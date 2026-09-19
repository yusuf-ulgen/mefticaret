import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BLOCK_KINDS,
  FLOW_PRESETS,
  filterAudience,
  mergeTags,
  pickVariant,
  renderEmailHtml,
  renderEmailText,
  type AudienceCustomer,
  type EmailBlock,
  type ProductCard,
} from "@/lib/email-marketing";
import { slugify } from "@/lib/mefti";

/**
 * E-posta pazarlama: tasarım/kampanya yönetimi, hedef kitle önizlemesi,
 * A/B dağıtımlı gerçek gönderim, ciro ilişkilendirme ve hazır akış kurulumu.
 * Tenant izolasyonu RLS + assertStoreManager ile sağlanır.
 */

const blockSchema = z.object({
  id: z.string().min(1).max(60),
  kind: z.enum(BLOCK_KINDS),
  text: z.string().max(4000).optional(),
  subtext: z.string().max(4000).optional(),
  href: z.string().max(500).optional(),
  imageUrl: z.string().max(1000).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  code: z.string().max(80).optional(),
  deadline: z.string().max(40).optional(),
});

const audienceSchema = z.object({
  ltvMin: z.number().min(0).max(10_000_000).optional(),
  ordersMin: z.number().int().min(0).max(1000).optional(),
  activeWithinDays: z.number().int().min(0).max(3650).optional(),
  inactiveOverDays: z.number().int().min(0).max(3650).optional(),
  tag: z.string().trim().max(60).optional(),
  categoryInterest: z.string().trim().max(80).optional(),
  includeSubscribers: z.boolean().default(true),
});

async function guard(supabase: unknown, storeId: string, userId: string) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(supabase as never, storeId, userId);
}

/* ------------------------------------------------------------- tasarımlar */

export const saveEmailDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        designId: z.guid().optional(),
        name: z.string().trim().min(2).max(120),
        subject: z.string().trim().max(200).default(""),
        previewText: z.string().trim().max(200).default(""),
        accentColor: z.string().trim().max(20).default("#111111"),
        sector: z.string().trim().max(60).optional(),
        campaignTag: z.string().trim().max(60).optional(),
        sourceTemplate: z.string().trim().max(120).optional(),
        blocks: z.array(blockSchema).max(60).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await guard(supabase, data.storeId, userId);

    const payload = {
      store_id: data.storeId,
      name: data.name,
      subject: data.subject,
      preview_text: data.previewText,
      accent_color: data.accentColor,
      sector: data.sector ?? null,
      campaign_tag: data.campaignTag ?? null,
      source_template: data.sourceTemplate ?? null,
      blocks: data.blocks as never,
    };

    const { data: row, error } = await (data.designId
      ? supabase.from("email_designs").update(payload).eq("id", data.designId).eq("store_id", data.storeId)
      : supabase.from("email_designs").insert(payload)
    )
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Tasarım kaydedilemedi");
    return row;
  });

export const deleteEmailDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), designId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("email_designs")
      .delete()
      .eq("id", data.designId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------------------------------------------- kampanyalar */

const variantSchema = z.object({
  id: z.guid().optional(),
  label: z.string().trim().min(1).max(10),
  subject: z.string().trim().max(200).default(""),
  previewText: z.string().trim().max(200).default(""),
  designId: z.guid().nullable().optional(),
  weight: z.number().int().min(0).max(100).default(50),
});

export const saveEmailCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        campaignId: z.guid().optional(),
        name: z.string().trim().min(2).max(140),
        designId: z.guid().nullable().optional(),
        subject: z.string().trim().max(200).default(""),
        previewText: z.string().trim().max(200).default(""),
        audience: audienceSchema.default({ includeSubscribers: true }),
        abEnabled: z.boolean().default(false),
        scheduledAt: z.string().max(40).nullable().optional(),
        variants: z.array(variantSchema).max(4).default([]),
        storefrontEnabled: z.boolean().default(false),
        slug: z
          .string()
          .trim()
          .regex(/^[a-z0-9-]*$/, "Adres yalnızca küçük harf, rakam ve tire içerebilir")
          .max(80)
          .default(""),
        bannerHeadline: z.string().trim().max(120).default(""),
        bannerBody: z.string().trim().max(200).default(""),
        bannerCtaLabel: z.string().trim().max(60).default(""),
        landingHeadline: z.string().trim().max(160).default(""),
        landingBody: z.string().trim().max(4000).default(""),
        discountCode: z.string().trim().max(40).default(""),
        startsAt: z.string().max(40).nullable().optional(),
        endsAt: z.string().max(40).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await guard(supabase, data.storeId, userId);

    if (data.storefrontEnabled && !data.slug) {
      throw new Error("Vitrinde göstermek için kampanya adresi (slug) gerekir");
    }

    const payload = {
      store_id: data.storeId,
      name: data.name,
      design_id: data.designId ?? null,
      subject: data.subject,
      preview_text: data.previewText,
      audience: data.audience as never,
      ab_enabled: data.abEnabled,
      scheduled_at: data.scheduledAt ?? null,
      storefront_enabled: data.storefrontEnabled,
      slug: data.slug || null,
      banner_headline: data.bannerHeadline,
      banner_body: data.bannerBody,
      banner_cta_label: data.bannerCtaLabel,
      landing_headline: data.landingHeadline,
      landing_body: data.landingBody,
      discount_code: data.discountCode,
      starts_at: data.startsAt ?? null,
      ends_at: data.endsAt ?? null,
    };


    const { data: campaign, error } = await (data.campaignId
      ? supabase.from("email_campaigns").update(payload).eq("id", data.campaignId).eq("store_id", data.storeId)
      : supabase.from("email_campaigns").insert(payload)
    )
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!campaign) throw new Error("Kampanya kaydedilemedi");

    if (data.abEnabled) {
      const keepIds = data.variants.map((variant) => variant.id).filter(Boolean) as string[];
      const existing = await supabase
        .from("email_campaign_variants")
        .select("id")
        .eq("campaign_id", campaign.id);
      const removable = (existing.data ?? [])
        .map((row) => row.id)
        .filter((id) => !keepIds.includes(id));
      if (removable.length > 0) {
        await supabase.from("email_campaign_variants").delete().in("id", removable);
      }
      for (const variant of data.variants) {
        const variantPayload = {
          store_id: data.storeId,
          campaign_id: campaign.id,
          label: variant.label,
          subject: variant.subject,
          preview_text: variant.previewText,
          design_id: variant.designId ?? null,
          weight: variant.weight,
        };
        const { error: variantError } = variant.id
          ? await supabase.from("email_campaign_variants").update(variantPayload).eq("id", variant.id)
          : await supabase.from("email_campaign_variants").insert(variantPayload);
        if (variantError) throw new Error(variantError.message);
      }
    } else {
      await supabase.from("email_campaign_variants").delete().eq("campaign_id", campaign.id);
    }

    return campaign;
  });

export const deleteEmailCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), campaignId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("email_campaigns")
      .delete()
      .eq("id", data.campaignId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------ hedef kitle */

type SupabaseClient = Parameters<typeof guard>[0];

async function loadAudience(
  supabase: any,
  storeId: string,
  filters: z.infer<typeof audienceSchema>,
): Promise<{ recipients: { email: string; name: string; customerId: string | null }[]; totalCustomers: number; totalSubscribers: number }> {
  const { data: customerRows, error } = await supabase
    .from("customers")
    .select("id, email, full_name, first_name, orders_count, total_spent, tags, accepts_marketing, last_activity_at")
    .eq("store_id", storeId)
    .not("email", "is", null)
    .limit(20000);
  if (error) throw new Error(error.message);

  let lastOrderByCustomer = new Map<string, string>();
  if (filters.activeWithinDays || filters.inactiveOverDays) {
    const { data: orderRows } = await supabase
      .from("orders")
      .select("customer_id, created_at")
      .eq("store_id", storeId)
      .not("customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(20000);
    for (const row of orderRows ?? []) {
      const key = String(row.customer_id);
      if (!lastOrderByCustomer.has(key)) lastOrderByCustomer.set(key, row.created_at);
    }
  }

  let categoriesByCustomer = new Map<string, string[]>();
  if (filters.categoryInterest) {
    const { data: itemRows } = await supabase
      .from("order_items")
      .select("title, orders(customer_id)")
      .eq("store_id", storeId)
      .limit(20000);
    for (const row of itemRows ?? []) {
      const customerId = (row as any).orders?.customer_id;
      if (!customerId) continue;
      const list = categoriesByCustomer.get(customerId) ?? [];
      list.push(String(row.title ?? ""));
      categoriesByCustomer.set(customerId, list);
    }
  }

  const candidates: AudienceCustomer[] = (customerRows ?? []).map((row: any) => ({
    id: row.id,
    email: row.email,
    fullName: row.first_name || row.full_name,
    ordersCount: row.orders_count ?? 0,
    totalSpent: Number(row.total_spent ?? 0),
    lastOrderAt: lastOrderByCustomer.get(row.id) ?? row.last_activity_at ?? null,
    tags: row.tags ?? [],
    categories: categoriesByCustomer.get(row.id) ?? [],
    marketingOptIn: Boolean(row.accepts_marketing),
  }));

  const matched = filterAudience(candidates, filters);
  const recipients = new Map<string, { email: string; name: string; customerId: string | null }>();
  for (const customer of matched) {
    const email = (customer.email ?? "").trim().toLowerCase();
    if (!email) continue;
    recipients.set(email, { email, name: customer.fullName ?? "", customerId: customer.id });
  }

  let totalSubscribers = 0;
  if (filters.includeSubscribers) {
    const { data: subscriberRows } = await supabase
      .from("email_subscribers")
      .select("email, full_name, customer_id, status")
      .eq("store_id", storeId)
      .eq("status", "subscribed")
      .limit(20000);
    totalSubscribers = (subscriberRows ?? []).length;
    for (const row of subscriberRows ?? []) {
      const email = String(row.email ?? "").trim().toLowerCase();
      if (!email || recipients.has(email)) continue;
      recipients.set(email, { email, name: row.full_name ?? "", customerId: row.customer_id ?? null });
    }
  }

  return {
    recipients: [...recipients.values()],
    totalCustomers: matched.length,
    totalSubscribers,
  };
}

export const previewEmailAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), audience: audienceSchema.default({ includeSubscribers: true }) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const result = await loadAudience(context.supabase as any, data.storeId, data.audience);
    return {
      total: result.recipients.length,
      customers: result.totalCustomers,
      subscribers: result.totalSubscribers,
      sample: result.recipients.slice(0, 12).map((recipient) => recipient.email),
    };
  });

/* --------------------------------------------------------------- gönderim */

async function loadProductCards(supabase: any, storeId: string, storeSlug: string, siteUrl: string) {
  const { data } = await supabase
    .from("products")
    .select("id, title, slug, base_price, currency, product_images(url, position)")
    .eq("store_id", storeId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(6);
  const formatter = (value: number, currency: string) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: currency || "TRY" }).format(value);
  return ((data ?? []) as any[]).map<ProductCard>((row) => {
    const images = (row.product_images ?? []).slice().sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
    return {
      title: row.title,
      price: formatter(Number(row.base_price ?? 0), row.currency ?? "TRY"),
      imageUrl: images[0]?.url ?? null,
      url: `${siteUrl}/s/${storeSlug}/p/${row.slug}`,
    };
  });
}

export const sendEmailCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        campaignId: z.guid(),
        /** Sadece bu adrese test gönderimi yapar; kampanya durumu değişmez. */
        testEmail: z.string().trim().email().optional(),
        maxRecipients: z.number().int().min(1).max(5000).default(2000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await guard(supabase, data.storeId, userId);

    const { sendMarketingEmail, trackingUrls, PUBLIC_SITE_URL } = await import("@/lib/email-marketing.server");

    const [{ data: campaign, error: campaignError }, { data: store }] = await Promise.all([
      supabase.from("email_campaigns").select("*").eq("id", data.campaignId).eq("store_id", data.storeId).maybeSingle(),
      supabase.from("stores").select("name, slug, currency").eq("id", data.storeId).maybeSingle(),
    ]);
    if (campaignError) throw new Error(campaignError.message);
    if (!campaign) throw new Error("Kampanya bulunamadı");
    if (!store) throw new Error("Mağaza bulunamadı");

    const { data: designRows } = await supabase.from("email_designs").select("*").eq("store_id", data.storeId);
    const designs = new Map((designRows ?? []).map((row) => [row.id, row]));

    const { data: variantRows } = await supabase
      .from("email_campaign_variants")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("label", { ascending: true });
    const variants = (variantRows ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      weight: row.weight,
      subject: row.subject || campaign.subject,
      previewText: row.preview_text || campaign.preview_text,
      designId: row.design_id ?? campaign.design_id,
    }));

    const baseDesign = campaign.design_id ? designs.get(campaign.design_id) : null;
    if (!baseDesign && variants.length === 0) throw new Error("Kampanyaya bir e-posta tasarımı seçin");

    const storeUrl = `${PUBLIC_SITE_URL}/s/${store.slug}`;
    const products = await loadProductCards(supabase as any, data.storeId, store.slug, PUBLIC_SITE_URL);

    let recipients: { email: string; name: string; customerId: string | null }[];
    if (data.testEmail) {
      recipients = [{ email: data.testEmail.toLowerCase(), name: "Test", customerId: null }];
    } else {
      const audience = await loadAudience(supabase as any, data.storeId, {
        includeSubscribers: true,
        ...(campaign.audience as Record<string, never>),
      } as never);
      recipients = audience.recipients.slice(0, data.maxRecipients);
      if (recipients.length === 0) throw new Error("Bu filtrelere uyan izinli alıcı bulunamadı");
      await supabase
        .from("email_campaigns")
        .update({ status: "sending", recipients_count: recipients.length })
        .eq("id", campaign.id);
    }

    let sent = 0;
    let failed = 0;
    let suppressed = 0;
    const variantCounts = new Map<string, number>();

    for (const recipient of recipients) {
      const token = crypto.randomUUID().replace(/-/g, "");
      const variant = campaign.ab_enabled && variants.length > 0 ? pickVariant(variants, `${campaign.id}:${recipient.email}`) : null;
      const design = (variant?.designId ? designs.get(variant.designId) : baseDesign) ?? baseDesign;
      if (!design) {
        failed += 1;
        continue;
      }
      const subject = variant?.subject || campaign.subject || design.subject || store.name;
      const previewText = variant?.previewText || campaign.preview_text || design.preview_text || "";
      const links = trackingUrls(token);
      const vars = {
        "customer.first_name": recipient.name || "değerli müşterimiz",
        "customer.email": recipient.email,
        musteri_adi: recipient.name || "değerli müşterimiz",
        magaza_adi: store.name,
        magaza_linki: storeUrl,
        unsubscribe_url: links.unsubscribe,
        "discount.code": "",
        "cart.items_grid": "",
        "product.recommended_carousel": "",
        "product.last_viewed": products[0]?.title ?? "",
      };
      const blocks = (design.blocks ?? []) as unknown as EmailBlock[];
      const html = renderEmailHtml(
        { blocks, accentColor: design.accent_color, previewText },
        { vars, products, cartItems: [], wrapLink: links.click },
        { trackingPixelUrl: links.pixel },
      );
      const text = renderEmailText({ blocks }, vars);

      const { data: sendRow } = await supabase
        .from("email_sends")
        .insert({
          store_id: data.storeId,
          campaign_id: data.testEmail ? null : campaign.id,
          variant_id: variant?.id ?? null,
          customer_id: recipient.customerId,
          recipient: recipient.email,
          token,
          status: "queued",
        })
        .select("id")
        .maybeSingle();

      const result = await sendMarketingEmail({
        to: recipient.email,
        fromName: store.name,
        subject: mergeTags(subject, vars),
        html,
        text,
        label: `campaign:${campaign.id}`,
        idempotencyKey: token,
        unsubscribeUrl: links.unsubscribe,
      });

      if (result.sent) sent += 1;
      else if (result.reason === "recipient_suppressed") suppressed += 1;
      else failed += 1;

      if (sendRow) {
        await supabase
          .from("email_sends")
          .update({
            status: result.sent ? "sent" : result.reason === "recipient_suppressed" ? "suppressed" : "failed",
            error: result.sent ? null : (result as { message?: string }).message ?? result.reason,
            sent_at: result.sent ? new Date().toISOString() : null,
          })
          .eq("id", sendRow.id);
      }

      if (variant && result.sent) variantCounts.set(variant.id, (variantCounts.get(variant.id) ?? 0) + 1);
    }

    for (const [variantId, count] of variantCounts) {
      const current = (variantRows ?? []).find((row) => row.id === variantId);
      await supabase
        .from("email_campaign_variants")
        .update({ sent_count: (current?.sent_count ?? 0) + count })
        .eq("id", variantId);
    }

    if (!data.testEmail) {
      await supabase
        .from("email_campaigns")
        .update({
          status: sent > 0 ? "sent" : "failed",
          sent_at: new Date().toISOString(),
          recipients_count: recipients.length,
        })
        .eq("id", campaign.id);
    }

    return { recipients: recipients.length, sent, failed, suppressed, test: Boolean(data.testEmail) };
  });

/* --------------------------------------------------------- ciro eşleştirme */

export const syncCampaignRevenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), campaignId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await guard(supabase, data.storeId, userId);

    const { data: sends } = await supabase
      .from("email_sends")
      .select("id, customer_id, sent_at, variant_id")
      .eq("store_id", data.storeId)
      .eq("campaign_id", data.campaignId)
      .eq("status", "sent");

    const { data: orders } = await supabase
      .from("orders")
      .select("customer_id, grand_total, created_at, payment_status")
      .eq("store_id", data.storeId)
      .eq("payment_status", "paid")
      .limit(20000);

    const window = 7 * 86_400_000;
    const variantRevenue = new Map<string, number>();
    let attributed = 0;

    for (const send of sends ?? []) {
      if (!send.customer_id || !send.sent_at) continue;
      const sentAt = new Date(send.sent_at).getTime();
      const revenue = (orders ?? [])
        .filter((order) => {
          if (order.customer_id !== send.customer_id) return false;
          const placed = new Date(order.created_at).getTime();
          return placed >= sentAt && placed - sentAt <= window;
        })
        .reduce((sum, order) => sum + Number(order.grand_total ?? 0), 0);
      if (revenue <= 0) continue;
      attributed += revenue;
      await supabase.from("email_sends").update({ revenue }).eq("id", send.id);
      if (send.variant_id) {
        variantRevenue.set(send.variant_id, (variantRevenue.get(send.variant_id) ?? 0) + revenue);
      }
    }

    for (const [variantId, revenue] of variantRevenue) {
      await supabase.from("email_campaign_variants").update({ revenue }).eq("id", variantId);
    }

    return { attributedRevenue: Math.round(attributed * 100) / 100 };
  });

/* ------------------------------------------------------------ hazır akışlar */

export const seedEmailFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), presetId: z.string().trim().min(2).max(60) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await guard(supabase, data.storeId, userId);

    const preset = FLOW_PRESETS.find((item) => item.id === data.presetId);
    if (!preset) throw new Error("Bilinmeyen akış şablonu");

    const { data: workflow, error } = await supabase
      .from("automation_workflows")
      .insert({
        store_id: data.storeId,
        name: preset.name,
        description: preset.description,
        trigger_event: preset.trigger,
        is_active: false,
        canvas: {
          nodes: [
            { id: "trigger", position: { x: 70, y: 210 } },
            ...preset.steps.map((_, index) => ({ id: `step-${index}`, position: { x: 330 + index * 250, y: 210 } })),
          ],
          edges: preset.steps.map((_, index) => ({
            id: `edge-${index}`,
            source: index === 0 ? "trigger" : `step-${index - 1}`,
            target: `step-${index}`,
          })),
        } as never,
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!workflow) throw new Error("Akış oluşturulamadı");

    const steps: {
      workflow_id: string;
      store_id: string;
      position: number;
      kind: "wait" | "email" | "condition" | "end";
      title: string;
      wait_minutes: number;
      template_id: string | null;
      condition_kind: string | null;
      on_true: string;
      on_false: string;
      config: never;
    }[] = [];

    for (const [index, step] of preset.steps.entries()) {
      let templateId: string | null = null;
      if (step.kind === "email") {
        const slug = slugify(`${preset.id}-${index}-${step.title}`);
        const { data: template, error: templateError } = await supabase
          .from("message_templates")
          .upsert(
            {
              store_id: data.storeId,
              channel: "email",
              name: `${preset.name} · ${step.title}`,
              slug,
              subject: step.subject ?? preset.name,
              body: step.body ?? "",
              is_active: true,
            },
            { onConflict: "store_id,slug" },
          )
          .select("id")
          .maybeSingle();
        if (templateError) throw new Error(templateError.message);
        templateId = template?.id ?? null;
      }
      steps.push({
        workflow_id: workflow.id,
        store_id: data.storeId,
        position: index,
        kind: step.kind,
        title: step.title,
        wait_minutes: step.waitMinutes ?? 0,
        template_id: templateId,
        condition_kind: step.condition ?? null,
        on_true: step.onTrue ?? "continue",
        on_false: step.onFalse ?? "end",
        config: (step.config ?? {}) as never,
      });
    }

    const { error: stepError } = await supabase.from("automation_steps").insert(steps as never);
    if (stepError) throw new Error(stepError.message);

    return { workflowId: workflow.id, name: preset.name, steps: steps.length };
  });

/* --------------------------------------------------------------- aboneler */

export const importSubscribers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        /** Satır başına e-posta (isteğe bağlı olarak "e-posta, ad"). */
        raw: z.string().trim().min(3).max(200_000),
        tags: z.array(z.string().trim().max(40)).max(10).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);

    const rows = data.raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [email, ...rest] = line.split(/[,;\t]/).map((part) => part.trim());
        return { email: (email ?? "").toLowerCase(), full_name: rest.join(" ") || null };
      })
      .filter((row) => /.+@.+\..+/.test(row.email));

    if (rows.length === 0) throw new Error("Geçerli e-posta bulunamadı");

    const { error } = await context.supabase.from("email_subscribers").upsert(
      rows.map((row) => ({
        store_id: data.storeId,
        email: row.email,
        full_name: row.full_name,
        source: "import",
        status: "subscribed",
        tags: data.tags,
      })),
      { onConflict: "store_id,email" },
    );
    if (error) throw new Error(error.message);
    return { imported: rows.length };
  });

export const setSubscriberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ storeId: z.guid(), subscriberId: z.guid(), status: z.enum(["subscribed", "unsubscribed"]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("email_subscribers")
      .update({ status: data.status })
      .eq("id", data.subscriberId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type { SupabaseClient };

/** Vitrin bülten formu: giriş gerektirmez, yalnız aktif mağazaya abone ekler. */
export const subscribeToNewsletter = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        storeSlug: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(180),
        fullName: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: store, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("id, status")
      .eq("slug", data.storeSlug)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store || store.status !== "active") throw new Error("Mağaza bulunamadı");

    const { error } = await supabaseAdmin.from("email_subscribers").upsert(
      {
        store_id: store.id,
        email: data.email.toLowerCase(),
        full_name: data.fullName?.trim() ? data.fullName.trim() : null,
        source: "storefront",
        status: "subscribed",
      },
      { onConflict: "store_id,email" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Kampanyaların vitrin performansı: gerçek banner görüntülenme/tıklama sayıları ve
 * kampanya indirim kodu ile ödemesi tamamlanan siparişlerden gelen ciro.
 */
export const getCampaignStorefrontReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ storeId: z.guid(), days: z.number().int().min(1).max(365).default(90) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.days * 86400000).toISOString();

    const { data: campaigns, error } = await supabase
      .from("email_campaigns")
      .select("id, name, slug, storefront_enabled, discount_code, starts_at, ends_at")
      .eq("store_id", data.storeId)
      .eq("storefront_enabled", true);
    if (error) throw new Error(error.message);

    const rows = (campaigns ?? []) as unknown as {
      id: string;
      name: string;
      slug: string | null;
      discount_code: string | null;
      starts_at: string | null;
      ends_at: string | null;
    }[];
    if (rows.length === 0) return { days: data.days, campaigns: [], totals: { views: 0, clicks: 0, orders: 0, revenue: 0 } };

    const { data: events, error: eventsError } = await supabase
      .from("campaign_storefront_events")
      .select("campaign_id, kind")
      .eq("store_id", data.storeId)
      .gte("created_at", since)
      .limit(50_000);
    if (eventsError) throw new Error(eventsError.message);

    const views = new Map<string, number>();
    const clicks = new Map<string, number>();
    for (const event of (events ?? []) as unknown as { campaign_id: string; kind: string }[]) {
      const target = event.kind === "click" ? clicks : views;
      target.set(event.campaign_id, (target.get(event.campaign_id) ?? 0) + 1);
    }

    const codes = rows.map((row) => (row.discount_code ?? "").trim()).filter(Boolean);
    const revenueByCode = new Map<string, { orders: number; revenue: number }>();
    if (codes.length > 0) {
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("discount_code, grand_total")
        .eq("store_id", data.storeId)
        .gte("created_at", since)
        .in("payment_status", ["paid", "partially_refunded"])
        .in("discount_code", codes)
        .limit(5000);
      if (ordersError) throw new Error(ordersError.message);
      for (const order of (orders ?? []) as unknown as { discount_code: string | null; grand_total: number | string | null }[]) {
        const code = (order.discount_code ?? "").trim().toUpperCase();
        const entry = revenueByCode.get(code) ?? { orders: 0, revenue: 0 };
        entry.orders += 1;
        entry.revenue += Number(order.grand_total ?? 0);
        revenueByCode.set(code, entry);
      }
    }

    const result = rows
      .map((row) => {
        const code = (row.discount_code ?? "").trim();
        const attributed = revenueByCode.get(code.toUpperCase()) ?? { orders: 0, revenue: 0 };
        const viewCount = views.get(row.id) ?? 0;
        const clickCount = clicks.get(row.id) ?? 0;
        return {
          id: row.id,
          name: row.name,
          slug: row.slug ?? "",
          discountCode: code,
          views: viewCount,
          clicks: clickCount,
          ctr: viewCount > 0 ? (clickCount / viewCount) * 100 : 0,
          orders: attributed.orders,
          revenue: attributed.revenue,
        };
      })
      .sort((a, b) => b.revenue - a.revenue || b.clicks - a.clicks);

    return {
      days: data.days,
      campaigns: result,
      totals: {
        views: result.reduce((sum, row) => sum + row.views, 0),
        clicks: result.reduce((sum, row) => sum + row.clicks, 0),
        orders: result.reduce((sum, row) => sum + row.orders, 0),
        revenue: result.reduce((sum, row) => sum + row.revenue, 0),
      },
    };
  });
