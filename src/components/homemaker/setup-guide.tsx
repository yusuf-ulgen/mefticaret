import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { storeReadinessQuery } from "@/lib/store-readiness-query";
import { Check, CreditCard, Package, Palette, Store } from "lucide-react";

import { SoftCard } from "@/components/homemaker/kolay-parts";

type GuideSettings = {
  bio?: string | null;
  payment_mode?: string | null;
  bank_iban?: string | null;
  whatsapp_phone?: string | null;
} | null;

/**
 * "Yeni mağaza rehberi": mağaza oluştur → vitrin kur → ürün yükle → ödeme ayarla.
 * Her adım gerçek verilere bakar; hepsi tamamlanınca kart gizlenir.
 */
export function SetupGuide({
  storeId,
  storeName,
  logoUrl,
  settings,
  productCount,
  storeUrl,
  onGoToProducts,
}: {
  storeId: string;
  storeName: string;
  logoUrl: string | null;
  settings: GuideSettings;
  productCount: number;
  storeUrl: string;
  onGoToProducts: () => void;
}) {
  const readiness = useQuery(storeReadinessQuery(storeId));
  const hasStore = Boolean(storeName?.trim());
  const hasShopLook = Boolean(logoUrl) && Boolean(settings?.bio?.trim());
  const hasProduct = (readiness.data?.publishedProducts ?? 0) > 0;
  const mode = settings?.payment_mode ?? "";
  const hasPayment =
    mode === "mefpay" ||
    (mode === "bank_transfer" && Boolean(settings?.bank_iban?.trim()));

  const steps = [
    {
      icon: Store,
      title: "1. Mağazanızı oluşturun",
      text: "Mağaza adınız hazır. İsterseniz aşağıdaki formdan adını her zaman değiştirebilirsiniz.",
      done: hasStore,
      action: null as null | { label: string; onClick: () => void },
    },
    {
      icon: Palette,
      title: "2. Vitrininizi kurun",
      text: "Mağaza fotoğrafınızı ekleyin ve kısa bir tanıtım yazın; vitrininiz bu bilgilerle açılır.",
      done: hasShopLook,
      action: null,
    },
    {
      icon: Package,
      title: "3. İlk ürününüzü yükleyin",
      text: "Fotoğraf, isim ve fiyat yeterli. Açıklamayı yardımcı sizin için yazabilir.",
      done: hasProduct,
      action: { label: "Ürün ekle", onClick: onGoToProducts },
    },
    {
      icon: CreditCard,
      title: "4. Ödemeyi ayarlayın",
      text: "Kartla tahsilat, IBAN'a havale veya WhatsApp ile anlaşma: paranızı nasıl alacağınızı seçin.",
      done: hasPayment,
      action: null,
    },
    {
      icon: Store,
      title: "5. Politikalarınızı yayınlayın",
      text: "Gizlilik, mesafeli satış ve iade belgelerinin yayınlanmış ve yürürlükteki sürümleri gereklidir.",
      done: readiness.data?.policies.ready === true,
      action: null,
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) return null;

  return (
    <SoftCard>
      <div className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-lg font-bold text-hm-ink">Yeni mağaza rehberi</h2>
          <p className="text-sm text-hm-ink-soft">
            {doneCount}/{steps.length} adım tamam. Kalan adımları bitirince mağazanız satışa hazır.
          </p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-hm-line">
            <div
              className="h-full rounded-full bg-hm-rose transition-all"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
        </div>
        <ol className="grid gap-2.5">
          {steps.map((step) => (
            <li
              key={step.title}
              className="flex items-start gap-3 rounded-2xl border border-hm-line bg-white p-3"
            >
              <span
                className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${
                  step.done ? "bg-hm-teal-soft text-hm-teal" : "bg-hm-rose-soft text-hm-rose"
                }`}
              >
                {step.done ? <Check className="size-4" /> : <step.icon className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-semibold ${
                    step.done ? "text-hm-ink-soft line-through" : "text-hm-ink"
                  }`}
                >
                  {step.title}
                </p>
                {!step.done ? (
                  <p className="mt-1 text-xs leading-relaxed text-hm-ink-soft">{step.text}</p>
                ) : null}
                {!step.done && step.action ? (
                  <button
                    type="button"
                    onClick={step.action.onClick}
                    className="mt-2 min-h-9 rounded-xl bg-hm-rose px-3 text-xs font-semibold text-white"
                  >
                    {step.action.label}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        {readiness.error ? <p role="alert" className="text-sm text-destructive">Hazırlık durumu alınamadı. <button type="button" className="underline" onClick={() => void readiness.refetch()}>Tekrar dene</button></p> : null}
        <Link to="/store/$storeId/policies" params={{ storeId }} className="inline-flex min-h-11 items-center text-sm font-semibold underline">Politikaları düzenle ve yayınla</Link>
        <p className="text-xs text-hm-ink-soft">
          Vitrin bağlantınız: <span className="break-all font-medium text-hm-ink">{storeUrl}</span>
        </p>
      </div>
    </SoftCard>
  );
}
