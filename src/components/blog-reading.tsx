import { useEffect, useRef, useState } from "react";

import { trackBlogReadProgress, trackBlogShare, trackBlogView } from "@/lib/blog-track";

/**
 * Blog okuma deneyimi bileşenleri: üstte sabit okuma çubuğu (%) ve mobil uyumlu
 * paylaşım butonları. İkisi de olayları GA4 / Meta Pixel'e iletir.
 */

const MILESTONES = [25, 50, 75, 100];

export function ReadingProgress({
  postId,
  title,
  accent,
}: {
  postId: string;
  title: string;
  accent: string;
}) {
  const [percent, setPercent] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      trackBlogView({ postId, title });
    }

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? window.scrollY / scrollable : 1;
      const value = Math.min(100, Math.max(0, Math.round(ratio * 100)));
      setPercent(value);
      for (const milestone of MILESTONES) {
        if (value >= milestone) trackBlogReadProgress({ postId, title, percent: milestone });
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [postId, title]);

  return (
    <div
      role="progressbar"
      aria-label="Okuma ilerlemesi"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: "transparent",
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: `${percent}%`,
          height: "100%",
          background: accent,
          transition: "width 120ms linear",
        }}
      />
    </div>
  );
}

type ShareTarget = { key: string; label: string; href?: (url: string, title: string) => string };

const TARGETS: ShareTarget[] = [
  { key: "whatsapp", label: "WhatsApp", href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}` },
  { key: "x", label: "X", href: (u, t) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { key: "facebook", label: "Facebook", href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { key: "linkedin", label: "LinkedIn", href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
];

export function ShareButtons({
  postId,
  title,
  border,
  muted,
}: {
  postId: string;
  title: string;
  border: string;
  muted: string;
}) {
  const [copied, setCopied] = useState(false);

  const chip = {
    border: `1px solid ${border}`,
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 13,
    color: "inherit",
    background: "transparent",
    textDecoration: "none",
    cursor: "pointer",
    minHeight: 40,
    display: "inline-flex",
    alignItems: "center",
  } as const;

  const shareUrl = typeof window === "undefined" ? "" : window.location.href;

  const nativeShare = async () => {
    if (typeof navigator === "undefined" || !navigator.share) return false;
    try {
      await navigator.share({ title, url: shareUrl });
      trackBlogShare({ postId, title, method: "native" });
      return true;
    } catch {
      return true;
    }
  };

  return (
    <div style={{ marginTop: 26 }}>
      <p style={{ margin: "0 0 8px", fontSize: 13, color: muted }}>Bu yazıyı paylaş</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {typeof navigator !== "undefined" && "share" in navigator ? (
          <button type="button" style={chip} onClick={() => void nativeShare()}>
            Paylaş
          </button>
        ) : null}
        {TARGETS.map((target) => (
          <a
            key={target.key}
            href={target.href ? target.href(shareUrl, title) : shareUrl}
            target="_blank"
            rel="noreferrer noopener"
            style={chip}
            onClick={() => trackBlogShare({ postId, title, method: target.key })}
          >
            {target.label}
          </a>
        ))}
        <button
          type="button"
          style={chip}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* kopyalama engellenmiş olabilir */
            }
            trackBlogShare({ postId, title, method: "kopyala" });
          }}
        >
          {copied ? "Kopyalandı" : "Bağlantıyı kopyala"}
        </button>
      </div>
    </div>
  );
}
