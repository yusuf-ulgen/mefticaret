import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

/**
 * Eski yalnızca-şifre giriş ucu kaldırıldı.
 *
 * Süper yönetici girişi artık normal Supabase e-posta/şifre girişinden sonra
 * `openAdminPanelSession` ile açılır; ikinci faktör atlanabilen paylaşımlı
 * panel şifresi akışı bulunmuyor.
 */

/**
 * Normal e-posta/şifre girişinden sonra çağrılır.
 *
 * Kullanıcının `platform_admin` rolü veritabanından doğrulanır; yalnızca gerçek
 * platform yöneticileri için panel oturumu açılır. Diğer tüm kullanıcılar için
 * `allowed: false` döner ve hiçbir çerez yazılmaz.
 */
export const openAdminPanelSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const mod = await import("./admin-auth.server");
    const userId = context.userId;
    if (!userId) return { allowed: false as const };

    if (!(await mod.isPlatformAdminUser(userId))) {
      await mod.clearAdminSession();
      return { allowed: false as const };
    }

    const session = await mod.adminSession();
    await session.update({
      stage: "authenticated",
      userId,
      email: (context.claims as { email?: string } | undefined)?.email ?? "",
      at: Date.now(),
    });
    return { allowed: true as const };
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
