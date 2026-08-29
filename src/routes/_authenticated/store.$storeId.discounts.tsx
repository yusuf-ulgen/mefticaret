import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Tag } from "lucide-react";
import { useState } from "react";
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
import { discountsQuery } from "@/lib/sales-queries";
import { toggleDiscount, upsertDiscount } from "@/lib/sales.functions";
import { DISCOUNT_TYPE_LABELS, formatDate, formatMoney } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/discounts")({
  head: () => ({
    meta: [
      { title: "İndirimler — Mefticaret" },
      {
        name: "description",
        content:
          "Kupon kodları oluştur: yüzde indirim, sabit tutar veya ücretsiz kargo kampanyaları.",
      },
      { property: "og:title", content: "İndirimler — Mefticaret" },
      {
        property: "og:description",
        content: "Kupon kodları, kullanım limitleri ve kampanya takibi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscountsPage,
});

type DiscountType = "percentage" | "fixed_amount" | "free_shipping";

function DiscountsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: discounts, isLoading } = useQuery(discountsQuery(storeId));
  const save = useServerFn(upsertDiscount);
  const toggle = useServerFn(toggleDiscount);

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DiscountType>("percentage");
  const [value, setValue] = useState("10");
  const [minSubtotal, setMinSubtotal] = useState("0");
  const [usageLimit, setUsageLimit] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["discounts", storeId] });

  const createMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          storeId,
          code,
          title: title || undefined,
          type,
          value: Number(value) || 0,
          minSubtotal: Number(minSubtotal) || 0,
          usageLimit: usageLimit ? Number(usageLimit) : null,
          endsAt: endsAt || undefined,
          isActive: true,
        },
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Kupon oluşturuldu");
      setCode("");
      setTitle("");
      setUsageLimit("");
      setEndsAt("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { discountId: string; isActive: boolean }) => toggle({ data: input }),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      storeId={storeId}
      title="İndirimler"
      description="Kupon kodları ve kampanya kurallarını yönet."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <form
          className="surface-card space-y-4 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
        >
          <h2 className="text-lg font-semibold">Yeni kupon</h2>
          <div className="space-y-2">
            <Label htmlFor="d-code">Kod</Label>
            <Input
              id="d-code"
              required
              minLength={3}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="HOSGELDIN10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-title">Başlık</Label>
            <Input
              id="d-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="İlk siparişe %10"
            />
          </div>
          <div className="space-y-2">
            <Label>Tür</Label>
            <Select value={type} onValueChange={(next) => setType(next as DiscountType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DISCOUNT_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {type !== "free_shipping" ? (
            <div className="space-y-2">
              <Label htmlFor="d-value">
                {type === "percentage" ? "Yüzde (%)" : "Tutar (TRY)"}
              </Label>
              <Input
                id="d-value"
                type="number"
                min={0}
                step="0.01"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="d-min">Minimum sepet tutarı</Label>
            <Input
              id="d-min"
              type="number"
              min={0}
              step="0.01"
              value={minSubtotal}
              onChange={(event) => setMinSubtotal(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-limit">Kullanım limiti (boş = sınırsız)</Label>
            <Input
              id="d-limit"
              type="number"
              min={0}
              value={usageLimit}
              onChange={(event) => setUsageLimit(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-ends">Bitiş tarihi</Label>
            <Input
              id="d-ends"
              type="date"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Oluşturuluyor…" : "Kupon oluştur"}
          </Button>
        </form>

        <div className="lg:col-span-2">
          {isLoading ? (
            <p className="text-muted-foreground">Yükleniyor…</p>
          ) : (discounts ?? []).length === 0 ? (
            <div className="surface-card p-10 text-center">
              <Tag className="mx-auto mb-3 size-6 text-muted-foreground" />
              <p className="font-medium">Henüz kupon yok</p>
              <p className="text-sm text-muted-foreground">
                Soldaki formla ilk kampanyanı oluştur.
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {(discounts ?? []).map((discount) => (
                <li key={discount.id} className="surface-card space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold">{discount.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {discount.title ?? DISCOUNT_TYPE_LABELS[discount.type]}
                      </p>
                    </div>
                    <Switch
                      checked={discount.is_active}
                      aria-label={`${discount.code} kuponunu aç/kapat`}
                      onCheckedChange={(next) =>
                        toggleMutation.mutate({ discountId: discount.id, isActive: next })
                      }
                    />
                  </div>
                  <p className="text-lg font-semibold">
                    {discount.type === "percentage"
                      ? `%${Number(discount.value)}`
                      : discount.type === "fixed_amount"
                        ? formatMoney(Number(discount.value))
                        : "Ücretsiz kargo"}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{DISCOUNT_TYPE_LABELS[discount.type]}</Badge>
                    <span>Min. {formatMoney(Number(discount.min_subtotal))}</span>
                    <span>
                      {discount.used_count}
                      {discount.usage_limit ? ` / ${discount.usage_limit}` : ""} kullanım
                    </span>
                    <span>Bitiş: {formatDate(discount.ends_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
