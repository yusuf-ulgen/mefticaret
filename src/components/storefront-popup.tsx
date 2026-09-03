import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";

import { activeStorefrontPopupsQuery } from "@/lib/marketing-tools-queries";
import { trackStorefrontPopupEvent } from "@/lib/marketing-tools.functions";
import { matchesPageTarget, parseDisplayRules } from "@/lib/popups";

const STORAGE_PREFIX = "mefti-popup-seen:";

/** Vitrinde aktif tek popup'ı gösterir; seans/tekrar kuralına ve erişilebilirlik kurallarına uyar. */
export function StorefrontPopup({ storeSlug }: { storeSlug: string }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: popups } = useQuery(activeStorefrontPopupsQuery(storeSlug));
  const [visibleId, setVisibleId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trackedRef = useRef<Set<string>>(new Set());

  const candidate = (popups ?? []).find((popup) => {
    const rules = parseDisplayRules(popup.display_rules);
    if (!matchesPageTarget(rules.pages, pathname)) return false;
    if (rules.frequency === "always") return true;
    const key = `${STORAGE_PREFIX}${popup.id}`;
    if (rules.frequency === "once") return !window.localStorage.getItem(key);
    return !window.sessionStorage.getItem(key);
  });

  useEffect(() => {
    setVisibleId(null);
    if (!candidate) return;
    const rules = parseDisplayRules(candidate.display_rules);
    const timer = window.setTimeout(() => setVisibleId(candidate.id), rules.delaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [candidate?.id]);

  useEffect(() => {
    if (!visibleId || !candidate || trackedRef.current.has(visibleId)) return;
    trackedRef.current.add(visibleId);
    trackStorefrontPopupEvent({ data: { id: visibleId, kind: "impression" } }).catch(() => {});
  }, [visibleId, candidate]);

  useEffect(() => {
    if (!visibleId) return;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visibleId]);

  if (!candidate || visibleId !== candidate.id) return null;

  const rules = parseDisplayRules(candidate.display_rules);
  const key = `${STORAGE_PREFIX}${candidate.id}`;

  const close = () => {
    setVisibleId(null);
    if (rules.frequency === "once") window.localStorage.setItem(key, "1");
    if (rules.frequency === "session") window.sessionStorage.setItem(key, "1");
  };

  const onCtaClick = () => {
    trackStorefrontPopupEvent({ data: { id: candidate.id, kind: "click" } }).catch(() => {});
    close();
  };

  const animationClass =
    candidate.animation === "slide-up"
      ? "animate-in slide-in-from-bottom-6"
      : candidate.animation === "zoom"
        ? "animate-in zoom-in-90"
        : candidate.animation === "bounce"
          ? "animate-in zoom-in-95"
          : candidate.animation === "shake"
            ? "animate-in fade-in"
            : "animate-in fade-in";

  const positionClass =
    candidate.position === "bottom-right"
      ? "items-end justify-end p-4 sm:p-6"
      : candidate.position === "bottom-left"
        ? "items-end justify-start p-4 sm:p-6"
        : candidate.position === "bottom-bar"
          ? "items-end justify-center p-0"
          : candidate.position === "top-bar"
            ? "items-start justify-center p-0"
            : "items-center justify-center p-4";

  const isBar = candidate.position === "bottom-bar" || candidate.position === "top-bar";

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[90] flex ${positionClass}`}
      style={{ contain: "layout" }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`popup-headline-${candidate.id}`}
        tabIndex={-1}
        className={`pointer-events-auto ${animationClass} duration-300 ${
          isBar ? "w-full" : "max-w-sm rounded-xl"
        } border bg-card p-5 shadow-2xl outline-none`}
        style={{ borderColor: candidate.accent_color || undefined }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={`popup-headline-${candidate.id}`} className="text-base font-semibold">
            {candidate.headline}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Kapat"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            ✕
          </button>
        </div>
        {candidate.image_url ? (
          <img src={candidate.image_url} alt="" className="mt-3 max-h-40 w-full rounded-lg object-cover" />
        ) : null}
        {candidate.body ? <p className="mt-2 text-sm text-muted-foreground">{candidate.body}</p> : null}
        {candidate.cta_label && candidate.cta_url ? (
          <a
            href={candidate.cta_url}
            onClick={onCtaClick}
            className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-semibold text-white"
            style={{ background: candidate.accent_color || "#1f2933" }}
          >
            {candidate.cta_label}
          </a>
        ) : null}
      </div>
    </div>
  );
}
