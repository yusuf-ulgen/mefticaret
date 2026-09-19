import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { FraudShieldPanel } from "@/components/innovation/fraud-shield-panel";
import { GreenCheckoutPanel } from "@/components/innovation/green-checkout-panel";
import { LiveCommercePanel } from "@/components/innovation/live-commerce-panel";
import { SmartPaymentPanel } from "@/components/innovation/smart-payment-panel";
import { SocialArPanel } from "@/components/innovation/social-ar-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInnovationDashboard } from "@/lib/innovation.functions";
import { formatMoney } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/innovation")({
  head: () => ({
    meta: [
      { title: "Yenilik & Akıllı Ödeme Merkezi — Mefticaret" },
      {
        name: "description",
        content:
          "Canlı satış yayını, kısa video vitrini, müşteri içerikleri, 3B ürün görüntüleme, akıllı POS yönlendirme, karbon dengeleme ve sahtecilik kalkanı tek panelde.",
      },
      { property: "og:title", content: "Yenilik & Akıllı Ödeme Merkezi — Mefticaret" },
      {
        property: "og:description",
        content: "Canlı satış, kısa video, akıllı POS yönlendirme, yeşil kasa ve sahtecilik kalkanı.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InnovationPage,
});

type Dashboard = {
  videos: { total: number; active: number; views: number; clicks: number };
  ugc: { total: number; approved: number; pending: number; likes: number };
  pos: { decisions: number; savings: number; feesPaid: number; currency: string };
  fraud: { total: number; high: number; medium: number; pending: number; blocked: number };
  addons: { kind: string; amount: number }[];
};

function InnovationPage() {
  const { storeId } = Route.useParams();
  const { data: store } = useQuery(storeQuery(storeId));
  const currency = (store as unknown as { currency?: string } | undefined)?.currency ?? "TRY";

  const dashboard = useServerFn(getInnovationDashboard);
  const [summary, setSummary] = useState<Dashboard | null>(null);

  const summaryMutation = useMutation({
    mutationFn: async () => dashboard({ data: { storeId, days: 90 } as never }),
    onSuccess: (result) => setSummary(result as unknown as Dashboard),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      storeId={storeId}
      title="Yenilik & Akıllı Ödeme"
      description="Canlı satış, kısa video, müşteri içerikleri, 3B ürün, akıllı POS, yeşil kasa ve sahtecilik kalkanı."
      actions={
        <Button variant="outline" disabled={summaryMutation.isPending} onClick={() => summaryMutation.mutate()}>
          Panoyu yenile
        </Button>
      }
    >
      <div className="space-y-6">

        {summary ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Kısa video görüntüleme</p>
              <p className="text-xl font-semibold">{summary.videos.views}</p>
              <p className="text-xs text-muted-foreground">{summary.videos.active} aktif video</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Müşteri içeriği</p>
              <p className="text-xl font-semibold">{summary.ugc.approved}</p>
              <p className="text-xs text-muted-foreground">{summary.ugc.pending} onay bekliyor</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">POS komisyon tasarrufu</p>
              <p className="text-xl font-semibold">{formatMoney(summary.pos.savings, summary.pos.currency)}</p>
              <p className="text-xs text-muted-foreground">{summary.pos.decisions} yönlendirme</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Yüksek riskli sipariş</p>
              <p className="text-xl font-semibold">{summary.fraud.high}</p>
              <p className="text-xs text-muted-foreground">{summary.fraud.pending} inceleme bekliyor</p>
            </div>
          </div>
        ) : null}

        <Tabs defaultValue="live">
          <TabsList className="flex-wrap">
            <TabsTrigger value="live">Canlı Satış & Video</TabsTrigger>
            <TabsTrigger value="social">İçerik & 3B</TabsTrigger>
            <TabsTrigger value="pos">Akıllı POS</TabsTrigger>
            <TabsTrigger value="green">Yeşil Kasa & Ek Hizmet</TabsTrigger>
            <TabsTrigger value="fraud">Sahtecilik Kalkanı</TabsTrigger>
          </TabsList>
          <TabsContent value="live" className="pt-4">
            <LiveCommercePanel storeId={storeId} />
          </TabsContent>
          <TabsContent value="social" className="pt-4">
            <SocialArPanel storeId={storeId} />
          </TabsContent>
          <TabsContent value="pos" className="pt-4">
            <SmartPaymentPanel storeId={storeId} currency={currency} />
          </TabsContent>
          <TabsContent value="green" className="pt-4">
            <GreenCheckoutPanel storeId={storeId} currency={currency} />
          </TabsContent>
          <TabsContent value="fraud" className="pt-4">
            <FraudShieldPanel storeId={storeId} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
