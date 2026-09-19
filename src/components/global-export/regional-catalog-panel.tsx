import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Globe2, Trash2 } from "lucide-react";
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
import { productsQuery } from "@/lib/catalog-queries";
import { GLOBAL_COUNTRIES, PRICE_ROUNDING_RULES, applyPriceRounding } from "@/lib/global-commerce";
import { productCountryRulesQuery } from "@/lib/global-suite-queries";
import {
  deleteProductCountryRule,
  saveProductCountryRule,
} from "@/lib/global-suite.functions";

type Props = {
  storeId: string;
  roundingRule: string;
  onRoundingRuleChange: (rule: string) => void;
};

/** Bölgesel katalog: ülkeye göre ürün gizleme/gösterme + psikolojik fiyat yuvarlama. */
export function RegionalCatalogPanel({ storeId, roundingRule, onRoundingRuleChange }: Props) {
  const queryClient = useQueryClient();
  const { data: products } = useQuery(productsQuery(storeId));
  const { data: rules } = useQuery(productCountryRulesQuery(storeId));
  const saveRule = useServerFn(saveProductCountryRule);
  const deleteRule = useServerFn(deleteProductCountryRule);

  const [productId, setProductId] = useState("");
  const [mode, setMode] = useState<"allow" | "block">("allow");
  const [countries, setCountries] = useState<string[]>([]);
  const [sample, setSample] = useState("34.12");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["product-country-rules", storeId] });

  const saveMutation = useMutation({
    mutationFn: () =>
      saveRule({ data: { storeId, productId, mode, countryCodes: countries } as never }),
    onSuccess: () => {
      toast.success("Bölgesel kural kaydedildi");
      setProductId("");
      setCountries([]);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRule({ data: { storeId, id } as never }),
    onSuccess: () => {
      toast.success("Kural kaldırıldı");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleCountry = (code: string) =>
    setCountries((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Psikolojik fiyat yuvarlama</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dövize çevrilen fiyatlar bu kurala göre yuvarlanır; ülke bazlı sabit fiyatlar etkilenmez.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Kural</Label>
            <Select value={roundingRule} onValueChange={onRoundingRuleChange}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICE_ROUNDING_RULES.map((rule) => (
                  <SelectItem key={rule.rule} value={rule.rule}>
                    {rule.label} ({rule.example})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rounding-sample">Deneme tutarı</Label>
            <Input
              id="rounding-sample"
              className="mt-1"
              value={sample}
              onChange={(event) => setSample(event.target.value)}
            />
            <p className="mt-2 text-sm">
              Sonuç:{" "}
              <strong>
                {applyPriceRounding(Number(sample.replace(",", ".")), roundingRule as never).toFixed(2)}
              </strong>
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Globe2 className="size-4" /> Ülkeye göre ürün görünürlüğü
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gümrük veya lisans kısıtı olan ürünleri yalnızca seçili ülkelere açın ya da belirli ülkelerde
          gizleyin.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Ürün</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Ürün seçin" />
              </SelectTrigger>
              <SelectContent>
                {(products ?? []).map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Kural tipi</Label>
            <Select value={mode} onValueChange={(next) => setMode(next as "allow" | "block")}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allow">Yalnızca seçili ülkelerde göster</SelectItem>
                <SelectItem value="block">Seçili ülkelerde gizle</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {GLOBAL_COUNTRIES.map((country) => (
            <button
              key={country.code}
              type="button"
              onClick={() => toggleCountry(country.code)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                countries.includes(country.code)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {country.code} · {country.name}
            </button>
          ))}
        </div>
        <Button
          className="mt-4"
          disabled={!productId || countries.length === 0 || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          Kuralı kaydet
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">Tanımlı kurallar</h3>
        {(rules ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Henüz bölgesel kural yok.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {(rules ?? []).map((rule) => (
              <li
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{rule.products?.title ?? "Ürün"}</p>
                  <p className="text-xs text-muted-foreground">
                    {rule.mode === "allow" ? "Yalnızca" : "Hariç"}: {rule.country_codes.join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{rule.mode === "allow" ? "İzin listesi" : "Engel listesi"}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(rule.id)}
                    aria-label="Kuralı sil"
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
