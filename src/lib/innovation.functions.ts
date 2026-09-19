import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Next-Gen Innovation & FinTech Pack sunucu fonksiyonları.
 * Yazma işlemleri mağaza yöneticisi kontrolünden geçer; gerçek POS/kargo hesabı
 * olmadan hiçbir yerde uydurma tahsilat veya takip verisi üretilmez.
 */

const storeId = z.guid();

async function guard(supabase: unknown, store: string, userId: string) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await assertStoreManager(supabase as any, store, userId);
}

/* ----------------------------- live commerce ----------------------------- */

export const saveLiveStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        id: z.guid().nullish(),
        title: z.string().trim().min(2).max(160),
        description: z.string().trim().max(600).nullish(),
        provider: z.enum(["youtube", "vimeo", "mux", "custom"]).default("youtube"),
        streamUrl: z.string().trim().url().max(500).nullish(),
        chatEnabled: z.boolean().default(true),
        status: z.enum(["scheduled", "live", "ended", "cancelled"]).default("scheduled"),
        scheduledAt: z.string().trim().max(40).nullish(),
        productIds: z.array(z.guid()).max(40).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const payload = {
      store_id: data.storeId,
      title: data.title,
      description: data.description ?? null,
      provider: data.provider,
      stream_url: data.streamUrl ?? null,
      chat_enabled: data.chatEnabled,
      status: data.status,
      scheduled_at: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : null,
      ...(data.status === "live" ? { started_at: new Date().toISOString() } : {}),
      ...(data.status === "ended" ? { ended_at: new Date().toISOString() } : {}),
    };

    const { data: row, error } = data.id
      ? await context.supabase
          .from("live_streams")
          .update(payload)
          .eq("id", data.id)
          .eq("store_id", data.storeId)
          .select("id")
          .single()
      : await context.supabase.from("live_streams").insert(payload).select("id").single();
    if (error) throw new Error(error.message);

    const streamId = row?.id as string;
    await context.supabase.from("live_stream_products").delete().eq("stream_id", streamId);
    if (data.productIds.length > 0) {
      const rows = data.productIds.map((productId, index) => ({
        store_id: data.storeId,
        stream_id: streamId,
        product_id: productId,
        sort_order: index,
      }));
      const { error: linkError } = await context.supabase.from("live_stream_products").insert(rows);
      if (linkError) throw new Error(linkError.message);
    }
    return { id: streamId };
  });

export const deleteLiveStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("live_streams")
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Yayın performansı: yayına bağlı ürünlerden gerçek sipariş/ciro toplanır. */
export const getStreamPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, streamId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { streamPerformance } = await import("@/lib/innovation");

    const { data: stream } = await context.supabase
      .from("live_streams")
      .select("total_views, peak_viewers, product_clicks, started_at, ended_at")
      .eq("id", data.streamId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (!stream) throw new Error("Yayın bulunamadı.");

    const { data: links } = await context.supabase
      .from("live_stream_products")
      .select("product_id")
      .eq("stream_id", data.streamId);
    const productIds = (links ?? []).map((row) => row.product_id as string);

    let orders = 0;
    let revenue = 0;
    if (productIds.length > 0 && stream.started_at) {
      const { data: items } = await context.supabase
        .from("order_items")
        .select("order_id, total, orders!inner(created_at, payment_status, store_id)")
        .in("product_id", productIds)
        .gte("orders.created_at", stream.started_at as string)
        .eq("orders.store_id", data.storeId)
        .eq("orders.payment_status", "paid")
        .limit(2000);
      const seen = new Set<string>();
      for (const item of items ?? []) {
        revenue += Number(item.total ?? 0);
        const key = String(item.order_id);
        if (!seen.has(key)) seen.add(key);
      }
      orders = seen.size;
    }

    return {
      orders,
      revenue: Number(revenue.toFixed(2)),
      totalViews: Number(stream.total_views ?? 0),
      peakViewers: Number(stream.peak_viewers ?? 0),
      productClicks: Number(stream.product_clicks ?? 0),
      ...streamPerformance({
        totalViews: Number(stream.total_views ?? 0),
        peakViewers: Number(stream.peak_viewers ?? 0),
        productClicks: Number(stream.product_clicks ?? 0),
        orders,
        revenue,
      }),
    };
  });

/* --------------------------- shoppable videos ---------------------------- */

export const saveShoppableVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        id: z.guid().nullish(),
        productId: z.guid().nullish(),
        title: z.string().trim().min(2).max(160),
        videoUrl: z.string().trim().url().max(600),
        thumbnailUrl: z.string().trim().url().max(600).nullish(),
        source: z.enum(["upload", "tiktok", "instagram", "youtube"]).default("upload"),
        placement: z.enum(["home", "pdp", "both"]).default("home"),
        sortOrder: z.number().int().min(0).max(999).default(0),
        isActive: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const payload = {
      store_id: data.storeId,
      product_id: data.productId ?? null,
      title: data.title,
      video_url: data.videoUrl,
      thumbnail_url: data.thumbnailUrl ?? null,
      source: data.source,
      placement: data.placement,
      sort_order: data.sortOrder,
      is_active: data.isActive,
    };
    const { error } = data.id
      ? await context.supabase
          .from("shoppable_videos")
          .update(payload)
          .eq("id", data.id)
          .eq("store_id", data.storeId)
      : await context.supabase.from("shoppable_videos").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteShoppableVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("shoppable_videos")
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------------- UGC ---------------------------------- */

export const saveUgcPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        productId: z.guid().nullish(),
        source: z.enum(["instagram", "tiktok", "manual"]).default("instagram"),
        authorHandle: z.string().trim().max(120).nullish(),
        mediaUrl: z.string().trim().url().max(600),
        permalink: z.string().trim().url().max(600).nullish(),
        caption: z.string().trim().max(600).nullish(),
        status: z.enum(["pending", "approved", "rejected"]).default("pending"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase.from("ugc_posts").insert({
      store_id: data.storeId,
      product_id: data.productId ?? null,
      source: data.source,
      author_handle: data.authorHandle ?? null,
      media_url: data.mediaUrl,
      permalink: data.permalink ?? null,
      caption: data.caption ?? null,
      status: data.status,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUgcStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ storeId, id: z.guid(), status: z.enum(["pending", "approved", "rejected"]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("ugc_posts")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * TikTok içeriklerini bağlı hesaptan çeker. Hesap bağlı değilse uydurma içerik
 * üretmez, `credentialsReady: false` döner.
 */
export const importTiktokUgc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, limit: z.number().int().min(1).max(20).default(10) }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const tiktokKey = process.env["TIKTOK_API_KEY"];
    if (!lovableKey || !tiktokKey) {
      return { credentialsReady: false, imported: 0, message: "TikTok hesabı bağlı değil." };
    }

    const response = await fetch("https://connector-gateway.lovable.dev/tiktok/video/list/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": tiktokKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ max_count: data.limit, fields: ["id", "title", "cover_image_url", "share_url"] }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`TikTok isteği başarısız [${response.status}]: ${body}`);
    }
    const json = (await response.json()) as {
      data?: { videos?: { id?: string; title?: string; cover_image_url?: string; share_url?: string }[] };
    };
    const videos = json.data?.videos ?? [];
    const rows = videos
      .filter((video) => video.cover_image_url)
      .map((video) => ({
        store_id: data.storeId,
        source: "tiktok" as const,
        author_handle: null,
        media_url: String(video.cover_image_url),
        permalink: video.share_url ?? null,
        caption: video.title ?? null,
        status: "pending" as const,
      }));
    if (rows.length > 0) {
      const { error } = await context.supabase.from("ugc_posts").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { credentialsReady: true, imported: rows.length };
  });

/* --------------------------- payment routing ---------------------------- */

export const savePaymentRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        id: z.guid().nullish(),
        provider: z.string().trim().min(2).max(60),
        label: z.string().trim().min(2).max(120),
        binPrefixes: z.array(z.string().trim().max(8)).max(40).default([]),
        cardNetworks: z.array(z.string().trim().max(20)).max(8).default([]),
        feePercent: z.number().min(0).max(20),
        feeFixed: z.number().min(0).max(1000).default(0),
        approvalRate: z.number().min(0).max(100).default(95),
        priority: z.number().int().min(0).max(100).default(0),
        isActive: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { normalizeBin } = await import("@/lib/innovation");
    const payload = {
      store_id: data.storeId,
      provider: data.provider,
      label: data.label,
      bin_prefixes: data.binPrefixes.map((prefix) => normalizeBin(prefix)).filter(Boolean),
      card_networks: data.cardNetworks.map((item) => item.toLowerCase()),
      fee_percent: data.feePercent,
      fee_fixed: data.feeFixed,
      approval_rate: data.approvalRate,
      priority: data.priority,
      is_active: data.isActive,
    };
    const { error } = data.id
      ? await context.supabase
          .from("payment_routes")
          .update(payload)
          .eq("id", data.id)
          .eq("store_id", data.storeId)
      : await context.supabase.from("payment_routes").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePaymentRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("payment_routes")
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** BIN + tutara göre en uygun POS'u seçer ve kararı kaydeder (sipariş varsa). */
export const routePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        bin: z.string().trim().max(8).nullish(),
        amount: z.number().min(0).max(10_000_000),
        currency: z.string().trim().length(3).default("TRY"),
        orderId: z.guid().nullish(),
        persist: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { chooseRoute } = await import("@/lib/innovation");

    const { data: rows, error } = await context.supabase
      .from("payment_routes")
      .select(
        "id, provider, label, bin_prefixes, card_networks, fee_percent, fee_fixed, approval_rate, priority, is_active",
      )
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);

    const routes = (rows ?? []).map((row) => ({
      id: row.id as string,
      provider: row.provider as string,
      label: row.label as string,
      binPrefixes: (row.bin_prefixes ?? []) as string[],
      cardNetworks: (row.card_networks ?? []) as string[],
      feePercent: Number(row.fee_percent ?? 0),
      feeFixed: Number(row.fee_fixed ?? 0),
      approvalRate: Number(row.approval_rate ?? 95),
      priority: Number(row.priority ?? 0),
      isActive: Boolean(row.is_active),
    }));

    const result = chooseRoute(routes, { amount: data.amount, bin: data.bin ?? null });
    if (data.persist && result.selected) {
      const { error: insertError } = await context.supabase.from("payment_route_decisions").insert({
        store_id: data.storeId,
        order_id: data.orderId ?? null,
        route_id: result.selected.route.id,
        bin_prefix: data.bin ?? null,
        amount: data.amount,
        currency: data.currency,
        chosen_fee: result.selected.fee,
        baseline_fee: result.baselineFee,
        saved_amount: result.savedAmount,
      });
      if (insertError) throw new Error(insertError.message);
    }
    return {
      selected: result.selected
        ? {
            routeId: result.selected.route.id,
            provider: result.selected.route.provider,
            label: result.selected.route.label,
            fee: result.selected.fee,
            matchedBin: result.selected.matchedBin,
          }
        : null,
      ranked: result.ranked.map((item) => ({
        label: item.route.label,
        provider: item.route.provider,
        fee: item.fee,
        approvalRate: item.route.approvalRate,
      })),
      baselineFee: result.baselineFee,
      savedAmount: result.savedAmount,
    };
  });

/* ---------------------------- checkout addons --------------------------- */

export const saveCheckoutAddon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        id: z.guid().nullish(),
        kind: z.enum(["warranty", "insurance", "carbon"]),
        name: z.string().trim().min(2).max(160),
        description: z.string().trim().max(400).nullish(),
        months: z.number().int().min(0).max(120).nullish(),
        priceType: z.enum(["percent", "fixed"]).default("percent"),
        priceValue: z.number().min(0).max(100_000),
        minOrderTotal: z.number().min(0).max(10_000_000).default(0),
        currency: z.string().trim().length(3).default("TRY"),
        isActive: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const payload = {
      store_id: data.storeId,
      kind: data.kind,
      name: data.name,
      description: data.description ?? null,
      months: data.months ?? null,
      price_type: data.priceType,
      price_value: data.priceValue,
      min_order_total: data.minOrderTotal,
      currency: data.currency,
      is_active: data.isActive,
    };
    const { error } = data.id
      ? await context.supabase
          .from("checkout_addons")
          .update(payload)
          .eq("id", data.id)
          .eq("store_id", data.storeId)
      : await context.supabase.from("checkout_addons").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCheckoutAddon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("checkout_addons")
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ AR assets ------------------------------- */

export const saveArAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        productId: z.guid(),
        modelUrl: z.string().trim().url().max(600).nullish(),
        usdzUrl: z.string().trim().url().max(600).nullish(),
        posterUrl: z.string().trim().url().max(600).nullish(),
        scaleHint: z.string().trim().max(60).nullish(),
        isActive: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase.from("product_ar_assets").upsert(
      {
        store_id: data.storeId,
        product_id: data.productId,
        model_url: data.modelUrl ?? null,
        usdz_url: data.usdzUrl ?? null,
        poster_url: data.posterUrl ?? null,
        scale_hint: data.scaleHint ?? null,
        is_active: data.isActive,
      },
      { onConflict: "product_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------------- fraud shield ----------------------------- */

/** Son siparişleri gerçek verilerden risk puanlar (uydurma sinyal üretmez). */
export const scoreRecentOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, days: z.number().int().min(1).max(90).default(30) }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { scoreFraudRisk } = await import("@/lib/innovation");
    const { normalizeCountryCode } = await import("@/lib/global-commerce");

    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const { data: orders, error } = await context.supabase
      .from("orders")
      .select(
        "id, order_number, customer_email, customer_phone, grand_total, currency, payment_status, shipping_address, created_at",
      )
      .eq("store_id", data.storeId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const list = orders ?? [];
    const totals = list.map((order) => Number(order.grand_total ?? 0));
    const average = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;

    const byEmail = new Map<string, number>();
    const paidByEmail = new Map<string, number>();
    for (const order of list) {
      const email = String(order.customer_email ?? "").toLowerCase();
      if (!email) continue;
      byEmail.set(email, (byEmail.get(email) ?? 0) + 1);
      if (order.payment_status === "paid") paidByEmail.set(email, (paidByEmail.get(email) ?? 0) + 1);
    }

    const rows: Array<{
      store_id: string;
      order_id: string;
      score: number;
      level: string;
      signals: { code: string; label: string; weight: number }[];
      status: string;
    }> = [];

    for (const order of list) {
      const email = String(order.customer_email ?? "").toLowerCase();
      if (!email) continue;
      const address = (order.shipping_address ?? {}) as Record<string, unknown>;
      const result = scoreFraudRisk({
        email,
        orderTotal: Number(order.grand_total ?? 0),
        shippingCountry: normalizeCountryCode(String(address["country"] ?? ""), "TR"),
        ipCountry: null,
        ordersLast24h: byEmail.get(email) ?? 1,
        paidHistoryCount: paidByEmail.get(email) ?? 0,
        averageOrderTotal: average,
        phone: order.customer_phone ? String(order.customer_phone) : null,
      });
      rows.push({
        store_id: data.storeId,
        order_id: order.id as string,
        score: result.score,
        level: result.level,
        signals: result.signals,
        status: "pending",
      });
    }

    if (rows.length > 0) {
      const { error: upsertError } = await context.supabase
        .from("fraud_assessments")
        .upsert(rows, { onConflict: "order_id" });
      if (upsertError) throw new Error(upsertError.message);
    }

    return {
      scored: rows.length,
      high: rows.filter((row) => row.level === "high").length,
      medium: rows.filter((row) => row.level === "medium").length,
    };
  });

export const setFraudStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId, id: z.guid(), status: z.enum(["pending", "cleared", "blocked"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("fraud_assessments")
      .update({
        status: data.status,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ innovation settings ---------------------- */

export const saveInnovationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        carbonOffsetEnabled: z.boolean(),
        carbonOffsetAmount: z.number().min(0).max(10_000),
        fraudBlockThreshold: z.number().int().min(10).max(100),
        liveCommerceEnabled: z.boolean(),
        voiceSearchEnabled: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase.from("store_global_settings").upsert(
      {
        store_id: data.storeId,
        carbon_offset_enabled: data.carbonOffsetEnabled,
        carbon_offset_amount: data.carbonOffsetAmount,
        fraud_block_threshold: data.fraudBlockThreshold,
        live_commerce_enabled: data.liveCommerceEnabled,
        voice_search_enabled: data.voiceSearchEnabled,
      },
      { onConflict: "store_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------- dashboard ------------------------------ */

export const getInnovationDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, days: z.number().int().min(1).max(365).default(90) }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();

    const [streams, videos, ugc, decisions, fraud, addons] = await Promise.all([
      context.supabase
        .from("live_streams")
        .select("id, title, status, total_views, peak_viewers, product_clicks")
        .eq("store_id", data.storeId)
        .order("created_at", { ascending: false })
        .limit(20),
      context.supabase
        .from("shoppable_videos")
        .select("id, title, views, product_clicks, is_active")
        .eq("store_id", data.storeId)
        .limit(100),
      context.supabase
        .from("ugc_posts")
        .select("id, status, likes")
        .eq("store_id", data.storeId)
        .limit(500),
      context.supabase
        .from("payment_route_decisions")
        .select("chosen_fee, baseline_fee, saved_amount, currency, created_at")
        .eq("store_id", data.storeId)
        .gte("created_at", since)
        .limit(1000),
      context.supabase
        .from("fraud_assessments")
        .select("level, status, score")
        .eq("store_id", data.storeId)
        .limit(1000),
      context.supabase
        .from("order_addon_selections")
        .select("kind, amount, currency")
        .eq("store_id", data.storeId)
        .limit(1000),
    ]);

    const decisionRows = decisions.data ?? [];
    const savings = decisionRows.reduce((total, row) => total + Number(row.saved_amount ?? 0), 0);
    const feesPaid = decisionRows.reduce((total, row) => total + Number(row.chosen_fee ?? 0), 0);

    const ugcRows = ugc.data ?? [];
    const addonRows = addons.data ?? [];
    const addonTotals = new Map<string, number>();
    for (const row of addonRows) {
      const kind = String(row.kind);
      addonTotals.set(kind, (addonTotals.get(kind) ?? 0) + Number(row.amount ?? 0));
    }

    const fraudRows = fraud.data ?? [];

    return {
      streams: (streams.data ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        status: row.status as string,
        totalViews: Number(row.total_views ?? 0),
        peakViewers: Number(row.peak_viewers ?? 0),
        productClicks: Number(row.product_clicks ?? 0),
      })),
      videos: {
        total: (videos.data ?? []).length,
        active: (videos.data ?? []).filter((row) => row.is_active).length,
        views: (videos.data ?? []).reduce((total, row) => total + Number(row.views ?? 0), 0),
        clicks: (videos.data ?? []).reduce((total, row) => total + Number(row.product_clicks ?? 0), 0),
      },
      ugc: {
        total: ugcRows.length,
        approved: ugcRows.filter((row) => row.status === "approved").length,
        pending: ugcRows.filter((row) => row.status === "pending").length,
        likes: ugcRows.reduce((total, row) => total + Number(row.likes ?? 0), 0),
      },
      pos: {
        decisions: decisionRows.length,
        savings: Number(savings.toFixed(2)),
        feesPaid: Number(feesPaid.toFixed(2)),
        currency: decisionRows[0]?.currency ? String(decisionRows[0].currency) : "TRY",
      },
      fraud: {
        total: fraudRows.length,
        high: fraudRows.filter((row) => row.level === "high").length,
        medium: fraudRows.filter((row) => row.level === "medium").length,
        pending: fraudRows.filter((row) => row.status === "pending").length,
        blocked: fraudRows.filter((row) => row.status === "blocked").length,
      },
      addons: Array.from(addonTotals.entries()).map(([kind, amount]) => ({
        kind,
        amount: Number(amount.toFixed(2)),
      })),
    };
  });
