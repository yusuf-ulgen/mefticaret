/**
 * Delta senkronizasyon ayarları kartı: akıllı kısmi güncelleme anahtarı,
 * özet alanları listesi ve zorunlu tam senkronizasyon aralığı.
 */

import { Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DELTA_HASH_FIELDS,
  DEFAULT_DELTA_SYNC_CONFIG,
  type DeltaSyncConfig,
} from "@/lib/xml-delta-sync";

export function DeltaSyncSettings({
  idPrefix = "delta",
  value,
  onChange,
  lastFullSyncAt,
}: {
  idPrefix?: string;
  value: DeltaSyncConfig;
  onChange: (next: DeltaSyncConfig) => void;
  lastFullSyncAt?: string | null;
}) {
  const toggleField = (key: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...value.hashFields, key]))
      : value.hashFields.filter((item) => item !== key);
    onChange({ ...value, hashFields: next.length ? next : [...DEFAULT_DELTA_SYNC_CONFIG.hashFields] });
  };

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-enabled`} className="flex items-center gap-1.5">
            <Zap className="size-4 text-primary" aria-hidden />
            Delta senkronizasyonu (akıllı kısmi güncelleme)
          </Label>
          <p className="text-xs text-muted-foreground">
            Yalnızca fiyatı, stoğu veya adı değişen ürünler güncellenir. Sunucu ve veritabanı yükünü
            %80'e kadar azaltır.
          </p>
        </div>
        <Switch
          id={`${idPrefix}-enabled`}
          checked={value.enabled}
          onCheckedChange={(checked) => onChange({ ...value, enabled: checked })}
        />
      </div>

      {value.enabled ? (
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Değişiklik takip edilen alanlar
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {DELTA_HASH_FIELDS.map((field) => (
                <label
                  key={field.key}
                  className="flex items-center gap-2 rounded-lg border p-2 text-sm"
                  htmlFor={`${idPrefix}-field-${field.key}`}
                >
                  <Checkbox
                    id={`${idPrefix}-field-${field.key}`}
                    checked={value.hashFields.includes(field.key)}
                    onCheckedChange={(checked) => toggleField(field.key, checked === true)}
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-hours`}>Zorunlu tam senkronizasyon aralığı (saat)</Label>
            <Input
              id={`${idPrefix}-hours`}
              type="number"
              min={1}
              max={2160}
              value={value.forceFullSyncHours}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                onChange({
                  ...value,
                  forceFullSyncHours: Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 168,
                });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Varsayılan 168 saat (haftalık): bu süre geçtiğinde tüm liste baştan işlenir.
            </p>
          </div>

          {lastFullSyncAt ? (
            <Badge variant="outline" className="text-xs">
              Son tam senkronizasyon: {new Date(lastFullSyncAt).toLocaleString("tr-TR")}
            </Badge>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Kapalı: her çalıştırmada tüm ürünler yeniden yazılır.
        </p>
      )}
    </section>
  );
}
