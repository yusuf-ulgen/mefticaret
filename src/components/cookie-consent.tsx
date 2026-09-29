import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getPublicCookieBanner } from "@/lib/policies-public.functions";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { recordConsent } from "@/lib/compliance.functions";
import {
  CONSENT_POLICY_VERSION,
  readCookiePreferences,
  writeCookiePreferences,
} from "@/lib/security";

/** KVKK/GDPR çerez onay bandı: zorunlu çerezler dışındaki kategoriler açık rıza gerektirir. */
export function CookieConsent({ storeSlug }: { storeSlug: string }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const settings = useQuery({
    queryKey: ["cookie-banner", storeSlug],
    queryFn: () => getPublicCookieBanner({ data: { slug: storeSlug } }),
    staleTime: 10 * 60_000,
  });
  const cfg = settings.data;
  const version = `${CONSENT_POLICY_VERSION}-${cfg?.consentVersion ?? "1.0"}`;

  useEffect(() => {
    if (settings.isLoading) return;
    const prev = readCookiePreferences(storeSlug) as (ReturnType<typeof readCookiePreferences> & { version?: string }) | null;
    // Mağaza çerez kategorilerini değiştirdiyse onay yeniden istenir.
    if (!prev || (cfg && prev.version && prev.version !== version)) setOpen(true);
  }, [storeSlug, settings.isLoading, cfg, version]);

  async function persist(next: { analytics: boolean; marketing: boolean }) {
    // eslint-disable-next-line no-param-reassign
    setBusy(true);
    next = { analytics: next.analytics && (cfg?.usesAnalytics ?? true), marketing: next.marketing && (cfg?.usesMarketing ?? true) };
    writeCookiePreferences(storeSlug, { ...next, decidedAt: new Date().toISOString(), version } as never);
    setOpen(false);
    try {
      await recordConsent({
        data: {
          storeSlug,
          policyVersion: version,
          source: "storefront",
          consents: [
            { consentType: "cookies_necessary", granted: true },
            { consentType: "cookies_analytics", granted: next.analytics },
            { consentType: "cookies_marketing", granted: next.marketing },
          ],
        },
      });
    } catch {
      /* rıza kaydı sunucuya ulaşmazsa yerel tercih geçerli kalır */
    }
    setBusy(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Çerez bildirimi"
      className={cn(
        "fixed inset-x-3 bottom-[104px] z-50 mx-auto max-w-3xl rounded-xl border border-border p-4 shadow-lg sm:bottom-3",
        cfg?.position === "bottom-left" && "sm:right-auto sm:mx-0 sm:max-w-sm",
        cfg?.position === "bottom-right" && "sm:left-auto sm:mx-0 sm:max-w-sm",
        cfg?.colorScheme === "dark" ? "dark bg-background text-foreground" : "bg-background",
      )}
    >
      <p className="text-sm font-semibold text-foreground">Çerez tercihleri</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {cfg?.bannerText ||
          "Size daha iyi bir deneyim sunmak için çerezler kullanıyoruz. Zorunlu çerezler sepet ve oturum için gereklidir; diğerleri yalnızca onayınızla kullanılır."}{" "}
        Ayrıntılar için{" "}
        <a className="underline" href={`/s/${storeSlug}/politika/cerez`}>
          çerez politikası
        </a>
        .
      </p>

      {details ? (
        <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between text-xs">
            <span>Zorunlu çerezler</span>
            <span className="text-muted-foreground">Her zaman açık</span>
          </div>
          {cfg?.usesAnalytics !== false ? (
            <div className="flex items-center justify-between text-xs">
              <span>Analitik çerezler — siteyi nasıl kullandığınızı anlarız</span>
              <Switch checked={analytics} onCheckedChange={setAnalytics} />
            </div>
          ) : null}
          {cfg?.usesMarketing !== false ? (
            <div className="flex items-center justify-between text-xs">
              <span>Pazarlama çerezleri — size özel reklamlar</span>
              <Switch checked={marketing} onCheckedChange={setMarketing} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => void persist({ analytics: true, marketing: true })}>
          Tümünü kabul et
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void persist({ analytics: false, marketing: false })}
        >
          Yalnızca zorunlu
        </Button>
        {details ? (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void persist({ analytics, marketing })}>
            Seçimimi kaydet
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setDetails(true)}>
            Ayarla
          </Button>
        )}
      </div>
    </div>
  );
}
