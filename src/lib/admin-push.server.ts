import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * Süper yönetici push bildirim merkezi (sunucu katmanı).
 * Firebase Cloud Messaging'e Lovable connector gateway üzerinden gider;
 * mağaza bazlı topic (`store-<id>`) veya kayıtlı cihaz token'ları hedeflenir.
 */

type AdminClient = SupabaseClient<Database>;

export const platformPushSchema = z.object({
  storeId: z.guid().nullable(), // null = tüm mağazalar
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(500),
  imageUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  deepLink: z.string().trim().max(300).optional().or(z.literal("")),
});

const FCM_GATEWAY = "https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send";

export function pushProviderConfigured(): boolean {
  return Boolean(process.env["FIREBASE_MESSAGING_API_KEY"] && process.env["LOVABLE_API_KEY"]);
}

async function adminClient(): Promise<AdminClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AdminClient;
}

/** Panel özeti: sağlayıcı durumu, uygulaması yayında olan mağazalar, cihaz sayıları, son kampanyalar. */
export async function pushOverview() {
  const supabase = await adminClient();

  const [configsRes, devicesRes, campaignsRes] = await Promise.all([
    supabase
      .from("mobile_app_configs")
      .select("store_id, version, published_at, stores(name, slug)")
      .not("published_config", "is", null),
    supabase.from("mobile_app_devices").select("store_id, platform"),
    supabase
      .from("mobile_push_campaigns")
      .select("id, store_id, title, body, status, audience, recipients_count, created_at, sent_at, stores(name, slug)")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const deviceCounts = new Map<string, { total: number; ios: number; android: number }>();
  for (const device of devicesRes.data ?? []) {
    const entry = deviceCounts.get(device.store_id) ?? { total: 0, ios: 0, android: 0 };
    entry.total += 1;
    if (device.platform === "ios") entry.ios += 1;
    if (device.platform === "android") entry.android += 1;
    deviceCounts.set(device.store_id, entry);
  }

  const stores = (configsRes.data ?? []).map((row) => {
    const store = Array.isArray(row.stores) ? row.stores[0] : row.stores;
    return {
      storeId: row.store_id,
      name: (store as { name?: string } | null)?.name ?? "Mağaza",
      slug: (store as { slug?: string } | null)?.slug ?? "",
      version: row.version,
      publishedAt: row.published_at,
      devices: deviceCounts.get(row.store_id) ?? { total: 0, ios: 0, android: 0 },
    };
  });

  return {
    providerConfigured: pushProviderConfigured(),
    stores,
    totalDevices: (devicesRes.data ?? []).length,
    campaigns: (campaignsRes.data ?? []).map((c) => {
      const store = Array.isArray(c.stores) ? c.stores[0] : c.stores;
      return { ...c, stores: undefined, storeName: (store as { name?: string } | null)?.name ?? "—" };
    }),
  };
}

async function sendTopic(topic: string, input: z.infer<typeof platformPushSchema>): Promise<boolean> {
  const response = await fetch(FCM_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
      "X-Connection-Api-Key": process.env["FIREBASE_MESSAGING_API_KEY"] ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        topic,
        notification: { title: input.title, body: input.body, ...(input.imageUrl ? { image: input.imageUrl } : {}) },
        data: { deepLink: input.deepLink || "mefticaret://home" },
      },
    }),
  });
  if (!response.ok) {
    console.error(`FCM konu gönderimi başarısız [${response.status}]: ${await response.text()}`);
    return false;
  }
  return true;
}

/**
 * Platform duyurusu: tek mağazaya veya uygulaması yayında olan tüm mağazalara
 * topic üzerinden gönderir ve her mağaza için kampanya kaydı açar.
 */
export async function sendPlatformPush(input: z.infer<typeof platformPushSchema>, actorId: string) {
  if (!pushProviderConfigured()) {
    throw new Error("Firebase bağlantısı yapılandırılmamış; önce bağlayıcıyı kontrol edin.");
  }

  const supabase = await adminClient();

  let targets: { storeId: string; name: string }[] = [];
  if (input.storeId) {
    const { data: store } = await supabase.from("stores").select("id, name").eq("id", input.storeId).maybeSingle();
    if (!store) throw new Error("Mağaza bulunamadı");
    targets = [{ storeId: store.id, name: store.name }];
  } else {
    const { data: configs } = await supabase
      .from("mobile_app_configs")
      .select("store_id, stores(name)")
      .not("published_config", "is", null);
    targets = (configsResRows(configs)).map((row) => ({
      storeId: row.store_id,
      name: (Array.isArray(row.stores) ? row.stores[0] : row.stores)?.name ?? "Mağaza",
    }));
  }
  if (targets.length === 0) throw new Error("Yayınlanmış mobil uygulaması olan mağaza bulunamadı.");

  let sent = 0;
  for (const target of targets) {
    const ok = await sendTopic(`store-${target.storeId}`, input);
    const { data: devices } = await supabase
      .from("mobile_app_devices")
      .select("id")
      .eq("store_id", target.storeId)
      .limit(2000);

    await supabase.from("mobile_push_campaigns").insert({
      store_id: target.storeId,
      title: input.title,
      body: input.body,
      image_url: input.imageUrl || null,
      deep_link: input.deepLink || null,
      audience: "all",
      status: ok ? "sent" : "scheduled",
      sent_at: ok ? new Date().toISOString() : null,
      recipients_count: (devices ?? []).length,
      created_by: actorId,
    });
    if (ok) sent += 1;
  }

  return { sent, total: targets.length, stores: targets.map((t) => t.name) };
}

function configsResRows(data: unknown): { store_id: string; stores: unknown }[] {
  return Array.isArray(data) ? (data as { store_id: string; stores: unknown }[]) : [];
}
