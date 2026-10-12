import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/mefti";
import { storeActivityQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/activity")({
  head: () => ({
    meta: [
      { title: "Denetim Kaydı — Mefticaret" },
      {
        name: "description",
        content:
          "Mağazanızda yapılan tüm yönetim işlemlerini kim, ne zaman ve neyi değiştirdi detayıyla izleyin.",
      },
      { property: "og:title", content: "Denetim Kaydı — Mefticaret" },
      {
        property: "og:description",
        content: "Mefticaret denetim kaydı: ürün, sipariş, ayar ve yetki değişikliklerinin izi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActivityPage,
});

const ACTION_LABELS: Record<string, string> = {
  "store.created": "Mağaza oluşturuldu",
  "store.updated": "Mağaza güncellendi",
  "store.settings_updated": "Ayarlar güncellendi",
  "store.plan_changed": "Paket değiştirildi",
  "product.created": "Ürün eklendi",
  "product.updated": "Ürün güncellendi",
  "product.deleted": "Ürün silindi",
  "order.updated": "Sipariş güncellendi",
  "inventory.adjusted": "Stok düzeltildi",
  "theme.saved": "Tema kaydedildi",
  "domain.added": "Domain eklendi",
  "domain.verified": "Domain doğrulandı",
  "member.invited": "Ekip üyesi eklendi",
  "member.removed": "Ekip üyesi çıkarıldı",
  "payout.created": "Hakediş oluşturuldu",
  "payout.updated": "Hakediş güncellendi",
};

const ENTITY_LABELS: Record<string, string> = {
  stores: "Mağaza",
  store_settings: "Ayarlar",
  products: "Ürün",
  product_variants: "Varyant",
  orders: "Sipariş",
  discounts: "İndirim",
  store_users: "Ekip",
  store_domains: "Domain",
  store_themes: "Tema",
  payouts: "Hakediş",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function actionTone(action: string) {
  if (action.includes("deleted") || action.includes("removed")) return "destructive" as const;
  if (action.includes("created") || action.includes("invited")) return "default" as const;
  return "secondary" as const;
}

function ValueBlock({ label, value }: { label: string; value: unknown }) {
  if (!value || (typeof value === "object" && Object.keys(value as object).length === 0)) return null;
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <pre className="overflow-x-auto rounded-lg bg-muted/60 p-2 text-[0.7rem] leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function ActivityPage() {
  const { storeId } = Route.useParams();
  const { data: logs, isLoading } = useQuery(storeActivityQuery(storeId));

  const [term, setTerm] = useState("");
  const [entity, setEntity] = useState("all");

  const entities = useMemo(() => {
    const set = new Set<string>();
    (logs ?? []).forEach((log) => log.entity && set.add(log.entity));
    return Array.from(set).sort();
  }, [logs]);

  const rows = (logs ?? []).filter((log) => {
    if (entity !== "all" && log.entity !== entity) return false;
    if (!term.trim()) return true;
    const haystack = `${log.action} ${log.entity ?? ""} ${log.entity_id ?? ""}`.toLowerCase();
    return haystack.includes(term.trim().toLowerCase());
  });

  return (
    <AppShell
      storeId={storeId}
      title="Denetim Kaydı"
      description="Mağazada yapılan her yönetim işleminin değiştirilemez izi."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="İşlem ara…"
              className="w-52 pl-9"
              aria-label="İşlem ara"
            />
          </div>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm kayıtlar</SelectItem>
              {entities.map((item) => (
                <SelectItem key={item} value={item}>
                  {ENTITY_LABELS[item] ?? item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="surface-card p-0">
        {isLoading ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <History className="mx-auto mb-3 size-6 text-muted-foreground" />
            <p className="font-medium">Bu filtrede kayıt yok</p>
            <p className="text-sm text-muted-foreground">
              Ürün, sipariş, ayar ve yetki değişiklikleri otomatik olarak burada listelenir.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((log) => (
              <li key={log.id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={actionTone(log.action)}>{actionLabel(log.action)}</Badge>
                  {log.entity ? (
                    <span className="text-xs text-muted-foreground">
                      {ENTITY_LABELS[log.entity] ?? log.entity}
                      {log.entity_id ? ` · ${log.entity_id.slice(0, 8)}` : ""}
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTime(log.created_at)}
                  </span>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <ValueBlock label="Önce" value={log.old_value} />
                  <ValueBlock label="Sonra" value={log.new_value} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
