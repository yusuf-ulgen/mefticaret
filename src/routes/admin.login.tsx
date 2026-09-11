import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  adminLoginCode,
  adminLoginLogout,
  adminLoginPassword,
  adminLoginState,
} from "@/lib/admin-auth.functions";

/**
 * Süper admin için ayrı giriş sayfası.
 *
 * Mağaza/müşteri girişinden bağımsızdır: panel şifresi + tek kullanımlık kod.
 * Doğrulama tamamen sunucuda yapılır; sayfa hiçbir gizli değer tutmaz.
 */
export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Süper Admin Girişi — Mefticaret" },
      {
        name: "description",
        content: "Mefticaret platform yönetim konsoluna iki adımlı özel süper admin girişi.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Süper Admin Girişi — Mefticaret" },
      { property: "og:description", content: "Platform yönetim konsolu için özel güvenli giriş." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLoginPage,
});

type Step = "password" | "code" | "done";

function AdminLoginPage() {
  const navigate = useNavigate();
  const loadState = useServerFn(adminLoginState);
  const submitPassword = useServerFn(adminLoginPassword);
  const submitCode = useServerFn(adminLoginCode);
  const logout = useServerFn(adminLoginLogout);

  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupUri, setSetupUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void loadState().then((state) => {
      if (!active) return;
      if (state.stage === "authenticated") setStep("done");
      else if (state.stage === "code") setStep("code");
      if (!state.passwordConfigured) setError("Panel şifresi henüz tanımlanmamış.");
      else if (!state.accountReady) setError("Süper yönetici hesabı tanımlı değil.");
      else if (state.locked) {
        setError(`Çok fazla hatalı deneme. ${state.lockMinutes} dakika sonra tekrar deneyin.`);
      }
    });
    return () => {
      active = false;
    };
  }, [loadState]);

  const messages: Record<string, string> = {
    invalid: "Bilgiler doğrulanamadı.",
    locked: "Çok fazla hatalı deneme yapıldı. Bir süre sonra tekrar deneyin.",
    expired: "Süre doldu, şifre adımından yeniden başlayın.",
    not_configured: "Giriş yapılandırması eksik.",
    forbidden: "Bu hesabın süper yönetici yetkisi yok.",
  };

  async function onPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await submitPassword({ data: { password } });
      if (!result.ok) {
        setError(messages[result.error] ?? messages["invalid"]!);
        return;
      }
      setPassword("");
      setSetupSecret(result.setupSecret ?? null);
      setSetupUri(result.setupUri ?? null);
      setStep("code");
      setNotice(
        result.needsEnrollment
          ? "Aşağıdaki anahtarı doğrulama uygulamanıza (Google Authenticator, 1Password vb.) ekleyin, sonra üretilen 6 haneli kodu girin. Bu anahtar bir daha gösterilmez."
          : "Doğrulama uygulamanızdaki 6 haneli kodu girin.",
      );
    } catch {
      setError("Giriş sırasında beklenmeyen bir sorun oluştu.");
    } finally {
      setBusy(false);
    }
  }

  async function onCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await submitCode({ data: { code } });
      if (!result.ok) {
        setError(messages[result.error] ?? messages["invalid"]!);
        if (result.error === "expired") setStep("password");
        return;
      }
      setCode("");
      setSetupSecret(null);
      setSetupUri(null);
      // Panel verileri mevcut erişim kurallarıyla okunduğu için tek kullanımlık
      // devir token'ı ile veri oturumu açılır; şifre kullanılmaz.
      if (result.tokenHash) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: result.tokenHash,
          type: "email",
        });
        if (otpError) {
          setError("Panel oturumu açıldı, veri erişimi doğrulanamadı. Tekrar deneyin.");
          return;
        }
      }
      setStep("done");
      await navigate({ to: "/admin" });
    } catch {
      setError("Kod doğrulanırken beklenmeyen bir sorun oluştu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Mefticaret Platform
          </p>
          <CardTitle className="text-2xl">Süper Admin Girişi</CardTitle>
          <CardDescription>
            Bu giriş yalnızca platform yönetimi içindir ve mağaza girişinden ayrıdır.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {step === "password" ? (
            <form className="space-y-4" onSubmit={onPassword}>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Panel şifresi</Label>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy || password.length === 0}>
                {busy ? "Kontrol ediliyor…" : "Devam et"}
              </Button>
            </form>
          ) : null}

          {step === "code" ? (
            <form className="space-y-4" onSubmit={onCode}>
              {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
              {setupSecret ? (
                <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Kurulum anahtarı
                  </p>
                  <p className="break-all font-mono text-sm">{setupSecret}</p>
                  {setupUri ? (
                    <p className="break-all text-xs text-muted-foreground">{setupUri}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="admin-code">6 haneli kod</Label>
                <Input
                  id="admin-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy || code.length < 6}>
                {busy ? "Doğrulanıyor…" : "Panele gir"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("password");
                  setNotice(null);
                  setSetupSecret(null);
                  setSetupUri(null);
                }}
              >
                Geri dön
              </Button>
            </form>
          ) : null}

          {step === "done" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Panel oturumunuz açık.</p>
              <Button className="w-full" onClick={() => void navigate({ to: "/admin" })}>
                Panele git
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  await logout();
                  await supabase.auth.signOut();
                  setStep("password");
                }}
              >
                Panel oturumunu kapat
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
