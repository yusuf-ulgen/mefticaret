import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Factor = { id: string; status: string; friendly_name?: string | null };

/** TOTP tabanlı iki adımlı doğrulama (2FA) yönetimi. */
export function TwoFactorSettings() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error) setFactors((data?.totp ?? []) as Factor[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function startEnroll() {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Mefticaret ${new Date().toLocaleDateString("tr-TR")}`,
    });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "2FA başlatılamadı");
      return;
    }
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verifyEnroll() {
    if (!enrolling) return;
    setBusy(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId: enrolling.id });
    if (challenge.error || !challenge.data) {
      setBusy(false);
      toast.error(challenge.error?.message ?? "Doğrulama başlatılamadı");
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: enrolling.id,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error("Kod doğrulanamadı, tekrar dene");
      return;
    }
    toast.success("İki adımlı doğrulama etkinleştirildi");
    setEnrolling(null);
    setCode("");
    void refresh();
  }

  async function removeFactor(id: string) {
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("2FA kaldırıldı");
    void refresh();
  }

  const verified = factors.filter((factor) => factor.status === "verified");

  return (
    <div className="surface-card space-y-4 p-5">
      <div>
        <h3 className="text-sm font-semibold">İki adımlı doğrulama (2FA)</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Google Authenticator, 1Password veya Authy gibi TOTP uygulamalarıyla çalışır.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Yükleniyor...</p>
      ) : verified.length > 0 ? (
        <div className="space-y-2">
          {verified.map((factor) => (
            <div key={factor.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-xs">{factor.friendly_name ?? "Authenticator"} · etkin</span>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void removeFactor(factor.id)}>
                Kaldır
              </Button>
            </div>
          ))}
        </div>
      ) : enrolling ? (
        <div className="space-y-3">
          <img src={enrolling.qr} alt="2FA QR kodu" className="size-40 rounded-lg border border-border bg-white p-2" />
          <p className="break-all text-xs text-muted-foreground">Manuel anahtar: {enrolling.secret}</p>
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Uygulamadaki 6 haneli kod</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || code.trim().length < 6} onClick={() => void verifyEnroll()}>
              Doğrula ve etkinleştir
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEnrolling(null)}>
              Vazgeç
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" disabled={busy} onClick={() => void startEnroll()}>
          2FA'yı etkinleştir
        </Button>
      )}
    </div>
  );
}
