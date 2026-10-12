import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitDataRequest } from "@/lib/compliance.functions";
import { DSR_KINDS, DSR_KIND_LABELS, type DsrKind } from "@/lib/security";

/** Vitrin tarafı KVKK/GDPR başvuru formu: veri dışa aktarma, silme, erişim ve düzeltme. */
export function DataRequestForm({ slug }: { slug: string }) {
  const [kind, setKind] = useState<DsrKind>("export");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await submitDataRequest({
        data: { storeSlug: slug, kind, subjectEmail: email.trim(), ...(reason.trim() ? { reason: reason.trim() } : {}) },
      });
      toast.success("Başvurun alındı. En geç 30 gün içinde dönüş yapılacak.");
      setReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Başvuru gönderilemedi");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl border border-border p-5">
      <div>
        <h2 className="text-base font-semibold">Veri sahibi başvurusu</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          KVKK m.11 ve GDPR Art. 15-17 kapsamındaki haklarını buradan kullanabilirsin.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dsr-kind">Talep türü</Label>
        <select
          id="dsr-kind"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={kind}
          onChange={(event) => setKind(event.target.value as DsrKind)}
        >
          {DSR_KINDS.map((item) => (
            <option key={item} value={item}>
              {DSR_KIND_LABELS[item]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dsr-email">E-posta</Label>
        <Input
          id="dsr-email"
          type="email"
          required
          maxLength={200}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dsr-reason">Açıklama (opsiyonel)</Label>
        <Textarea
          id="dsr-reason"
          maxLength={1000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? "Gönderiliyor..." : "Başvuruyu gönder"}
      </Button>
    </form>
  );
}
