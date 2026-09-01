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
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatNumber } from "@/lib/mefti";
import { platformListQuery, platformRolesQuery } from "@/lib/platform-admin-queries";
import { setPlatformUserRole } from "@/lib/platform-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Kullanıcılar — Süper Admin" },
      { name: "description", content: "Platform hesaplarını ara, rollerini görüntüle ve yönetici yetkisi ver." },
      { property: "og:title", content: "Kullanıcılar — Süper Admin" },
      { property: "og:description", content: "Rol tabanlı erişim kontrolü ayrı rol tablosunda tutulur." },
    ],
  }),
  component: AdminUsers,
});

const ROLES = ["platform_admin", "agency", "seller", "customer"] as const;
const ROLE_LABELS: Record<string, string> = {
  platform_admin: "Platform yöneticisi",
  agency: "Ajans",
  seller: "Satıcı",
  customer: "Müşteri",
};

function AdminUsers() {
  const { isPlatformAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");

  const users = useQuery(platformListQuery("users", search, isPlatformAdmin));
  const roles = useQuery(platformRolesQuery(isPlatformAdmin));
  const saveRole = useServerFn(setPlatformUserRole);

  const roleMutation = useMutation({
    mutationFn: (input: { userId: string; role: (typeof ROLES)[number]; grant: boolean }) =>
      saveRole({ data: input }),
    onSuccess: () => {
      toast.success("Rol güncellendi");
      queryClient.invalidateQueries({ queryKey: ["platform-roles"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rolesFor = (userId: string) =>
    (roles.data ?? []).filter((row) => row.user_id === userId).map((row) => row.role);

  const rows = users.data?.rows ?? [];

  return (
    <AdminShell title="Kullanıcılar" description="Hesaplar ve platform rolleri.">
      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(term.trim());
        }}
      >
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="E-posta, ad veya telefon"
          className="h-9 w-full sm:w-72"
          aria-label="Kullanıcı ara"
        />
        <Button type="submit" size="sm" variant="outline">
          Ara
        </Button>
        <Badge variant="secondary">{formatNumber(rows.length)} kullanıcı</Badge>
      </form>

      <div className="surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Kullanıcı</th>
              <th className="px-4 py-3">Kayıt</th>
              {ROLES.map((role) => (
                <th key={role} className="px-4 py-3 whitespace-nowrap">
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const userId = String(row["id"] ?? "");
              const owned = rolesFor(userId);
              return (
                <tr key={userId}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{String(row["full_name"] ?? "İsimsiz")}</p>
                    <p className="text-xs text-muted-foreground">{String(row["email"] ?? "—")}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {row["created_at"] ? formatDateTime(String(row["created_at"])) : "—"}
                  </td>
                  {ROLES.map((role) => (
                    <td key={role} className="px-4 py-3">
                      <Switch
                        checked={owned.includes(role)}
                        aria-label={`${String(row["email"])} için ${ROLE_LABELS[role]}`}
                        disabled={roleMutation.isPending}
                        onCheckedChange={(checked) =>
                          roleMutation.mutate({ userId, role, grant: checked })
                        }
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
