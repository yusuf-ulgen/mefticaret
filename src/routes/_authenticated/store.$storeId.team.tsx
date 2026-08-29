import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STORE_ROLE_LABELS } from "@/lib/mefti";
import { storeMembersQuery, storeQuery } from "@/lib/store-queries";
import { updateStoreMember } from "@/lib/stores.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/team")({
  head: () => ({
    meta: [
      { title: "Ekip & Yetkiler — Mefticaret" },
      { name: "description", content: "Mağaza ekibini yönet, rol bazlı yetkileri (RBAC) düzenle." },
      { property: "og:title", content: "Ekip & Yetkiler — Mefticaret" },
      { property: "og:description", content: "Sahip, yönetici, personel, pazarlama ve destek rolleri." },
    ],
  }),
  component: TeamPage,
});

const ROLE_SCOPES: Record<string, string> = {
  owner: "Tüm yetkiler + mağaza silme ve fatura",
  admin: "Ayarlar, domain, ekip ve katalog yönetimi",
  staff: "Katalog ve sipariş operasyonları",
  marketing: "Kampanya, indirim ve içerik",
  support: "Sipariş görüntüleme ve müşteri desteği",
};

function TeamPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: members } = useQuery(storeMembersQuery(storeId));
  const updateMember = useServerFn(updateStoreMember);

  const mutation = useMutation({
    mutationFn: (input: { memberId: string; role: "admin" | "staff" | "marketing" | "support" }) =>
      updateMember({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store-members", storeId] });
      toast.success("Rol güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const limits = (store?.plans?.limits ?? {}) as { staff?: number };

  return (
    <AppShell
      storeId={storeId}
      title="Ekip & Yetkiler"
      description="Rol bazlı erişim kontrolü veritabanı seviyesinde uygulanır."
      actions={
        <Badge variant="secondary">
          Personel limiti: {limits.staff === -1 ? "Sınırsız" : (limits.staff ?? 1)}
        </Badge>
      }
    >
      <div className="surface-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Kullanıcı</th>
              <th className="px-5 py-3">Rol</th>
              <th className="px-5 py-3">Eklenme</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(members ?? []).length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-muted-foreground">
                  Henüz ekip üyesi yok.
                </td>
              </tr>
            ) : (
              (members ?? []).map((member) => (
                <tr key={member.id}>
                  <td className="px-5 py-3 font-mono text-xs">{member.user_id}</td>
                  <td className="px-5 py-3">
                    {member.role === "owner" ? (
                      <Badge className="gap-1">
                        <ShieldCheck className="size-3" /> {STORE_ROLE_LABELS.owner}
                      </Badge>
                    ) : (
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          mutation.mutate({
                            memberId: member.id,
                            role: value as "admin" | "staff" | "marketing" | "support",
                          })
                        }
                      >
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["admin", "staff", "marketing", "support"].map((role) => (
                            <SelectItem key={role} value={role}>
                              {STORE_ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {new Date(member.created_at).toLocaleDateString("tr-TR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className="surface-card p-6">
        <h2 className="font-display text-lg font-semibold">Rol yetkileri</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(ROLE_SCOPES).map(([role, scope]) => (
            <div key={role} className="rounded-lg border border-border p-4">
              <dt className="font-medium">{STORE_ROLE_LABELS[role] ?? role}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{scope}</dd>
            </div>
          ))}
        </dl>
      </section>
    </AppShell>
  );
}
