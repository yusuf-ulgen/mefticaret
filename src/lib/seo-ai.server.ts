/**
 * Otomatik SEO AI motoru (platform geneli, yalnızca sunucu).
 *
 * Her çalışmada: aktif mağazaları denetler, güvenli otomatik düzeltmeleri uygular,
 * ardından yapay zeka ile eksik/zayıf meta başlık ve açıklamaları gerçek ürün,
 * koleksiyon, blog ve kampanya verisine dayanarak üretir. Ana sayfa (platform
 * pazarlama sitesi) meta verisi de aynı çalışmada güncellenir.
 *
 * Kurallar: uydurma veri yok, yalnızca panelde var olan bilgiler kullanılır;
 * her değişiklik `platform_seo_ai_actions` içine öncesi/sonrası ile yazılır.
 */

import { callProvider, DEFAULT_AI_SETTINGS, type ChatMessage } from "@/lib/ai.server";
import { clampDescription, plainText, readSeo } from "@/lib/seo";

type Db = { from: (table: string) => any };

async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

export type SeoAiSettings = {
  isEnabled: boolean;
  runLanding: boolean;
  runProducts: boolean;
  runCollections: boolean;
  runBlog: boolean;
  runCampaigns: boolean;
  autofixEnabled: boolean;
  aiEnabled: boolean;
  providerCode: string;
  model: string;
  maxStoresPerRun: number;
  maxItemsPerStore: number;
  dailyHour: number;
  dailyMinute: number;
  /** 0 = Pazar … 6 = Cumartesi. Boşsa her gün çalışır. */
  runDays: number[];
  /** Aynı anda işlenecek mağaza sayısı. */
  concurrency: number;
  focusKeywords: string;
  lastRunAt: string | null;
};

const DEFAULTS: SeoAiSettings = {
  isEnabled: true,
  runLanding: true,
  runProducts: true,
  runCollections: true,
  runBlog: true,
  runCampaigns: true,
  autofixEnabled: true,
  aiEnabled: true,
  providerCode: DEFAULT_AI_SETTINGS.providerCode,
  model: DEFAULT_AI_SETTINGS.model,
  maxStoresPerRun: 20,
  maxItemsPerStore: 8,
  dailyHour: 3,
  dailyMinute: 0,
  runDays: [0, 1, 2, 3, 4, 5, 6],
  concurrency: 4,
  focusKeywords: "",
  lastRunAt: null,
};


const TITLE_MAX = 60;
const DESC_MAX = 155;

const SYSTEM_PROMPT = [
  "Sen Mefticaret platformunun kıdemli teknik SEO editörüsün.",
  "Yalnızca sana verilen gerçek veriye dayanarak Türkçe meta başlık ve meta açıklama yaz.",
  "Uydurma özellik, fiyat, kampanya, garanti, istatistik veya yorum ekleme.",
  `Başlık en fazla ${TITLE_MAX} karakter, açıklama 120-${DESC_MAX} karakter olmalı.`,
  "Başlıkta ana anahtar kelime öne gelsin; açıklama arama amacına cevap veren tek cümle + fayda içersin.",
  "Tıklama tuzağı, ALL CAPS, aşırı emoji ve tekrar kullanma.",
  'Yanıtı yalnızca şu JSON şemasıyla ver: {"items":[{"id":"...","title":"...","description":"..."}]}',
].join(" ");

type SeoSuggestion = { id: string; title?: string | undefined; description?: string | undefined };

function parseJson(text: string): { items: SeoSuggestion[] } {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return { items: [] };
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      items?: { id?: unknown; title?: unknown; description?: unknown }[];
    };
    return {
      items: (parsed.items ?? [])
        .filter((item) => typeof item.id === "string")
        .map((item) => ({
          id: String(item.id),
          title: typeof item.title === "string" ? item.title : undefined,
          description: typeof item.description === "string" ? item.description : undefined,
        })),
    };
  } catch {
    return { items: [] };
  }
}

function weakSeo(seo: unknown) {
  const current = readSeo(seo);
  const title = (current.title ?? "").trim();
  const description = (current.description ?? "").trim();
  return {
    current,
    title,
    description,
    needsTitle: title.length < 15 || title.length > TITLE_MAX,
    needsDescription: description.length < 70 || description.length > DESC_MAX + 20,
  };
}

/* ------------------------------------------------------------------ ayarlar */

export async function loadSeoAiSettings(db?: Db): Promise<SeoAiSettings> {
  const client = db ?? (await admin());
  const { data } = await client
    .from("platform_seo_ai_settings")
    .select("*")
    .eq("singleton_key", "global")
    .maybeSingle();
  if (!data) return DEFAULTS;
  return {
    isEnabled: Boolean(data.is_enabled),
    runLanding: Boolean(data.run_landing),
    runProducts: Boolean(data.run_products),
    runCollections: Boolean(data.run_collections),
    runBlog: Boolean(data.run_blog),
    runCampaigns: Boolean(data.run_campaigns),
    autofixEnabled: Boolean(data.autofix_enabled),
    aiEnabled: Boolean(data.ai_enabled),
    providerCode: String(data.provider_code ?? DEFAULTS.providerCode),
    model: String(data.model ?? DEFAULTS.model),
    maxStoresPerRun: Number(data.max_stores_per_run ?? DEFAULTS.maxStoresPerRun),
    maxItemsPerStore: Number(data.max_items_per_store ?? DEFAULTS.maxItemsPerStore),
    dailyHour: Number(data.daily_hour ?? DEFAULTS.dailyHour),
    dailyMinute: Number(data.daily_minute ?? DEFAULTS.dailyMinute),
    runDays: Array.isArray(data.run_days) && data.run_days.length > 0
      ? (data.run_days as unknown[]).map((day) => Number(day)).filter((day) => day >= 0 && day <= 6)
      : DEFAULTS.runDays,
    concurrency: Number(data.concurrency ?? DEFAULTS.concurrency),
    focusKeywords: String(data.focus_keywords ?? ""),

    lastRunAt: data.last_run_at ? String(data.last_run_at) : null,
  };
}

export async function saveSeoAiSettings(input: { [K in keyof SeoAiSettings]?: SeoAiSettings[K] | undefined }) {
  const db = await admin();
  const row: Record<string, unknown> = { singleton_key: "global" };
  if (input.isEnabled !== undefined) row["is_enabled"] = input.isEnabled;
  if (input.runLanding !== undefined) row["run_landing"] = input.runLanding;
  if (input.runProducts !== undefined) row["run_products"] = input.runProducts;
  if (input.runCollections !== undefined) row["run_collections"] = input.runCollections;
  if (input.runBlog !== undefined) row["run_blog"] = input.runBlog;
  if (input.runCampaigns !== undefined) row["run_campaigns"] = input.runCampaigns;
  if (input.autofixEnabled !== undefined) row["autofix_enabled"] = input.autofixEnabled;
  if (input.aiEnabled !== undefined) row["ai_enabled"] = input.aiEnabled;
  if (input.providerCode !== undefined) row["provider_code"] = input.providerCode;
  if (input.model !== undefined) row["model"] = input.model;
  if (input.maxStoresPerRun !== undefined) row["max_stores_per_run"] = Math.min(Math.max(input.maxStoresPerRun, 1), 100);
  if (input.maxItemsPerStore !== undefined) row["max_items_per_store"] = Math.min(Math.max(input.maxItemsPerStore, 1), 40);
  if (input.dailyHour !== undefined) row["daily_hour"] = Math.min(Math.max(input.dailyHour, 0), 23);
  if (input.dailyMinute !== undefined) row["daily_minute"] = Math.min(Math.max(input.dailyMinute, 0), 59);
  if (input.concurrency !== undefined) row["concurrency"] = Math.min(Math.max(input.concurrency, 1), 12);
  if (input.runDays !== undefined) {
    const days = [...new Set(input.runDays.map((day) => Number(day)).filter((day) => day >= 0 && day <= 6))].sort();
    row["run_days"] = days.length > 0 ? days : DEFAULTS.runDays;
  }
  if (input.focusKeywords !== undefined) row["focus_keywords"] = input.focusKeywords.slice(0, 500);


  const { error } = await db
    .from("platform_seo_ai_settings")
    .upsert(row, { onConflict: "singleton_key" });
  if (error) throw new Error(error.message);
  return loadSeoAiSettings(db);
}

/* ------------------------------------------------------------------- durum */

export async function seoAiStatus() {
  const db = await admin();
  const [settings, runsRes, actionsRes] = await Promise.all([
    loadSeoAiSettings(db),
    db
      .from("platform_seo_ai_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20),
    db
      .from("platform_seo_ai_actions")
      .select("id, run_id, store_id, scope, action, target, before_value, after_value, created_at")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const runs = (runsRes.data ?? []) as any[];
  const storeIds = [
    ...new Set(((actionsRes.data ?? []) as any[]).map((row) => row.store_id).filter(Boolean)),
  ] as string[];
  let names = new Map<string, string>();
  if (storeIds.length > 0) {
    const { data } = await db.from("stores").select("id, name").in("id", storeIds);
    names = new Map(((data ?? []) as any[]).map((row) => [String(row.id), String(row.name)]));
  }

  const totals = runs.reduce(
    (acc, run) => ({
      autofixed: acc.autofixed + Number(run.autofixed ?? 0),
      aiUpdates: acc.aiUpdates + Number(run.ai_updates ?? 0),
      tokens: acc.tokens + Number(run.total_tokens ?? 0),
      issues: acc.issues + Number(run.issues_found ?? 0),
    }),
    { autofixed: 0, aiUpdates: 0, tokens: 0, issues: 0 },
  );

  return {
    settings,
    runs: runs.map((run) => ({
      id: String(run.id),
      trigger: String(run.trigger),
      status: String(run.status),
      startedAt: String(run.started_at),
      finishedAt: run.finished_at ? String(run.finished_at) : null,
      storesAudited: Number(run.stores_audited ?? 0),
      issuesFound: Number(run.issues_found ?? 0),
      autofixed: Number(run.autofixed ?? 0),
      aiUpdates: Number(run.ai_updates ?? 0),
      totalTokens: Number(run.total_tokens ?? 0),
      averageScore: Number(run.average_score ?? 0),
      error: run.error ? String(run.error) : null,
    })),
    actions: ((actionsRes.data ?? []) as any[]).map((row) => ({
      id: String(row.id),
      scope: String(row.scope),
      action: String(row.action),
      target: row.target ? String(row.target) : null,
      before: row.before_value ? String(row.before_value) : null,
      after: row.after_value ? String(row.after_value) : null,
      createdAt: String(row.created_at),
      storeName: row.store_id ? (names.get(String(row.store_id)) ?? "—") : "Platform",
    })),
    totals,
  };
}

/* --------------------------------------------------------------- yardımcılar */

type Action = {
  storeId: string | null;
  scope: string;
  action: string;
  target: string | null;
  before: string | null;
  after: string | null;
};

async function askAi(
  settings: SeoAiSettings,
  contextBlock: string,
  itemsBlock: string,
): Promise<{ items: SeoSuggestion[]; tokens: number }> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        contextBlock,
        settings.focusKeywords.trim() ? `Odak anahtar kelimeler: ${settings.focusKeywords.trim()}` : "",
        "Aşağıdaki kayıtlar için meta yaz:",
        itemsBlock,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
  const result = await callProvider({
    providerCode: settings.providerCode,
    model: settings.model,
    messages,
    temperature: 0.4,
    maxTokens: 2200,
  });
  return { items: parseJson(result.text).items, tokens: result.inputTokens + result.outputTokens };
}

/** Bir tablodaki eksik/zayıf metaları AI ile doldurur. */
async function optimizeTable(options: {
  db: Db;
  settings: SeoAiSettings;
  storeId: string;
  storeName: string;
  currency: string;
  table: string;
  scope: string;
  select: string;
  nameField: string;
  descField: string;
  filters?: (query: any) => any;
}): Promise<{ actions: Action[]; tokens: number }> {
  const { db, settings, storeId, storeName, table, scope, select, nameField, descField } = options;
  let query = db.from(table).select(select).eq("store_id", storeId).limit(settings.maxItemsPerStore * 4);
  if (options.filters) query = options.filters(query);
  const { data } = await query;
  const rows = (data ?? []) as any[];

  const targets = rows
    .map((row) => ({ row, state: weakSeo(row.seo) }))
    .filter((entry) => entry.state.needsTitle || entry.state.needsDescription)
    .slice(0, settings.maxItemsPerStore);
  if (targets.length === 0) return { actions: [], tokens: 0 };

  const contextBlock = [
    `Mağaza: ${storeName}`,
    `Para birimi: ${options.currency}`,
    `Kayıt tipi: ${scope}`,
  ].join("\n");
  const itemsBlock = targets
    .map((entry) => {
      const row = entry.row;
      const price = row.base_price ? ` | fiyat: ${row.base_price} ${options.currency}` : "";
      const detail = plainText(String(row[descField] ?? "")).slice(0, 400);
      return `- id: ${row.id} | ad: ${String(row[nameField] ?? "")}${price}${detail ? ` | içerik: ${detail}` : ""}`;
    })
    .join("\n");

  const { items, tokens } = await askAi(settings, contextBlock, itemsBlock);
  const byId = new Map(items.map((item) => [item.id, item]));
  const actions: Action[] = [];

  for (const entry of targets) {
    const suggestion = byId.get(String(entry.row.id));
    if (!suggestion) continue;
    const next: Record<string, unknown> = { ...entry.state.current };
    let changed = false;
    let before = "";
    let after = "";

    if (entry.state.needsTitle && suggestion.title?.trim()) {
      before = entry.state.title;
      after = suggestion.title.trim().slice(0, TITLE_MAX);
      next["title"] = after;
      changed = true;
    }
    if (entry.state.needsDescription && suggestion.description?.trim()) {
      const desc = clampDescription(suggestion.description.trim(), DESC_MAX);
      before = before || entry.state.description;
      after = after ? `${after} — ${desc}` : desc;
      next["description"] = desc;
      changed = true;
    }
    if (!changed) continue;

    const { error } = await db.from(table).update({ seo: next }).eq("id", entry.row.id).eq("store_id", storeId);
    if (error) continue;
    actions.push({
      storeId,
      scope,
      action: "ai_meta",
      target: String(entry.row[nameField] ?? entry.row.id),
      before: before || null,
      after,
    });
  }

  return { actions, tokens };
}

/** Platform ana sayfası için meta başlık/açıklama üretir ve site_sections içine yazar. */
async function optimizeLanding(db: Db, settings: SeoAiSettings): Promise<{ actions: Action[]; tokens: number }> {
  const { data: sections } = await db
    .from("site_sections")
    .select("section_key, kind, eyebrow, title, subtitle, is_enabled")
    .order("sort_order", { ascending: true })
    .limit(40);
  const rows = ((sections ?? []) as any[]).filter((row) => row.is_enabled !== false);
  if (rows.length === 0) return { actions: [], tokens: 0 };

  const { data: current } = await db
    .from("site_sections")
    .select("id, title, subtitle")
    .eq("section_key", "platform-home-seo")
    .maybeSingle();

  const contextBlock = [
    "Mefticaret; Türkiye pazarına yönelik çok kiracılı SaaS e-ticaret altyapısıdır.",
    "Ana sayfa bölümlerinden alınan gerçek içerik:",
    ...rows.map((row) => `- ${row.section_key}: ${row.title ?? ""} — ${plainText(String(row.subtitle ?? "")).slice(0, 200)}`),
  ].join("\n");

  const { items, tokens } = await askAi(
    settings,
    contextBlock,
    "- id: platform-home | ad: Mefticaret ana sayfası (SaaS e-ticaret altyapısı)",
  );
  const suggestion = items[0];
  if (!suggestion?.title || !suggestion.description) return { actions: [], tokens };

  const title = suggestion.title.trim().slice(0, TITLE_MAX);
  const description = clampDescription(suggestion.description.trim(), DESC_MAX);

  const { error } = await db.from("site_sections").upsert(
    {
      section_key: "platform-home-seo",
      kind: "seo",
      title,
      subtitle: description,
      items: [],
      sort_order: 9999,
      is_enabled: false,
    },
    { onConflict: "section_key" },
  );
  if (error) return { actions: [], tokens };

  return {
    actions: [
      {
        storeId: null,
        scope: "landing",
        action: "ai_meta",
        target: "Ana sayfa (mefticaret.com)",
        before: current?.title ? String(current.title) : null,
        after: `${title} — ${description}`,
      },
    ],
    tokens,
  };
}

/* ----------------------------------------------------------------- çalışma */

/**
 * Tüm platformda bir SEO AI turu çalıştırır.
 * `storeId` verilirse yalnızca o mağaza işlenir.
 */
export async function runSeoAiCycle(options: {
  trigger: "cron" | "manual";
  userId?: string | null;
  storeId?: string | null;
  force?: boolean;
}) {
  const db = await admin();
  const settings = await loadSeoAiSettings(db);
  if (!settings.isEnabled && !options.force) {
    return { skipped: true as const, reason: "Otomatik SEO kapalı" };
  }

  const { data: runRow, error: runError } = await db
    .from("platform_seo_ai_runs")
    .insert({ trigger: options.trigger, status: "running", actor_id: options.userId ?? null })
    .select("id")
    .single();
  if (runError) throw new Error(runError.message);
  const runId = String(runRow.id);

  const totals = { stores: 0, issues: 0, autofixed: 0, aiUpdates: 0, tokens: 0, scoreSum: 0 };
  const actions: Action[] = [];
  const perStore: { storeId: string; name: string; score: number; issues: number; error?: string }[] = [];
  let failure: string | null = null;

  try {
    /* --- ana sayfa (platform) --- */
    if (settings.runLanding && settings.aiEnabled && !options.storeId) {
      try {
        const landing = await optimizeLanding(db, settings);
        actions.push(...landing.actions);
        totals.tokens += landing.tokens;
        totals.aiUpdates += landing.actions.length;
      } catch (error) {
        failure = error instanceof Error ? error.message : "ana sayfa hatası";
      }
    }

    /* --- mağazalar --- */
    let storeQuery = db.from("stores").select("id, name, currency, status").eq("status", "active");
    if (options.storeId) storeQuery = db.from("stores").select("id, name, currency, status").eq("id", options.storeId);
    const { data: storeData } = await storeQuery.limit(settings.maxStoresPerRun);
    const stores = (storeData ?? []) as { id: string; name: string; currency: string | null }[];

    const { runStoreSeoAudit } = await import("@/lib/seo-audit.server");
    const { applySeoAutofix, AUTOFIXABLE_CODES } = await import("@/lib/seo-autofix.server");

    const processStore = async (store: { id: string; name: string; currency: string | null }) => {
      const storeId = String(store.id);
      const currency = String(store.currency ?? "TRY");
      try {
        const audit = await runStoreSeoAudit(db as never, storeId, {
          source: options.trigger === "cron" ? "cron_ai" : "platform_admin_ai",
          userId: options.userId ?? null,
        } as never);
        totals.stores += 1;
        totals.issues += Number(audit.issues ?? 0);
        totals.scoreSum += Number(audit.score ?? 0);
        perStore.push({ storeId, name: String(store.name), score: Number(audit.score ?? 0), issues: Number(audit.issues ?? 0) });

        /* güvenli otomatik düzeltmeler */
        if (settings.autofixEnabled) {
          const { data: issues } = await db
            .from("seo_issues")
            .select("id, code, title")
            .eq("store_id", storeId)
            .eq("status", "open")
            .in("code", AUTOFIXABLE_CODES as unknown as string[])
            .limit(settings.maxItemsPerStore * 3);
          for (const issue of (issues ?? []) as { id: string; code: string; title: string | null }[]) {
            try {
              const result = await applySeoAutofix(db, String(issue.id), storeId);
              await db
                .from("seo_issues")
                .update({ status: "resolved", resolved_at: new Date().toISOString() })
                .eq("id", issue.id)
                .eq("store_id", storeId);
              totals.autofixed += 1;
              actions.push({
                storeId,
                scope: "autofix",
                action: issue.code,
                target: issue.title ?? issue.code,
                before: null,
                after: String(result.value ?? ""),
              });
            } catch {
              /* düzeltilemeyen bulgu açık kalır */
            }
          }
        }

        /* AI meta üretimi */
        if (settings.aiEnabled) {
          const jobs: Promise<{ actions: Action[]; tokens: number }>[] = [];
          const base = { db, settings, storeId, storeName: String(store.name), currency };
          if (settings.runProducts) {
            jobs.push(
              optimizeTable({
                ...base,
                table: "products",
                scope: "product",
                select: "id, title, description, seo, base_price",
                nameField: "title",
                descField: "description",
                filters: (query) => query.eq("status", "active"),
              }),
            );
          }
          if (settings.runCollections) {
            jobs.push(
              optimizeTable({
                ...base,
                table: "collections",
                scope: "collection",
                select: "id, title, description, seo",
                nameField: "title",
                descField: "description",
              }),
            );
            jobs.push(
              optimizeTable({
                ...base,
                table: "categories",
                scope: "category",
                select: "id, name, description, seo",
                nameField: "name",
                descField: "description",
              }),
            );
          }
          if (settings.runBlog || settings.runCampaigns) {
            jobs.push(
              optimizeTable({
                ...base,
                table: "store_pages",
                scope: settings.runBlog ? "page" : "campaign",
                select: "id, title, excerpt, seo",
                nameField: "title",
                descField: "excerpt",
              }),
            );
          }

          for (const job of jobs) {
            try {
              const result = await job;
              actions.push(...result.actions);
              totals.aiUpdates += result.actions.length;
              totals.tokens += result.tokens;
            } catch (error) {
              failure = error instanceof Error ? error.message : "AI hatası";
            }
          }
        }
      } catch (error) {
        perStore.push({
          storeId,
          name: String(store.name),
          score: 0,
          issues: 0,
          error: error instanceof Error ? error.message : "denetim hatası",
        });
      }
    };

    /* Mağazalar tek tek beklenmez: eşzamanlılık sınırı kadar mağaza aynı anda işlenir. */
    const pool = Math.min(Math.max(settings.concurrency || 1, 1), 12);
    const queue = [...stores];
    await Promise.all(
      Array.from({ length: Math.min(pool, queue.length) }, async () => {
        for (;;) {
          const next = queue.shift();
          if (!next) return;
          await processStore(next);
        }
      }),
    );


    if (actions.length > 0) {
      await db.from("platform_seo_ai_actions").insert(
        actions.slice(0, 500).map((action) => ({
          run_id: runId,
          store_id: action.storeId,
          scope: action.scope,
          action: action.action,
          target: action.target?.slice(0, 300) ?? null,
          before_value: action.before?.slice(0, 500) ?? null,
          after_value: action.after?.slice(0, 500) ?? null,
        })),
      );
    }

    const averageScore = totals.stores > 0 ? Math.round(totals.scoreSum / totals.stores) : 0;
    await db
      .from("platform_seo_ai_runs")
      .update({
        status: failure ? "partial" : "success",
        finished_at: new Date().toISOString(),
        stores_audited: totals.stores,
        issues_found: totals.issues,
        autofixed: totals.autofixed,
        ai_updates: totals.aiUpdates,
        total_tokens: totals.tokens,
        average_score: averageScore,
        summary: { stores: perStore },
        error: failure,
      })
      .eq("id", runId);

    await db
      .from("platform_seo_ai_settings")
      .update({ last_run_at: new Date().toISOString() })
      .eq("singleton_key", "global");

    return {
      skipped: false as const,
      runId,
      storesAudited: totals.stores,
      issuesFound: totals.issues,
      autofixed: totals.autofixed,
      aiUpdates: totals.aiUpdates,
      totalTokens: totals.tokens,
      averageScore,
      stores: perStore,
      warning: failure,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "çalışma hatası";
    await db
      .from("platform_seo_ai_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error: message })
      .eq("id", runId);
    throw new Error(message);
  }
}

/** Ana sayfa için AI tarafından üretilmiş meta (yoksa null). */
export async function platformHomeSeo(db?: Db) {
  const client = db ?? (await admin());
  const { data } = await client
    .from("site_sections")
    .select("title, subtitle")
    .eq("section_key", "platform-home-seo")
    .maybeSingle();
  if (!data?.title) return null;
  return { title: String(data.title), description: String(data.subtitle ?? "") };
}

/**
 * Günlük tetikleyici: son çalışma 20 saatten eskiyse ve günün belirlenen saati
 * geldiyse yeni bir tur başlatır. Harici zamanlayıcı yoksa da otomasyon işler.
 */
export async function maybeRunDailySeoAi() {
  const db = await admin();
  const settings = await loadSeoAiSettings(db);
  if (!settings.isEnabled) return { started: false as const, reason: "kapalı" };
  if (new Date().getUTCHours() < settings.dailyHour) {
    return { started: false as const, reason: "saat gelmedi" };
  }
  if (settings.lastRunAt && Date.now() - new Date(settings.lastRunAt).getTime() < 20 * 60 * 60 * 1000) {
    return { started: false as const, reason: "bugün çalıştı" };
  }
  const { data: running } = await db
    .from("platform_seo_ai_runs")
    .select("id, started_at")
    .eq("status", "running")
    .gte("started_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .limit(1);
  if ((running ?? []).length > 0) return { started: false as const, reason: "çalışma sürüyor" };

  const result = await runSeoAiCycle({ trigger: "cron" });
  return { started: true as const, result };
}
