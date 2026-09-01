import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!readCookiePreferences(storeSlug)) setOpen(true);
  }, [storeSlug]);

  async function persist(next: { analytics: boolean; marketing: boolean }) {
    setBusy(true);
    writeCookiePreferences(storeSlug, { ...next, decidedAt: new Date().toISOString() });
    setOpen(false);
    try {
      await recordConsent({
        data: {
          storeSlug,
          policyVersion: CONSENT_POLICY_VERSION,
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
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-xl border border-border bg-background p-4 shadow-lg">
      <p className="text-sm font-semibold text-foreground">Çerez tercihleri</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Zorunlu çerezler sepet ve oturum için gereklidir. Analitik ve pazarlama çerezleri yalnızca
        onayınla kullanılır. Ayrıntılar için{" "}
        <a className="underline" href={`/s/${storeSlug}/privacy`}>
          gizlilik politikası
        </a>
        .
      </p>

      {details ? (
        <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between text-xs">
            <span>Zorunlu çerezler</span>
            <span className="text-muted-foreground">Her zaman açık</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>Analitik çerezler</span>
            <Switch checked={analytics} onCheckedChange={setAnalytics} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>Pazarlama çerezleri</span>
            <Switch checked={marketing} onCheckedChange={setMarketing} />
          </div>
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
