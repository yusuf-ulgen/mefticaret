import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/mefti";
import { platformSettingsQuery } from "@/lib/platform-admin-queries";
import { savePlatformSetting } from "@/lib/platform-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Sistem ayarları — Süper Admin" },
      { name: "description", content: "Platform ayarlarını kod değişikliği olmadan yönet; herkese açık anahtarları işaretle." },
      { property: "og:title", content: "Sistem ayarları — Süper Admin" },
      { property: "og:description", content: "Bakım modu, kayıt açıklığı, komisyon ve para birimi varsayılanları." },
    ],
  }),
  component: AdminSettings,
});

type Draft = { key: string; value: string; label: string; description: string; isPublic: boolean };

function AdminSettings() {
  const { isPlatformAdmin } = useAuth();
  const queryClient = useQueryClient();
  const settings = useQuery(platformSettingsQuery(isPlatformAdmin));
  const saveSetting = useServerFn(savePlatformSetting);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState<Draft | null>(null);

  const mutation = useMutation({
    mutationFn: (input: Draft) =>
      saveSetting({
        data: {
          key: input.key,
          value: input.value,
          label: input.label || undefined,
          description: input.description || undefined,
          isPublic: input.isPublic,
        },
      }),
    onSuccess: () => {
      toast.success("Ayar kaydedildi");
      setCreating(null);
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = settings.data ?? [];

  return (
    <AdminShell
      title="Sistem ayarları"
      description="Platform davranışı kodda sabit değildir; buradan yönetilir."
      actions={
        <Button
          size="sm"
          onClick={() => setCreating({ key: "", value: "", label: "", description: "", isPublic: false })}
        >
          <Plus className="size-4" /> Yeni ayar
        </Button>
      }
    >
      {creating ? (
        <form
          className="surface-card grid gap-3 p-5 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(creating);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="new-key">Anahtar</Label>
            <Input
              id="new-key"
              value={creating.key}
              onChange={(event) => setCreating({ ...creating, key: event.target.value })}
              placeholder="platform.example"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-label">Etiket</Label>
            <Input
              id="new-label"
              value={creating.label}
              onChange={(event) => setCreating({ ...creating, label: event.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-value">Değer (JSON veya metin)</Label>
            <Textarea
              id="new-value"
              rows={2}
              value={creating.value}
              onChange={(event) => setCreating({ ...creating, value: event.target.value })}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="new-public"
              checked={creating.isPublic}
              onCheckedChange={(checked) => setCreating({ ...creating, isPublic: checked })}
            />
            <Label htmlFor="new-public" className="text-xs">
              Herkese açık (storefront okuyabilir)
            </Label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreating(null)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              Kaydet
            </Button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        {rows.map((row) => {
          const key = String(row["key"]);
          const raw = drafts[key] ?? JSON.stringify(row["value"] ?? "");
          return (
            <form
              key={key}
              className="surface-card flex flex-wrap items-end gap-3 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                mutation.mutate({
                  key,
                  value: raw,
                  label: String(row["label"] ?? ""),
                  description: String(row["description"] ?? ""),
                  isPublic: Boolean(row["is_public"]),
                });
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{String(row["label"] ?? key)}</p>
                  <Badge variant="secondary">{key}</Badge>
                  {row["is_public"] ? <Badge>Herkese açık</Badge> : null}
                </div>
                {row["description"] ? (
                  <p className="mt-1 text-xs text-muted-foreground">{String(row["description"])}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Son güncelleme: {row["updated_at"] ? formatDateTime(String(row["updated_at"])) : "—"}
                </p>
              </div>
              <div className="w-full sm:w-72">
                <Label htmlFor={`value-${key}`} className="text-xs">
                  Değer
                </Label>
                <Input
                  id={`value-${key}`}
                  value={raw}
                  onChange={(event) => setDrafts({ ...drafts, [key]: event.target.value })}
                />
              </div>
              <Button type="submit" size="sm" disabled={mutation.isPending}>
                Kaydet
              </Button>
            </form>
          );
        })}
        {rows.length === 0 ? (
          <p className="surface-card p-6 text-sm text-muted-foreground">Kayıtlı ayar yok.</p>
        ) : null}
      </div>
    </AdminShell>
  );
}
