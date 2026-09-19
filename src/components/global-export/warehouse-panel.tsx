import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2, Warehouse } from "lucide-react";
import { toast } from "sonner";

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
import { FULFILLMENT_PROVIDER_CATALOG, GLOBAL_COUNTRIES } from "@/lib/global-commerce";
import { warehousesQuery } from "@/lib/global-suite-queries";
import {
  deleteFulfillmentWarehouse,
  saveFulfillmentWarehouse,
} from "@/lib/global-suite.functions";

/** Çoklu depo / fulfillment: Türkiye deposu + Avrupa/ABD 3PL ve FBA depoları. */
export function WarehousePanel({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data: warehouses } = useQuery(warehousesQuery(storeId));
  const save = useServerFn(saveFulfillmentWarehouse);
  const remove = useServerFn(deleteFulfillmentWarehouse);

  const [form, setForm] = useState({
    code: "",
    name: "",
    provider: "own",
    countryCode: "TR",
    city: "",
    priority: "10",
    isActive: true,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["fulfillment-warehouses", storeId] });

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          storeId,
          code: form.code,
          name: form.name,
          provider: form.provider,
          countryCode: form.countryCode,
          city: form.city || null,
          priority: Number(form.priority) || 0,
          isActive: form.isActive,
        } as never,
      }),
    onSuccess: () => {
      toast.success("Depo kaydedildi");
      setForm({ ...form, code: "", name: "", city: "" });
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { storeId, id } as never }),
    onSuccess: () => {
      toast.success("Depo kaldırıldı");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Warehouse className="size-4" /> Depo ekle
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Siparişler, teslimat ülkesine en yakın ve önceliği yüksek aktif depodan sevk edilir.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="wh-code">Depo kodu</Label>
            <Input
              id="wh-code"
              className="mt-1"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
              placeholder="TR-IST"
            />
          </div>
          <div>
            <Label htmlFor="wh-name">Depo adı</Label>
            <Input
              id="wh-name"
              className="mt-1"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="İstanbul merkez depo"
            />
          </div>
          <div>
            <Label>Tip</Label>
            <Select
              value={form.provider}
              onValueChange={(provider) => setForm({ ...form, provider })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FULFILLMENT_PROVIDER_CATALOG.map((item) => (
                  <SelectItem key={item.provider} value={item.provider}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ülke</Label>
            <Select
              value={form.countryCode}
              onValueChange={(countryCode) => setForm({ ...form, countryCode })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLOBAL_COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="wh-city">Şehir</Label>
            <Input
              id="wh-city"
              className="mt-1"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="wh-priority">Öncelik</Label>
            <Input
              id="wh-priority"
              className="mt-1"
              inputMode="numeric"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value })}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Switch
            id="wh-active"
            checked={form.isActive}
            onCheckedChange={(isActive) => setForm({ ...form, isActive })}
          />
          <Label htmlFor="wh-active">Aktif</Label>
        </div>
        <Button
          className="mt-4"
          disabled={!form.code || !form.name || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          Depoyu kaydet
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">Depolar</h3>
        {(warehouses ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Henüz depo tanımlı değil.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {(warehouses ?? []).map((warehouse) => (
              <li
                key={warehouse.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {warehouse.name} <span className="text-muted-foreground">({warehouse.code})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {warehouse.country_code}
                    {warehouse.city ? ` · ${warehouse.city}` : ""} · öncelik {warehouse.priority}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={warehouse.is_active ? "default" : "secondary"}>
                    {warehouse.is_active ? "Aktif" : "Kapalı"}
                  </Badge>
                  {!warehouse.credentials_ready && warehouse.provider !== "own" ? (
                    <Badge variant="outline">Hesap bilgisi bekliyor</Badge>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(warehouse.id)}
                    aria-label="Depoyu sil"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
