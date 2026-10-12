import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { APP_ROLE_LABELS, STORE_ROLE_LABELS, formatDateTime } from "@/lib/mefti";
import { storeAccessQuery } from "@/lib/platform-admin-queries";
import {
  addStoreMemberFn,
  removeStoreMemberFn,
  setStoreMemberRoleFn,
  setStoreOwnerFn,
} from "@/lib/platform-admin.functions";
import { adminStoresQuery } from "@/lib/store-queries";

const DESCRIPTION =
  "Mağaza ekiplerinin rollerini ve izinlerini süper yönetici olarak yönet, mağaza sahipliğini devret.";

const STORE_ROLES = ["owner", "admin", "staff", "marketing", "support"] as const;
type StoreRole = (typeof STORE_ROLES)[number];

/** Rol bazlı yetki özeti; mağaza panelinde bu seviyeler uygulanır. */
const ROLE_SCOPES: Record<StoreRole, string> = {
  owner: "Tüm ayarlar, faturalama, ekip ve mağaza silme",
  admin: "Katalog, sipariş, müşteri ve ayarların tamamı (faturalama hariç)",
  staff: "Sipariş ve stok işlemleri",
  marketing: "Kampanya, indirim, içerik ve SEO",
  support: "Müşteri, sipariş görüntüleme ve destek talepleri",
};

export const Route = createFileRoute("/_authenticated/admin/store-access")({
  head: () => ({
    meta: [
      { title: "Mağaza Yetkilendirme — Süper Admin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Mağaza Yetkilendirme — Süper Admin" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminStoreAccessPage,
});

function AdminStoreAccessPage() {
  const { isPlatformAdmin } = useAuth();
  const queryClient = useQueryClient();
  const stores = useQuery(adminStoresQuery(isPlatformAdmin));
  const [storeId, setStoreId] = useState("");

  const storeRows = useMemo(
    () => ((stores.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row["id"]),
      name: String(row["name"] ?? "Mağaza"),
      slug: String(row["slug"] ?? ""),
    })),
    [stores.data],
  );

  useEffect(() => {
    if (!storeId && storeRows[0]) setStoreId(storeRows[0].id);
  }, [storeId, storeRows]);

  const access = useQuery(storeAccessQuery(storeId));

  const addMember = useServerFn(addStoreMemberFn);
  const setRole = useServerFn(setStoreMemberRoleFn);
  const removeMember = useServerFn(removeStoreMemberFn);
  const setOwner = useServerFn(setStoreOwnerFn);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["platform-store-access", storeId] });
    queryClient.invalidateQueries({ queryKey: ["admin-stores"] });
  };

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<StoreRole>("staff");

  const inviteMutation = useMutation({
    mutationFn: () => addMember({ data: { storeId, email: email.trim(), role: inviteRole, permissions: [] } }),
    onSuccess: () => {
      toast.success("Ekip üyesi eklendi");
      setEmail("");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const roleMutation = useMutation({
    mutationFn: (input: { userId: string; role: StoreRole }) => setRole({ data: { storeId, ...input } }),
    onSuccess: () => {
      toast.success("Yetki seviyesi güncellendi");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember({ data: { storeId, userId } }),
    onSuccess: () => {
      toast.success("Üye mağazadan çıkarıldı");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ownerMutation = useMutation({
    mutationFn: (userId: string) => setOwner({ data: { storeId, userId } }),
    onSuccess: () => {
      toast.success("Mağaza sahipliği devredildi");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const busy =
    inviteMutation.isPending || roleMutation.isPending || removeMutation.isPending || ownerMutation.isPending;
  const data = access.data;

  return (
    <AdminShell title="Mağaza Yetkilendirme" description={DESCRIPTION}>
      <div className="space-y-6">
        <div className="surface-card flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-56 space-y-1">
            <Label htmlFor="store-select">Mağaza</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger id="store-select" className="h-9">
                <SelectValue placeholder="Mağaza seç" />
              </SelectTrigger>
              <SelectContent>
                {storeRows.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {data ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">
                Sahip: {data.owner.fullName ?? data.owner.email ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.owner.email ?? "E-posta yok"} ·{" "}
                {data.owner.platformRoles.length
                  ? data.owner.platformRoles.map((role) => APP_ROLE_LABELS[role] ?? role).join(", ")
                  : "Platform rolü yok"}
              </p>
            </div>
          ) : null}
        </div>

        <section className="surface-card p-4">
          <h2 className="text-sm font-semibold">Rol yetki seviyeleri</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {STORE_ROLES.map((role) => (
              <li key={role} className="rounded-lg border border-border p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
                  {STORE_ROLE_LABELS[role] ?? role}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{ROLE_SCOPES[role]}</p>
              </li>
            ))}
          </ul>
        </section>

        <form
          className="surface-card flex flex-wrap items-end gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!email.trim() || !storeId) return;
            inviteMutation.mutate();
          }}
        >
          <div className="min-w-64 space-y-1">
            <Label htmlFor="member-email">Kayıtlı hesabın e-postası</Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ornek@mefticaret.com"
              className="h-9"
            />
          </div>
          <div className="min-w-44 space-y-1">
            <Label htmlFor="member-role">Yetki seviyesi</Label>
            <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as StoreRole)}>
              <SelectTrigger id="member-role" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STORE_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {STORE_ROLE_LABELS[role] ?? role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="sm" disabled={busy || !storeId}>
            <UserPlus className="mr-1 size-4" aria-hidden /> Ekibe ekle
          </Button>
        </form>

        <div className="surface-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Kullanıcı</th>
                <th className="px-4 py-3">Platform rolü</th>
                <th className="px-4 py-3">Yetki seviyesi</th>
                <th className="px-4 py-3">Eklendi</th>
                <th className="px-4 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {access.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Yükleniyor…
                  </td>
                </tr>
              ) : (data?.members ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Bu mağazada henüz ekip üyesi yok.
                  </td>
                </tr>
              ) : (
                (data?.members ?? []).map((member) => (
                  <tr key={member.userId}>
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-2 font-medium">
                        {member.fullName ?? "İsimsiz"}
                        {member.isOwner ? (
                          <Badge variant="secondary" className="gap-1">
                            <Crown className="size-3" aria-hidden /> Sahip
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.email ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {member.platformRoles.length
                        ? member.platformRoles.map((role) => APP_ROLE_LABELS[role] ?? role).join(", ")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          roleMutation.mutate({ userId: member.userId, role: value as StoreRole })
                        }
                        disabled={busy}
                      >
                        <SelectTrigger className="h-9 w-44" aria-label={`${member.email ?? member.userId} yetkisi`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STORE_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {STORE_ROLE_LABELS[role] ?? role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(member.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {member.isOwner ? null : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => ownerMutation.mutate(member.userId)}
                            >
                              <Crown className="mr-1 size-4" aria-hidden /> Sahip yap
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => removeMutation.mutate(member.userId)}
                            >
                              <Trash2 className="mr-1 size-4" aria-hidden /> Çıkar
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {access.error ? (
          <p className="text-sm text-destructive">{(access.error as Error).message}</p>
        ) : null}
      </div>
    </AdminShell>
  );
}
