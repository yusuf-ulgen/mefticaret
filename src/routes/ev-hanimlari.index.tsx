import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Heart, Loader2, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getHomeMakerProfile } from "@/lib/home-maker.functions";

export const Route = createFileRoute("/ev-hanimlari/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ev Hanımları Portalı — Mefticaret" },
      {
        name: "description",
        content:
          "Telefon numaranızla giriş yapın, el emeği ürünlerinizi sade bir panelden satmaya hemen başlayın.",
      },
      { property: "og:title", content: "Ev Hanımları Portalı — Mefticaret" },
      {
        property: "og:description",
        content: "Sade panel, kolay giriş: el emeği ürünlerinizi telefonunuzdan satın.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomeMakerAuthPage,
});

/** 0555… veya +90555… girişlerini E.164 (+90…) biçimine çevirir. */
function toE164(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10 && digits[0] === "5") return `+90${digits}`;
  if (digits.length === 11 && digits.startsWith("05")) return `+90${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("905")) return `+${digits}`;
  return null;
}

const PERKS = [
  "Tek ekranda mağaza, ürün ve sipariş",
  "Fotoğraf arka planını yapay zeka temizler",
  "Kargosuz teslimat için kod üretir",
];

function HomeMakerAuthPage() {
  const navigate = useNavigate();
  const readProfile = useServerFn(getHomeMakerProfile);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  /** SMS sağlayıcısı kapalıysa e-posta ile giriş seçeneği gösterilir. */
  const [smsBlocked, setSmsBlocked] = useState(false);

  /** Oturum varsa doğrudan panele; kaydı yoksa kuruluma. */
  const routeAfterLogin = async () => {
    try {
      const profile = await readProfile();
      if (profile?.store_id) {
        await navigate({ to: "/store/$storeId/kolay", params: { storeId: profile.store_id }, replace: true });
        return;
      }
    } catch {
      /* kayıt okunamazsa kuruluma yönlendiriyoruz */
    }
    await navigate({ to: "/ev-hanimlari/kurulum", replace: true });
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        await routeAfterLogin();
        return;
      }
      setChecking(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    const e164 = toE164(phone);
    if (!e164) {
      toast.error("Telefon numaranızı 05XX XXX XX XX biçiminde yazın.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (error) {
      const blocked = /sms|phone_provider|provider|not enabled|disabled|unsupported/i.test(
        error.message,
      );
      setSmsBlocked(blocked);
      toast.error(
        blocked
          ? "SMS ile kod gönderimi şu an kapalı. E-posta ile giriş yapabilirsiniz."
          : error.message,
      );
      return;
    }
    setSmsBlocked(false);
    setStep("code");
    toast.success("Şifre kodunu SMS ile gönderdik.");
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    const e164 = toE164(phone);
    if (!e164) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code.trim(), type: "sms" });
    if (error) {
      setBusy(false);
      toast.error("Kod doğrulanamadı, tekrar deneyin.");
      return;
    }
    toast.success("Hoş geldiniz!");
    await routeAfterLogin();
    setBusy(false);
  }

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-hm-sand">
        <Loader2 className="size-6 animate-spin text-hm-rose" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hm-sand px-5 py-10">
      <div className="mx-auto w-full max-w-[420px]">
        <div className="mb-7 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-hm-rose/15 text-hm-rose">
            <Heart className="size-7" />
          </span>
          <h1 className="mt-4 text-[26px] font-semibold leading-tight text-hm-ink">Evde Üretenler Portalı</h1>
          <p className="mt-2 text-sm text-hm-ink-soft">
            Telefon numaranızla girin. Şifre, e-posta ya da form doldurmak yok.
          </p>
        </div>

        <div className="rounded-[28px] border border-hm-line bg-white p-6 shadow-sm">
          {step === "phone" ? (
            <form onSubmit={sendCode} className="grid gap-4">
              <label className="text-sm font-medium text-hm-ink" htmlFor="hm-phone">
                Telefon numaranız
              </label>
              <div className="relative flex items-center">
                <Phone className="pointer-events-none absolute left-4 size-5 text-hm-ink-soft" />
                <Input
                  id="hm-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  placeholder="0555 123 45 67"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="h-14 rounded-2xl border-hm-line pl-12 text-base"
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="h-14 rounded-2xl bg-hm-rose text-base font-semibold text-white hover:bg-hm-rose/90"
              >
                {busy ? <Loader2 className="size-5 animate-spin" /> : "Kod gönder"}
              </Button>
            </form>
          ) : (
            <form onSubmit={verify} className="grid gap-4">
              <label className="text-sm font-medium text-hm-ink" htmlFor="hm-code">
                SMS ile gelen kod
              </label>
              <Input
                id="hm-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={8}
                placeholder="1234"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/[^\d]/g, ""))}
                className="h-16 rounded-2xl border-hm-line text-center text-2xl tracking-[0.4em]"
              />
              <Button
                type="submit"
                disabled={busy || code.length < 4}
                className="h-14 rounded-2xl bg-hm-teal text-base font-semibold text-white hover:bg-hm-teal/90"
              >
                {busy ? <Loader2 className="size-5 animate-spin" /> : "Giriş yap"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                }}
                className="text-sm font-medium text-hm-ink-soft underline-offset-4 hover:underline"
              >
                Numarayı değiştir
              </button>
            </form>
          )}

          {smsBlocked ? (
            <div className="mt-5 grid gap-3 rounded-2xl bg-hm-amber-soft p-4 text-sm text-hm-ink">
              <p className="font-semibold">SMS ile kod gönderimi şu an kapalı.</p>
              <p className="text-hm-ink-soft">
                E-posta ve şifrenizle giriş yapabilir ya da yeni kayıt oluşturabilirsiniz. Kolay
                Panel'iniz aynı şekilde açılır.
              </p>
              <a
                href="/auth?mode=login&next=/ev-hanimlari"
                className="grid h-14 place-items-center rounded-2xl bg-hm-teal text-base font-semibold text-white"
              >
                E-posta ile giriş yap
              </a>
              <a
                href="/auth?mode=register&next=/ev-hanimlari"
                className="grid h-14 place-items-center rounded-2xl border border-hm-line bg-white text-base font-semibold text-hm-ink"
              >
                E-posta ile kayıt ol
              </a>
            </div>
          ) : null}
        </div>

        <ul className="mt-6 grid gap-3">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-start gap-3 rounded-2xl bg-white/70 p-3 text-sm text-hm-ink">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-hm-amber" />
              {perk}
            </li>
          ))}
        </ul>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-hm-ink-soft">
          <ShieldCheck className="size-4" /> Bilgileriniz KVKK kapsamında korunur
        </p>
        <a
          href="/auth"
          className="mt-4 flex items-center justify-center gap-1 text-xs font-medium text-hm-ink-soft"
        >
          Kurumsal panele giriş <ArrowRight className="size-3" />
        </a>
      </div>
    </div>
  );
}
