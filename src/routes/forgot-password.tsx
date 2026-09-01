import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Rocket } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Şifremi Unuttum — Mefticaret" },
      {
        name: "description",
        content: "E-posta adresinizi girin, şifre sıfırlama bağlantısını saniyeler içinde gönderelim.",
      },
      { property: "og:title", content: "Şifremi Unuttum — Mefticaret" },
      { property: "og:description", content: "Mefticaret hesabınızın şifresini güvenle sıfırlayın." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Sıfırlama bağlantısı gönderildi.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <span className="brand-gradient text-brand-foreground grid size-9 place-items-center rounded-xl">
            <Rocket className="size-4" />
          </span>
          <span className="font-display text-lg font-semibold">Mefticaret</span>
        </Link>

        <form onSubmit={handleSubmit} className="surface-card space-y-4 p-6">
          <h1 className="font-display text-xl font-semibold">Şifreni sıfırla</h1>
          <p className="text-sm text-muted-foreground">
            Hesabına bağlı e-posta adresini gir; şifre yenileme bağlantısını gönderelim.
          </p>
          <div className="space-y-2">
            <Label htmlFor="forgot-email">E-posta</Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || sent}>
            {sent ? "Bağlantı gönderildi" : busy ? "Gönderiliyor..." : "Sıfırlama bağlantısı gönder"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Link to="/auth" search={{ mode: "login" }} className="underline">
              Girişe dön
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
