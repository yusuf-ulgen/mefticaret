import { Check, Copy, Share2, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

/** Kolay Panel'in paylaşılan sade arayüz parçaları. */

export function SoftCard({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-40 rounded-3xl border border-hm-line bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${className}`}
    >
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-hm-ink">{label}</span>
      {hint ? <span className="mt-0.5 block text-xs text-hm-ink-soft">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-hm-line bg-hm-sand px-4 py-3 text-base text-hm-ink outline-none transition-colors placeholder:text-hm-ink-soft focus:border-hm-rose focus:bg-white";

export function BigButton({
  children,
  onClick,
  tone = "rose",
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "rose" | "teal" | "emerald" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const tones = {
    rose: "bg-hm-rose text-white",
    teal: "bg-hm-teal text-white",
    emerald: "bg-hm-emerald text-white",
    ghost: "border border-hm-line bg-white text-hm-ink",
  } as const;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold transition-transform active:scale-[0.98] disabled:opacity-50 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  // Telefonda alttan açılan panel: geri tuşu/Escape ile kapanır, arka plana
  // dokununca kapanır ve panel açıkken arkadaki sayfa kaymaz.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="hm-app fixed inset-0 z-[90] flex items-end justify-center overflow-x-hidden bg-black/40 p-0 sm:items-center sm:p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[88svh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:max-h-[92vh] sm:rounded-3xl sm:p-5"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-hm-line sm:hidden" />
        <div className="sticky -top-4 z-10 mb-4 flex items-center justify-between gap-3 bg-white pb-2 pt-1 sm:-top-5">
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-hm-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="grid size-11 shrink-0 place-items-center rounded-2xl bg-hm-sand text-hm-ink"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Kopyalanabilir mağaza bağlantısı + QR kod. */
export function ShareSheet({
  open,
  onClose,
  url,
  storeName,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  storeName: string;
}) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !url) return;
    QRCode.toDataURL(url, { width: 512, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [open, url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Bağlantı kopyalandı");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopyalanamadı, bağlantıyı elle seçebilirsiniz.");
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: storeName, url });
        return;
      } catch {
        /* kullanıcı vazgeçti */
      }
    }
    void copy();
  };

  return (
    <Sheet open={open} title="Mağazamı paylaş" onClose={onClose}>
      <div className="grid gap-4">
        <div className="grid place-items-center rounded-3xl bg-hm-sand p-5">
          {qr ? (
            <img src={qr} alt="Mağaza QR kodu" className="size-48 rounded-2xl bg-white p-2" />
          ) : (
            <div className="size-48 animate-pulse rounded-2xl bg-white" />
          )}
          <p className="mt-3 break-all text-center text-sm text-hm-ink-soft">{url}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <BigButton tone="ghost" onClick={copy}>
            {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
            {copied ? "Kopyalandı" : "Bağlantıyı kopyala"}
          </BigButton>
          <BigButton tone="rose" onClick={share}>
            <Share2 className="size-5" /> Paylaş
          </BigButton>
        </div>
        {qr ? (
          <a
            href={qr}
            download={`${storeName}-qr.png`}
            className="text-center text-sm font-semibold text-hm-teal underline"
          >
            QR kodu indir
          </a>
        ) : null}
      </div>
    </Sheet>
  );
}
