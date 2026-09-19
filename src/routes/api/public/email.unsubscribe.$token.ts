import { createFileRoute } from "@tanstack/react-router";

/**
 * Tek tıkla abonelikten çıkma. Hem GET (bağlantı) hem POST
 * (RFC 8058 List-Unsubscribe-Post) ile çalışır.
 */

function page(title: string, message: string) {
  return new Response(
    `<!doctype html><html lang="tr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${title}</title></head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f5f5;display:grid;place-items:center;min-height:100vh">
  <main style="max-width:420px;background:#fff;border-radius:20px;padding:32px;text-align:center">
    <h1 style="margin:0 0 12px;font-size:20px">${title}</h1>
    <p style="margin:0;color:#555;line-height:1.6">${message}</p>
  </main>
</body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

async function unsubscribe(token: string) {
  if (!/^[a-f0-9]{16,64}$/i.test(token)) {
    return page("Bağlantı geçersiz", "Abonelik bağlantısı geçerli değil. Lütfen e-postadaki bağlantıyı yeniden deneyin.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: send } = await supabaseAdmin
    .from("email_sends")
    .select("id, store_id, campaign_id, recipient, customer_id, unsubscribed_at, variant_id")
    .eq("token", token)
    .maybeSingle();

  if (!send) {
    return page("Bağlantı geçersiz", "Bu abonelik bağlantısı artık geçerli değil.");
  }

  const now = new Date().toISOString();
  if (!send.unsubscribed_at) {
    await supabaseAdmin.from("email_sends").update({ unsubscribed_at: now }).eq("id", send.id);
    if (send.variant_id) {
      const { data: variant } = await supabaseAdmin
        .from("email_campaign_variants")
        .select("unsubscribe_count")
        .eq("id", send.variant_id)
        .maybeSingle();
      await supabaseAdmin
        .from("email_campaign_variants")
        .update({ unsubscribe_count: (variant?.unsubscribe_count ?? 0) + 1 })
        .eq("id", send.variant_id);
    }
  }

  await supabaseAdmin.from("email_events").insert({
    store_id: send.store_id,
    campaign_id: send.campaign_id,
    send_id: send.id,
    kind: "unsubscribe",
  });

  await supabaseAdmin
    .from("email_subscribers")
    .update({ status: "unsubscribed" })
    .eq("store_id", send.store_id)
    .eq("email", send.recipient);

  if (send.customer_id) {
    await supabaseAdmin
      .from("customers")
      .update({ accepts_marketing: false })
      .eq("id", send.customer_id);
  }

  return page(
    "Aboneliğiniz durduruldu",
    `${send.recipient} adresine artık pazarlama e-postası gönderilmeyecek. Sipariş ve kargo bilgilendirmeleri devam eder.`,
  );
}

export const Route = createFileRoute("/api/public/email/unsubscribe/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => unsubscribe(String(params.token ?? "")),
      POST: async ({ params }) => unsubscribe(String(params.token ?? "")),
    },
  },
});
