import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { LoadTestMonitor } from "@/components/monitoring/load-test-monitor";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin/load-test")({
  head: () => ({
    meta: [
      { title: "Yük Testi Monitörü — Süper Admin" },
      {
        name: "description",
        content:
          "Otomatik 3 saatlik stres testi turları, veri tohumlama, sipariş simülasyonu ve bütünlük bulguları tek ekranda.",
      },
      { property: "og:title", content: "Yük Testi Monitörü — Süper Admin" },
      {
        property: "og:description",
        content: "Mefticaret otomatik stres testi ve dayanıklılık orkestratörü paneli.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminLoadTestPage,
});

function AdminLoadTestPage() {
  const { isPlatformAdmin } = useAuth();
  return (
    <AdminShell
      title="Yük Testi Monitörü"
      description="Otomatik sıfırlama, veri tohumlama, trafik simülasyonu ve mutabakat doğrulaması."
    >
      <LoadTestMonitor enabled={isPlatformAdmin} />
    </AdminShell>
  );
}
