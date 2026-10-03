import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app-shell";
import { StoreSummary } from "@/components/store-summary";
import { Badge } from "@/components/ui/badge";
import { STORE_STATUS_LABELS } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/dashboard")({
  head: () => ({
    meta: [
      { title: "Mağaza Paneli — Mefticaret" },
      { name: "description", content: "Ciro, sipariş, ziyaretçi ve dönüşüm metriklerini tek ekranda izle." },
      { property: "og:title", content: "Mağaza Paneli — Mefticaret" },
      { property: "og:description", content: "Mağaza özeti, Copilot ve kısayollar tek ekranda." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { storeId } = Route.useParams();
  const { data: store } = useQuery(storeQuery(storeId));
  return (
    <AppShell
      storeId={storeId}
      title={store?.name ?? "Mağaza paneli"}
      actions={
        store ? (
          <Badge variant={store.status === "active" ? "default" : "secondary"}>
            {STORE_STATUS_LABELS[store.status] ?? store.status}
          </Badge>
        ) : null
      }
    >
      <StoreSummary storeId={storeId} />
    </AppShell>
  );
}
