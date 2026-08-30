import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { createStockAlert } from "@/lib/stock-alerts.functions";

/**
 * Tükenen ürünlerde "stoğa gelince haber ver" formu. Vitrin tema tokenları ile
 * çalışır, kayıt sunucu fonksiyonu üzerinden doğrulanarak oluşturulur.
 */
export function StockAlertForm({
  slug,
  productSlug,
  variantId,
  accent,
  border,
  muted,
  radius,
}: {
  slug: string;
  productSlug: string;
  variantId?: string;
  accent: string;
  border: string;
  muted: string;
  radius: string;
}) {
  const submit = useServerFn(createStockAlert);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p style={{ marginTop: 16, fontSize: 13, color: muted }}>
        Teşekkürler! Ürün stoğa girdiğinde <strong>{email}</strong> adresine haber vereceğiz.
      </p>
    );
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (!email.trim()) return;
        setPending(true);
        try {
          await submit({ data: { slug, productSlug, variantId, email: email.trim() } });
          setDone(true);
          toast.success("Stok bildirimi kaydedildi");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Kaydedilemedi");
        } finally {
          setPending(false);
        }
      }}
      style={{ marginTop: 18, border: `1px solid ${border}`, borderRadius: radius, padding: 14 }}
    >
      <p style={{ fontSize: 13, fontWeight: 600 }}>Stoğa gelince haber ver</p>
      <p style={{ fontSize: 12, color: muted, marginTop: 4 }}>
        E-postanı bırak, ürün yeniden satışa çıktığında ilk sen öğren.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ornek@eposta.com"
          style={{
            flex: "1 1 180px",
            background: "transparent",
            color: "inherit",
            border: `1px solid ${border}`,
            borderRadius: radius,
            padding: "10px 12px",
            fontSize: 13,
          }}
        />
        <button
          type="submit"
          disabled={pending}
          style={{
            background: accent,
            color: "#12181f",
            border: "none",
            borderRadius: radius,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 600,
            cursor: pending ? "progress" : "pointer",
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? "Kaydediliyor..." : "Haber ver"}
        </button>
      </div>
    </form>
  );
}
