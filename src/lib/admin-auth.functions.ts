import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * `/admin/login` akışının sunucu uçları.
 *
 * Adım 1: panel şifresi (Supabase Auth'tan tamamen bağımsız).
 * Adım 2: TOTP kodu (ilk girişte kurulum anahtarı bir kez gösterilir).
 * Başarılı olursa 24 saatlik şifreli panel oturumu çerezi yazılır ve panelin
 * veri erişimi için tek kullanımlık Supabase devir token'ı döner.
 */

type Stage = "password" | "code" | "authenticated";

/** Panel oturumunun durumu; hiçbir gizli bilgi sızdırmaz. */
export const adminLoginState = createServerFn({ method: "GET" }).handler(async () => {
  const mod = await import("./admin-auth.server");
  const data = await mod.readAdminSession();
  const row = await mod.loadAdminAuthRow();

  let stage: Stage = "password";
  if (mod.hasAdminPanelSession(data)) stage = "authenticated";
  else if (mod.challengeIsFresh(data)) stage = "code";

  return {
    stage,
    passwordConfigured: mod.panelPasswordConfigured(),
    accountReady: Boolean(row),
    locked: row ? mod.isLocked(row) : false,
    lockMinutes: mod.ADMIN_LOCK_MINUTES,
  };
});

/** Adım 1 — panel şifresi. */
export const adminLoginPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ password: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const mod = await import("./admin-auth.server");
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

    const needsEnrollment = !row.totp_secret;
    const secret = needsEnrollment ? mod.generateTotpSecret() : null;

    const session = await mod.adminSession();
    await session.update({
      stage: "password",
      userId: row.user_id,
      email: row.email,
      at: Date.now(),
      ...(secret ? { pendingSecret: secret } : {}),
    });

    return {
      ok: true as const,
      needsEnrollment,
      // Kurulum anahtarı yalnızca ilk kurulumda ve şifre doğrulandıktan sonra döner.
      setupSecret: secret,
      setupUri: secret ? mod.otpauthUri(row.email, secret) : null,
    };
  });

/** Adım 2 — tek kullanımlık kod. */
export const adminLoginCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ code: z.string().min(6).max(10) }).parse(input))
  .handler(async ({ data }) => {
    const mod = await import("./admin-auth.server");
    const session = await mod.adminSession();
    const current = session.data;
    if (!mod.challengeIsFresh(current)) {
      return { ok: false as const, error: "expired" as const };
    }

    const row = await mod.loadAdminAuthRow();
    if (!row) return { ok: false as const, error: "not_configured" as const };
    if (mod.isLocked(row)) return { ok: false as const, error: "locked" as const };

    const pending = (current as { pendingSecret?: string }).pendingSecret ?? null;
    const secret = row.totp_secret ?? pending;
    if (!secret) return { ok: false as const, error: "not_configured" as const };

    if (!mod.verifyTotp(secret, data.code)) {
      await mod.registerFailure(row, "totp");
      return { ok: false as const, error: "invalid" as const };
    }

    // Yetki her zaman veritabanından doğrulanır.
    if (!(await mod.isPlatformAdminUser(row.user_id))) {
      await mod.registerFailure(row, "not_platform_admin");
      await session.clear();
      return { ok: false as const, error: "forbidden" as const };
    }

    if (!row.totp_secret && pending) await mod.enrollTotpSecret(row, pending);

    await session.update({
      stage: "authenticated",
      userId: row.user_id,
      email: row.email,
      at: Date.now(),
      pendingSecret: undefined,
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

/** `/admin/*` kapısı: ayrı panel oturumu zorunlu. */
export const checkAdminPanelSession = createServerFn({ method: "POST" }).handler(async () => {
  const mod = await import("./admin-auth.server");
  const data = await mod.readAdminSession();
  return { allowed: mod.hasAdminPanelSession(data) };
});
