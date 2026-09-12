import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * `/admin/login` akışının sunucu uçları.
 *
 * Tek adım: panel şifresi (Supabase Auth'tan tamamen bağımsız).
 * Başarılı olursa 24 saatlik şifreli panel oturumu çerezi yazılır ve panelin
 * veri erişimi için tek kullanımlık Supabase devir token'ı döner.
 */

type Stage = "password" | "authenticated";

/** Panel oturumunun durumu; hiçbir gizli bilgi sızdırmaz. */
export const adminLoginState = createServerFn({ method: "GET" }).handler(async () => {
  const mod = await import("./admin-auth.server");
  const data = await mod.readAdminSession();
  const row = await mod.loadAdminAuthRow();

  const stage: Stage = mod.hasAdminPanelSession(data) ? "authenticated" : "password";

  return {
    stage,
    passwordConfigured: mod.panelPasswordConfigured(),
    accountReady: Boolean(row),
    locked: row ? mod.isLocked(row) : false,
    lockMinutes: mod.ADMIN_LOCK_MINUTES,
  };
});

/** Panel şifresi ile giriş. */
export const adminLoginPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ password: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const mod = await import("./admin-auth.server");

    // IP başına deneme sınırı: hesap kilidinin yanında kaba kuvvet denemelerini
    // farklı hesap/oturum denemelerinde de yavaşlatır.
    const { RATE_LIMITS, consumeRateLimit, clientIp } = await import("./rate-limit.server");
    let ip = "unknown";
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      ip = clientIp(getRequest());
    } catch {
      /* istek bağlamı yoksa varsayılan kova kullanılır */
    }
    const limit = await consumeRateLimit(`admin_login:${ip}`, RATE_LIMITS.admin_login);
    if (!limit.allowed) return { ok: false as const, error: "locked" as const };

    const row = await mod.loadAdminAuthRow();
    if (!row) return { ok: false as const, error: "not_configured" as const };
    if (mod.isLocked(row)) return { ok: false as const, error: "locked" as const };
    if (!mod.panelPasswordConfigured()) {
      return { ok: false as const, error: "not_configured" as const };
    }

    if (!mod.panelPasswordMatches(data.password)) {
      await mod.registerFailure(row, "password");
      return { ok: false as const, error: "invalid" as const };
    }

    // Yetki her zaman veritabanından doğrulanır.
    if (!(await mod.isPlatformAdminUser(row.user_id))) {
      await mod.registerFailure(row, "not_platform_admin");
      await mod.clearAdminSession();
      return { ok: false as const, error: "forbidden" as const };
    }

    const session = await mod.adminSession();
    await session.update({
      stage: "authenticated",
      userId: row.user_id,
      email: row.email,
      at: Date.now(),
    });
    await mod.registerSuccess(row);

    const tokenHash = await mod.mintSupabaseHandoff(row.email);
    return { ok: true as const, tokenHash, email: row.email };
  });

/** Panel oturumunu kapatır. */
export const adminLoginLogout = createServerFn({ method: "POST" }).handler(async () => {
  const mod = await import("./admin-auth.server");
  await mod.clearAdminSession();
  return { ok: true as const };
});

/**
 * `/admin/*` kapısı: ayrı panel oturumu zorunlu.
 *
 * Yetki, çerezdeki kullanıcı için her istekte veritabanından yeniden
 * doğrulanır; istemci durumu yetki kaynağı değildir.
 */
export const checkAdminPanelSession = createServerFn({ method: "POST" }).handler(async () => {
  const mod = await import("./admin-auth.server");
  const data = await mod.readAdminSession();
  if (!mod.hasAdminPanelSession(data) || !data.userId) return { allowed: false as const };
  const isAdmin = await mod.isPlatformAdminUser(data.userId);
  if (!isAdmin) {
    await mod.clearAdminSession();
    return { allowed: false as const };
  }
  return { allowed: true as const };
});
