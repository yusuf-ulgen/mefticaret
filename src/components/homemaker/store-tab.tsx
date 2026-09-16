import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Banknote,
  Bell,
  Facebook,
  ImagePlus,
  Instagram,
  Link2,
  Loader2,
  Save,
  Share2,
  ShieldCheck,
  Snowflake,
  Trash2,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BigButton, Field, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import { ShopQrCard } from "@/components/homemaker/shop-qr-card";
import { UpgradeCard } from "@/components/homemaker/upgrade-card";
import { uploadStoreLogo } from "@/lib/media";
import { updateStoreSettings, updateStore } from "@/lib/stores.functions";

type Store = { id: string; name: string; logo_url: string | null };
type Settings = {
  bio: string | null;
  whatsapp_phone: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  payment_mode: string | null;
  bank_iban: string | null;
  bank_account_holder: string | null;
  daily_order_limit?: number | null;
  trust_badges?: string[] | null;
  gallery?: unknown;
  delivery_methods?: string[] | null;
  cold_pack_enabled?: boolean | null;
  cold_pack_fee?: number | null;
  voice_alerts?: boolean | null;
  campaign_banner?: unknown;
} | null;

const BADGES = [
  "Katkısız / Doğal",
  "Hijyen Sertifikalı",
  "Özel El Yapımı",
  "Günlük Üretim",
  "Vegan",
  "Hediye Paketi",
];

type DeliveryMethod = "shipping" | "local_delivery" | "pickup";

const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  shipping: "Tüm Türkiye'ye kargo",
  local_delivery: "Aynı şehir içi elden teslimat",
  pickup: "Gel-al (mağazadan teslim)",
};

/** Kullanıcı yalnızca kullanıcı adı yazdıysa tam bağlantıya çevirir. */
const toUrl = (value: string, base: string) => {
  const v = value.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `${base}${v.replace(/^@/, "")}`;
};

/** "Mağazam" sekmesi: isim, tanıtım, görsel, WhatsApp ve para alma yöntemi. */
export function StoreTab({
  store,
  settings,
  storeUrl,
}: {
  store: Store;
  settings: Settings;
  storeUrl: string;
}) {
  const queryClient = useQueryClient();
  const saveStore = useServerFn(updateStore);
  const saveSettings = useServerFn(updateStoreSettings);

  const [name, setName] = useState(store.name);
  const [bio, setBio] = useState(settings?.bio ?? "");
  const [whatsapp, setWhatsapp] = useState(settings?.whatsapp_phone ?? "");
  const [instagram, setInstagram] = useState(settings?.instagram_url ?? "");
  const [facebook, setFacebook] = useState(settings?.facebook_url ?? "");
  const [mode, setMode] = useState<"mefpay" | "bank_transfer">(
    settings?.payment_mode === "bank_transfer" ? "bank_transfer" : "mefpay",
  );
  const [iban, setIban] = useState(settings?.bank_iban ?? "");
  const [holder, setHolder] = useState(settings?.bank_account_holder ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(
    settings?.daily_order_limit ? String(settings.daily_order_limit) : "",
  );
  const [badges, setBadges] = useState<string[]>(settings?.trust_badges ?? []);
  const [gallery, setGallery] = useState<string[]>(
    Array.isArray(settings?.gallery) ? (settings?.gallery as string[]) : [],
  );
  const [delivery, setDelivery] = useState<DeliveryMethod[]>(
    ((settings?.delivery_methods ?? ["shipping"]) as DeliveryMethod[]).filter((method) =>
      ["shipping", "local_delivery", "pickup"].includes(method),
    ),
  );
  const [coldPack, setColdPack] = useState(Boolean(settings?.cold_pack_enabled));
  const [coldFee, setColdFee] = useState(String(Number(settings?.cold_pack_fee ?? 50)));
  const [voiceAlerts, setVoiceAlerts] = useState(Boolean(settings?.voice_alerts));
  const [galleryBusy, setGalleryBusy] = useState(false);

  // Kaydedilmemiş değişiklik takibi: alt şerit yalnızca gerçek fark varsa görünür.
  const currentSnapshot = JSON.stringify({
    name: name.trim(),
    bio: bio.trim(),
    whatsapp: whatsapp.trim(),
    instagram: instagram.trim(),
    facebook: facebook.trim(),
    mode,
    iban: iban.replace(/\s/g, "").toUpperCase(),
    holder: holder.trim(),
    dailyLimit: dailyLimit.trim(),
    badges: [...badges].sort(),
    delivery: [...delivery].sort(),
    coldPack,
    coldFee: Number(coldFee.replace(",", ".")) || 0,
    voiceAlerts,
  });
  const savedSnapshot = JSON.stringify({
    name: store.name.trim(),
    bio: (settings?.bio ?? "").trim(),
    whatsapp: (settings?.whatsapp_phone ?? "").trim(),
    instagram: (settings?.instagram_url ?? "").trim(),
    facebook: (settings?.facebook_url ?? "").trim(),
    mode: settings?.payment_mode === "bank_transfer" ? "bank_transfer" : "mefpay",
    iban: (settings?.bank_iban ?? "").replace(/\s/g, "").toUpperCase(),
    holder: (settings?.bank_account_holder ?? "").trim(),
    dailyLimit: settings?.daily_order_limit ? String(settings.daily_order_limit) : "",
    badges: [...(settings?.trust_badges ?? [])].sort(),
    delivery: [
      ...((settings?.delivery_methods ?? ["shipping"]) as DeliveryMethod[]).filter((method) =>
        ["shipping", "local_delivery", "pickup"].includes(method),
      ),
    ].sort(),
    coldPack: Boolean(settings?.cold_pack_enabled),
    coldFee: Number(settings?.cold_pack_fee ?? 50),
    voiceAlerts: Boolean(settings?.voice_alerts),
  });
  const dirty = currentSnapshot !== savedSnapshot;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Mağazayı tamamlama listesi: eksik olan adıma tek dokunuşla gidilir.
  const steps = [
    { id: "hm-photo", label: "Mağaza fotoğrafı ekle", done: Boolean(store.logo_url) },
    { id: "hm-basic", label: "Mağaza adını yaz", done: name.trim().length >= 2 },
    { id: "hm-basic", label: "Kendini tanıt (hikayen)", done: bio.trim().length >= 20 },
    { id: "hm-basic", label: "WhatsApp numarası ekle", done: whatsapp.replace(/\D/g, "").length >= 10 },
    {
      id: "hm-payment",
      label: "Para alma yöntemini seç",
      done: mode === "mefpay" || iban.replace(/\s/g, "").length >= 20,
    },
    { id: "hm-delivery", label: "Teslimat yöntemi seç", done: delivery.length > 0 },
    { id: "hm-badges", label: "Güven rozeti seç", done: badges.length > 0 },
    { id: "hm-gallery", label: "Galeriye fotoğraf ekle", done: gallery.length > 0 },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);
  const missing = steps.filter((step) => !step.done);

  const goTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });


  const toggleBadge = (badge: string) =>
    setBadges((current) =>
      current.includes(badge) ? current.filter((item) => item !== badge) : [...current, badge],
    );

  const toggleDelivery = (method: DeliveryMethod) =>
    setDelivery((current) =>
      current.includes(method) ? current.filter((item) => item !== method) : [...current, method],
    );

  const addGalleryPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (gallery.length >= 12) {
      toast.error("En fazla 12 fotoğraf ekleyebilirsiniz.");
      return;
    }
    setGalleryBusy(true);
    try {
      const url = await uploadStoreLogo(store.id, file);
      const next = [...gallery, url];
      setGallery(next);
      await saveSettings({ data: { storeId: store.id, patch: { gallery: next } } });
      await queryClient.invalidateQueries({ queryKey: ["store-settings", store.id] });
      toast.success("Fotoğraf galerinize eklendi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fotoğraf yüklenemedi");
    } finally {
      setGalleryBusy(false);
    }
  };

  const removeGalleryPhoto = async (url: string) => {
    const next = gallery.filter((item) => item !== url);
    setGallery(next);
    try {
      await saveSettings({ data: { storeId: store.id, patch: { gallery: next } } });
      await queryClient.invalidateQueries({ queryKey: ["store-settings", store.id] });
      toast.success("Fotoğraf kaldırıldı");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kaldırılamadı");
    }
  };

  useEffect(() => {
    setName(store.name);
  }, [store.name]);

  const save = async () => {
    if (name.trim().length < 2) {
      toast.error("Mağaza adı en az 2 harf olmalı.");
      return;
    }
    if (mode === "bank_transfer" && iban.replace(/\s/g, "").length < 20) {
      toast.error("Havale için geçerli bir IBAN yazın.");
      return;
    }
    setSaving(true);
    try {
      if (name.trim() !== store.name) {
        await saveStore({ data: { storeId: store.id, patch: { name: name.trim() } } });
      }
      await saveSettings({
        data: {
          storeId: store.id,
          patch: {
            bio: bio.trim(),
            whatsapp_phone: whatsapp.trim(),
            instagram_url: toUrl(instagram, "https://instagram.com/"),
            facebook_url: toUrl(facebook, "https://facebook.com/"),
            payment_mode: mode,
            bank_iban: iban.replace(/\s/g, "").toUpperCase(),
            bank_account_holder: holder.trim(),
            daily_order_limit: dailyLimit.trim() ? Math.max(0, Number(dailyLimit) || 0) : null,
            trust_badges: badges,
            gallery,
            delivery_methods: delivery.length > 0 ? delivery : ["shipping"],
            cold_pack_enabled: coldPack,
            cold_pack_fee: Math.max(0, Number(coldFee.replace(",", ".")) || 0),
            voice_alerts: voiceAlerts,
          },
        },
      });
      await queryClient.invalidateQueries();
      toast.success("Mağaza bilgileriniz kaydedildi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadStoreLogo(store.id, file);
      await saveStore({ data: { storeId: store.id, patch: { logo_url: url } } });
      await queryClient.invalidateQueries();
      toast.success("Mağaza fotoğrafınız güncellendi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fotoğraf yüklenemedi");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-4">
      <UpgradeCard storeId={store.id} />
      <SoftCard>
        <div className="flex items-center gap-4">
          <div className="size-20 shrink-0 overflow-hidden rounded-3xl border border-hm-line bg-hm-sand">
            {store.logo_url ? (
              <img src={store.logo_url} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <label className="flex-1">
            <span className="text-sm font-semibold text-hm-ink">Mağaza fotoğrafı</span>
            <p className="text-xs text-hm-ink-soft">Kare bir fotoğraf en güzel görünür.</p>
            <span className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl bg-hm-rose-soft px-4 text-sm font-semibold text-hm-rose">
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              Fotoğraf seç
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void onLogo(event.target.files?.[0])}
              />
            </span>
          </label>
        </div>
      </SoftCard>

      <SoftCard className="grid gap-4">
        <Field label="Mağaza adı">
          <input
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Örn. Ayşe'nin El Emeği"
          />
        </Field>
        <Field label="Hikayem / Biyografi" hint="Müşterileriniz mağaza sayfanızda görecek.">
          <textarea
            className={`${inputClass} min-h-32 resize-y`}
            value={bio}
            maxLength={400}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Evimde el yapımı sabun ve mum üretiyorum…"
          />
        </Field>
        <Field label="WhatsApp numaranız" hint="Siparişlerde müşteriye tek dokunuşla yazarsınız.">
          <input
            className={inputClass}
            value={whatsapp}
            inputMode="tel"
            onChange={(event) => setWhatsapp(event.target.value)}
            placeholder="0555 555 55 55"
          />
        </Field>
        <Field label="Instagram sayfanız" hint="Kullanıcı adınızı yazmanız yeterli.">
          <div className="relative">
            <Instagram className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-hm-ink-soft" />
            <input
              className={`${inputClass} pl-11`}
              value={instagram}
              inputMode="url"
              onChange={(event) => setInstagram(event.target.value)}
              placeholder="ornek: elyapimiseker"
            />
          </div>
        </Field>
        <Field label="Facebook sayfanız" hint="Sayfa adınızı veya tam bağlantıyı yazabilirsiniz.">
          <div className="relative">
            <Facebook className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-hm-ink-soft" />
            <input
              className={`${inputClass} pl-11`}
              value={facebook}
              inputMode="url"
              onChange={(event) => setFacebook(event.target.value)}
              placeholder="ornek: elyapimiseker"
            />
          </div>
        </Field>
      </SoftCard>

      <SoftCard className="grid gap-3">
        <p className="text-sm font-semibold text-hm-ink">Güven rozetleriniz</p>
        <p className="text-sm text-hm-ink-soft">
          Size uyanları seçin; mağaza sayfanızda müşterilere gösterilir.
        </p>
        <div className="flex flex-wrap gap-2">
          {BADGES.map((badge) => {
            const active = badges.includes(badge);
            return (
              <button
                key={badge}
                type="button"
                onClick={() => toggleBadge(badge)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-2xl px-3 text-sm font-semibold ${
                  active ? "bg-hm-emerald text-white" : "bg-hm-sand text-hm-ink-soft"
                }`}
              >
                <ShieldCheck className="size-4" />
                {badge}
              </button>
            );
          })}
        </div>
      </SoftCard>

      <SoftCard className="grid gap-3">
        <p className="text-sm font-semibold text-hm-ink">Fotoğraf galerim</p>
        <p className="text-sm text-hm-ink-soft">
          Mutfağınızdan, atölyenizden veya ürünlerinizden kareler ekleyin.
        </p>
        {gallery.length ? (
          <div className="grid grid-cols-3 gap-2">
            {gallery.map((url) => (
              <div key={url} className="relative overflow-hidden rounded-2xl bg-hm-sand">
                <img src={url} alt="" className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  aria-label="Fotoğrafı kaldır"
                  onClick={() => void removeGalleryPhoto(url)}
                  className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-xl bg-white/90 text-hm-rose"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-hm-line bg-white text-sm font-semibold text-hm-ink-soft">
          {galleryBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          Fotoğraf ekle
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void addGalleryPhoto(event.target.files?.[0])}
          />
        </label>
      </SoftCard>

      <SoftCard className="grid gap-3">
        <p className="text-sm font-semibold text-hm-ink">Teslimat yöntemleriniz</p>
        <div className="grid gap-2">
          {(Object.keys(DELIVERY_LABELS) as DeliveryMethod[]).map((method) => {
            const active = delivery.includes(method);
            return (
              <button
                key={method}
                type="button"
                onClick={() => toggleDelivery(method)}
                className={`flex min-h-14 items-center gap-3 rounded-2xl px-4 text-left text-sm font-semibold ${
                  active ? "bg-hm-teal-soft text-hm-teal" : "bg-hm-sand text-hm-ink-soft"
                }`}
              >
                <Truck className="size-5" />
                {DELIVERY_LABELS[method]}
              </button>
            );
          })}
        </div>
        <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-hm-sand px-4">
          <input
            type="checkbox"
            checked={coldPack}
            onChange={(event) => setColdPack(event.target.checked)}
            className="size-5 accent-hm-teal"
          />
          <Snowflake className="size-5 text-hm-teal" />
          <span className="text-sm font-semibold text-hm-ink">Buz aküsü / soğuk paketleme</span>
        </label>
        {coldPack ? (
          <Field label="Soğuk paketleme ücreti (₺)" hint="Sipariş tutarına eklenir.">
            <input
              className={inputClass}
              inputMode="decimal"
              value={coldFee}
              onChange={(event) => setColdFee(event.target.value)}
            />
          </Field>
        ) : null}
      </SoftCard>

      <SoftCard id="hm-quota" className="grid gap-3">
        <p className="text-sm font-semibold text-hm-ink">Günlük sipariş kotanız</p>
        <Field
          label="Bir günde en fazla kaç sipariş alabilirsiniz?"
          hint="Boş bırakırsanız sınır olmaz. Kota dolduğunda mağazanız sipariş almayı durdurur."
        >
          <input
            className={inputClass}
            inputMode="numeric"
            value={dailyLimit}
            onChange={(event) => setDailyLimit(event.target.value)}
            placeholder="Örn. 10"
          />
        </Field>
        <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-hm-sand px-4">
          <input
            type="checkbox"
            checked={voiceAlerts}
            onChange={(event) => setVoiceAlerts(event.target.checked)}
            className="size-5 accent-hm-rose"
          />
          <Bell className="size-5 text-hm-rose" />
          <span className="text-sm font-semibold text-hm-ink">
            Yeni sipariş geldiğinde sesli haber ver
          </span>
        </label>
      </SoftCard>

      <SoftCard id="hm-payment" className="grid gap-3">
        <p className="text-sm font-semibold text-hm-ink">Paranızı nasıl almak istersiniz?</p>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => setMode("mefpay")}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
              mode === "mefpay" ? "border-hm-emerald bg-hm-emerald-soft" : "border-hm-line bg-white"
            }`}
          >
            <ShieldCheck className="mt-0.5 size-5 text-hm-emerald" />
            <span>
              <span className="block font-semibold text-hm-ink">Mefpay ile kartla tahsilat</span>
              <span className="block text-sm text-hm-ink-soft">
                Müşteri kredi kartıyla öder, para hesabınıza geçer. Vergi muafiyeti belgeniz varsa
                da kullanabilirsiniz.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("bank_transfer")}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
              mode === "bank_transfer"
                ? "border-hm-teal bg-hm-teal-soft"
                : "border-hm-line bg-white"
            }`}
          >
            <Banknote className="mt-0.5 size-5 text-hm-teal" />
            <span>
              <span className="block font-semibold text-hm-ink">IBAN ile havale/EFT</span>
              <span className="block text-sm text-hm-ink-soft">
                Müşteri paranızı doğrudan banka hesabınıza gönderir.
              </span>
            </span>
          </button>
        </div>
        {mode === "bank_transfer" ? (
          <div className="grid gap-3">
            <Field label="IBAN">
              <input
                className={inputClass}
                value={iban}
                onChange={(event) => setIban(event.target.value)}
                placeholder="TR__ ____ ____ ____ ____ ____ __"
              />
            </Field>
            <Field label="Hesap sahibinin adı">
              <input
                className={inputClass}
                value={holder}
                onChange={(event) => setHolder(event.target.value)}
                placeholder="Ad Soyad"
              />
            </Field>
          </div>
        ) : null}
      </SoftCard>

      <SoftCard id="hm-share" className="grid gap-3">
        <p className="text-sm font-semibold text-hm-ink">Mağaza adresiniz</p>
        <p className="break-all text-sm text-hm-ink-soft">{storeUrl}</p>
        <p className="text-sm font-semibold text-hm-ink">Mağazanızı sosyal medyada paylaşın</p>
        <div className="grid grid-cols-3 gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${name.trim() || store.name} mağazama göz atın: ${storeUrl}`)}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-hm-emerald-soft px-3 text-sm font-semibold text-hm-emerald"
          >
            <Share2 className="size-4" />
            WhatsApp
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storeUrl)}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-hm-teal-soft px-3 text-sm font-semibold text-hm-teal"
          >
            <Facebook className="size-4" />
            Facebook
          </a>
          <button
            type="button"
            onClick={() => {
              void (async () => {
                try {
                  if (navigator.share) {
                    await navigator.share({ title: store.name, url: storeUrl });
                  } else {
                    await navigator.clipboard.writeText(storeUrl);
                    toast.success("Mağaza bağlantınız kopyalandı");
                  }
                } catch {
                  // Kullanıcı paylaşım penceresini kapattıysa sessiz geç.
                }
              })();
            }}
            className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-hm-rose-soft px-3 text-sm font-semibold text-hm-rose"
          >
            <Link2 className="size-4" />
            Paylaş
          </button>
        </div>
      </SoftCard>

      <ShopQrCard
        storeName={name.trim() || store.name}
        storeUrl={storeUrl}
        campaignCode={(settings?.campaign_banner as { code?: string } | null)?.code ?? null}
      />

      <BigButton onClick={save} disabled={saving || !dirty} className="w-full">
        {saving ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
        {dirty ? "Kaydet" : "Her şey kayıtlı"}
      </BigButton>

      {dirty ? (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-4 pb-2">
          <div className="mx-auto flex max-w-lg items-center gap-3 rounded-3xl border border-hm-line bg-white/95 p-3 shadow-lg backdrop-blur">
            <p className="min-w-0 flex-1 text-sm font-semibold text-hm-ink">
              Kaydedilmemiş değişiklikleriniz var
            </p>
            <BigButton onClick={save} disabled={saving} className="px-6">
              {saving ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
              Kaydet
            </BigButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
