import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Calculator,
  Clock,
  Download,
  ImagePlus,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { CostCalculatorSheet } from "@/components/homemaker/cost-calculator";
import {
  BigButton,
  Field,
  Sheet,
  SoftCard,
  inputClass,
} from "@/components/homemaker/kolay-parts";
import { useSpeechToText } from "@/hooks/use-voice";
import { generateProductCopy } from "@/lib/ai.functions";
import { createProduct, deleteProduct, generateVariants, setVariantOptions, updateProduct, upsertVariant } from "@/lib/catalog.functions";
import type { SimpleProduct } from "@/lib/homemaker-queries";
import { addProductImage } from "@/lib/media.functions";
import { uploadProductImage } from "@/lib/media";
import { cleanProductPhoto } from "@/lib/photo-ai.functions";
import { formatMoney } from "@/lib/mefti";

const CATEGORIES = [
  "El yapımı takı",
  "Ev tekstili",
  "Sabun & mum",
  "Kozmetik",
  "Bebek & çocuk",
  "Ev yapımı gıda",
  "Hediyelik",
  "Diğer",
];

/** "Ürünlerim" sekmesi: sade ürün listesi, ekleme, stok anahtarı ve sosyal medya görseli. */
export function ProductsTab({
  storeId,
  storeName,
  storeUrl,
  products,
  currency,
}: {
  storeId: string;
  storeName: string;
  storeUrl: string;
  products: SimpleProduct[];
  currency: string;
}) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [social, setSocial] = useState<SimpleProduct | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const saveVariant = useServerFn(upsertVariant);
  const removeProduct = useServerFn(deleteProduct);
  const patchProduct = useServerFn(updateProduct);

  const toggleStock = async (product: SimpleProduct, inStock: boolean) => {
    const variant = product.variants[0];
    if (!variant) return;
    setBusyId(product.id);
    try {
      await saveVariant({
        data: {
          variantId: variant.id,
          productId: product.id,
          title: variant.title || "Standart",
          price: variant.price ?? product.base_price,
          stock: inStock ? Math.max(variant.stock ?? 0, 1) : 0,
          options: variant.options ?? {},
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["kolay-products", storeId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Güncellenemedi");
    } finally {
      setBusyId(null);
    }
  };

  const togglePublish = async (product: SimpleProduct) => {
    setBusyId(product.id);
    try {
      await patchProduct({
        data: {
          productId: product.id,
          patch: { status: product.status === "active" ? "draft" : "active" },
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["kolay-products", storeId] });
      toast.success(product.status === "active" ? "Ürün gizlendi" : "Ürün yayında");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Güncellenemedi");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (product: SimpleProduct) => {
    if (!confirm(`"${product.title}" ürününü silmek istediğinize emin misiniz?`)) return;
    setBusyId(product.id);
    try {
      await removeProduct({ data: { productId: product.id } });
      await queryClient.invalidateQueries({ queryKey: ["kolay-products", storeId] });
      toast.success("Ürün silindi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Silinemedi");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid gap-4">
      <BigButton onClick={() => setAddOpen(true)} className="w-full">
        <Plus className="size-5" /> Yeni ürün ekle
      </BigButton>

      {products.length === 0 ? (
        <SoftCard className="text-center">
          <p className="font-semibold text-hm-ink">Henüz ürün yok</p>
          <p className="mt-1 text-sm text-hm-ink-soft">
            İlk ürününüzü ekleyin; fotoğraf, isim ve fiyat yeterli.
          </p>
        </SoftCard>
      ) : (
        <div className="grid gap-3">
          {products.map((product) => (
            <SoftCard key={product.id} className="grid gap-3">
              <div className="flex gap-3">
                <div className="size-20 shrink-0 overflow-hidden rounded-2xl bg-hm-sand">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-hm-ink">{product.title}</p>
                  <p className="mt-0.5 text-base font-bold text-hm-rose">
                    {formatMoney(product.base_price, product.currency || currency)}
                  </p>
                  <p className="mt-0.5 text-xs text-hm-ink-soft">
                    {product.variants.length > 1
                      ? `${product.variants.length} seçenek · `
                      : ""}
                    {product.stock > 0 ? `${product.stock} adet var` : "Şu an yok"}
                  </p>
                  {product.made_to_order ? (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-hm-rose-soft px-2 py-0.5 text-xs font-semibold text-hm-rose">
                      <Clock className="size-3" /> Sipariş üzerine · {product.prep_days} gün
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busyId === product.id}
                  onClick={() => void toggleStock(product, product.stock === 0)}
                  className={`min-h-11 rounded-2xl px-4 text-sm font-semibold ${
                    product.stock > 0
                      ? "bg-hm-emerald-soft text-hm-emerald"
                      : "bg-hm-sand text-hm-ink-soft"
                  }`}
                >
                  {product.stock > 0 ? "Stokta var" : "Stokta yok"}
                </button>
                <button
                  type="button"
                  disabled={busyId === product.id}
                  onClick={() => void togglePublish(product)}
                  className={`min-h-11 rounded-2xl px-4 text-sm font-semibold ${
                    product.status === "active"
                      ? "bg-hm-teal-soft text-hm-teal"
                      : "bg-hm-sand text-hm-ink-soft"
                  }`}
                >
                  {product.status === "active" ? "Yayında" : "Gizli"}
                </button>
                <button
                  type="button"
                  onClick={() => setSocial(product)}
                  className="min-h-11 rounded-2xl bg-hm-rose-soft px-4 text-sm font-semibold text-hm-rose"
                >
                  Paylaşım görseli
                </button>
                <button
                  type="button"
                  aria-label="Ürünü sil"
                  disabled={busyId === product.id}
                  onClick={() => void remove(product)}
                  className="ml-auto grid size-11 place-items-center rounded-2xl bg-hm-sand text-hm-ink-soft"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </SoftCard>
          ))}
        </div>
      )}

      <AddProductSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        storeId={storeId}
        currency={currency}
      />
      <SocialSheet
        product={social}
        onClose={() => setSocial(null)}
        storeName={storeName}
        storeUrl={storeUrl}
        currency={currency}
      />
    </div>
  );
}

function AddProductSheet({
  open,
  onClose,
  storeId,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  storeId: string;
  currency: string;
}) {
  const queryClient = useQueryClient();
  const add = useServerFn(createProduct);
  const attachImage = useServerFn(addProductImage);
  const writeCopy = useServerFn(generateProductCopy);
  const saveOptions = useServerFn(setVariantOptions);
  const buildVariants = useServerFn(generateVariants);

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [optionOne, setOptionOne] = useState({ name: "Renk", values: "" });
  const [optionTwo, setOptionTwo] = useState({ name: "Boyut", values: "" });
  const [aiBusy, setAiBusy] = useState(false);
  const [madeToOrder, setMadeToOrder] = useState(false);
  const [prepDays, setPrepDays] = useState("2");
  const [noteEnabled, setNoteEnabled] = useState(false);
  const [noteLabel, setNoteLabel] = useState("Nakışlanacak isim");
  const [calcOpen, setCalcOpen] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<"title" | "description">("title");
  const patchProduct = useServerFn(updateProduct);
  const voice = useSpeechToText((text) => {
    if (voiceTarget === "title") setTitle((current) => (current ? `${current} ${text}` : text));
    else setDescription((current) => (current ? `${current} ${text}` : text));
    toast.success("Söyledikleriniz yazıldı");
  });
  const listenFor = (target: "title" | "description") => {
    setVoiceTarget(target);
    if (voice.listening) voice.stop();
    else voice.start();
  };
  const cleanPhoto = useServerFn(cleanProductPhoto);
  const [cleanBusy, setCleanBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const previewUrl = useRef<string>("");

  if (file) previewUrl.current = URL.createObjectURL(file);

  const writeDescription = async () => {
    if (title.trim().length < 2) {
      toast.error("Önce ürün adını yazın.");
      return;
    }
    setAiBusy(true);
    try {
      const result = await writeCopy({
        data: { storeId, title: title.trim(), keywords: category, tone: "samimi" },
      });
      setDescription(result.text.trim());
      toast.success("Açıklama hazır, dilediğiniz gibi değiştirebilirsiniz.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Açıklama yazılamadı");
    } finally {
      setAiBusy(false);
    }
  };

  const clearBackground = async () => {
    if (!file) {
      toast.error("Önce bir fotoğraf seçin.");
      return;
    }
    setCleanBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Fotoğraf okunamadı"));
        reader.readAsDataURL(file);
      });
      const result = await cleanPhoto({ data: { storeId, dataUrl } });
      const response = await fetch(result.dataUrl);
      const blob = await response.blob();
      setFile(new File([blob], `temiz-${Date.now()}.png`, { type: blob.type || "image/png" }));
      toast.success("Arka plan temizlendi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fotoğraf temizlenemedi");
    } finally {
      setCleanBusy(false);
    }
  };

  const reset = () => {
    setTitle("");
    setPrice("");
    setStock("1");
    setDescription("");
    setFile(null);
    setOptionOne({ name: "Renk", values: "" });
    setOptionTwo({ name: "Boyut", values: "" });
  };

  const submit = async () => {
    const priceValue = Number(price.replace(",", "."));
    if (title.trim().length < 2) {
      toast.error("Ürün adı en az 2 harf olmalı.");
      return;
    }
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      toast.error("Geçerli bir fiyat yazın.");
      return;
    }
    setSaving(true);
    try {
      const product = await add({
        data: {
          storeId,
          title: title.trim(),
          description: description.trim() || undefined,
          productType: category,
          basePrice: priceValue,
          stock: Math.max(0, Number(stock) || 0),
          status: "active",
        },
      });

      if (file) {
        const path = await uploadProductImage(storeId, product.id, file);
        await attachImage({ data: { productId: product.id, storagePath: path } });
      }

      const groups = [optionOne, optionTwo]
        .map((group) => ({
          name: group.name.trim(),
          values: group.values
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        }))
        .filter((group) => group.name && group.values.length > 0);

      if (groups.length > 0) {
        await saveOptions({ data: { productId: product.id, options: groups } });
        await buildVariants({ data: { productId: product.id, options: groups } });
      }

      if (madeToOrder || noteEnabled) {
        await patchProduct({
          data: {
            productId: product.id,
            patch: {
              made_to_order: madeToOrder,
              prep_days: madeToOrder ? Math.max(0, Math.min(90, Number(prepDays) || 0)) : 0,
              custom_note_enabled: noteEnabled,
              custom_note_label: noteEnabled ? noteLabel.trim().slice(0, 80) : null,
            },
          },
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["kolay-products", storeId] });
      toast.success("Ürün eklendi ve yayında");
      reset();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ürün eklenemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} title="Yeni ürün" onClose={onClose}>
      <div className="grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-hm-ink">Ürün fotoğrafı</span>
          <span className="grid h-40 place-items-center overflow-hidden rounded-3xl border border-dashed border-hm-line bg-hm-sand text-hm-ink-soft">
            {file ? (
              <img src={previewUrl.current} alt="" className="size-full object-cover" />
            ) : (
              <span className="grid justify-items-center gap-1 text-sm">
                <ImagePlus className="size-6" />
                Fotoğraf seç
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </span>
        </label>

        {file ? (
          <BigButton tone="ghost" disabled={cleanBusy} onClick={() => void clearBackground()}>
            {cleanBusy ? <Loader2 className="size-5 animate-spin" /> : <Wand2 className="size-5" />}
            Arka Planı Temizle (AI)
          </BigButton>
        ) : null}

        <Field label="Ürün adı">
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Örn. Lavantalı el sabunu"
            />
            {voice.supported ? (
              <button
                type="button"
                aria-label="Konuşarak ürün adı yaz"
                onClick={() => listenFor("title")}
                className={`grid size-12 shrink-0 place-items-center rounded-2xl ${
                  voice.listening && voiceTarget === "title"
                    ? "bg-hm-rose text-white"
                    : "bg-hm-sand text-hm-ink-soft"
                }`}
              >
                {voice.listening && voiceTarget === "title" ? (
                  <MicOff className="size-5" />
                ) : (
                  <Mic className="size-5" />
                )}
              </button>
            ) : null}
          </div>
        </Field>
        {voice.supported ? (
          <p className="-mt-2 text-xs text-hm-ink-soft">
            Mikrofona dokunup konuşarak ürün bilgisi girebilirsiniz.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Fiyat (${currency})`}>
            <input
              className={inputClass}
              value={price}
              inputMode="decimal"
              onChange={(event) => setPrice(event.target.value)}
              placeholder="120"
            />
          </Field>
          <Field label="Kaç adet var?">
            <input
              className={inputClass}
              value={stock}
              inputMode="numeric"
              onChange={(event) => setStock(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Kategori">
          <select
            className={inputClass}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Açıklama" hint="İsterseniz yardımcı sizin için yazsın.">
          <textarea
            className={`${inputClass} min-h-24`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ürününüzü birkaç cümleyle anlatın…"
          />
        </Field>
        <div className="flex gap-2">
          <BigButton tone="ghost" onClick={writeDescription} disabled={aiBusy} className="flex-1">
            {aiBusy ? <Loader2 className="size-5 animate-spin" /> : <Wand2 className="size-5" />}
            Açıklamayı bana yaz
          </BigButton>
          {voice.supported ? (
            <button
              type="button"
              aria-label="Konuşarak açıklama yaz"
              onClick={() => listenFor("description")}
              className={`grid size-12 shrink-0 place-items-center rounded-2xl ${
                voice.listening && voiceTarget === "description"
                  ? "bg-hm-rose text-white"
                  : "bg-hm-sand text-hm-ink-soft"
              }`}
            >
              {voice.listening && voiceTarget === "description" ? (
                <MicOff className="size-5" />
              ) : (
                <Mic className="size-5" />
              )}
            </button>
          ) : null}
        </div>

        <BigButton tone="ghost" onClick={() => setCalcOpen(true)} className="w-full">
          <Calculator className="size-5" /> Maliyet hesapla
        </BigButton>

        <SoftCard className="grid gap-3 bg-hm-sand">
          <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4">
            <input
              type="checkbox"
              checked={madeToOrder}
              onChange={(event) => setMadeToOrder(event.target.checked)}
              className="size-5 accent-hm-rose"
            />
            <Clock className="size-5 text-hm-rose" />
            <span className="text-sm font-semibold text-hm-ink">Sipariş üzerine üretilir</span>
          </label>
          {madeToOrder ? (
            <Field label="Hazırlanma süresi (gün)">
              <select
                className={inputClass}
                value={prepDays}
                onChange={(event) => setPrepDays(event.target.value)}
              >
                {["1", "2", "3", "4", "5", "7", "10", "14"].map((day) => (
                  <option key={day} value={day}>
                    {day} gün
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4">
            <input
              type="checkbox"
              checked={noteEnabled}
              onChange={(event) => setNoteEnabled(event.target.checked)}
              className="size-5 accent-hm-teal"
            />
            <span className="text-sm font-semibold text-hm-ink">
              Müşteri özel not yazabilsin
            </span>
          </label>
          {noteEnabled ? (
            <Field label="Not başlığı" hint="Örn. Nakışlanacak isim, pasta yazısı…">
              <input
                className={inputClass}
                value={noteLabel}
                onChange={(event) => setNoteLabel(event.target.value)}
              />
            </Field>
          ) : null}
        </SoftCard>


        <SoftCard className="grid gap-3 bg-hm-sand">
          <p className="text-sm font-semibold text-hm-ink">Seçenekler (isteğe bağlı)</p>
          <p className="text-xs text-hm-ink-soft">
            Örn. Renk: kırmızı, mavi — Boyut: küçük, büyük. Virgülle ayırın.
          </p>
          {[
            [optionOne, setOptionOne] as const,
            [optionTwo, setOptionTwo] as const,
          ].map(([group, setGroup], index) => (
            <div key={index} className="grid grid-cols-2 gap-2">
              <input
                className={inputClass}
                value={group.name}
                onChange={(event) => setGroup({ ...group, name: event.target.value })}
                placeholder={index === 0 ? "Renk" : "Boyut"}
              />
              <input
                className={inputClass}
                value={group.values}
                onChange={(event) => setGroup({ ...group, values: event.target.value })}
                placeholder="kırmızı, mavi"
              />
            </div>
          ))}
        </SoftCard>

        <BigButton onClick={submit} disabled={saving} className="w-full">
          {saving ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
          Ürünü yayınla
        </BigButton>

        <CostCalculatorSheet
          open={calcOpen}
          onClose={() => setCalcOpen(false)}
          currency={currency}
          onApply={(value) => setPrice(String(value))}
        />
      </div>
    </Sheet>
  );
}

/** Ürün fotoğrafını fiyat ve mağaza bağlantısıyla paylaşıma hazır kareye dönüştürür. */
function SocialSheet({
  product,
  onClose,
  storeName,
  storeUrl,
  currency,
}: {
  product: SimpleProduct | null;
  onClose: () => void;
  storeName: string;
  storeUrl: string;
  currency: string;
}) {
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);

  const build = async () => {
    if (!product) return;
    setBusy(true);
    try {
      const size = 1080;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Görsel oluşturulamadı");

      ctx.fillStyle = "#fdf6f4";
      ctx.fillRect(0, 0, size, size);

      if (product.imageUrl) {
        const photo = new Image();
        photo.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          photo.onload = () => resolve();
          photo.onerror = () => reject(new Error("Fotoğraf okunamadı"));
          photo.src = product.imageUrl;
        });
        const side = Math.min(photo.width, photo.height);
        ctx.drawImage(
          photo,
          (photo.width - side) / 2,
          (photo.height - side) / 2,
          side,
          side,
          0,
          0,
          size,
          size * 0.72,
        );
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, size * 0.72, size, size * 0.28);
      ctx.fillStyle = "#3b3330";
      ctx.font = "600 54px Geist, sans-serif";
      ctx.fillText(product.title.slice(0, 26), 60, size * 0.72 + 90);
      ctx.fillStyle = "#c2415a";
      ctx.font = "700 68px Geist, sans-serif";
      ctx.fillText(formatMoney(product.base_price, product.currency || currency), 60, size * 0.72 + 175);
      ctx.fillStyle = "#7a716d";
      ctx.font = "400 34px Geist, sans-serif";
      ctx.fillText(`${storeName} · ${storeUrl.replace(/^https?:\/\//, "")}`, 60, size * 0.72 + 240);

      setImage(canvas.toDataURL("image/png"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Görsel oluşturulamadı");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={Boolean(product)}
      title="Paylaşım görseli"
      onClose={() => {
        setImage("");
        onClose();
      }}
    >
      <div className="grid gap-3">
        {image ? (
          <img src={image} alt="" className="w-full rounded-3xl border border-hm-line" />
        ) : (
          <p className="text-sm text-hm-ink-soft">
            Ürün fotoğrafınızı fiyat ve mağaza adresinizle birlikte kare bir görsele
            dönüştürelim; Instagram ve WhatsApp durumunda paylaşabilirsiniz.
          </p>
        )}
        <BigButton onClick={build} disabled={busy}>
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
          Görseli oluştur
        </BigButton>
        {image ? (
          <a
            href={image}
            download={`${product?.title ?? "urun"}.png`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-hm-teal px-5 text-base font-semibold text-white"
          >
            <Download className="size-5" /> Görseli indir
          </a>
        ) : null}
      </div>
    </Sheet>
  );
}
