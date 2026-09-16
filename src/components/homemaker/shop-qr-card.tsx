import { Copy, Download, QrCode, Radio } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BigButton, Field, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";

/**
 * Dükkan QR kodu (elden satış / stant ödemesi) ve canlı yayın satış linki.
 * QR, mağaza adresinizi gösterir; müşteri telefonuyla okutup ödeme yapar.
 */
export function ShopQrCard({
  storeName,
  storeUrl,
  campaignCode,
}: {
  storeName: string;
  storeUrl: string;
  campaignCode?: string | null;
}) {
  const [qr, setQr] = useState("");
  const [label, setLabel] = useState("canli-yayin");

  useEffect(() => {
    if (!storeUrl) return;
    QRCode.toDataURL(storeUrl, { width: 700, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [storeUrl]);

  const slug = label.trim().replace(/\s+/g, "-").toLowerCase() || "canli-yayin";
  const liveUrl = `${storeUrl}/products?kaynak=${encodeURIComponent(slug)}${
    campaignCode ? `&kod=${encodeURIComponent(campaignCode)}` : ""
  }`;

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Bağlantı kopyalandı");
    } catch {
      toast.error("Kopyalanamadı, bağlantıyı elle seçebilirsiniz.");
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: `${storeName} canlı yayın satışı`, url: liveUrl });
        return;
      } catch {
        /* kullanıcı vazgeçti */
      }
    }
    void copy(liveUrl);
  };

  return (
    <SoftCard className="grid gap-4">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-hm-ink">
          <QrCode className="size-4" /> Dükkan QR kodu
        </p>
        <p className="mt-1 text-sm text-hm-ink-soft">
          Pazarda, stantta veya kapıda teslimde müşteriniz bu kodu okutup kartla ödeyebilir.
        </p>
      </div>
      <div className="grid place-items-center rounded-3xl bg-hm-sand p-4">
        {qr ? (
          <img src={qr} alt="Dükkan QR kodu" className="size-44 rounded-2xl bg-white p-2" />
        ) : (
          <div className="size-44 animate-pulse rounded-2xl bg-white" />
        )}
      </div>
      {qr ? (
        <a
          href={qr}
          download={`${storeName}-dukkan-qr.png`}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-hm-teal px-5 text-base font-semibold text-white"
        >
          <Download className="size-5" /> Dükkan QR kodunu indir
        </a>
      ) : null}

      <div className="grid gap-3 border-t border-hm-line pt-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-hm-ink">
          <Radio className="size-4" /> Canlı yayın satış linki
        </p>
        <p className="text-sm text-hm-ink-soft">
          Instagram veya TikTok canlı yayınında paylaşın; izleyenler doğrudan sipariş verir.
        </p>
        <Field
          label="Yayın etiketi"
          hint="Örn. cuma-yayini — hangi yayından sipariş geldiğini görürsünüz."
        >
          <input
            className={inputClass}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </Field>
        <p className="break-all rounded-2xl bg-hm-sand p-3 text-xs text-hm-ink-soft">{liveUrl}</p>
        <div className="grid grid-cols-2 gap-2">
          <BigButton tone="ghost" onClick={() => void copy(liveUrl)}>
            <Copy className="size-4" /> Kopyala
          </BigButton>
          <BigButton tone="rose" onClick={() => void share()}>
            <Radio className="size-4" /> Yayında paylaş
          </BigButton>
        </div>
        {campaignCode ? (
          <p className="text-xs font-semibold text-hm-emerald">
            Kampanya kodunuz ({campaignCode}) bu bağlantıya otomatik ekleniyor.
          </p>
        ) : null}
      </div>
    </SoftCard>
  );
}
