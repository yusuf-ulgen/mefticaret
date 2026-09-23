import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Heart,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getHomeMakerProfile } from "@/lib/home-maker.functions";
import { requestPhoneOtp, verifyPhoneOtp } from "@/lib/kolay-v8.functions";

export const Route = createFileRoute("/ev-hanimlari/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ev Hanımları Portalı — Mefticaret" },
      {
        name: "description",
        content:
          "Telefon numaranızla veya e-postanızla giriş yapın, el emeği ürünlerinizi sade bir panelden satmaya hemen başlayın.",
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

const PERKS = [
  "Tek ekranda mağaza, ürün ve sipariş",
  "Fotoğraf arka planını yapay zeka temizler",
  "Kargosuz teslimat için kod üretir",
];

type Mode = "phone" | "login" | "register";

function HomeMakerAuthPage() {
  const navigate = useNavigate();
  const readProfile = useServerFn(getHomeMakerProfile);
  const sendCode = useServerFn(requestPhoneOtp);
  const checkCode = useServerFn(verifyPhoneOtp);
  const [mode, setMode] = useState<Mode>("phone");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [confirmSent, setConfirmSent] = useState(false);

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const mail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      toast.error("Geçerli bir e-posta adresi yazın.");
      return;
    }
    if (password.length < 8) {
      toast.error("Şifreniz en az 8 karakter olmalı.");
      return;
    }
    if (mode === "register" && fullName.trim().length < 2) {
      toast.error("Adınızı yazın.");
      return;
    }

    setBusy(true);
    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/ev-hanimlari`,
          data: { full_name: fullName.trim() },
        },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data.session) {
        setConfirmSent(true);
        toast.success("E-postanıza onay bağlantısı gönderdik.");
        return;
      }
      toast.success("Hoş geldiniz!");
      await routeAfterLogin();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
    if (error) {
      setBusy(false);
      toast.error(
        /invalid/i.test(error.message) ? "E-posta veya şifre hatalı." : error.message,
      );
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
    <div className="hm-app min-h-screen bg-hm-sand px-5 py-10">
      <div className="mx-auto w-full max-w-[420px]">
        <div className="mb-7 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-hm-rose/15 text-hm-rose">
            <Heart className="size-7" />
          </span>
          <h1 className="mt-4 text-[26px] font-semibold leading-tight text-hm-ink">Evde Üretenler Portalı</h1>
          <p className="mt-2 text-sm text-hm-ink-soft">
            E-posta ve şifrenizle girin. Onay kodu beklemek yok.
          </p>
        </div>

        <div className="rounded-[28px] border border-hm-line bg-white p-6 shadow-sm">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-hm-sand p-1">
            {(["login", "register"] as Mode[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value);
                  setConfirmSent(false);
                }}
                className={`h-11 rounded-xl text-sm font-semibold transition ${
                  mode === value ? "bg-white text-hm-ink shadow-sm" : "text-hm-ink-soft"
                }`}
              >
                {value === "login" ? "Giriş yap" : "Hesap oluştur"}
              </button>
            ))}
          </div>

          {confirmSent ? (
            <div className="grid gap-3 rounded-2xl bg-hm-amber-soft p-4 text-sm text-hm-ink">
              <p className="font-semibold">E-postanızı kontrol edin.</p>
              <p className="text-hm-ink-soft">
                Gönderdiğimiz onay bağlantısına dokunduktan sonra bu sayfadan giriş yapabilirsiniz.
              </p>
              <button
                type="button"
                onClick={() => {
                  setConfirmSent(false);
                  setMode("login");
                }}
                className="text-left text-sm font-semibold text-hm-teal underline-offset-4 hover:underline"
              >
                Girişe dön
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4">
              {mode === "register" ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-hm-ink" htmlFor="hm-name">
                    Adınız
                  </label>
                  <Input
                    id="hm-name"
                    autoComplete="name"
                    required
                    maxLength={80}
                    placeholder="Ayşe Yılmaz"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="h-14 rounded-2xl border-hm-line text-base"
                  />
                </div>
              ) : null}

              <div className="grid gap-2">
                <label className="text-sm font-medium text-hm-ink" htmlFor="hm-email">
                  E-posta adresiniz
                </label>
                <div className="relative flex items-center">
                  <Mail className="pointer-events-none absolute left-4 size-5 text-hm-ink-soft" />
                  <Input
                    id="hm-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    maxLength={160}
                    placeholder="ornek@eposta.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-14 rounded-2xl border-hm-line pl-12 text-base"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-hm-ink" htmlFor="hm-password">
                  Şifreniz
                </label>
                <div className="relative flex items-center">
                  <Lock className="pointer-events-none absolute left-4 size-5 text-hm-ink-soft" />
                  <Input
                    id="hm-password"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    minLength={8}
                    maxLength={72}
                    placeholder="En az 8 karakter"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-14 rounded-2xl border-hm-line pl-12 text-base"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={busy}
                className="h-14 rounded-2xl bg-hm-rose text-base font-semibold text-white hover:bg-hm-rose/90"
              >
                {busy ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : mode === "login" ? (
                  "Giriş yap"
                ) : (
                  "Hesabımı oluştur"
                )}
              </Button>

              {mode === "login" ? (
                <a
                  href="/forgot-password"
                  className="text-center text-sm font-medium text-hm-ink-soft underline-offset-4 hover:underline"
                >
                  Şifremi unuttum
                </a>
              ) : null}
            </form>
          )}
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
