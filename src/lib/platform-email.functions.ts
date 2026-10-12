import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Süper yönetici E-posta Pazarlama: platformun kendi e-posta sistemiyle
 * mağaza sahiplerine (satıcılara) kampanya gönderimi. Alıcılar sunucuda kurulur.
 */
const MAX_RECIPIENTS = 2000;

async function sellerRecipients() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as { from: (t: string) => any };
  const { data: stores } = await db.from("stores").select("id, name, owner_id, status").neq("status", "archived").limit(5000);
  const owners = new Map<string, string>();
  for (const s of (stores ?? []) as { owner_id: string | null; name: string }[]) {
    if (s.owner_id && !owners.has(s.owner_id)) owners.set(s.owner_id, s.name);
  }
  const emails = new Map<string, { email: string; storeName: string }>();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      const storeName = owners.get(u.id);
      if (storeName && u.email && u.email_confirmed_at) emails.set(u.email.toLowerCase(), { email: u.email, storeName });
    }
    if (data.users.length < 200) break;
  }
  return [...emails.values()];
}

async function guard(supabase: unknown, userId: string) {
  const { assertPlatformAdmin } = await import("@/lib/platform-admin.server");
  await assertPlatformAdmin(supabase as never, userId);
}

export const platformEmailOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.supabase, context.userId);
    const list = await sellerRecipients();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    const { data: stores } = await db.from("stores").select("id, name, slug, status").neq("status", "archived").order("created_at", { ascending: false }).limit(500);
    return {
      sellerCount: list.length,
      max: MAX_RECIPIENTS,
      stores: ((stores ?? []) as { id: string; name: string; slug: string; status: string }[]),
    };
  });

export const sendPlatformSellerCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      subject: z.string().trim().min(3).max(200),
      body: z.string().trim().min(10).max(20000),
      testEmail: z.string().trim().email().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const { sendMarketingEmail } = await import("@/lib/email-marketing.server");
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    const render = (storeName: string) => {
      const text = data.body.replaceAll("{magaza}", storeName);
      const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:600px;margin:0 auto;padding:24px">${esc(text)
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("")}<p style="color:#666;font-size:12px;margin-top:32px">Mefticaret</p></div>`;
      return { text, html };
    };

    const list = data.testEmail ? [{ email: data.testEmail, storeName: "Test Mağaza" }] : (await sellerRecipients()).slice(0, MAX_RECIPIENTS);
    const campaignId = crypto.randomUUID();
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    let lastError: string | null = null;
    for (let i = 0; i < list.length; i += 6) {
      const results = await Promise.all(
        list.slice(i, i + 6).map((r) => {
          const { text, html } = render(r.storeName);
          return sendMarketingEmail({
            to: r.email,
            fromName: "Mefticaret",
            subject: data.subject,
            html,
            text,
            label: "platform-seller-campaign",
            idempotencyKey: `platform-${campaignId}-${r.email}`,
          });
        }),
      );
      for (const r of results) {
        if (r.sent) sent += 1;
        else if (r.reason === "recipient_suppressed") skipped += 1;
        else { failed += 1; lastError = r.message ?? r.reason; }
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as unknown as { from: (t: string) => any }).from("audit_logs").insert({
      actor_id: context.userId,
      action: "platform.email_campaign.sent",
      metadata: { subject: data.subject, sent, skipped, failed, test: Boolean(data.testEmail) },
    });
    return { sent, skipped, failed, error: lastError };
  });
