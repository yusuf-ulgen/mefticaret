import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendPlatformContactMessage } from "@/lib/platform-contact.functions";

/** Platform iletişim sayfasındaki mesaj formu (mesajlar süper yönetici panelinde listelenir). */

const EMPTY = { name: "", email: "", phone: "", subject: "", message: "" };

export function PlatformContactForm({ pageSlug }: { pageSlug: string }) {
  const send = useServerFn(sendPlatformContactMessage);
  const [form, setForm] = useState(EMPTY);
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          subject: form.subject || undefined,
          message: form.message,
          pageSlug,
        },
      }),
    onSuccess: () => {
      setForm(EMPTY);
      setDone(true);
      toast.success("Mesajın bize ulaştı, en kısa sürede döneceğiz.");
    },
    onError: () => toast.error("Mesaj gönderilemedi, lütfen tekrar dene."),
  });

  return (
    <section className="surface-card mt-10 p-5 sm:p-6">
      <h2 className="text-xl font-semibold">Bize yazın</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Formu doldur, ekibimiz e-posta ile geri dönsün.
      </p>

      {done ? (
        <p className="mt-4 rounded-lg border p-4 text-sm">
          Mesajın alındı. Teşekkürler!{" "}
          <button type="button" className="underline" onClick={() => setDone(false)}>
            Yeni mesaj yaz
          </button>
        </p>
      ) : (
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pc-name">Ad soyad</Label>
              <Input
                id="pc-name"
                required
                minLength={2}
                value={form.name}
                onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-email">E-posta</Label>
              <Input
                id="pc-email"
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-phone">Telefon (opsiyonel)</Label>
              <Input
                id="pc-phone"
                value={form.phone}
                onChange={(event) => setForm((f) => ({ ...f, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-subject">Konu (opsiyonel)</Label>
              <Input
                id="pc-subject"
                value={form.subject}
                onChange={(event) => setForm((f) => ({ ...f, subject: event.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pc-message">Mesajın</Label>
            <Textarea
              id="pc-message"
              rows={6}
              required
              minLength={5}
              value={form.message}
              onChange={(event) => setForm((f) => ({ ...f, message: event.target.value }))}
            />
          </div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Gönderiliyor…" : "Mesajı gönder"}
          </Button>
        </form>
      )}
    </section>
  );
}
