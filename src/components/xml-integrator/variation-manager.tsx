/**
 * Varyasyon ve Seçenek Yöneticisi — beslemenin varyasyon modunu, varyant
 * düğüm yolunu ve varyanta özel alan eşlemesini düzenler.
 */

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_VARIANT_CONFIG,
  VARIANT_FIELD_KEYS,
  type VariantConfig,
  type VariantMode,
} from "@/lib/xml-variant-parser";

const MODES: Array<{ value: VariantMode; label: string; hint: string }> = [
  { value: "none", label: "Varyasyon yok", hint: "Her satır tek bir ürün olarak aktarılır." },
  {
    value: "nested",
    label: "İç içe varyasyon",
    hint: "Varyantlar ürünün altındaki düğümde, ör. <Variants><Variant>…",
  },
  {
    value: "flat",
    label: "Düz liste varyasyon",
    hint: "Varyantlar aynı seviyede, üst stok koduna göre gruplanır.",
  },
];

const VARIANT_FIELD_LABELS: Record<(typeof VARIANT_FIELD_KEYS)[number], string> = {
  sku: "Varyant stok kodu (SKU)",
  barcode: "Varyant barkod",
  price: "Varyant fiyat",
  compare_at_price: "Varyant liste fiyatı",
  cost_price: "Varyant maliyet",
  stock: "Varyant stok adedi",
  weight: "Varyant ağırlık",
  color: "Renk",
  size: "Beden",
  material: "Materyal",
  variant_name: "Seçenek adı",
  variant_value: "Seçenek değeri",
  images: "Varyant görselleri",
};

const NESTED_FIELDS = VARIANT_FIELD_KEYS;
const FLAT_OPTION_FIELDS = ["color", "size", "material"] as const;

export function VariationManager({
  columns,
  mode,
  config,
  onModeChange,
  onConfigChange,
}: {
  columns: string[];
  mode: VariantMode;
  config: VariantConfig;
  onModeChange: (mode: VariantMode) => void;
  onConfigChange: (config: VariantConfig) => void;
}) {
  const patch = (next: Partial<VariantConfig>) => onConfigChange({ ...DEFAULT_VARIANT_CONFIG, ...config, ...next });
  const setVariantField = (key: string, value: string) => {
    const mapping = { ...config.variantMapping };
    if (value) mapping[key] = value;
    else delete mapping[key];
    patch({ variantMapping: mapping });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {MODES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onModeChange(item.value)}
            aria-pressed={mode === item.value}
            className={`rounded-lg border p-3 text-left text-xs transition ${
              mode === item.value ? "border-foreground bg-muted" : "bg-background hover:bg-muted/50"
            }`}
          >
            <p className="text-sm font-medium">{item.label}</p>
            <p className="mt-1 text-muted-foreground">{item.hint}</p>
          </button>
        ))}
      </div>

      {mode === "nested" ? (
        <section className="space-y-3 rounded-xl border bg-card p-3">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="variant-node-path">
              Varyant alt düğüm yolu
            </Label>
            <Input
              id="variant-node-path"
              placeholder="Variants.Variant veya Secenekler.Secenek"
              value={config.variantNodePath}
              onChange={(event) => patch({ variantNodePath: event.target.value })}
            />
            <p className="text-[11px] text-muted-foreground">
              Varyantların bulunduğu düğüm. Boş bırakırsanız varyantlar okunmaz.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Varyant alanları</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {NESTED_FIELDS.map((key) => (
                <VariantFieldSelect
                  key={key}
                  label={VARIANT_FIELD_LABELS[key]}
                  columns={columns}
                  value={config.variantMapping[key] ?? ""}
                  onChange={(value) => setVariantField(key, value)}
                />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Boş bıraktığınız alanlar ürün eşlemesindeki karşılığından okunur.
            </p>
          </div>
        </section>
      ) : null}

      {mode === "flat" ? (
        <section className="space-y-3 rounded-xl border bg-card p-3">
          <VariantFieldSelect
            label="Üst stok kodu / grup kodu alanı"
            columns={columns}
            value={config.parentSkuField}
            onChange={(value) => patch({ parentSkuField: value })}
          />
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Seçenek alanları</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {FLAT_OPTION_FIELDS.map((key) => (
                <VariantFieldSelect
                  key={key}
                  label={VARIANT_FIELD_LABELS[key]}
                  columns={columns}
                  value={config.variantMapping[key] ?? ""}
                  onChange={(value) => setVariantField(key, value)}
                />
              ))}
              <VariantFieldSelect
                label={VARIANT_FIELD_LABELS.sku}
                columns={columns}
                value={config.variantMapping["sku"] ?? ""}
                onChange={(value) => setVariantField("sku", value)}
              />
              <VariantFieldSelect
                label={VARIANT_FIELD_LABELS.barcode}
                columns={columns}
                value={config.variantMapping["barcode"] ?? ""}
                onChange={(value) => setVariantField("barcode", value)}
              />
              <VariantFieldSelect
                label={VARIANT_FIELD_LABELS.stock}
                columns={columns}
                value={config.variantMapping["stock"] ?? ""}
                onChange={(value) => setVariantField("stock", value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="option-attributes">
              Ek seçenek alanları (virgülle ayırın)
            </Label>
            <Input
              id="option-attributes"
              placeholder="Kalıp, Desen"
              value={config.optionAttributes.join(", ")}
              onChange={(event) =>
                patch({
                  optionAttributes: event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .slice(0, 12),
                })
              }
            />
          </div>
        </section>
      ) : null}

      {mode === "none" ? (
        <p className="text-xs text-muted-foreground">
          Varyasyon kapalı. <Badge variant="outline">Tekil ürün</Badge> olarak aktarılır.
        </p>
      ) : null}
    </div>
  );
}

function VariantFieldSelect({
  label,
  columns,
  value,
  onChange,
}: {
  label: string;
  columns: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const known = !value || columns.includes(value);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <select
        aria-label={label}
        className="h-9 w-full rounded-md border bg-background px-2 text-xs"
        value={known ? value : "__custom"}
        onChange={(event) => onChange(event.target.value === "__custom" ? value : event.target.value)}
      >
        <option value="">Seçilmedi</option>
        {columns.map((column) => (
          <option key={column} value={column}>
            {column}
          </option>
        ))}
        {known ? null : <option value="__custom">{value}</option>}
      </select>
    </div>
  );
}
