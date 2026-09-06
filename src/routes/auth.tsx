import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth-context";
import { logAuthEvent } from "@/lib/audit.functions";


const searchSchema = z.object({
  mode: z.enum(["login", "register"]).optional(),
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Giriş & Kayıt — Mefticaret" },
      {
        name: "description",
        content: "Mefticaret hesabınıza giriş yapın veya saniyeler içinde ücretsiz hesap oluşturun.",
      },
      { property: "og:title", content: "Giriş & Kayıt — Mefticaret" },
      { property: "og:description", content: "Mefticaret hesabınıza giriş yapın veya ücretsiz kayıt olun." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode, next } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/stores";

  useEffect(() => {
    if (!loading && session) {
      void navigate({ to: safeNext, replace: true });
    }
  }, [loading, session, navigate, safeNext]);

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
    void navigate({ to: safeNext, replace: true });
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
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google ile giriş başarısız oldu");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: safeNext, replace: true });
  }

  return (
    <div className="grid grid-cols-1 min-h-screen lg:grid-cols-2">
      <div className="hero-surface hidden flex-col justify-between p-10 lg:flex">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl brand-gradient text-brand-foreground">
            <Rocket className="size-4" />
          </span>
          <span className="font-display text-lg font-semibold">Mefticaret</span>
        </Link>
        <div className="max-w-md">
          <h2 className="font-display text-3xl font-semibold">
            Tek hesap. <span className="text-brand-gradient">Sınırsız mağaza.</span>
          </h2>
          <p className="mt-3 text-sm opacity-75">
            Mağazalarını, ekibini, domainlerini ve yetkilerini tek panelden yönet. Verilerin
            veritabanı seviyesinde birbirinden izole edilir.
          </p>
        </div>
        <p className="text-xs opacity-60">KVKK & GDPR uyumlu • Rol bazlı erişim • Denetim kayıtları</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Tabs defaultValue={mode === "register" ? "register" : "login"}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Giriş yap</TabsTrigger>
              <TabsTrigger value="register">Kayıt ol</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="surface-card space-y-4 p-6">
                <h1 className="font-display text-xl font-semibold">Tekrar hoş geldin</h1>
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-posta</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Şifre</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Giriş yapılıyor..." : "Giriş yap"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="mt-6">
              <form onSubmit={handleRegister} className="surface-card space-y-4 p-6">
                <h1 className="font-display text-xl font-semibold">Ücretsiz hesap oluştur</h1>
                <div className="space-y-2">
                  <Label htmlFor="register-name">Ad Soyad</Label>
                  <Input
                    id="register-name"
                    required
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">E-posta</Label>
                  <Input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Şifre</Label>
                  <Input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">En az 8 karakter kullan.</p>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Hesap oluşturuluyor..." : "Hesabımı oluştur"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> veya <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
            Google ile devam et
          </Button>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Devam ederek Kullanım Şartları ve Gizlilik Politikası'nı kabul etmiş olursun.
          </p>
        </div>
      </div>
    </div>
  );
}
