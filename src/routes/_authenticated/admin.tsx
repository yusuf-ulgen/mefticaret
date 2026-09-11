import { Outlet, createFileRoute, isRedirect, redirect } from "@tanstack/react-router";

import { checkPlatformAdminAccess } from "@/lib/access-guard.functions";

/**
 * Süper admin bölümünün layout route'u.
 *
 * Tüm `/admin/*` sayfaları buradan geçer ve erişim sunucuda `platform_admin`
 * rolü ile doğrulanır. İstemci durumu (state, localStorage, cache) yetki
 * kaynağı olarak kullanılmaz; yetkisiz denemeler 403 sayfasına yönlenir ve
 * güvenlik kaydına yazılır.
 */
export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ location }) => {
    try {
      const result = await checkPlatformAdminAccess({ data: { route: location.pathname } });

      if (!result.allowed) throw redirect({ to: "/unauthorized" });
      return { platformAdmin: true as const };
    } catch (error) {
      if (isRedirect(error)) throw error;
      throw redirect({ to: "/unauthorized" });
    }
  },
  head: () => ({
    meta: [
      { title: "Süper Admin — Mefticaret" },
      {
        name: "description",
        content: "Platform genelinde mağazaları, paketleri, komisyonları ve denetim kayıtlarını yönet.",
      },
      { property: "og:title", content: "Süper Admin — Mefticaret" },
      { property: "og:description", content: "Çok kiracılı platformun merkezi yönetim konsolu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Outlet />,
});
