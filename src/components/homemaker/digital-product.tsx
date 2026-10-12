import { useQuery } from "@tanstack/react-query";
import { Download, FileUp, Link2, Package, Sparkles, Truck } from "lucide-react";

import { Field, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/mefti";
import type { SimpleOrder } from "@/lib/homemaker-queries";

export const DIGITAL_TYPES = [
  { value: "ebook", label: "E-Kitap / PDF" },
  { value: "pattern", label: "Örgü/Dikiş Kalıbı" },
  { value: "license", label: "Yazılım / Lisans Kodu" },
  { value: "recipe", label: "Özel Tarif / Rehber" },
  { value: "design", label: "Dijital Tasarım / Link" },
] as const;
export type DigitalSubType = (typeof DIGITAL_TYPES)[number]["value"];

export const DIGITAL_ACCEPT = ".pdf,.zip,.epub,image/*,application/pdf,application/zip,application/epub+zip";
const MAX_BYTES = 50 * 1024 * 1024;

export type DigitalDraft = {
  subType: DigitalSubType;
  file: File | null;
  accessUrl: string;
  deliveryNote: string;
};

export const emptyDigitalDraft = (): DigitalDraft => ({
  subType: "ebook",
  file: null,
  accessUrl: "",
  deliveryNote: "",
});

/** Kaydetmeden önce kontrol; hata metni döner (yoksa null). */
export function validateDigitalDraft(draft: DigitalDraft): string | null {
  if (!draft.file && !draft.accessUrl.trim()) return "Bir dosya yükleyin veya erişim bağlantısı yazın.";
  if (draft.accessUrl.trim() && !/^https:\/\/\S+$/i.test(draft.accessUrl.trim()))
    return "Bağlantı https:// ile başlamalı.";
  if (draft.file && draft.file.size > MAX_BYTES) return "Dosya en fazla 50 MB olabilir.";
  if (draft.file && !/\.(pdf|zip|epub|png|jpe?g|webp|gif)$/i.test(draft.file.name))
    return "Yalnız PDF, ZIP, EPUB veya görsel dosyası yükleyebilirsiniz.";
  return null;
}

/** Dosyayı özel alana yükler, dijital bilgileri kaydeder ve ürünü dijital işaretler. */
export async function saveDigitalAsset(storeId: string, productId: string, draft: DigitalDraft) {
  let filePath: string | null = null;
  let fileName: string | null = null;
  if (draft.file) {
    const safe = draft.file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    filePath = `${storeId}/${productId}/${Date.now()}-${safe}`;
    fileName = draft.file.name.slice(0, 120);
    const { error } = await supabase.storage
      .from("digital-assets")
      .upload(filePath, draft.file, { upsert: false, contentType: draft.file.type || "application/octet-stream" });
    if (error) throw new Error(`Dosya yüklenemedi: ${error.message}`);
  }
  const { error: assetError } = await supabase.from("kolay_digital_assets").upsert({
    product_id: productId,
    store_id: storeId,
    sub_type: draft.subType,
    file_path: filePath,
    file_name: fileName,
    access_url: draft.accessUrl.trim() || null,
    delivery_note: draft.deliveryNote.trim().slice(0, 1000) || null,
  });
  if (assetError) throw new Error(assetError.message);
  const { error: productError } = await supabase.from("products").update({ is_digital: true }).eq("id", productId);
  if (productError) throw new Error(productError.message);
}

/** "Fiziki / Dijital" seçici. */
export function ProductKindToggle({ digital, onChange }: { digital: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-3xl bg-hm-sand p-1.5" role="radiogroup" aria-label="Ürün türü">
      {[
        { value: false, label: "Fiziki Ürün", hint: "Kargo ile", icon: Truck },
        { value: true, label: "Dijital Ürün", hint: "Anında İndirme", icon: Download },
      ].map((option) => {
        const Icon = option.icon;
        const active = digital === option.value;
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`flex min-h-16 items-center gap-2 rounded-2xl px-3 text-left transition ${
              active ? "bg-white shadow-sm ring-2 ring-hm-teal" : "text-hm-ink-soft"
            }`}
          >
            <Icon className={`size-5 shrink-0 ${active ? "text-hm-teal" : ""}`} />
            <span className="grid">
              <span className="text-sm font-bold text-hm-ink">{option.label}</span>
              <span className="text-xs text-hm-ink-soft">({option.hint})</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Dijital ürün alt türü, dosya, bağlantı ve teslim notu alanları. */
export function DigitalAssetFields({ draft, onChange }: { draft: DigitalDraft; onChange: (draft: DigitalDraft) => void }) {
  return (
    <SoftCard className="grid gap-4 bg-hm-teal-soft">
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-hm-teal" />
        <p className="text-sm font-bold text-hm-ink">Dijital dosya ve teslimat</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DIGITAL_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange({ ...draft, subType: type.value })}
            className={`min-h-11 rounded-full border px-3 text-sm ${
              draft.subType === type.value
                ? "border-hm-teal bg-white font-semibold text-hm-ink"
                : "border-hm-line bg-white/60 text-hm-ink-soft"
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-hm-ink">Dosya (PDF, ZIP, EPUB, görsel · en fazla 50 MB)</span>
        <span className="flex min-h-20 items-center gap-3 rounded-3xl border border-dashed border-hm-teal bg-white px-4 text-sm text-hm-ink-soft">
          <FileUp className="size-6 shrink-0 text-hm-teal" />
          <span className="min-w-0 truncate">{draft.file ? draft.file.name : "Dosya seçmek için dokunun"}</span>
          <input
            type="file"
            accept={DIGITAL_ACCEPT}
            className="hidden"
            onChange={(event) => onChange({ ...draft, file: event.target.files?.[0] ?? null })}
          />
        </span>
      </label>

      <Field label="Lisans / erişim bağlantısı (isteğe bağlı)" hint="Google Drive, Canva veya yazılım erişim adresi">
        <div className="flex items-center gap-2">
          <Link2 className="size-5 shrink-0 text-hm-teal" />
          <input
            className={inputClass}
            value={draft.accessUrl}
            inputMode="url"
            onChange={(event) => onChange({ ...draft, accessUrl: event.target.value })}
            placeholder="https://drive.google.com/…"
          />
        </div>
      </Field>

      <Field label="Satın alma sonrası not" hint="Alıcı ödeme onaylanınca görür">
        <textarea
          className={`${inputClass} min-h-20`}
          value={draft.deliveryNote}
          maxLength={1000}
          onChange={(event) => onChange({ ...draft, deliveryNote: event.target.value })}
          placeholder="Örn. Şifreniz: 1234, dosyayı aşağıdan indirin."
        />
      </Field>
    </SoftCard>
  );
}

/** Sipariş kartındaki rozet. */
export function DigitalOrderBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-hm-teal-soft px-2.5 py-1 text-xs font-semibold text-hm-teal">
      <Download className="size-3.5" /> Dijital Teslimat (Kargo Gerektirmez)
    </span>
  );
}

/** Mağazanın dijital ürün kimlikleri (ürün listesinde rozet için). */
export const digitalProductIdsQuery = (storeId: string) => ({
  queryKey: ["kolay-digital-ids", storeId],
  staleTime: 30_000,
  queryFn: async () => {
    const { data, error } = await supabase.from("products").select("id").eq("store_id", storeId).eq("is_digital", true);
    if (error) throw error;
    return new Set((data ?? []).map((row) => row.id));
  },
});

export function useDigitalProductIds(storeId: string) {
  return useQuery(digitalProductIdsQuery(storeId)).data ?? new Set<string>();
}

/** Ödenmiş siparişlerden dijital (pasif) ve fiziki (el emeği) geliri ayrı gösterir. */
export function DigitalRevenueCard({ orders, currency }: { orders: SimpleOrder[]; currency: string }) {
  const paid = orders.filter((order) => order.payment_status === "paid" && !["cancelled", "refunded"].includes(order.status));
  const digital = paid.filter((order) => order.is_digital);
  const physical = paid.filter((order) => !order.is_digital);
  const sum = (list: SimpleOrder[]) => list.reduce((total, order) => total + Number(order.grand_total ?? 0), 0);
  const digitalTotal = sum(digital);
  const physicalTotal = sum(physical);
  const all = digitalTotal + physicalTotal;
  const share = all > 0 ? Math.round((digitalTotal / all) * 100) : 0;

  return (
    <SoftCard className="grid gap-3">
      <p className="text-sm font-bold text-hm-ink">Gelir dağılımı (ödenen siparişler)</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-hm-teal-soft p-3">
          <p className="flex items-center gap-1 text-xs font-semibold text-hm-teal">
            <Download className="size-3.5" /> Dijital pasif gelir
          </p>
          <p className="text-lg font-bold text-hm-ink">{formatMoney(digitalTotal, currency)}</p>
          <p className="text-xs text-hm-ink-soft">{digital.length} sipariş</p>
        </div>
        <div className="rounded-2xl bg-hm-amber-soft p-3">
          <p className="flex items-center gap-1 text-xs font-semibold text-hm-amber">
            <Package className="size-3.5" /> El emeği satışlar
          </p>
          <p className="text-lg font-bold text-hm-ink">{formatMoney(physicalTotal, currency)}</p>
          <p className="text-xs text-hm-ink-soft">{physical.length} sipariş</p>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-hm-amber-soft" aria-label={`Dijital pay %${share}`}>
        <div className="h-full bg-hm-teal" style={{ width: `${share}%` }} />
      </div>
      <p className="text-xs text-hm-ink-soft">Gelirinizin %{share}'i dijital ürünlerden.</p>
    </SoftCard>
  );
}
