import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { openAdminPanelSession } from "@/lib/admin-auth.functions";
import { useEffect, useState } from "react";
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

const searchSchema = z.object({
  mode: z.enum(["login", "register"]).optional(),
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Panel Girişi — Mefticaret" },
      {
        name: "description",
        content: "Mefticaret mağaza panelinize giriş yapın veya saniyeler içinde ücretsiz hesap oluşturun.",
      },
      { property: "og:title", content: "Panel Girişi — Mefticaret" },
      { property: "og:description", content: "Mefticaret mağaza panelinize erişin veya ücretsiz kayıt olun." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const fieldLabel = "block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground";
const inputClass =
  "h-[50px] rounded-[10px] border-[1.5px] bg-card/90 pl-11 text-sm shadow-sm transition-all focus-visible:bg-card";

function AuthPage() {
  const { mode, next } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [tab, setTab] = useState<"login" | "register">(mode === "register" ? "register" : "login");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/stores";
  const openAdminPanel = useServerFn(openAdminPanelSession);
  const [routing, setRouting] = useState(false);

  useEffect(() => {
    if (loading || !session || routing) return;
    setRouting(true);
    void (async () => {
      // Süper yönetici hesapları doğrudan platform paneline gider; yetki
      // yalnızca sunucuda, veritabanındaki role göre belirlenir.
      if (safeNext === "/stores" || safeNext === "/admin") {
        try {
          const result = await openAdminPanel();
          if (result.allowed) {
            await navigate({ to: "/admin", replace: true });
            return;
          }
        } catch {
          /* yetkisiz hesaplar normal panele yönlendirilir */
        }
      }
      await navigate({ to: safeNext === "/admin" ? "/stores" : safeNext, replace: true });
    })();
  }, [loading, session, navigate, safeNext, routing, openAdminPanel]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "E-posta veya şifre hatalı" : error.message);
      return;
    }
    void logAuthEvent({ data: { event: "login", method: "password" } }).catch(() => {});
    toast.success("Hoş geldin!");
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}${safeNext}`,
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      void logAuthEvent({ data: { event: "login", method: "signup" } }).catch(() => {});
      toast.success("Hesabın hazır, ilk mağazanı kuralım.");
      void navigate({ to: "/onboarding", replace: true });
      return;
    }
    toast.success("Hesabını doğrulamak için e-postanı kontrol et.");
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${safeNext}`,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google ile giriş başarısız oldu");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: safeNext, replace: true });
  }

  const isLogin = tab === "login";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/40 px-5 py-12">
      <div className="pointer-events-none fixed inset-0 z-0">
        <span className="absolute -right-[10%] -top-[15%] size-[500px] rounded-full bg-foreground/5 blur-[100px]" />
        <span className="absolute -bottom-[10%] -left-[5%] size-[400px] rounded-full bg-foreground/[0.04] blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-[520px]">
        <div className="rounded-[20px] border border-border bg-card/70 p-8 shadow-[0_16px_48px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-2xl sm:p-10">
          <div className="mb-9 flex flex-col items-center text-center">
            <Link to="/" className="flex items-center gap-2">
              <span className="brand-gradient text-brand-foreground grid size-10 place-items-center rounded-xl">
                <Rocket className="size-4" />
              </span>
              <span className="font-display text-lg font-semibold tracking-tight">Mefticaret</span>
            </Link>
            <p className="mt-4 text-[13px] text-muted-foreground">
              {isLogin ? "Mağaza panelinize erişin" : "Ücretsiz hesabınızı oluşturun"}
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
                {value === "login" ? "Giriş yap" : "Kayıt ol"}
              </button>
            ))}
          </div>

          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-[18px]">
            {!isLogin ? (
              <div className="space-y-2">
                <label className={fieldLabel} htmlFor="register-name">
                  Ad Soyad
                </label>
                <div className="relative flex items-center">
                  <User className="pointer-events-none absolute left-[14px] size-[18px] text-muted-foreground" />
                  <Input
                    id="register-name"
                    required
                    placeholder="Adınız Soyadınız"
                    className={inputClass}
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className={fieldLabel} htmlFor="auth-email">
                E-posta Adresi
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
                Şifre
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
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-[14px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                </button>
              </div>
              {isLogin ? (
                <div className="pt-1 text-right">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Şifremi unuttum
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">En az 8 karakter kullan.</p>
              )}
            </div>

            <Button type="submit" className="h-[52px] w-full rounded-[10px] text-sm font-semibold" disabled={busy}>
              {busy ? "Lütfen bekleyin..." : isLogin ? "Devam Et" : "Hesabımı oluştur"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> veya <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="outline"
            className="h-[50px] w-full rounded-[10px] text-sm font-medium"
            onClick={handleGoogle}
            disabled={busy}
          >
            Google ile devam et
          </Button>

          <p className="mt-7 text-center text-[13px] text-muted-foreground">
            {isLogin ? (
              <>
                Henüz hesabınız yok mu?{" "}
                <button
                  type="button"
                  onClick={() => setTab("register")}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Kayıt Olun
                </button>
              </>
            ) : (
              <>
                Hesabınız var mı?{" "}
                <button
                  type="button"
                  onClick={() => setTab("login")}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Giriş Yapın
                </button>
              </>
            )}
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          KVKK & GDPR uyumlu • Rol bazlı erişim • Denetim kayıtları
        </p>
      </div>
    </div>
  );
}
