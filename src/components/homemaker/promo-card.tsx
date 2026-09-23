import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Sparkles, Store, Trash2, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BigButton, Field, Sheet, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import {
  deleteCrossSellPartner,
  getPromoSettings,
  listCrossSellCandidates,
  listCrossSellPartners,
  savePromoSettings,
  saveCrossSellPartner,
  setCrossSellActive,
} from "@/lib/kolay-v8.functions";
import { formatMoney } from "@/lib/mefti";

/**
 * Satışı artıran anahtarlar: paket indirimi, kargo bedava barı ve komşu ürün
 * önerisi. Anahtarlar gerçek indirim kodu ve kargo eşiğine yazılır.
 */
export function PromoCard({ storeId, currency }: { storeId: string; currency: string }) {
  const queryClient = useQueryClient();
  const loadPromo = useServerFn(getPromoSettings);
  const loadPartners = useServerFn(listCrossSellPartners);
  const loadCandidates = useServerFn(listCrossSellCandidates);
  const savePromo = useServerFn(savePromoSettings);
  const savePartner = useServerFn(saveCrossSellPartner);
  const togglePartner = useServerFn(setCrossSellActive);
  const removePartner = useServerFn(deleteCrossSellPartner);

  const promoQuery = useQuery({
    queryKey: ["kolay-promo", storeId],
    queryFn: () => loadPromo({ data: { storeId } }),
  });
  const partnersQuery = useQuery({
    queryKey: ["kolay-cross-sell", storeId],
    queryFn: () => loadPartners({ data: { storeId } }),
  });

  const [bundleEnabled, setBundleEnabled] = useState(false);
  const [bundleQuantity, setBundleQuantity] = useState(2);
  const [bundlePercent, setBundlePercent] = useState(10);
  const [shippingEnabled, setShippingEnabled] = useState(false);
  const [threshold, setThreshold] = useState(250);
  const [crossSellEnabled, setCrossSellEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const promo = promoQuery.data;
    if (!promo) return;
    setBundleEnabled(promo.bundleEnabled);
    setBundleQuantity(promo.bundleMinQuantity);
    setBundlePercent(promo.bundleDiscountPercent);
    setShippingEnabled(promo.freeShippingEnabled);
    setThreshold(promo.freeShippingThreshold);
    setCrossSellEnabled(promo.crossSellEnabled);
  }, [promoQuery.data]);

  const persist = async (patch: Partial<Record<string, never>> = {}) => {
    void patch;
    setBusy(true);
    try {
      await savePromo({
        data: {
          storeId,
          bundleEnabled,
          bundleMinQuantity: bundleQuantity,
          bundleDiscountPercent: bundlePercent,
          freeShippingEnabled: shippingEnabled,
          freeShippingThreshold: threshold,
          crossSellEnabled,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["kolay-promo", storeId] });
      toast.success("Kampanya ayarlarınız kaydedildi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const candidatesQuery = useQuery({
    queryKey: ["kolay-cross-sell-candidates", storeId],
    queryFn: () => loadCandidates({ data: { storeId } }),
    enabled: pickerOpen,
  });

  const partners = partnersQuery.data ?? [];

  const addPartner = async (partnerStoreId: string, productId: string | null) => {
    try {
      await savePartner({
        data: { storeId, partnerStoreId, partnerProductId: productId, headline: null },
      });
      await queryClient.invalidateQueries({ queryKey: ["kolay-cross-sell", storeId] });
      setPickerOpen(false);
      toast.success("Komşu ürün önerisi eklendi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Eklenemedi");
    }
  };

  return (
    <>
      <SoftCard className="grid gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-hm-rose" />
          <h2 className="text-base font-bold">Satışı artıran anahtarlar</h2>
        </div>

        <label className="flex items-start gap-3 rounded-2xl bg-hm-rose-soft p-3">
          <input
            type="checkbox"
            checked={bundleEnabled}
            onChange={(event) => setBundleEnabled(event.target.checked)}
            className="mt-1 size-5 accent-[oklch(0.62_0.14_15)]"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-hm-rose">
              {bundleQuantity} Al %{bundlePercent} İndirim Kazan
            </span>
            <span className="mt-0.5 block text-xs text-hm-ink-soft">
              Açtığınızda <strong>{promoQuery.data?.bundleCode ?? "2AL10"}</strong> indirim kodu
              gerçekten çalışır; müşteriniz kasada bu kodu yazar.
            </span>
          </span>
        </label>

        {bundleEnabled ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kaç ürün alsın?">
              <input
                type="number"
                min={2}
                max={10}
                value={bundleQuantity}
                onChange={(event) => setBundleQuantity(Number(event.target.value) || 2)}
                className={inputClass}
              />
            </Field>
            <Field label="İndirim yüzdesi">
              <input
                type="number"
                min={1}
                max={50}
                value={bundlePercent}
                onChange={(event) => setBundlePercent(Number(event.target.value) || 10)}
                className={inputClass}
              />
            </Field>
          </div>
        ) : null}

        <label className="flex items-start gap-3 rounded-2xl bg-hm-emerald-soft p-3">
          <input
            type="checkbox"
            checked={shippingEnabled}
            onChange={(event) => setShippingEnabled(event.target.checked)}
            className="mt-1 size-5 accent-[oklch(0.55_0.12_160)]"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-hm-emerald">
              <Truck className="size-4" /> Kargo Bedava Barı
            </span>
            <span className="mt-0.5 block text-xs text-hm-ink-soft">
              {formatMoney(threshold, currency)} üzeri siparişlerde kargo ücreti alınmaz ve
              müşteriniz kasada “kargo bedavaya ne kadar kaldı” çizgisini görür.
            </span>
          </span>
        </label>

        {shippingEnabled ? (
          <Field label="Kargo bedava alt sınırı">
            <input
              type="number"
              min={0}
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value) || 0)}
              className={inputClass}
            />
          </Field>
        ) : null}

        <label className="flex items-start gap-3 rounded-2xl bg-hm-sand p-3">
          <input
            type="checkbox"
            checked={crossSellEnabled}
            onChange={(event) => setCrossSellEnabled(event.target.checked)}
            className="mt-1 size-5"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-hm-ink">
              <Store className="size-4" /> Komşu ürün önerisi
            </span>
            <span className="mt-0.5 block text-xs text-hm-ink-soft">
              Kasada müşterinize seçtiğiniz komşu mağazanın ürünü gösterilir.
            </span>
          </span>
        </label>

        <BigButton onClick={() => void persist()} disabled={busy}>
          {busy ? <Loader2 className="size-5 animate-spin" /> : null}
          Kaydet
        </BigButton>

        <div className="grid gap-2 border-t border-hm-line pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Önerdiğim komşu ürünler</p>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex min-h-10 items-center gap-1 rounded-2xl bg-hm-teal px-3 text-sm font-semibold text-white"
            >
              <Plus className="size-4" /> Ekle
            </button>
          </div>

          {partners.length === 0 ? (
            <p className="text-xs text-hm-ink-soft">
              Henüz komşu ürün seçmediniz. Örneğin mantı satıyorsanız komşunuzun erişte ürününü
              önerebilirsiniz.
            </p>
          ) : (
            <ul className="grid gap-2">
              {partners.map((partner) => (
                <li
                  key={partner.id}
                  className="flex items-center gap-3 rounded-2xl border border-hm-line p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {partner.productTitle ?? partner.storeName}
                    </p>
                    <p className="truncate text-xs text-hm-ink-soft">
                      {partner.storeName}
                      {partner.productPrice
                        ? ` · ${formatMoney(Number(partner.productPrice), partner.currency)}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await togglePartner({
                        data: { storeId, id: partner.id, isActive: !partner.isActive },
                      });
                      await queryClient.invalidateQueries({
                        queryKey: ["kolay-cross-sell", storeId],
                      });
                    }}
                    className={`min-h-10 rounded-2xl px-3 text-xs font-semibold ${
                      partner.isActive
                        ? "bg-hm-emerald-soft text-hm-emerald"
                        : "bg-hm-sand text-hm-ink-soft"
                    }`}
                  >
                    {partner.isActive ? "Açık" : "Kapalı"}
                  </button>
                  <button
                    type="button"
                    aria-label="Kaldır"
                    onClick={async () => {
                      await removePartner({ data: { storeId, id: partner.id } });
                      await queryClient.invalidateQueries({
                        queryKey: ["kolay-cross-sell", storeId],
                      });
                    }}
                    className="grid size-10 place-items-center rounded-2xl bg-hm-rose-soft text-hm-rose"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SoftCard>

      <Sheet open={pickerOpen} title="Komşu ürünü seç" onClose={() => setPickerOpen(false)}>
        {candidatesQuery.isPending ? (
          <p className="py-6 text-center text-sm text-hm-ink-soft">Komşularınız aranıyor…</p>
        ) : (candidatesQuery.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-hm-ink-soft">
            Şehrinizde önerebileceğiniz başka mağaza bulunamadı. Mağaza bilgilerinizde şehir yazılı
            olmalı.
          </p>
        ) : (
          <div className="grid gap-4">
            {(candidatesQuery.data ?? []).map((store) => (
              <div key={store.storeId} className="grid gap-2">
                <p className="text-sm font-bold">{store.storeName}</p>
                {store.products.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => void addPartner(store.storeId, null)}
                    className="min-h-11 rounded-2xl bg-hm-sand px-3 text-left text-sm"
                  >
                    Mağazanın tamamını öner
                  </button>
                ) : (
                  store.products.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => void addPartner(store.storeId, product.id)}
                      className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-hm-sand px-3 text-left text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">{product.title}</span>
                      <span className="shrink-0 font-semibold">
                        {formatMoney(product.price, product.currency)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </>
  );
}
