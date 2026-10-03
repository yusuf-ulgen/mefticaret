import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { sendSmsCampaignFn, smsAudienceFn } from "@/lib/sms-marketing.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/sms-marketing")({
  head: () => ({
    meta: [
      { title: "SMS Pazarlama — Mefticaret" },
      { name: "description", content: "SMS izni veren müşterilerinize toplu SMS gönderin." },
      { property: "og:title", content: "SMS Pazarlama — Mefticaret" },
      { property: "og:description", content: "İzinli müşterilere toplu SMS kampanyası." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SmsPage,
});

const STATUS: Record<string, string> = { queued: "Bekliyor", sent: "Gönderildi", delivered: "Teslim edildi", read: "Okundu", failed: "Başarısız" };

function SmsPage() {
  const { storeId } = Route.useParams();
  const qc = useQueryClient();
  const audienceFn = useServerFn(smsAudienceFn);
  const sendFn = useServerFn(sendSmsCampaignFn);
  const [body, setBody] = useState("");
  const [stop, setStop] = useState(true);

  const audience = useQuery({ queryKey: ["sms-audience", storeId], queryFn: () => audienceFn({ data: { storeId } }) });
  const history = useQuery({
    queryKey: ["sms-history", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_deliveries")
        .select("id, recipient, body, status, error, created_at")
        .eq("store_id", storeId).eq("channel", "sms").eq("subject", "SMS Pazarlama")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const text = stop && body.trim() ? `${body.trim()} SMS almamak icin magazamiza RET yazin.` : body.trim();
  const parts = text.length <= 160 ? 1 : Math.ceil(text.length / 153);

  const send = useMutation({
    mutationFn: () => sendFn({ data: { storeId, body: text } }),
    onSuccess: (r) => {
      if (r.failed) toast.error(`${r.sent} gönderildi, ${r.failed} gönderilemedi: ${r.error ?? ""}`);
      else toast.success(`${r.sent} müşteriye SMS gönderildi`);
      setBody("");
      void qc.invalidateQueries({ queryKey: ["sms-history", storeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gönderilemedi"),
  });

  const a = audience.data;
  return (
    <AppShell storeId={storeId} title="SMS Pazarlama" description="Yalnız SMS izni veren ve abonelikten çıkmamış müşterilerinize gönderilir.">
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="text-sm">
            Alıcı: <b className="tabular-nums">{audience.isLoading ? "…" : a?.count ?? 0}</b> müşteri
            {a && a.count > a.max && <span className="text-muted-foreground"> (bir seferde en fazla {a.max})</span>}
          </div>
          {a && !a.providerReady && (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              SMS göndermek için önce <Link to="/store/$storeId/apps" params={{ storeId }} className="underline">Uygulamalar</Link>'dan Verimor SMS'i kurup bilgilerinizi girin.
            </p>
          )}
          <Textarea rows={5} maxLength={560} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Örn: Hafta sonuna özel tüm ürünlerde %20 indirim!" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={stop} onChange={(e) => setStop(e.target.checked)} />
            Sonuna "SMS almamak için RET yazın" ekle (ticari ileti kuralı)
          </label>
          <div className="text-xs text-muted-foreground tabular-nums">{text.length} karakter · {parts} SMS / kişi</div>
          <Button
            disabled={!body.trim() || !a?.providerReady || !a?.count || send.isPending}
            onClick={() => { if (confirm(`${Math.min(a!.count, a!.max)} müşteriye SMS gönderilsin mi?`)) send.mutate(); }}
          >
            {send.isPending ? "Gönderiliyor…" : "SMS gönder"}
          </Button>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="border-b p-3 text-sm font-medium">Son gönderimler</div>
          {history.isLoading ? <p className="p-3 text-sm text-muted-foreground">Yükleniyor…</p>
          : (history.data ?? []).length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Henüz SMS gönderilmedi.</p>
          : (
            <ul className="max-h-[480px] divide-y overflow-y-auto text-sm">
              {history.data!.map((h) => (
                <li key={h.id} className="p-3">
                  <div className="flex justify-between gap-2"><span className="tabular-nums">{h.recipient}</span><span className={h.status === "failed" ? "text-destructive" : "text-muted-foreground"}>{STATUS[h.status] ?? h.status}</span></div>
                  <div className="truncate text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("tr-TR")} · {h.body}</div>
                  {h.error && <div className="text-xs text-destructive">{h.error}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
