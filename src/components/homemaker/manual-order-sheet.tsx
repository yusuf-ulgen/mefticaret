import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { BigButton, Field, Sheet, inputClass } from "@/components/homemaker/kolay-parts";
import type { SimpleProduct } from "@/lib/homemaker-queries";
import { formatMoney } from "@/lib/mefti";
import { createManualOrderFn } from "@/lib/sales.functions";

/**
 * WhatsApp / telefon ile gelen siparişi panele kaydeder.
 * Fiyat, stok ve toplam sunucuda üründen okunur; buradaki tutar yalnızca bilgi amaçlıdır.
 */
export function ManualOrderSheet({
  open,
  onClose,
  storeId,
  products,
  currency,
  source,
}: {
  open: boolean;
  onClose: () => void;
  storeId: string;
  products: SimpleProduct[];
  currency: string;
  source: "whatsapp" | "phone";
}) {
  const queryClient = useQueryClient();
  const createOrder = useServerFn(createManualOrderFn);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [line1, setLine1] = useState("");
  const [note, setNote] = useState("");
  const [paid, setPaid] = useState(false);
  const [shipping, setShipping] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const sellable = useMemo(
    () => products.filter((product) => product.variants.length > 0),
    [products],
  );

  const priceOf = (product: SimpleProduct) => {
    const variant = product.variants[0];
    return Number(variant?.price ?? product.base_price ?? 0);
  };

  const chosen = sellable.filter((product) => (quantities[product.id] ?? 0) > 0);
  const estimate =
    chosen.reduce((sum, product) => sum + priceOf(product) * (quantities[product.id] ?? 0), 0) +
    (Number(shipping.replace(",", ".")) || 0);

  const bump = (productId: string, delta: number) =>
    setQuantities((current) => {
      const next = Math.max(0, Math.min(99, (current[productId] ?? 0) + delta));
      return { ...current, [productId]: next };
    });

  const reset = () => {
    setFullName("");
    setPhone("");
    setEmail("");
    setCity("");
    setLine1("");
    setNote("");
    setShipping("");
    setPaid(false);
    setQuantities({});
  };

  const save = async () => {
    if (fullName.trim().length < 2) {
      toast.error("Müşterinin adını yazın.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10 && !email.trim()) {
      toast.error("Telefon numarası yazın (veya e-posta).");
      return;
    }
    const items = chosen.map((product) => ({
      variantId: product.variants[0]!.id,
      quantity: quantities[product.id] ?? 1,
    }));
    if (items.length === 0) {
      toast.error("En az bir ürün seçin.");
      return;
    }
    setSaving(true);
    try {
      const result = await createOrder({
        data: {
          storeId,
          source,
          customer: {
            fullName: fullName.trim(),
            phone: phone.trim() || null,
            email: email.trim() || null,
          },
          address: { city: city.trim() || null, line1: line1.trim() || null },
          items,
          shippingTotal: Number(shipping.replace(",", ".")) || 0,
          discountTotal: 0,
          paymentStatus: paid ? "paid" : "pending",
          note:
            [source === "whatsapp" ? "WhatsApp siparişi" : "Telefon siparişi", note.trim()]
              .filter(Boolean)
              .join(" · ") || null,
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["kolay-orders", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["kolay-products", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["kolay-customers", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["kolay-finance", storeId] }),
      ]);
      reset();
      onClose();
      toast.success(`Sipariş eklendi: ${result.orderNumber}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sipariş kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      title={source === "whatsapp" ? "WhatsApp siparişi ekle" : "Telefon siparişi ekle"}
      onClose={onClose}
    >
      <div className="grid gap-3">
        <Field label="Müşteri adı">
          <input
            className={inputClass}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Ayşe Yılmaz"
          />
        </Field>
        <Field label="Telefon" hint="WhatsApp'tan yazdığı numara">
          <input
            className={inputClass}
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="0555 111 22 33"
          />
        </Field>
        <Field label="E-posta (isteğe bağlı)" hint="Kartla ödeme bağlantısı göndermek için gerekli">
          <input
            className={inputClass}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Şehir">
          <input
            className={inputClass}
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
        </Field>
        <Field label="Adres">
          <input
            className={inputClass}
            value={line1}
            onChange={(event) => setLine1(event.target.value)}
            placeholder="Mahalle, sokak, no"
          />
        </Field>

        <div className="grid gap-2">
          <p className="text-sm font-semibold text-hm-ink">Ürünler</p>
          {sellable.length === 0 ? (
            <p className="rounded-2xl bg-hm-sand p-3 text-sm text-hm-ink-soft">
              Önce Ürünlerim sekmesinden ürün ekleyin.
            </p>
          ) : (
            sellable.map((product) => {
              const count = quantities[product.id] ?? 0;
              return (
                <div
                  key={product.id}
                  className="flex items-center gap-3 rounded-2xl border border-hm-line p-2"
                >
                  <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-hm-sand">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt="" className="size-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-hm-ink">{product.title}</p>
                    <p className="text-xs text-hm-ink-soft">
                      {formatMoney(priceOf(product), currency)} · stok {product.stock}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Azalt"
                      onClick={() => bump(product.id, -1)}
                      className="grid size-10 place-items-center rounded-xl bg-hm-sand text-hm-ink"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-hm-ink">{count}</span>
                    <button
                      type="button"
                      aria-label="Arttır"
                      onClick={() => bump(product.id, 1)}
                      className="grid size-10 place-items-center rounded-xl bg-hm-rose-soft text-hm-rose"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Field label="Kargo ücreti" hint="Ücretsiz kargo için boş bırakın">
          <input
            className={inputClass}
            inputMode="decimal"
            value={shipping}
            onChange={(event) => setShipping(event.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="Not">
          <input
            className={inputClass}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Örn. cuma günü teslim"
          />
        </Field>

        <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-hm-line px-4">
          <span className="text-sm font-semibold text-hm-ink">Ödemeyi şimdi aldım</span>
          <input
            type="checkbox"
            checked={paid}
            onChange={(event) => setPaid(event.target.checked)}
            className="size-5 accent-[var(--color-hm-rose,#f43f5e)]"
          />
        </label>

        <p className="rounded-2xl bg-hm-sand px-4 py-3 text-sm text-hm-ink-soft">
          Tahmini toplam: <strong className="text-hm-ink">{formatMoney(estimate, currency)}</strong>{" "}
          — kesin tutar kaydedince sunucuda hesaplanır.
        </p>

        <BigButton onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Siparişi kaydet
        </BigButton>
      </div>
    </Sheet>
  );
}
