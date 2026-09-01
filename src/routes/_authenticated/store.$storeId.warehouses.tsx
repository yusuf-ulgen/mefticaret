import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Plus, TriangleAlert, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
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
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { inventoryQuery } from "@/lib/inventory-queries";
import {
  WAREHOUSE_KIND_LABELS,
  inventoryLevelsQuery,
  warehousesQuery,
} from "@/lib/warehouses-queries";
import type { WarehouseKind, WarehouseRow } from "@/lib/warehouses-queries";
import {
  adjustWarehouseStock,
  deleteWarehouse,
  ensureInventoryLevel,
  saveWarehouse,
  updateLevelSettings,
} from "@/lib/warehouses.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/warehouses")({
  head: () => ({
    meta: [
      { title: "Depolar & Şubeler — Mefticaret" },
      {
        name: "description",
        content:
          "Depo ve şube bazlı mevcut, rezerve ve satılabilir stok yönetimi; minimum stok eşikleri ve raf konumları.",
      },
      { property: "og:title", content: "Depolar & Şubeler — Mefticaret" },
      {
        property: "og:description",
        content: "Çok depolu stok yönetimi: mevcut, rezerve, satılabilir ve yolda gelen stok.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WarehousesPage,
});

type FormState = {
  id?: string;
  code: string;
  name: string;
  kind: WarehouseKind;
  city: string;
  district: string;
  address: string;
  contactName: string;
  phone: string;
  priority: string;
  isDefault: boolean;
  isActive: boolean;
  allowsFulfillment: boolean;
  externalSource: string;
  syncUrl: string;
  note: string;
};

const emptyForm: FormState = {
  code: "",
  name: "",
  kind: "warehouse",
  city: "",
  district: "",
  address: "",
  contactName: "",
  phone: "",
  priority: "100",
  isDefault: false,
  isActive: true,
  allowsFulfillment: true,
  externalSource: "",
  syncUrl: "",
  note: "",
};

const toForm = (warehouse: WarehouseRow): FormState => ({
  id: warehouse.id,
  code: warehouse.code,
  name: warehouse.name,
  kind: warehouse.kind,
  city: warehouse.city ?? "",
  district: warehouse.district ?? "",
  address: warehouse.address ?? "",
  contactName: warehouse.contact_name ?? "",
  phone: warehouse.phone ?? "",
  priority: String(warehouse.priority ?? 100),
  isDefault: warehouse.is_default,
  isActive: warehouse.is_active,
  allowsFulfillment: warehouse.allows_fulfillment,
  externalSource: warehouse.external_source ?? "",
  syncUrl: warehouse.sync_url ?? "",
  note: warehouse.note ?? "",
});

function WarehousesPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: warehouses } = useQuery(warehousesQuery(storeId));
  const { data: variants } = useQuery(inventoryQuery(storeId));

  const [activeWarehouse, setActiveWarehouse] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [attachVariant, setAttachVariant] = useState("");

  const selected = activeWarehouse ?? warehouses?.[0]?.id ?? null;
  const { data: levels, isLoading } = useQuery({
    ...inventoryLevelsQuery(storeId, selected),
    enabled: Boolean(selected),
  });

  const save = useServerFn(saveWarehouse);
  const remove = useServerFn(deleteWarehouse);
  const attach = useServerFn(ensureInventoryLevel);
  const adjust = useServerFn(adjustWarehouseStock);
  const settings = useServerFn(updateLevelSettings);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["warehouses", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["inventory-levels", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["inventory", storeId] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: (input: FormState) =>
      save({
        data: {
          storeId,
          id: input.id,
          code: input.code,
          name: input.name,
          kind: input.kind,
          city: input.city || undefined,
          district: input.district || undefined,
          address: input.address || undefined,
          contactName: input.contactName || undefined,
          phone: input.phone || undefined,
          priority: Number(input.priority) || 100,
          isDefault: input.isDefault,
          isActive: input.isActive,
          allowsFulfillment: input.allowsFulfillment,
          externalSource: input.externalSource || undefined,
          syncUrl: input.syncUrl || undefined,
          note: input.note || undefined,
        },
      }),
    onSuccess: async () => {
      await invalidate();
      setForm(null);
      toast.success("Depo kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { storeId, id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Depo silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const attachMutation = useMutation({
    mutationFn: (variantId: string) =>
      attach({ data: { storeId, warehouseId: selected!, variantId } }),
    onSuccess: async () => {
      await invalidate();
      setAttachVariant("");
      toast.success("Varyant bu depoya eklendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const adjustMutation = useMutation({
    mutationFn: (input: { levelId: string; amount: number }) =>
      adjust({ data: { storeId, levelId: input.levelId, kind: "count", amount: input.amount } }),
    onSuccess: async (result) => {
      await invalidate();
      toast.success(`Mevcut stok güncellendi: ${result.before} → ${result.after}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const settingsMutation = useMutation({
    mutationFn: (input: { levelId: string; reserved?: number; minStock?: number }) =>
      settings({ data: { storeId, ...input } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Stok ayarı güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr");
    return (levels ?? []).filter((level) => {
      const title = `${level.products?.title ?? ""} ${level.product_variants?.title ?? ""} ${level.product_variants?.sku ?? ""}`;
      const matches = !term || title.toLocaleLowerCase("tr").includes(term);
      const low = level.available <= level.min_stock;
      return matches && (!onlyLow || low);
    });
  }, [levels, search, onlyLow]);

  const totals = useMemo(() => {
    const list = levels ?? [];
    return {
      onHand: list.reduce((sum, item) => sum + item.on_hand, 0),
      reserved: list.reduce((sum, item) => sum + item.reserved, 0),
      available: list.reduce((sum, item) => sum + item.available, 0),
      incoming: list.reduce((sum, item) => sum + item.incoming, 0),
    };
  }, [levels]);

  const unattached = useMemo(() => {
    const attached = new Set((levels ?? []).map((level) => level.variant_id));
    return (variants ?? []).filter((variant) => !attached.has(variant.id)).slice(0, 200);
  }, [levels, variants]);

  return (
    <AppShell
      storeId={storeId}
      title="Depolar & Şubeler"
      description="Çok depolu stok: mevcut, rezerve, satılabilir ve yolda gelen miktarlar."
      actions={
        <Button type="button" onClick={() => setForm({ ...emptyForm })}>
          <Plus className="mr-2 size-4" />
          Depo / şube ekle
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          {(warehouses ?? []).map((warehouse) => (
            <button
              key={warehouse.id}
              type="button"
              onClick={() => setActiveWarehouse(warehouse.id)}
              className={`surface-card p-5 text-left transition ${
                selected === warehouse.id ? "ring-2 ring-primary" : "hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{warehouse.name}</p>
                {warehouse.kind === "branch" ? (
                  <Building2 className="size-4 text-muted-foreground" />
                ) : (
                  <Warehouse className="size-4 text-muted-foreground" />
                )}
              </div>
              <p className="mt-1 text-xs font-mono text-muted-foreground">{warehouse.code}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="secondary">{WAREHOUSE_KIND_LABELS[warehouse.kind]}</Badge>
                {warehouse.is_default ? <Badge>Varsayılan</Badge> : null}
                {!warehouse.is_active ? <Badge variant="destructive">Pasif</Badge> : null}
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    setForm(toForm(warehouse));
                  }}
                >
                  Düzenle
                </Button>
                {!warehouse.is_default ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeMutation.mutate(warehouse.id);
                    }}
                  >
                    Sil
                  </Button>
                ) : null}
              </div>
            </button>
          ))}
          {(warehouses ?? []).length === 0 ? (
            <div className="surface-card p-6 text-sm text-muted-foreground">
              Henüz depo yok. İlk deponuzu ekleyin.
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Mevcut stok", value: totals.onHand },
            { label: "Rezerve stok", value: totals.reserved },
            { label: "Satılabilir stok", value: totals.available },
            { label: "Yolda gelen", value: totals.incoming },
          ].map((kpi) => (
            <div key={kpi.label} className="surface-card p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
              <p className="mt-2 text-2xl font-semibold">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="max-w-xs"
            placeholder="Ürün, varyant veya SKU ara"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button
            type="button"
            variant={onlyLow ? "default" : "outline"}
            onClick={() => setOnlyLow((prev) => !prev)}
          >
            <TriangleAlert className="mr-2 size-4" />
            Minimum stok altı
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Select value={attachVariant} onValueChange={setAttachVariant}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Depoya varyant ekle" />
              </SelectTrigger>
              <SelectContent>
                {unattached.map((variant) => (
                  <SelectItem key={variant.id} value={variant.id}>
                    {(variant.products?.title ?? "Ürün") + " · " + variant.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              disabled={!attachVariant || !selected || attachMutation.isPending}
              onClick={() => attachVariant && attachMutation.mutate(attachVariant)}
            >
              Ekle
            </Button>
          </div>
        </div>

        <div className="surface-card overflow-x-auto">
          {isLoading ? (
            <p className="p-6 text-muted-foreground">Yükleniyor…</p>
          ) : rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Bu depoda stok kaydı yok. Yukarıdan varyant ekleyerek başlayın.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Ürün / Varyant</th>
                  <th className="px-5 py-3">SKU</th>
                  <th className="px-5 py-3">Mevcut</th>
                  <th className="px-5 py-3">Rezerve</th>
                  <th className="px-5 py-3">Satılabilir</th>
                  <th className="px-5 py-3">Yolda</th>
                  <th className="px-5 py-3">Minimum</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((level) => (
                  <tr key={level.id} className="border-b border-border/40 last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium">{level.products?.title ?? "Ürün"}</p>
                      <p className="text-xs text-muted-foreground">
                        {level.product_variants?.title ?? "Varyant"}
                      </p>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {level.product_variants?.sku ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Input
                        className="h-9 w-20"
                        type="number"
                        min={0}
                        defaultValue={level.on_hand}
                        aria-label="Mevcut stok"
                        onBlur={(event) => {
                          const next = Number(event.target.value) || 0;
                          if (next !== level.on_hand)
                            adjustMutation.mutate({ levelId: level.id, amount: next });
                        }}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <Input
                        className="h-9 w-20"
                        type="number"
                        min={0}
                        defaultValue={level.reserved}
                        aria-label="Rezerve stok"
                        onBlur={(event) => {
                          const next = Number(event.target.value) || 0;
                          if (next !== level.reserved)
                            settingsMutation.mutate({ levelId: level.id, reserved: next });
                        }}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-semibold">{level.available}</span>
                      {level.available <= level.min_stock ? (
                        <Badge variant="destructive" className="ml-2">
                          Kritik
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{level.incoming}</td>
                    <td className="px-5 py-3">
                      <Input
                        className="h-9 w-20"
                        type="number"
                        min={0}
                        defaultValue={level.min_stock}
                        aria-label="Minimum stok"
                        onBlur={(event) => {
                          const next = Number(event.target.value) || 0;
                          if (next !== level.min_stock)
                            settingsMutation.mutate({ levelId: level.id, minStock: next });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Sheet open={Boolean(form)} onOpenChange={(open) => !open && setForm(null)}>
        <SheetContent className="w-full max-w-md space-y-4 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{form?.id ? "Depoyu düzenle" : "Yeni depo / şube"}</SheetTitle>
            <SheetDescription>
              Şube, tedarikçi deposu veya dropshipping kaynağı olarak tanımlayabilirsiniz.
            </SheetDescription>
          </SheetHeader>
          {form ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="wh-code">Kod</Label>
                  <Input
                    id="wh-code"
                    value={form.code}
                    onChange={(event) => setForm({ ...form, code: event.target.value })}
                    placeholder="MERKEZ"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wh-priority">Öncelik</Label>
                  <Input
                    id="wh-priority"
                    type="number"
                    min={0}
                    value={form.priority}
                    onChange={(event) => setForm({ ...form, priority: event.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wh-name">Ad</Label>
                <Input
                  id="wh-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Merkez Depo"
                />
              </div>
              <div className="space-y-2">
                <Label>Tip</Label>
                <Select
                  value={form.kind}
                  onValueChange={(next) => setForm({ ...form, kind: next as WarehouseKind })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(WAREHOUSE_KIND_LABELS) as WarehouseKind[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {WAREHOUSE_KIND_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="wh-city">İl</Label>
                  <Input
                    id="wh-city"
                    value={form.city}
                    onChange={(event) => setForm({ ...form, city: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wh-district">İlçe</Label>
                  <Input
                    id="wh-district"
                    value={form.district}
                    onChange={(event) => setForm({ ...form, district: event.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wh-address">Adres</Label>
                <Textarea
                  id="wh-address"
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="wh-contact">Yetkili</Label>
                  <Input
                    id="wh-contact"
                    value={form.contactName}
                    onChange={(event) => setForm({ ...form, contactName: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wh-phone">Telefon</Label>
                  <Input
                    id="wh-phone"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wh-sync">Stok senkronizasyon URL (XML / API)</Label>
                <Input
                  id="wh-sync"
                  value={form.syncUrl}
                  onChange={(event) => setForm({ ...form, syncUrl: event.target.value })}
                  placeholder="https://tedarikci.example.com/stok.xml"
                />
                <p className="text-xs text-muted-foreground">
                  Tedarikçi stokları ve XML senkronizasyonu için ayrılmıştır.
                </p>
              </div>
              <div className="space-y-3 rounded-lg border border-border/50 p-4">
                {[
                  { key: "isDefault" as const, label: "Varsayılan depo" },
                  { key: "isActive" as const, label: "Aktif" },
                  { key: "allowsFulfillment" as const, label: "Sipariş karşılamaya açık" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3">
                    <Label htmlFor={`wh-${item.key}`}>{item.label}</Label>
                    <Switch
                      id={`wh-${item.key}`}
                      checked={form[item.key]}
                      onCheckedChange={(checked) => setForm({ ...form, [item.key]: checked })}
                    />
                  </div>
                ))}
              </div>
              <Button
                className="w-full"
                disabled={saveMutation.isPending || !form.code || !form.name}
                onClick={() => saveMutation.mutate(form)}
              >
                {saveMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
