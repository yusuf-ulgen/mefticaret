import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, formatNumber } from "@/lib/mefti";
import { platformListQuery } from "@/lib/platform-admin-queries";
import { useAuth } from "@/lib/auth-context";
import {
  getUserAccountState,
  listAiCreditPackages,
  listChatReports,
  listPayoutRequests,
  saveAiCreditPackage,
  sendUserPasswordReset,
  setChatReportStatus,
  setPayoutRequestStatus,
  setUserSuspended,
} from "@/lib/admin-control.functions";

export const Route = createFileRoute("/_authenticated/admin/control")({
  head: () => ({
    meta: [
      { title: "Kontrol Merkezi — Süper Admin" },
      { name: "description", content: "Şikayetler, hesap askıya alma, şifre sıfırlama, ödeme talepleri ve AI kredi paketleri." },
      { property: "og:title", content: "Kontrol Merkezi — Süper Admin" },
      { property: "og:description", content: "Platformun tamamını tek yerden yönetin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ControlCenter,
});

function ControlCenter() {
  return (
    <AdminShell title="Kontrol Merkezi" description="Şikayetler, hesaplar, ödeme talepleri ve AI kredi paketleri. Her işlem denetim kaydına yazılır.">
      <Tabs defaultValue="reports">
        <TabsList className="flex-wrap">
          <TabsTrigger value="reports">Mesaj şikayetleri</TabsTrigger>
          <TabsTrigger value="accounts">Hesaplar</TabsTrigger>
          <TabsTrigger value="payouts">Ödeme talepleri</TabsTrigger>
          <TabsTrigger value="ai">AI kredi paketleri</TabsTrigger>
        </TabsList>
        <TabsContent value="reports"><Reports /></TabsContent>
        <TabsContent value="accounts"><Accounts /></TabsContent>
        <TabsContent value="payouts"><Payouts /></TabsContent>
        <TabsContent value="ai"><AiPackages /></TabsContent>
      </Tabs>
    </AdminShell>
  );
}

const REASONS: Record<string, string> = { spam: "Spam", abuse: "Taciz", fraud: "Dolandırıcılık", inappropriate: "Uygunsuz", other: "Diğer" };

function StatusPicker<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <Button key={v} size="sm" variant={v === value ? "default" : "outline"} onClick={() => onChange(v)}>{l}</Button>
      ))}
    </div>
  );
}

function Reports() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"open" | "reviewed" | "dismissed">("open");
  const list = useServerFn(listChatReports);
  const save = useServerFn(setChatReportStatus);
  const suspend = useServerFn(setUserSuspended);
  const q = useQuery({ queryKey: ["ctl-reports", status], queryFn: () => list({ data: { status } }) });
  const m = useMutation({
    mutationFn: (v: { id: string; status: "reviewed" | "dismissed" | "open" }) => save({ data: v }),
    onSuccess: () => { toast.success("Şikayet güncellendi"); qc.invalidateQueries({ queryKey: ["ctl-reports"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const ban = useMutation({
    mutationFn: (userId: string) => suspend({ data: { userId, suspend: true } }),
    onSuccess: () => toast.success("Hesap askıya alındı"),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-4 pt-4">
      <StatusPicker value={status} onChange={setStatus} options={[["open", "Açık"], ["reviewed", "İncelendi"], ["dismissed", "Reddedildi"]]} />
      {q.isLoading && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data?.length === 0 && <p className="text-sm text-muted-foreground">Bu durumda şikayet yok.</p>}
      {q.data?.map((r: any) => (
        <div key={r.id} className="surface-card space-y-2 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{REASONS[r.reason] ?? r.reason}</Badge>
            <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
          </div>
          <p><span className="text-muted-foreground">Şikayet eden:</span> {r.reporter}</p>
          <p><span className="text-muted-foreground">Şikayet edilen:</span> {r.reported}</p>
          {r.message_snapshot && <p className="rounded-md bg-muted p-2">“{r.message_snapshot}”</p>}
          {r.note && <p className="text-muted-foreground">Not: {r.note}</p>}
          <div className="flex flex-wrap gap-2">
            {status !== "reviewed" && <Button size="sm" onClick={() => m.mutate({ id: r.id, status: "reviewed" })}>İncelendi</Button>}
            {status !== "dismissed" && <Button size="sm" variant="outline" onClick={() => m.mutate({ id: r.id, status: "dismissed" })}>Reddet</Button>}
            {r.reported_user_id && (
              <Button size="sm" variant="destructive" disabled={ban.isPending} onClick={() => confirm("Bu hesap askıya alınsın mı?") && ban.mutate(r.reported_user_id)}>
                Hesabı askıya al
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AccountRow({ row }: { row: Record<string, unknown> }) {
  const userId = String(row["id"]);
  const qc = useQueryClient();
  const get = useServerFn(getUserAccountState);
  const suspend = useServerFn(setUserSuspended);
  const reset = useServerFn(sendUserPasswordReset);
  const state = useQuery({ queryKey: ["ctl-acc", userId], queryFn: () => get({ data: { userId } }) });
  const banned = Boolean(state.data?.bannedUntil && new Date(state.data.bannedUntil) > new Date());
  const s = useMutation({
    mutationFn: (v: boolean) => suspend({ data: { userId, suspend: v } }),
    onSuccess: () => { toast.success("Hesap durumu güncellendi"); qc.invalidateQueries({ queryKey: ["ctl-acc", userId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const r = useMutation({
    mutationFn: () => reset({ data: { userId, origin: window.location.origin } }),
    onSuccess: (d) => toast.success(`Şifre sıfırlama e-postası gönderildi: ${d.email}`),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-medium">{String(row["full_name"] ?? "İsimsiz")}</p>
        <p className="text-xs text-muted-foreground">{String(row["email"] ?? "—")}</p>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {state.data?.lastSignIn ? formatDateTime(state.data.lastSignIn) : "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Switch checked={banned} disabled={state.isLoading || s.isPending} aria-label="Askıya al" onCheckedChange={(v) => s.mutate(v)} />
          {banned ? <Badge variant="destructive">Askıda</Badge> : <Badge variant="secondary">Aktif</Badge>}
        </div>
      </td>
      <td className="px-4 py-3">
        <Button size="sm" variant="outline" disabled={r.isPending} onClick={() => r.mutate()}>Şifre sıfırlama gönder</Button>
      </td>
    </tr>
  );
}

function Accounts() {
  const { isPlatformAdmin } = useAuth();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const users = useQuery(platformListQuery("users", search, isPlatformAdmin));
  const rows = users.data?.rows ?? [];
  return (
    <div className="space-y-4 pt-4">
      <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); setSearch(term.trim()); }}>
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="E-posta, ad veya telefon" className="h-9 w-full sm:w-72" aria-label="Kullanıcı ara" />
        <Button type="submit" size="sm" variant="outline">Ara</Button>
        <Badge variant="secondary">{formatNumber(rows.length)} kullanıcı</Badge>
      </form>
      <p className="text-xs text-muted-foreground">Askıya alınan hesap giriş yapamaz. Roller için "Kullanıcılar" sayfasını kullanın.</p>
      <div className="surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-3">Kullanıcı</th><th className="px-4 py-3">Son giriş</th><th className="px-4 py-3">Askıya al</th><th className="px-4 py-3">Şifre</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.slice(0, 50).map((row) => <AccountRow key={String(row["id"])} row={row} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Payouts() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending" | "approved" | "paid" | "rejected">("pending");
  const list = useServerFn(listPayoutRequests);
  const save = useServerFn(setPayoutRequestStatus);
  const q = useQuery({ queryKey: ["ctl-payouts", status], queryFn: () => list({ data: { status } }) });
  const m = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "paid" | "rejected"; note?: string }) => save({ data: v }),
    onSuccess: () => { toast.success("Talep güncellendi"); qc.invalidateQueries({ queryKey: ["ctl-payouts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-4 pt-4">
      <StatusPicker value={status} onChange={setStatus} options={[["pending", "Bekleyen"], ["approved", "Onaylı"], ["paid", "Ödendi"], ["rejected", "Reddedildi"]]} />
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data?.length === 0 && <p className="text-sm text-muted-foreground">Bu durumda talep yok.</p>}
      {q.data?.map((p: any) => (
        <div key={p.id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div>
            <p className="font-medium">{p.stores?.name ?? "Mağaza"} · {formatNumber(Number(p.amount))} {p.currency}</p>
            <p className="text-xs text-muted-foreground">{p.account_holder ?? "—"} · {p.iban ?? "IBAN yok"} · {formatDateTime(p.created_at)}</p>
            {p.note && <p className="text-xs text-muted-foreground">Not: {p.note}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "pending" && <Button size="sm" onClick={() => m.mutate({ id: p.id, status: "approved" })}>Onayla</Button>}
            {(status === "pending" || status === "approved") && <Button size="sm" variant="outline" onClick={() => m.mutate({ id: p.id, status: "paid" })}>Ödendi işaretle</Button>}
            {status !== "rejected" && status !== "paid" && (
              <Button size="sm" variant="destructive" onClick={() => { const note = prompt("Red sebebi (isteğe bağlı)") ?? undefined; m.mutate({ id: p.id, status: "rejected", note: note || undefined }); }}>Reddet</Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

type Pkg = { id?: string; code: string; name: string; credits: number; price: number; currency: string; description: string | null; is_active: boolean; sort_order: number };
const EMPTY: Pkg = { code: "", name: "", credits: 100, price: 0, currency: "TRY", description: "", is_active: true, sort_order: 0 };

function PackageForm({ initial, onDone }: { initial: Pkg; onDone: () => void }) {
  const [p, setP] = useState<Pkg>(initial);
  const save = useServerFn(saveAiCreditPackage);
  const m = useMutation({
    mutationFn: () => save({ data: { ...p, credits: Number(p.credits), price: Number(p.price), sort_order: Number(p.sort_order) } }),
    onSuccess: () => { toast.success("Paket kaydedildi"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const f = (k: keyof Pkg) => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: e.target.value });
  return (
    <div className="surface-card grid gap-2 p-4 text-sm sm:grid-cols-4">
      <Input placeholder="Kod (ör. baslangic)" value={p.code} onChange={f("code")} aria-label="Kod" />
      <Input placeholder="Ad" value={p.name} onChange={f("name")} aria-label="Ad" />
      <Input type="number" placeholder="Kredi" value={p.credits} onChange={f("credits")} aria-label="Kredi" />
      <Input type="number" placeholder="Fiyat" value={p.price} onChange={f("price")} aria-label="Fiyat" />
      <Input placeholder="Para birimi" value={p.currency} maxLength={3} onChange={(e) => setP({ ...p, currency: e.target.value.toUpperCase() })} aria-label="Para birimi" />
      <Input type="number" placeholder="Sıra" value={p.sort_order} onChange={f("sort_order")} aria-label="Sıra" />
      <Input className="sm:col-span-2" placeholder="Açıklama" value={p.description ?? ""} onChange={f("description")} aria-label="Açıklama" />
      <label className="flex items-center gap-2"><Switch checked={p.is_active} onCheckedChange={(v) => setP({ ...p, is_active: v })} /> Satışta</label>
      <div className="sm:col-span-3 flex justify-end"><Button size="sm" disabled={m.isPending} onClick={() => m.mutate()}>Kaydet</Button></div>
    </div>
  );
}

function AiPackages() {
  const qc = useQueryClient();
  const list = useServerFn(listAiCreditPackages);
  const q = useQuery({ queryKey: ["ctl-ai-pkgs"], queryFn: () => list() });
  const [adding, setAdding] = useState(false);
  const refresh = () => { setAdding(false); qc.invalidateQueries({ queryKey: ["ctl-ai-pkgs"] }); };
  return (
    <div className="space-y-3 pt-4">
      <div className="flex justify-end"><Button size="sm" onClick={() => setAdding(true)}>Yeni paket</Button></div>
      {adding && <PackageForm initial={EMPTY} onDone={refresh} />}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data?.map((p: any) => <PackageForm key={p.id + p.updated_at} initial={p} onDone={refresh} />)}
    </div>
  );
}
