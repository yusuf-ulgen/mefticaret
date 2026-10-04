import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Boxes, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { supplierPortalAccess } from "@/lib/supplier-portal.functions";

/** Tedarikçilerin kendi paneline doğrudan giriş yaptığı bağımsız ekran. */
const searchSchema = z.object({ mode: z.enum(["login", "register"]).optional() });

export const Route = createFileRoute("/tedarikci-giris")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Tedarikçi Girişi — Mefticaret" },
      {
        name: "description",
        content:
          "Mefticaret tedarikçi paneline e-posta ve şifrenizle giriş yapın: siparişleri karşılayın, ürün dosyanızı yükleyin, komisyon ve ödeme bakiyenizi görün.",
      },
      { property: "og:title", content: "Tedarikçi Girişi — Mefticaret" },
      {
        property: "og:description",
        content: "Tedarikçi hesabınızla giriş yapın; sipariş masası, senkron durumu ve komisyon defteri tek ekranda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index, follow, max-image-preview:large" },
    ],
    links: [{ rel: "canonical", href: "https://mefticaret.com/tedarikci-giris" }],
  }),
  component: SupplierLoginPage,
});

function SupplierLoginPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const checkAccess = useServerFn(supplierPortalAccess);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      toast.error("Giriş yapılamadı", { description: "E-posta veya şifre hatalı." });
      return;
    }
    try {
      const access = await checkAccess({ data: undefined } as never);
      setBusy(false);
      if (!access.hasAccess) {
        setNotice(
          "Hesabınız oluşturuldu ancak henüz bir tedarikçi kaydına bağlı değil. Çalıştığınız mağaza yöneticisi panelinden e-posta adresinize portal erişimi vermelidir.",
        );
        return;
      }
      toast.success("Tedarikçi paneline hoş geldiniz");
      void navigate({ to: "/supplier/panel" });
    } catch {
      setBusy(false);
      setNotice("Tedarikçi erişiminiz doğrulanamadı. Lütfen birkaç saniye sonra tekrar deneyin.");
    }
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/tedarikci-giris`,
        data: { full_name: fullName.trim() || null, signup_kind: "supplier" },
      },
    });
    setBusy(false);
    if (error) {
      toast.error("Kayıt tamamlanamadı", { description: error.message });
      return;
    }
    setNotice(
      "E-posta adresinize doğrulama bağlantısı gönderdik. Bağlantıyı onayladıktan sonra bu sayfadan giriş yapabilirsiniz.",
    );
  }

  async function handleReset() {
    if (!email.trim()) {
      toast.error("Önce e-posta adresinizi yazın");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/tedarikci-giris`,
    });
    setBusy(false);
    if (error) {
      toast.error("Sıfırlama bağlantısı gönderilemedi", { description: error.message });
      return;
    }
    toast.success("Şifre sıfırlama bağlantısı e-postanıza gönderildi");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-5 py-12">
      <div className="space-y-2 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Boxes className="size-3.5" /> Tedarikçi Portalı
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Tedarikçi girişi</h1>
        <p className="text-sm text-muted-foreground">
          Siparişlerinizi karşılayın, ürün dosyanızı yükleyin, senkron durumunuzu ve komisyon defterinizi takip edin.
        </p>
      </div>

      <Tabs defaultValue={mode === "register" ? "register" : "login"}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Giriş yap</TabsTrigger>
          <TabsTrigger value="register">Kayıt ol</TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="mt-5">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplier-email">E-posta</Label>
              <Input
                id="supplier-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-password">Şifre</Label>
              <Input
                id="supplier-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Panele gir
            </Button>
            <button
              type="button"
              onClick={handleReset}
              className="w-full text-xs text-muted-foreground underline underline-offset-4"
            >
              Şifremi unuttum
            </button>
          </form>
        </TabsContent>

        <TabsContent value="register" className="mt-5">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplier-name">Firma / yetkili adı</Label>
              <Input
                id="supplier-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Örn. Demir Tekstil — Ayşe Demir"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-register-email">E-posta</Label>
              <Input
                id="supplier-register-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-register-password">Şifre</Label>
              <Input
                id="supplier-register-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Hesap oluştur
            </Button>
            <p className="text-xs text-muted-foreground">
              Kaydınızı doğruladıktan sonra çalıştığınız mağaza yöneticisi aynı e-posta ile tedarikçi kaydınıza portal
              erişimi verir; panel o anda açılır.
            </p>
          </form>
        </TabsContent>
      </Tabs>

      {notice ? (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">{notice}</p>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        Mağaza yöneticisi misiniz?{" "}
        <Link to="/auth" search={{ mode: "login" as const }} className="underline underline-offset-4">
          Mağaza girişine geçin
        </Link>
      </p>
    </main>
  );
}
