import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  adminLoginLogout,
  adminLoginPassword,
  adminLoginState,
} from "@/lib/admin-auth.functions";

/**
 * Süper admin için ayrı giriş sayfası.
 *
 * Mağaza/müşteri girişinden bağımsızdır: yalnızca panel şifresi.
 * Doğrulama tamamen sunucuda yapılır; sayfa hiçbir gizli değer tutmaz.
 */
export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Süper Admin Girişi — Mefticaret" },
      {
        name: "description",
        content: "Mefticaret platform yönetim konsoluna özel süper admin girişi.",
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

type Step = "password" | "done";

function AdminLoginPage() {
  const navigate = useNavigate();
  const loadState = useServerFn(adminLoginState);
  const submitPassword = useServerFn(adminLoginPassword);
  const logout = useServerFn(adminLoginLogout);

  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void loadState().then((state) => {
      if (!active) return;
      if (state.stage === "authenticated") setStep("done");
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
      setError("Giriş sırasında beklenmeyen bir sorun oluştu.");
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy || password.length === 0}>
                {busy ? "Giriş yapılıyor…" : "Panele gir"}
              </Button>
            </form>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </main>
  );
}
