import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PublicTracking = {
  tracking_number: string;
  carrier: string;
  carrier_key: string | null;
  tracking_url: string | null;
  status: string;
  shipped_at: string | null;
  delivered_at: string | null;
  estimated_delivery_date: string | null;
  store: { name: string; slug: string; logo_url: string | null };
  brandColor?: string | null;
  theme?: { primary: string | null; accent: string | null; background: string | null; fontPair: string | null; radius: number | null } | null;
  events: { status: string; description: string | null; location: string | null; event_at: string }[];
};

const trackingSchema = z.object({ tracking: z.string().trim().min(6).max(120).regex(/^[A-Za-z0-9-_]+$/) });

/** Herkese açık takip: yalnız güvenli alanlar döner (kişisel bilgi yok). */
export const getPublicTracking = createServerFn({ method: "GET" })
  .inputValidator((d) => trackingSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("public_track_shipment", { p_tracking: data.tracking });
    if (error) throw new Error("Takip bilgisi alınamadı");
    const t = (res ?? null) as PublicTracking | null;
    if (!t) return null;
    const { data: st } = await supabaseAdmin.from("stores").select("id").eq("slug", t.store.slug).maybeSingle();
    const { data: theme } = st
      ? await supabaseAdmin.from("store_themes").select("primary_color, accent_color, background_color, font_pair, radius, logo_url").eq("store_id", st.id).maybeSingle()
      : { data: null };
    const hex = (v: string | null | undefined) => (/^#[0-9a-f]{6}$/i.test(v ?? "") ? v! : null);
    const color = hex(theme?.primary_color);
    const accent = hex(theme?.accent_color);
    return {
      ...t,
      store: { ...t.store, logo_url: theme?.logo_url || t.store.logo_url },
      brandColor: accent ?? color,
      theme: theme ? { primary: color, accent, background: hex(theme.background_color), fontPair: theme.font_pair ?? null, radius: typeof theme.radius === "number" ? theme.radius : null } : null,
    };
  });

/** Abonelikten çıkma (imzalı bağlantı). */
export const unsubscribeByToken = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10).max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const { verifyUnsubscribe, recordUnsubscribe } = await import("@/lib/customer-notify.server");
    const parsed = verifyUnsubscribe(data.token);
    if (!parsed) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await recordUnsubscribe(supabaseAdmin as never, parsed.s, parsed.c, parsed.r, "link");
    const { data: store } = await supabaseAdmin.from("stores").select("name").eq("id", parsed.s).maybeSingle();
    return { ok: true as const, storeName: store?.name ?? "" };
  });

/** Müşterinin kendi bildirim tercihleri. */
export const getMyNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: customer } = await context.supabase
      .from("customers").select("id, accepts_marketing").eq("store_id", data.storeId).eq("user_id", context.userId).maybeSingle();
    if (!customer) return null;
    const { data: row } = await context.supabase
      .from("customer_notification_prefs").select("prefs, marketing_email").eq("customer_id", customer.id).maybeSingle();
    return { prefs: (row?.prefs ?? {}) as Record<string, Record<string, boolean>>, marketing: row?.marketing_email ?? Boolean(customer.accepts_marketing) };
  });

export const saveMyNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    storeId: z.guid(),
    prefs: z.record(z.string().max(40), z.record(z.string().max(20), z.boolean())),
    marketing: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: customer } = await context.supabase
      .from("customers").select("id").eq("store_id", data.storeId).eq("user_id", context.userId).maybeSingle();
    if (!customer) throw new Error("Müşteri hesabı bulunamadı");
    const { error } = await context.supabase.from("customer_notification_prefs").upsert(
      { store_id: data.storeId, customer_id: customer.id, prefs: data.prefs, marketing_email: data.marketing },
      { onConflict: "customer_id" },
    );
    if (error) throw new Error(error.message);
    await context.supabase.from("customers").update({ accepts_marketing: data.marketing }).eq("id", customer.id);
    return { ok: true };
  });
