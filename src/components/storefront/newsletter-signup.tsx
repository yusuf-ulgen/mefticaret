import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeToNewsletter } from "@/lib/email-marketing.functions";

/** Vitrin alt bilgisinde e-bülten kayıt formu. */
export function NewsletterSignup({ slug, muted }: { slug: string; muted?: string }) {
  const subscribe = useServerFn(subscribeToNewsletter);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: () => subscribe({ data: { storeSlug: slug, email: email.trim() } }),
    onSuccess: () => {
      setDone(true);
      setEmail("");
      toast.success("Bültene kaydınız alındı");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Kayıt tamamlanamadı"),
  });

  if (done) {
    return (
      <p style={{ marginBottom: 14, fontSize: 13, color: muted }}>
        Teşekkürler! Yeni ürün ve kampanyaları e-posta ile paylaşacağız.
      </p>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!/.+@.+\..+/.test(email.trim())) {
          toast.error("Geçerli bir e-posta girin");
          return;
        }
        mutation.mutate();
      }}
      style={{
        margin: "0 auto 18px",
        display: "flex",
        gap: 8,
        maxWidth: 420,
        flexWrap: "wrap",
        justifyContent: "center",
      }}
    >
      <label htmlFor="sf-newsletter" style={{ width: "100%", fontSize: 12, color: muted }}>
        Kampanyalardan ilk siz haberdar olun
      </label>
      <Input
        id="sf-newsletter"
        type="email"
        placeholder="E-posta adresiniz"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        style={{ flex: "1 1 200px" }}
      />
      <Button type="submit" disabled={mutation.isPending}>
        Abone ol
      </Button>
    </form>
  );
}
