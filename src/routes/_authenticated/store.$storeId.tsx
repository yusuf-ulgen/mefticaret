import { Outlet, createFileRoute, isRedirect, redirect } from "@tanstack/react-router";

import { checkStoreAccess } from "@/lib/access-guard.functions";

const accessCache = new Map<string, { result: Awaited<ReturnType<typeof checkStoreAccess>>; until: number }>();

/**
 * Mağaza panelinin kapısı.
 *
 * Alt tüm `/store/{storeId}/*` sayfaları buradan geçer. Erişim sunucuda
 * mağaza üyeliği (sahip / store_users) veya platform yöneticiliği ile
 * doğrulanır; URL'ye başka bir mağaza kimliği yazan kullanıcı 403 alır.
 */
export const Route = createFileRoute("/_authenticated/store/$storeId")({
  beforeLoad: async ({ params, location }) => {
    const expectedKind = location.pathname.includes("/kolay") ? "micro" : "corporate";
    const key = `${params.storeId}:${expectedKind}`;
    // Panel içi her tıklamada sunucuya gitmemek için onaylı erişim kısa süre
    // önbelleğe alınır; veri erişimi yine sunucu/RLS tarafından korunur.
    const cached = accessCache.get(key);
    if (cached && cached.until > Date.now()) return { storeAccess: cached.result };
    try {
      const result = await checkStoreAccess({
        data: { storeId: params.storeId, route: location.pathname, expectedKind },
      });

      if (!result.allowed) throw redirect({ to: "/unauthorized" });
      accessCache.set(key, { result, until: Date.now() + 120_000 });
      return { storeAccess: result };
    } catch (error) {
      if (isRedirect(error)) throw error;
      throw redirect({ to: "/unauthorized" });
    }
  },
  component: () => <Outlet />,
});
