import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { openAdminPanelSession } from "@/lib/admin-auth.functions";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Lock, Mail, Rocket, User } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth-context";
import { logAuthEvent } from "@/lib/audit.functions";
import { cn } from "@/lib/utils";
import { getPanelDestinations } from "@/lib/panel-destinations.functions";
import { authText, safeAuthNext, withLocale } from "@/lib/auth-i18n";

const searchSchema = z.object({
  mode: z.enum(["login", "register"]).optional(),
  next: z.string().optional(),
  locale: z.enum(["tr", "en", "de", "fr", "ar"]).default("tr"),
  plan: z
    .string()
    .regex(/^[a-z0-9_-]{1,40}$/)
    .optional(),
  interval: z.enum(["monthly", "yearly"]).default("monthly"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: ({ match }) => ({
    meta: [
      { title: authText(match.search.locale, "Panel Girişi — Mefticaret") },
      {
        name: "description",
        content:
          "Mefticaret mağaza panelinize giriş yapın veya saniyeler içinde ücretsiz hesap oluşturun.",
      },
      { property: "og:title", content: authText(match.search.locale, "Panel Girişi — Mefticaret") },
      {
        property: "og:description",
        content: "Mefticaret mağaza panelinize erişin veya ücretsiz kayıt olun.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const fieldLabel =
  "block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground";
const inputClass =
  "h-[50px] rounded-[10px] border-[1.5px] bg-card/90 pl-11 text-sm shadow-sm transition-all focus-visible:bg-card";

function AuthPage() {
  const { mode, next, locale, plan, interval } = Route.useSearch();
  const tx = (text: string) => authText(locale, text);
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [tab, setTab] = useState<"login" | "register">(mode === "register" ? "register" : "login");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const onboardingTarget = plan
    ? `/onboarding?plan=${encodeURIComponent(plan)}&interval=${interval}`
    : "/onboarding";
  const safeNext = safeAuthNext(next ?? (plan ? onboardingTarget : undefined));
  const authReturn = withLocale(
    `/auth?mode=login&next=${encodeURIComponent(safeNext)}${plan ? `&plan=${encodeURIComponent(plan)}&interval=${interval}` : ""}`,
    locale,
  );
  const go = useCallback(
    (path: string) => window.location.replace(withLocale(path, locale)),
    [locale],
  );
  const openAdminPanel = useServerFn(openAdminPanelSession);
  const readPanels = useServerFn(getPanelDestinations);
  const [panels, setPanels] = useState<Array<{ label: string; path: string }>>([]);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routing, setRouting] = useState(false);
  // Kayıt akışı kendi yönlendirmesini yapar; genel yönlendirme onu ezmemeli.
  const signingUpRef = useRef(false);

  useEffect(() => {
    if (loading || !session || routing || routeError || signingUpRef.current) return;
    setRouting(true);
    void (async () => {
      // Süper yönetici hesapları doğrudan platform paneline gider; yetki
      // yalnızca sunucuda, veritabanındaki role göre belirlenir.
      if (safeNext === "/stores" || safeNext === "/admin") {
        try {
          const result = await openAdminPanel();
          if (result.allowed) {
            go("/admin");
            return;
          }
        } catch {
          /* yetkisiz hesaplar normal panele yönlendirilir */
        }
      }
      if (safeNext === "/stores") {
        try {
          const choices = await readPanels();
          if (choices.length > 1) {
            setPanels(choices);
            return;
          }
          go(choices[0]!.path);
        } catch (error) {
          setRouteError(error instanceof Error ? error.message : "Panel bilgileri yüklenemedi");
        }
        return;
      }
      go(safeNext === "/admin" ? "/stores" : safeNext);
    })();
  }, [loading, session, safeNext, routing, routeError, openAdminPanel, readPanels, go]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? tx("E-posta veya şifre hatalı")
          : error.message,
      );
      return;
    }
    void logAuthEvent({ data: { event: "login", method: "password" } }).catch(() => {});
    toast.success(tx("Hoş geldin!"));
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    signingUpRef.current = true;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          requested_plan: plan ?? null,
          requested_billing_interval: interval,
        },
        emailRedirectTo: `${window.location.origin}${authReturn}`,
      },
    });
    setBusy(false);
    if (error) {
      signingUpRef.current = false;
      toast.error(error.message);
      return;
    }
    if (data.session) {
      setRouting(true);
      void logAuthEvent({ data: { event: "login", method: "signup" } }).catch(() => {});
      toast.success(tx("Hesabın hazır, ilk mağazanı kuralım."));
      go(onboardingTarget);
      return;
    }
    signingUpRef.current = false;
    toast.success(tx("Hesabını doğrulamak için e-postanı kontrol et."));
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${authReturn}`,
    });
    if (result.error) {
      setBusy(false);
      toast.error(tx("Google ile giriş başarısız oldu"));
      return;
    }
    if (result.redirected) return;
    go(safeNext);
  }

  const isLogin = tab === "login";

  if (session && panels.length > 1)
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6">
        <h1 className="text-xl font-semibold">{tx("Panelini seç")}</h1>
        {panels.map((panel) => (
          <Button key={panel.path} onClick={() => go(panel.path)}>
            {tx(panel.label)}
          </Button>
        ))}
      </main>
    );
  if (routeError)
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6">
        <p role="alert">{routeError}</p>
        <Button
          onClick={() => {
            setRouteError(null);
            setRouting(false);
          }}
        >
          {tx("Tekrar dene")}
        </Button>
      </main>
    );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/40 px-5 py-12">
      <div className="pointer-events-none fixed inset-0 z-0">
        <span className="absolute -right-[10%] -top-[15%] size-[500px] rounded-full bg-foreground/5 blur-[100px]" />
        <span className="absolute -bottom-[10%] -left-[5%] size-[400px] rounded-full bg-foreground/[0.04] blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-[520px]">
        <div className="rounded-[20px] border border-border bg-card/70 p-8 shadow-[0_16px_48px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-2xl sm:p-10">
          <div className="mb-9 flex flex-col items-center text-center">
            <Link to={locale === "tr" ? "/" : `/${locale}`} className="flex items-center gap-2">
              <span className="brand-gradient text-brand-foreground grid size-10 place-items-center rounded-xl">
                <Rocket className="size-4" />
              </span>
              <span className="font-display text-lg font-semibold tracking-tight">Mefticaret</span>
            </Link>
            <p className="mt-4 text-[13px] text-muted-foreground">
              {isLogin ? tx("Mağaza panelinize erişin") : tx("Ücretsiz hesabınızı oluşturun")}
            </p>
          </div>

          <div className="mb-7 grid grid-cols-2 gap-1 rounded-[10px] border border-border bg-muted/50 p-1">
            {(["login", "register"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "h-9 rounded-[8px] text-[13px] font-medium transition-all",
                  tab === value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value === "login" ? tx("Giriş yap") : tx("Kayıt ol")}
              </button>
            ))}
          </div>

          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-[18px]">
            {plan ? (
              <p className="rounded-lg border p-3 text-sm">
                {tx("Seçilen paket")}: <strong>{plan}</strong> ·{" "}
                {tx(interval === "yearly" ? "Yıllık" : "Aylık")}
              </p>
            ) : null}
            {!isLogin ? (
              <div className="space-y-2">
                <label className={fieldLabel} htmlFor="register-name">
                  {tx("Ad Soyad")}
                </label>
                <div className="relative flex items-center">
                  <User className="pointer-events-none absolute left-[14px] size-[18px] text-muted-foreground" />
                  <Input
                    id="register-name"
                    required
                    placeholder={tx("Adınız Soyadınız")}
                    className={inputClass}
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className={fieldLabel} htmlFor="auth-email">
                {tx("E-posta Adresi")}
              </label>
              <div className="relative flex items-center">
                <Mail className="pointer-events-none absolute left-[14px] size-[18px] text-muted-foreground" />
                <Input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="ornek@sirket.com"
                  className={inputClass}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className={fieldLabel} htmlFor="auth-password">
                {tx("Şifre")}
              </label>
              <div className="relative flex items-center">
                <Lock className="pointer-events-none absolute left-[14px] size-[18px] text-muted-foreground" />
                <Input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  minLength={isLogin ? undefined : 8}
                  required
                  placeholder="••••••••"
                  className={cn(inputClass, "pr-11")}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? tx("Şifreyi gizle") : tx("Şifreyi göster")}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-[14px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="size-[18px]" />
                  ) : (
                    <Eye className="size-[18px]" />
                  )}
                </button>
              </div>
              {isLogin ? (
                <div className="pt-1 text-right">
                  <Link
                    to="/forgot-password"
                    search={{ locale }}
                    className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {tx("Şifremi unuttum")}
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{tx("En az 8 karakter kullan.")}</p>
              )}
            </div>

            <Button
              type="submit"
              className="h-[52px] w-full rounded-[10px] text-sm font-semibold"
              disabled={busy}
            >
              {busy ? tx("Lütfen bekleyin...") : isLogin ? tx("Devam Et") : tx("Hesabımı oluştur")}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> {tx("veya")}{" "}
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="outline"
            className="h-[50px] w-full rounded-[10px] text-sm font-medium"
            onClick={handleGoogle}
            disabled={busy}
          >
            {tx("Google ile devam et")}
          </Button>

          <p className="mt-7 text-center text-[13px] text-muted-foreground">
            {isLogin ? (
              <>
                {tx("Henüz hesabınız yok mu?")}{" "}
                <button
                  type="button"
                  onClick={() => setTab("register")}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {tx("Kayıt Olun")}
                </button>
              </>
            ) : (
              <>
                {tx("Hesabınız var mı?")}{" "}
                <button
                  type="button"
                  onClick={() => setTab("login")}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {tx("Giriş Yapın")}
                </button>
              </>
            )}
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          {tx("KVKK & GDPR uyumlu • Rol bazlı erişim • Denetim kayıtları")}
        </p>
      </div>
    </div>
  );
}
