import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { platformEmailOverview, sendPlatformSellerCampaign } from "@/lib/platform-email.functions";

export const Route = createFileRoute("/_authenticated/admin/email-marketing")({
  head: () => ({
    meta: [
      { title: "E-posta Pazarlama — Süper Admin" },
      { name: "description", content: "Satıcılara platform kampanyası gönderin ve mağazaların e-posta pazarlamasını yönetin." },
      { property: "og:title", content: "E-posta Pazarlama — Süper Admin" },
      { property: "og:description", content: "Mefticaret'in kendi e-posta pazarlama sistemi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminEmailMarketing,
});

function AdminEmailMarketing() {
  const overviewFn = useServerFn(platformEmailOverview);
  const sendFn = useServerFn(sendPlatformSellerCampaign);
  const q = useQuery({ queryKey: ["admin-email-marketing"], queryFn: () => overviewFn() });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [filter, setFilter] = useState("");

  const send = useMutation({
    mutationFn: (test: boolean) =>
      sendFn({ data: test ? { subject, body, testEmail: testEmail.trim() } : { subject, body } }),
    onSuccess: (r) => {
      if (r.failed) toast.error(`${r.sent} gönderildi, ${r.failed} gönderilemedi: ${r.error ?? ""}`);
      else toast.success(`${r.sent} kişiye gönderildi${r.skipped ? `, ${r.skipped} abonelikten çıkmış` : ""}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gönderilemedi"),
  });

  const d = q.data;
  const ready = subject.trim().length >= 3 && body.trim().length >= 10 && !send.isPending;
  const stores = (d?.stores ?? []).filter((s) => s.name.toLocaleLowerCase("tr").includes(filter.toLocaleLowerCase("tr")));

  return (
    <AdminShell title="E-posta Pazarlama" description="Mefticaret'in kendi e-posta sistemiyle satıcılara kampanya gönderin, mağazaların kampanyalarını yönetin.">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface-card space-y-3 p-5">
          <div>
            <h2 className="font-semibold">Satıcılara kampanya</h2>
            <p className="text-sm text-muted-foreground">
              Alıcı: <b className="tabular-nums">{q.isLoading ? "…" : d?.sellerCount ?? 0}</b> doğrulanmış mağaza sahibi
              {d && d.sellerCount > d.max ? ` (bir seferde en fazla ${d.max})` : ""}. Metinde {"{magaza}"} mağaza adıyla değişir.
            </p>
          </div>
          <Input placeholder="Konu" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Konu" />
          <Textarea rows={10} placeholder="Merhaba {magaza} ekibi, …" value={body} onChange={(e) => setBody(e.target.value)} aria-label="İçerik" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="email" placeholder="Test e-postası" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} aria-label="Test e-postası" />
            <Button variant="outline" disabled={!ready || !testEmail.includes("@")} onClick={() => send.mutate(true)}>
              Test gönder
            </Button>
          </div>
          <Button
            disabled={!ready || !d?.sellerCount}
            onClick={() => { if (confirm(`${Math.min(d!.sellerCount, d!.max)} satıcıya gönderilsin mi?`)) send.mutate(false); }}
          >
            {send.isPending ? "Gönderiliyor…" : "Tüm satıcılara gönder"}
          </Button>
        </section>

        <section className="surface-card p-5">
          <h2 className="font-semibold">Mağazaların e-posta pazarlaması</h2>
          <p className="mb-3 text-sm text-muted-foreground">Bir mağazayı açıp onun adına kampanya, tasarım ve abone listesini yönetin.</p>
          <Input placeholder="Mağaza ara" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Mağaza ara" className="mb-3" />
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : (
            <ul className="max-h-[480px] divide-y divide-border overflow-y-auto text-sm">
              {stores.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate font-medium">{s.name}</span>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/store/$storeId/email-marketing" params={{ storeId: s.id }}>Yönet</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
