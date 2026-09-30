import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Ban, KeyRound, Loader2, ShieldCheck, Store } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { sendUserPasswordReset, setUserSuspended } from "@/lib/admin-control.functions";
import { getAdminUserDetail } from "@/lib/admin-insights.functions";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/mefti";
import { setPlatformUserRole } from "@/lib/platform-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/user/$userId")({
  head: () => ({
    meta: [
      { title: "Kullanıcı Detayı — Süper Admin" },
      { name: "description", content: "Kullanıcının hesabı, rolleri, mağazaları ve işlem geçmişi tek ekranda." },
      { property: "og:title", content: "Kullanıcı Detayı — Süper Admin" },
      { property: "og:description", content: "Kullanıcı 360° görünümü." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UserDetail,
});

const ROLES = ["platform_admin", "agency", "seller", "customer"] as const;
const ROLE_LABELS: Record<string, string> = {
  platform_admin: "Platform yöneticisi",
  agency: "Ajans",
  seller: "Satıcı",
  customer: "Müşteri",
};

function UserDetail() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getAdminUserDetail);
  const suspendFn = useServerFn(setUserSuspended);
  const resetFn = useServerFn(sendUserPasswordReset);
  const roleFn = useServerFn(setPlatformUserRole);

  const q = useQuery({ queryKey: ["admin-user", userId], queryFn: () => fetchDetail({ data: { userId } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-user", userId] });

  const suspend = useMutation({
    mutationFn: (s: boolean) => suspendFn({ data: { userId, suspend: s } }),
    onSuccess: (_d, s) => { toast.success(s ? "Hesap askıya alındı" : "Askı kaldırıldı"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reset = useMutation({
    mutationFn: () => resetFn({ data: { userId, origin: window.location.origin } }),
    onSuccess: (r) => toast.success(`Şifre sıfırlama bağlantısı gönderildi: ${r.email}`),
    onError: (e: Error) => toast.error(e.message),
  });
  const role = useMutation({
    mutationFn: (i: { role: (typeof ROLES)[number]; grant: boolean }) => roleFn({ data: { userId, ...i } }),
    onSuccess: () => { toast.success("Rol güncellendi"); refresh(); qc.invalidateQueries({ queryKey: ["platform-roles"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const back = (
    <Button asChild size="sm" variant="outline">
      <Link to="/admin/users"><ArrowLeft className="size-4" />Kullanıcılar</Link>
    </Button>
  );

  if (q.isLoading) {
    return <AdminShell title="Kullanıcı" actions={back}><div className="surface-card grid place-items-center p-10"><Loader2 className="size-5 animate-spin" /></div></AdminShell>;
  }
  if (q.isError || !q.data) {
    return (
      <AdminShell title="Kullanıcı" actions={back}>
        <div className="surface-card p-6 text-sm">
          <p className="text-destructive">Kullanıcı bilgileri alınamadı: {(q.error as Error | null)?.message}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => q.refetch()}>Yeniden dene</Button>
        </div>
      </AdminShell>
    );
  }

  const d = q.data;
  const banned = d.account.bannedUntil && new Date(d.account.bannedUntil) > new Date();

  return (
    <AdminShell title={d.profile.full_name || d.profile.email || "Kullanıcı"} description={d.profile.email ?? ""} actions={back}>
      <section className="surface-card flex flex-wrap items-center gap-3 p-5">
        {banned ? <Badge variant="destructive">Askıda</Badge> : <Badge variant="secondary">Aktif</Badge>}
        {d.account.emailConfirmed ? <Badge variant="outline">E-posta doğrulandı</Badge> : <Badge variant="outline">E-posta doğrulanmadı</Badge>}
        {d.roles.map((r: string) => <Badge key={r} className="gap-1"><ShieldCheck className="size-3" />{ROLE_LABELS[r] ?? r}</Badge>)}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={reset.isPending} onClick={() => reset.mutate()}>
            <KeyRound className="size-4" />Şifre sıfırlama gönder
          </Button>
          <Button size="sm" variant={banned ? "outline" : "destructive"} disabled={suspend.isPending}
            onClick={() => { if (banned || confirm("Bu hesap askıya alınsın mı? Kullanıcı giriş yapamaz.")) suspend.mutate(!banned); }}>
            <Ban className="size-4" />{banned ? "Askıyı kaldır" : "Askıya al"}
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Kayıt" value={formatDateTime(d.profile.created_at)} />
        <Stat label="Son giriş" value={d.account.lastSignIn ? formatDateTime(d.account.lastSignIn) : "—"} />
        <Stat label="Mağaza siparişi (ödenmiş)" value={formatNumber(d.stats.orderCount)} />
        <Stat label="Mağaza cirosu" value={formatMoney(d.stats.revenue)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="surface-card p-5">
          <h2 className="font-display text-base font-semibold">Hesap bilgileri</h2>
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Telefon</dt><dd>{d.profile.phone || "—"}</dd>
            <dt className="text-muted-foreground">Dil</dt><dd>{d.profile.locale}</dd>
            <dt className="text-muted-foreground">Giriş yöntemi</dt><dd>{d.account.providers || "—"}</dd>
            <dt className="text-muted-foreground">Kimlik</dt><dd className="truncate font-mono text-xs">{d.profile.id}</dd>
          </dl>
          <h3 className="mt-5 text-sm font-semibold">Platform rolleri</h3>
          <ul className="mt-2 space-y-2">
            {ROLES.map((r) => (
              <li key={r} className="flex items-center justify-between text-sm">
                {ROLE_LABELS[r]}
                <Switch checked={d.roles.includes(r)} disabled={role.isPending}
                  aria-label={ROLE_LABELS[r]} onCheckedChange={(c) => role.mutate({ role: r, grant: c })} />
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-card p-5">
          <h2 className="font-display text-base font-semibold">Mağazaları</h2>
          {d.ownedStores.length === 0 && d.memberships.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Bu kullanıcının mağazası yok.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {d.ownedStores.map((s) => <StoreRow key={s.id} store={s} role="Sahip" />)}
              {d.memberships.map((m: { role: string; store: { id: string; name: string; slug: string; status: string } }) => <StoreRow key={m.store.id + m.role} store={m.store} role={m.role} />)}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="surface-card p-5">
          <h2 className="font-display text-base font-semibold">İşlem geçmişi</h2>
          {d.audit.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Kayıt yok.</p> : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {d.audit.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{a.action}</span>
                    <span className="text-xs text-muted-foreground"> · {a.actor_id === userId ? "kendisi" : "yönetici"}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="surface-card p-5">
          <h2 className="font-display text-base font-semibold">Karşılaştığı hatalar</h2>
          {d.errors.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Kayıtlı hata yok.</p> : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {d.errors.map((e) => (
                <li key={e.id} className="py-2">
                  <p className="truncate font-medium">{e.message}</p>
                  <p className="text-xs text-muted-foreground">{e.severity} · {e.occurrences} kez · {formatDateTime(e.last_seen_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base font-semibold">{value}</p>
    </div>
  );
}

function StoreRow({ store, role }: { store: { id: string; name: string; slug: string; status: string }; role: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <Link to="/admin/store/$storeId" params={{ storeId: store.id }} className="flex min-w-0 items-center gap-2 hover:underline">
        <Store className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{store.name}</span>
      </Link>
      <span className="flex shrink-0 gap-1">
        <Badge variant="outline">{role}</Badge>
        <Badge variant={store.status === "active" ? "secondary" : "outline"}>{store.status}</Badge>
      </span>
    </li>
  );
}
