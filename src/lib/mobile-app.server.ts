import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { recordAudit } from "@/lib/audit.server";
import { assertStoreManager } from "@/lib/store-access.server";
import { resolveDesignTokens } from "@/lib/theme-design";
import {
  PUSH_AUDIENCES,
  PUSH_TRIGGERS,
  PUSH_TRIGGER_META,
  mobileAppConfigSchema,
  resolveMobileAppConfig,
  type MobileAppConfig,
} from "@/lib/mobile-app";

type Client = SupabaseClient<Database>;

export const storeIdSchema = z.object({ storeId: z.guid() });

export const saveConfigSchema = z.object({
  storeId: z.guid(),
  config: z.unknown(),
});

export const automationSchema = z.object({
  storeId: z.guid(),
  trigger: z.enum(PUSH_TRIGGERS),
  isActive: z.boolean(),
  delayMinutes: z.number().int().min(0).max(20160),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().max(300).default(""),
  imageUrl: z.string().trim().max(500).default(""),
  deepLink: z.string().trim().max(300).default(""),
  discountCode: z.string().trim().max(24).default(""),
});

export const campaignSchema = z.object({
  storeId: z.guid(),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().max(300).default(""),
  imageUrl: z.string().trim().max(500).default(""),
  deepLink: z.string().trim().max(300).default(""),
  audience: z.enum(PUSH_AUDIENCES),
  scheduledAt: z.string().trim().max(40).optional(),
});

/** Mağaza adını okur (uygulama adı varsayılanı için). */
async function storeName(supabase: Client, storeId: string): Promise<string> {
  const { data } = await supabase.from("stores").select("name").eq("id", storeId).maybeSingle();
  return data?.name ?? "Mağazam";
}

/** Mağaza slug'ından ters-DNS uygulama kimliği üretir: `com.mefticaret.utebaylarmarket`. */
export function bundleIdFromSlug(slug: string): string {
  const clean = (slug || "magaza").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `com.mefticaret.${clean || "magaza"}`;
}

/** Yayın alanları boşsa mağaza slug'ına göre doldurur (App Store / Google Play). */
function withPublishingDefaults(config: MobileAppConfig, slug: string, name: string): MobileAppConfig {
  const bundle = bundleIdFromSlug(slug);
  return {
    ...config,
    publishing: {
      ...config.publishing,
      iosBundleId: config.publishing.iosBundleId || bundle,
      androidPackage: config.publishing.androidPackage || bundle,
      versionName: config.publishing.versionName || "1.0.0",
      releaseNotes: config.publishing.releaseNotes || `${name} mobil uygulamasının ilk sürümü.`,
    },
  };
}

/**
 * Mobil tasarımı tema düzenleyicisine geri yansıtır: renkler, köşe yuvarlaklığı
 * ve duyuru şeridi metni `store_themes` kaydına yazılır, böylece vitrin ve
 * mobil uygulama aynı tasarım dilini paylaşır.
 */
async function syncThemeFromMobile(supabase: Client, storeId: string, config: MobileAppConfig) {
  const ticker = config.home.find((widget) => widget.type === "announcement_ticker" && widget.visible);

  const { data: theme } = await supabase
    .from("store_themes")
    .select("design_tokens")
    .eq("store_id", storeId)
    .maybeSingle();

  const tokens = resolveDesignTokens(theme?.design_tokens);

  const { error } = await supabase.from("store_themes").upsert(
    {
      store_id: storeId,
      primary_color: config.branding.primary,
      accent_color: config.branding.accent,
      background_color: config.branding.background,
      radius: Math.min(24, Math.max(0, config.branding.radius)),
      ...(ticker?.title ? { announcement: ticker.title, show_announcement: true } : {}),
      design_tokens: {
        ...tokens,
        colors: {
          ...tokens.colors,
          surface: config.branding.surface,
          text: config.branding.text,
          secondary: config.branding.accent,
        },
      },
    },
    { onConflict: "store_id" },
  );
  if (error) throw new Error(error.message);
}

/** Editör verisi: taslak/yayın config, otomasyonlar, kampanyalar ve cihaz sayıları. */
export async function loadMobileApp(supabase: Client, storeId: string) {
  const { data: store } = await supabase.from("stores").select("name, slug").eq("id", storeId).maybeSingle();
  const name = store?.name ?? "Mağazam";
  const slug = store?.slug ?? "magaza";


  const [configRes, automationRes, campaignRes, deviceRes] = await Promise.all([
    supabase.from("mobile_app_configs").select("*").eq("store_id", storeId).maybeSingle(),
    supabase.from("mobile_push_automations").select("*").eq("store_id", storeId),
    supabase
      .from("mobile_push_campaigns")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase.from("mobile_app_devices").select("platform").eq("store_id", storeId),
  ]);

  if (configRes.error) throw new Error(configRes.error.message);
  if (automationRes.error) throw new Error(automationRes.error.message);
  if (campaignRes.error) throw new Error(campaignRes.error.message);

  const rows = automationRes.data ?? [];
  const automations = PUSH_TRIGGERS.map((trigger) => {
    const existing = rows.find((row) => row.trigger === trigger);
    const meta = PUSH_TRIGGER_META[trigger];
    return {
      trigger,
      isActive: existing?.is_active ?? false,
      delayMinutes: existing?.delay_minutes ?? meta.delayMinutes,
      title: existing?.title ?? meta.title,
      body: existing?.body ?? meta.body,
      imageUrl: existing?.image_url ?? "",
      deepLink: existing?.deep_link ?? meta.link,
      discountCode: existing?.discount_code ?? "",
    };
  });

  const devices = deviceRes.data ?? [];
  return {
    draft: withPublishingDefaults(resolveMobileAppConfig(configRes.data?.draft_config, name), slug, name),
    published: configRes.data?.published_config ? resolveMobileAppConfig(configRes.data.published_config, name) : null,
    version: configRes.data?.version ?? 1,
    publishedAt: configRes.data?.published_at ?? null,
    automations,
    campaigns: campaignRes.data ?? [],
    devices: {
      total: devices.length,
      ios: devices.filter((d) => d.platform === "ios").length,
      android: devices.filter((d) => d.platform === "android").length,
    },
    storeName: name,
  };
}

function normalize(raw: unknown, name: string): MobileAppConfig {
  const parsed = mobileAppConfigSchema.safeParse(raw);
  return resolveMobileAppConfig(parsed.success ? parsed.data : raw, name);
}

/** Taslağı kaydeder (sunucu tarafında normalize edilir). */
export async function saveDraftConfig(
  supabase: Client,
  input: z.infer<typeof saveConfigSchema>,
): Promise<{ config: MobileAppConfig }> {
  const name = await storeName(supabase, input.storeId);
  const config = normalize(input.config, name);
  const { error } = await supabase
    .from("mobile_app_configs")
    .upsert({ store_id: input.storeId, draft_config: config }, { onConflict: "store_id" });
  if (error) throw new Error(error.message);
  return { config };
}

/** Taslağı mobil uygulamalara yayınlar ve sürümü artırır. */
export async function publishConfig(
  supabase: Client,
  input: z.infer<typeof saveConfigSchema>,
  actorId: string,
): Promise<{ config: MobileAppConfig; version: number }> {
  const name = await storeName(supabase, input.storeId);
  const config = normalize(input.config, name);

  const { data: current } = await supabase
    .from("mobile_app_configs")
    .select("version")
    .eq("store_id", input.storeId)
    .maybeSingle();
  const version = (current?.version ?? 0) + 1;

  const { error } = await supabase.from("mobile_app_configs").upsert(
    {
      store_id: input.storeId,
      draft_config: config,
      published_config: config,
      version,
      published_at: new Date().toISOString(),
    },
    { onConflict: "store_id" },
  );
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    action: "mobile_app.publish",
    storeId: input.storeId,
    actorId,
    entity: "mobile_app_config",
    entityId: input.storeId,
    newValue: { version, appName: config.branding.appName },
  });

  return { config, version };
}

/** Push otomasyon kuralını kaydeder. */
export async function upsertAutomation(supabase: Client, input: z.infer<typeof automationSchema>) {
  const { error } = await supabase.from("mobile_push_automations").upsert(
    {
      store_id: input.storeId,
      trigger: input.trigger,
      is_active: input.isActive,
      delay_minutes: input.delayMinutes,
      title: input.title,
      body: input.body,
      image_url: input.imageUrl || null,
      deep_link: input.deepLink || null,
      discount_code: input.discountCode || null,
    },
    { onConflict: "store_id,trigger" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

type SendResult = {
  status: "sent" | "scheduled";
  recipients: number;
  providerConfigured: boolean;
};

/**
 * Manuel push kampanyası oluşturur. Hedef kitledeki cihaz sayısı sunucuda
 * hesaplanır; gerçek gönderim yalnızca push sağlayıcısı (FCM) bağlıysa yapılır,
 * aksi halde kampanya kuyruğa alınır.
 */
export async function createCampaign(
  supabase: Client,
  input: z.infer<typeof campaignSchema>,
  actorId: string,
): Promise<SendResult> {
  let query = supabase.from("mobile_app_devices").select("push_token, platform").eq("store_id", input.storeId);
  if (input.audience === "ios" || input.audience === "android") query = query.eq("platform", input.audience);
  const { data: devices, error: deviceError } = await query.limit(2000);
  if (deviceError) throw new Error(deviceError.message);

  const tokens = (devices ?? []).map((d) => d.push_token);
  const providerConfigured = Boolean(process.env["FIREBASE_MESSAGING_API_KEY"] && process.env["LOVABLE_API_KEY"]);
  const scheduled = Boolean(input.scheduledAt);

  let delivered = 0;
  if (providerConfigured && !scheduled && tokens.length > 0) {
    delivered = await sendViaFcm(tokens, input);
  }

  const status = scheduled || !providerConfigured ? "scheduled" : "sent";
  const { error } = await supabase.from("mobile_push_campaigns").insert({
    store_id: input.storeId,
    title: input.title,
    body: input.body,
    image_url: input.imageUrl || null,
    deep_link: input.deepLink || null,
    audience: input.audience,
    status,
    scheduled_at: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    recipients_count: status === "sent" ? delivered : tokens.length,
    created_by: actorId,
  });
  if (error) throw new Error(error.message);

  return { status, recipients: status === "sent" ? delivered : tokens.length, providerConfigured };
}

/** FCM HTTP v1 üzerinden (Lovable connector gateway) gönderim. */
async function sendViaFcm(tokens: string[], input: z.infer<typeof campaignSchema>): Promise<number> {
  const gateway = "https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send";
  const headers = {
    Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
    "X-Connection-Api-Key": process.env["FIREBASE_MESSAGING_API_KEY"] ?? "",
    "Content-Type": "application/json",
  };
  let delivered = 0;
  for (const token of tokens.slice(0, 500)) {
    const response = await fetch(gateway, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: {
          token,
          notification: { title: input.title, body: input.body, ...(input.imageUrl ? { image: input.imageUrl } : {}) },
          data: { deepLink: input.deepLink || "mefticaret://home" },
        },
      }),
    });
    if (response.ok) delivered += 1;
    else console.error(`FCM gönderimi başarısız [${response.status}]: ${await response.text()}`);
  }
  return delivered;
}

/** iOS/Android build isteği: yayın alanlarını doğrular ve sürüm numarasını artırır. */
export async function requestBuild(
  supabase: Client,
  storeId: string,
  platform: "ios" | "android" | "both",
  actorId: string,
) {
  const name = await storeName(supabase, storeId);
  const { data } = await supabase
    .from("mobile_app_configs")
    .select("draft_config, version")
    .eq("store_id", storeId)
    .maybeSingle();
  const config = resolveMobileAppConfig(data?.draft_config, name);

  const missing: string[] = [];
  if (!config.branding.appName) missing.push("Uygulama adı");
  if (!config.branding.appIconUrl) missing.push("Uygulama ikonu");
  if ((platform === "ios" || platform === "both") && !config.publishing.iosBundleId) missing.push("iOS Bundle ID");
  if ((platform === "android" || platform === "both") && !config.publishing.androidPackage)
    missing.push("Android paket adı");
  if (missing.length) throw new Error(`Build alınabilmesi için eksik alanlar: ${missing.join(", ")}`);

  const next = {
    ...config,
    publishing: { ...config.publishing, buildNumber: config.publishing.buildNumber + 1 },
  };
  const { error } = await supabase
    .from("mobile_app_configs")
    .upsert({ store_id: storeId, draft_config: next }, { onConflict: "store_id" });
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    action: "mobile_app.build_request",
    storeId,
    actorId,
    entity: "mobile_app_build",
    entityId: storeId,
    newValue: { platform, buildNumber: next.publishing.buildNumber, channel: next.publishing.channel },
  });

  return { buildNumber: next.publishing.buildNumber, platform };
}

export { assertStoreManager };
