import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { createManualOrderFn } from "@/lib/sales.functions";
import { formatMoney } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/orders/new")({
  head: () => ({
    meta: [
      { title: "Manuel sipariş — Mefticaret" },
      {
        name: "description",
        content: "Telefon veya WhatsApp üzerinden gelen siparişleri panelden hızlıca oluştur.",
      },
      { property: "og:title", content: "Manuel sipariş — Mefticaret" },
      {
        property: "og:description",
        content: "Ürün seç, müşteri bilgisini gir ve siparişi anında kaydet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManualOrderPage,
});

type Line = { variantId: string; quantity: number };

function ManualOrderPage() {
  const { storeId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createFn = useServerFn(createManualOrderFn);

  const { data: products } = useQuery({
    queryKey: ["manual-order-variants", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, currency, base_price, status, product_variants(id, title, price, stock)")
        .eq("store_id", storeId)
        .neq("status", "archived")
        .order("title");
      if (error) throw error;
      return data ?? [];
    },
  });

  const variantIndex = useMemo(() => {
    const list: { id: string; label: string; price: number; stock: number }[] = [];
    for (const product of products ?? []) {
      for (const variant of product.product_variants ?? []) {
        list.push({
          id: variant.id,
          label: `${product.title}${variant.title ? ` — ${variant.title}` : ""}`,
          price: Number(variant.price ?? product.base_price),
          stock: Number(variant.stock ?? 0),
        });
      }
    }
    return list;
  }, [products]);

  const [lines, setLines] = useState<Line[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [line1, setLine1] = useState("");
  const [shipping, setShipping] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "paid">("pending");
  const [note, setNote] = useState("");

  const subtotal = lines.reduce((sum, line) => {
    const variant = variantIndex.find((row) => row.id === line.variantId);
    return sum + (variant ? variant.price * line.quantity : 0);
  }, 0);
  const estimated = Math.max(0, subtotal - (Number(discount) || 0)) + (Number(shipping) || 0);

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          storeId,
          customer: { fullName, email, phone: phone || null },
          address: { city: city || null, line1: line1 || null },
          items: lines,
          shippingTotal: Number(shipping) || 0,
          discountTotal: Number(discount) || 0,
          paymentStatus,
          note: note || null,
        },
      }),
    onSuccess: (result) => {
      toast.success(`${result.orderNumber} oluşturuldu`);
      void queryClient.invalidateQueries({ queryKey: ["orders", storeId] });
      void navigate({
        to: "/store/$storeId/orders/$orderId",
        params: { storeId, orderId: result.orderId },
      });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Sipariş oluşturulamadı"),
  });

  const canSubmit = lines.length > 0 && fullName.trim().length > 1 && /.+@.+\..+/.test(email);

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
        <header className="flex items-center gap-3">
          <ShoppingBag className="size-5 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Manuel sipariş</h1>
            <p className="text-sm text-muted-foreground">
              Telefon veya mesajla gelen siparişleri panelden oluştur; stok ve finans kayıtları otomatik işlenir.
            </p>
          </div>
        </header>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ürünler</h2>
          <div className="flex flex-col gap-3">
            {lines.map((line, index) => (
              <div key={index} className="flex flex-wrap items-end gap-3">
                <div className="min-w-[240px] flex-1">
                  <Label className="text-xs">Ürün</Label>
                  <Select
                    value={line.variantId}
                    onValueChange={(value) =>
                      setLines((prev) => prev.map((row, i) => (i === index ? { ...row, variantId: value } : row)))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ürün seç" />
                    </SelectTrigger>
                    <SelectContent>
                      {variantIndex.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {variant.label} · {formatMoney(variant.price, "TRY")} · stok {variant.stock}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label className="text-xs">Adet</Label>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(event) =>
                      setLines((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, quantity: Math.max(1, Number(event.target.value) || 1) } : row,
                        ),
                      )
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                  aria-label="Satırı sil"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              className="self-start"
              onClick={() =>
                setLines((prev) => [...prev, { variantId: variantIndex[0]?.id ?? "", quantity: 1 }])
              }
              disabled={!variantIndex.length}
            >
              <Plus className="mr-2 size-4" /> Satır ekle
            </Button>
          </div>
        </section>

        <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-2">
          <div>
            <Label>Ad soyad</Label>
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </div>
          <div>
            <Label>E-posta</Label>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
          <div>
            <Label>Şehir</Label>
            <Input value={city} onChange={(event) => setCity(event.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Adres</Label>
            <Input value={line1} onChange={(event) => setLine1(event.target.value)} />
          </div>
        </section>

        <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-3">
          <div>
            <Label>Kargo tutarı</Label>
            <Input type="number" min={0} value={shipping} onChange={(event) => setShipping(event.target.value)} />
          </div>
          <div>
            <Label>İndirim tutarı</Label>
            <Input type="number" min={0} value={discount} onChange={(event) => setDiscount(event.target.value)} />
          </div>
          <div>
            <Label>Ödeme durumu</Label>
            <Select value={paymentStatus} onValueChange={(value) => setPaymentStatus(value as "pending" | "paid")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Bekliyor</SelectItem>
                <SelectItem value="paid">Ödendi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Label>Not</Label>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5">
          <div className="text-sm text-muted-foreground">
            Ara toplam {formatMoney(subtotal, "TRY")} · Tahmini toplam{" "}
            <strong className="text-foreground">{formatMoney(estimated, "TRY")}</strong> (vergi sunucuda hesaplanır)
          </div>
          <Button onClick={() => create.mutate()} disabled={!canSubmit || create.isPending}>
            {create.isPending ? "Oluşturuluyor…" : "Siparişi oluştur"}
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
