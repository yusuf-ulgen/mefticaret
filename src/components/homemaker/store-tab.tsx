import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Banknote, Facebook, ImagePlus, Instagram, Link2, Loader2, Save, Share2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BigButton, Field, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import { uploadStoreLogo } from "@/lib/media";
import { updateStore, updateStoreSettings } from "@/lib/stores.functions";

type Store = { id: string; name: string; logo_url: string | null };
type Settings = {
  bio: string | null;
  whatsapp_phone: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  payment_mode: string | null;
  bank_iban: string | null;
  bank_account_holder: string | null;
} | null;

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
        <Field label="Kendinizi tanıtın" hint="Müşterileriniz mağaza sayfanızda görecek.">
          <textarea
            className={`${inputClass} min-h-24 resize-y`}
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
        <p className="text-sm font-semibold text-hm-ink">Paranızı nasıl almak istersiniz?</p>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => setMode("mefpay")}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
              mode === "mefpay"
                ? "border-hm-emerald bg-hm-emerald-soft"
                : "border-hm-line bg-white"
            }`}
          >
            <ShieldCheck className="mt-0.5 size-5 text-hm-emerald" />
            <span>
              <span className="block font-semibold text-hm-ink">Mefpay ile kartla tahsilat</span>
              <span className="block text-sm text-hm-ink-soft">
                Müşteri kredi kartıyla öder, para hesabınıza geçer. Vergi muafiyeti belgeniz
                varsa da kullanabilirsiniz.
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

      <SoftCard className="grid gap-3">
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

      <BigButton onClick={save} disabled={saving} className="w-full">
        {saving ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
        Kaydet
      </BigButton>
    </div>
  );
}
