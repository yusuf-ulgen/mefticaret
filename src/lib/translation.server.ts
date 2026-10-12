/**
 * Çeviri motoru — yalnızca sunucuda çalışır.
 *
 * Katmanlar:
 *   kaynak toplayıcı (mağaza içeriği)  →  çeviri hafızası / sözlük
 *   →  sağlayıcı adaptörü (Translation Gateway)  →  çeviri kayıtları + kullanım
 *
 * Sağlayıcı tek bir servise bağlı değildir: `translateBatch` içindeki adapter
 * seçimi `translation_settings.provider` alanına göre yapılır.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { isRtlLanguage, findLanguage } from "@/lib/languages";
import {
  CONTENT_TYPES,
  SYSTEM_STRINGS,
  checkTranslation,
  makeKey,
  sanitizeTranslation,
  slugifyTranslation,
  sourceHash,
  type ContentType,
  type TranslatableItem,
} from "@/lib/translation";

type Client = SupabaseClient<Database>;
type SettingsRow = Database["public"]["Tables"]["translation_settings"]["Row"];

const BATCH_SIZE = 25;

/* ------------------------------------------------------------------ ayarlar */

export async function loadTranslationSettings(
  supabase: Client,
  storeId: string,
): Promise<SettingsRow> {
  const { data, error } = await supabase
    .from("translation_settings")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;

  const { data: created, error: insertError } = await supabase
    .from("translation_settings")
    .insert({ store_id: storeId })
    .select("*")
    .single();
  if (insertError) throw new Error(insertError.message);
  return created;
}

/** Mağazanın varsayılan dili yoksa mağaza ayarındaki dille oluşturur. */
export async function ensureDefaultLocale(supabase: Client, storeId: string): Promise<string> {
  const { data: rows, error } = await supabase
    .from("store_locales")
    .select("locale, is_default")
    .eq("store_id", storeId);
  if (error) throw new Error(error.message);

  const current = rows?.find((row) => row.is_default);
  if (current) return current.locale;
  if (rows && rows.length > 0) {
    await supabase
      .from("store_locales")
      .update({ is_default: true })
      .eq("store_id", storeId)
      .eq("locale", rows[0]!.locale);
    return rows[0]!.locale;
  }

  const { data: settings } = await supabase
    .from("store_settings")
    .select("default_locale")
    .eq("store_id", storeId)
    .maybeSingle();
  const locale = settings?.default_locale === "en" ? "en-US" : "tr-TR";
  const meta = findLanguage(locale);
  const { error: insertError } = await supabase.from("store_locales").insert({
    store_id: storeId,
    code: locale.slice(0, 2),
    locale,
    label: meta?.label ?? locale,
    native_label: meta?.native ?? locale,
    currency: meta?.currency ?? null,
    dir: isRtlLanguage(locale) ? "rtl" : "ltr",
    is_default: true,
    is_active: true,
    sort_order: 0,
  });
  if (insertError) throw new Error(insertError.message);
  return locale;
}

/* -------------------------------------------------------- kaynak toplayıcı */

function seoFields(seo: unknown): { title?: string; description?: string } {
  if (!seo || typeof seo !== "object" || Array.isArray(seo)) return {};
  const record = seo as Record<string, unknown>;
  const title = typeof record["title"] === "string" ? (record["title"] as string) : undefined;
  const description =
    typeof record["description"] === "string" ? (record["description"] as string) : undefined;
  return { ...(title ? { title } : {}), ...(description ? { description } : {}) };
}

function push(
  list: TranslatableItem[],
  contentType: ContentType,
  entityId: string | null,
  field: string,
  source: string | null | undefined,
  options: { isSlug?: boolean; html?: boolean } = {},
) {
  const value = (source ?? "").trim();
  if (!value) return;
  list.push({
    contentType,
    entityId,
    field,
    key: makeKey(contentType, entityId ?? "global", field),
    source: value,
    ...options,
  });
}

const THEME_TEXT_FIELDS = new Set([
  "heading",
  "title",
  "subtitle",
  "subheading",
  "text",
  "body",
  "label",
  "badge",
  "button",
  "buttonLabel",
  "cta",
  "ctaLabel",
  "eyebrow",
  "description",
  "promoText",
  "note",
]);

/** Seçili içerik tiplerinin çevrilebilir alanlarını toplar. */
export async function collectSourceItems(
  supabase: Client,
  storeId: string,
  contentTypes: readonly ContentType[],
): Promise<TranslatableItem[]> {
  const wanted = new Set(contentTypes.length > 0 ? contentTypes : CONTENT_TYPES);
  const items: TranslatableItem[] = [];

  if (wanted.has("product") || wanted.has("seo")) {
    const { data, error } = await supabase
      .from("products")
      .select("id, title, description, slug, tags, seo")
      .eq("store_id", storeId)
      .limit(5000);
    if (error) throw new Error(error.message);
    for (const product of data ?? []) {
      if (wanted.has("product")) {
        push(items, "product", product.id, "title", product.title);
        push(items, "product", product.id, "description", product.description, { html: true });
        push(items, "product", product.id, "slug", product.slug, { isSlug: true });
        (product.tags ?? []).forEach((tag, index) =>
          push(items, "product", product.id, `tag.${index}`, tag),
        );
      }
      if (wanted.has("seo")) {
        const seo = seoFields(product.seo);
        push(items, "seo", product.id, "product.title", seo.title);
        push(items, "seo", product.id, "product.description", seo.description);
      }
    }
  }

  if (wanted.has("variant")) {
    const [{ data: options }, { data: values }] = await Promise.all([
      supabase.from("product_options").select("id, name").eq("store_id", storeId).limit(3000),
      supabase.from("product_option_values").select("id, value").eq("store_id", storeId).limit(6000),
    ]);
    for (const option of options ?? []) push(items, "variant", option.id, "option_name", option.name);
    for (const value of values ?? []) push(items, "variant", value.id, "option_value", value.value);
  }

  if (wanted.has("category") || wanted.has("seo")) {
    const { data } = await supabase
      .from("categories")
      .select("id, name, description, slug, seo")
      .eq("store_id", storeId)
      .limit(2000);
    for (const category of data ?? []) {
      if (wanted.has("category")) {
        push(items, "category", category.id, "name", category.name);
        push(items, "category", category.id, "description", category.description, { html: true });
        push(items, "category", category.id, "slug", category.slug, { isSlug: true });
      }
      if (wanted.has("seo")) {
        const seo = seoFields(category.seo);
        push(items, "seo", category.id, "category.title", seo.title);
        push(items, "seo", category.id, "category.description", seo.description);
      }
    }
  }

  if (wanted.has("collection")) {
    const { data } = await supabase
      .from("collections")
      .select("id, title, description, slug, seo")
      .eq("store_id", storeId)
      .limit(2000);
    for (const collection of data ?? []) {
      push(items, "collection", collection.id, "title", collection.title);
      push(items, "collection", collection.id, "description", collection.description, { html: true });
      push(items, "collection", collection.id, "slug", collection.slug, { isSlug: true });
      const seo = seoFields(collection.seo);
      push(items, "collection", collection.id, "seo.title", seo.title);
      push(items, "collection", collection.id, "seo.description", seo.description);
    }
  }

  if (wanted.has("brand")) {
    const { data } = await supabase
      .from("brands")
      .select("id, name, description, slug")
      .eq("store_id", storeId)
      .limit(2000);
    for (const brand of data ?? []) {
      push(items, "brand", brand.id, "name", brand.name);
      push(items, "brand", brand.id, "description", brand.description, { html: true });
      push(items, "brand", brand.id, "slug", brand.slug, { isSlug: true });
    }
  }

  if (wanted.has("page") || wanted.has("blog")) {
    const { data } = await supabase
      .from("store_pages")
      .select("id, title, excerpt, body, slug, seo, seo_description, page_kind")
      .eq("store_id", storeId)
      .limit(2000);
    for (const page of data ?? []) {
      const type: ContentType = page.page_kind === "post" || page.page_kind === "blog" ? "blog" : "page";
      if (!wanted.has(type)) continue;
      push(items, type, page.id, "title", page.title);
      push(items, type, page.id, "excerpt", page.excerpt);
      push(items, type, page.id, "body", page.body, { html: true });
      push(items, type, page.id, "slug", page.slug, { isSlug: true });
      const seo = seoFields(page.seo);
      push(items, type, page.id, "seo.title", seo.title);
      push(items, type, page.id, "seo.description", seo.description ?? page.seo_description);
    }
  }

  if (wanted.has("menu")) {
    const { data } = await supabase
      .from("store_menu_items")
      .select("id, label")
      .eq("store_id", storeId)
      .limit(2000);
    for (const item of data ?? []) push(items, "menu", item.id, "label", item.label);
  }

  if (wanted.has("theme")) {
    const { data } = await supabase
      .from("store_theme_sections")
      .select("id, type, settings")
      .eq("store_id", storeId)
      .limit(500);
    for (const section of data ?? []) {
      const settings = section.settings;
      if (!settings || typeof settings !== "object" || Array.isArray(settings)) continue;
      for (const [field, value] of Object.entries(settings as Record<string, unknown>)) {
        if (typeof value !== "string" || !THEME_TEXT_FIELDS.has(field)) continue;
        push(items, "theme", section.id, `${section.type}.${field}`, value);
      }
    }
  }

  if (wanted.has("system")) {
    for (const [key, value] of Object.entries(SYSTEM_STRINGS)) {
      if (key.startsWith("email.")) continue;
      push(items, "system", null, key, value);
    }
  }

  if (wanted.has("email")) {
    for (const [key, value] of Object.entries(SYSTEM_STRINGS)) {
      if (!key.startsWith("email.")) continue;
      push(items, "email", null, key, value);
    }
    const { data } = await supabase
      .from("message_templates")
      .select("id, name, subject, body")
      .eq("store_id", storeId)
      .limit(500);
    for (const template of data ?? []) {
      push(items, "email", template.id, "subject", template.subject);
      push(items, "email", template.id, "body", template.body, { html: true });
    }
  }

  return items;
}

/**
 * Kaynak metinleri hedef dilin çeviri kayıtlarıyla eşitler.
 * Yeni alan `missing`, kaynak metni değişen alan `needs_review` olur.
 */
export async function syncSourceEntries(
  supabase: Client,
  storeId: string,
  locale: string,
  items: TranslatableItem[],
): Promise<{ created: number; stale: number }> {
  if (items.length === 0) return { created: 0, stale: 0 };

  // Tüm mevcut kayıtlar sayfalanarak okunur; tek sorgu 1000 satırla sınırlıdır ve
  // eksik okunan kayıtlar yeniden eklenmeye çalışılınca tekil anahtar hatası verir.
  const existing: { id: string; translation_key: string; source_value: string | null; status: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("translation_entries")
      .select("id, translation_key, source_value, status")
      .eq("store_id", storeId)
      .eq("locale", locale)
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    existing.push(...rows);
    if (rows.length < 1000) break;
  }

  const byKey = new Map(existing.map((row) => [row.translation_key, row]));
  const inserts: Database["public"]["Tables"]["translation_entries"]["Insert"][] = [];
  let stale = 0;

  const queued = new Set<string>();
  for (const item of items) {
    const row = byKey.get(item.key);
    if (!row) {
      if (queued.has(item.key)) continue;
      queued.add(item.key);
      inserts.push({
        store_id: storeId,
        locale,
        namespace: item.contentType,
        content_type: item.contentType,
        entity_id: item.entityId,
        field: item.field,
        translation_key: item.key,
        source_value: item.source,
        status: "missing",
      });
      continue;
    }
    if (row.source_value !== item.source) {
      stale += 1;
      await supabase
        .from("translation_entries")
        .update({
          source_value: item.source,
          status: row.status === "missing" ? "missing" : "needs_review",
        })
        .eq("id", row.id);
    }
  }

  for (let index = 0; index < inserts.length; index += 500) {
    const chunk = inserts.slice(index, index + 500);
    const { error: insertError } = await supabase
      .from("translation_entries")
      .upsert(chunk, { onConflict: "store_id,locale,translation_key", ignoreDuplicates: true });
    if (insertError) throw new Error(insertError.message);
  }

  return { created: inserts.length, stale };
}

/* ------------------------------------------------ sağlayıcı adaptör katmanı */

type ProviderInput = {
  sourceLocale: string;
  targetLocale: string;
  items: { key: string; text: string; isSlug?: boolean; html?: boolean }[];
  brandVoice: string;
  glossary: { term: string; translation: string | null; doNotTranslate: boolean }[];
  doNotTranslate: string[];
  model: string;
};

type ProviderOutput = { key: string; value: string }[];

function buildPrompt(input: ProviderInput): string {
  const glossaryLines = input.glossary
    .map((entry) =>
      entry.doNotTranslate
        ? `- "${entry.term}" ASLA çevrilmeyecek, aynen korunacak`
        : `- "${entry.term}" → "${entry.translation ?? entry.term}"`,
    )
    .join("\n");
  const protectedWords = input.doNotTranslate.join(", ");

  return [
    `Kaynak dil: ${input.sourceLocale}`,
    `Hedef dil: ${input.targetLocale}`,
    `Marka dili/tonu: ${input.brandVoice}`,
    glossaryLines ? `Sözlük:\n${glossaryLines}` : "",
    protectedWords ? `Çevrilmeyecek kelimeler: ${protectedWords}` : "",
    "",
    "Aşağıdaki JSON dizisindeki her nesnenin `text` alanını hedef dile çevir.",
    "`slug: true` olan alanlar için yalnızca küçük harf, rakam ve tire içeren SEO dostu URL parçası üret.",
    "`html: true` olan alanlarda HTML etiketlerini ve yapısını birebir koru, yalnızca metni çevir.",
    "{{degisken}} ve {degisken} biçimindeki tüm yer tutucuları aynen koru.",
    "Kelime kelime değil; e-ticaret bağlamına, ürün terminolojisine ve marka diline uygun çevir.",
    'Yanıt SADECE şu biçimde JSON olsun: {"items":[{"key":"...","value":"..."}]}',
    "",
    JSON.stringify(
      input.items.map((item) => ({
        key: item.key,
        text: item.text,
        ...(item.isSlug ? { slug: true } : {}),
        ...(item.html ? { html: true } : {}),
      })),
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

function parseProviderJson(text: string): ProviderOutput {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  const parsed = JSON.parse(slice) as { items?: { key?: string; value?: string }[] };
  return (parsed.items ?? [])
    .filter((item): item is { key: string; value: string } =>
      typeof item.key === "string" && typeof item.value === "string",
    )
    .map((item) => ({ key: item.key, value: item.value }));
}

/** Gateway: sağlayıcı adaptörünü seçer. Şu an Lovable AI adaptörü bağlıdır. */
async function callTranslationProvider(
  provider: string,
  input: ProviderInput,
): Promise<ProviderOutput> {
  if (provider !== "lovable-ai" && provider !== "lovable") {
    throw new Error(`Desteklenmeyen çeviri sağlayıcısı: ${provider}`);
  }
  const { chatComplete } = await import("@/lib/ai.server");
  const text = await chatComplete(
    [
      {
        role: "system",
        content:
          "Sen kıdemli bir e-ticaret lokalizasyon uzmanısın. Anlamı, bağlamı, ürün terminolojisini ve marka dilini koruyarak çeviri yaparsın. Yanıtın her zaman geçerli JSON olur.",
      },
      { role: "user", content: buildPrompt(input) },
    ],
    3000,
  );
  return parseProviderJson(text);
}

async function recordUsage(
  supabase: Client,
  storeId: string,
  locale: string,
  provider: string,
  characters: number,
  requests: number,
) {
  const day = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from("translation_usage")
    .select("id, characters, words, requests")
    .eq("store_id", storeId)
    .eq("day", day)
    .eq("locale", locale)
    .eq("provider", provider)
    .maybeSingle();

  const words = Math.round(characters / 6);
  if (existing) {
    await supabase
      .from("translation_usage")
      .update({
        characters: existing.characters + characters,
        words: existing.words + words,
        requests: existing.requests + requests,
      })
      .eq("id", existing.id);
    return;
  }
  await supabase
    .from("translation_usage")
    .insert({ store_id: storeId, day, locale, provider, characters, words, requests });
}

/* ------------------------------------------------------------- çeviri akışı */

export type TranslateResult = {
  translated: number;
  reused: number;
  failed: number;
  issues: { key: string; issues: string[] }[];
};

/**
 * Verilen kayıtları çevirir: önce çeviri hafızası, sonra sağlayıcı.
 * Placeholder/HTML doğrulaması geçmeyen çeviriler `needs_review` olarak yazılır.
 */
export async function translateEntries(
  supabase: Client,
  options: {
    storeId: string;
    sourceLocale: string;
    targetLocale: string;
    entries: { id: string; translation_key: string; source_value: string | null; field: string | null }[];
    settings?: SettingsRow;
    userId?: string | null;
  },
): Promise<TranslateResult> {
  const settings = options.settings ?? (await loadTranslationSettings(supabase, options.storeId));
  const result: TranslateResult = { translated: 0, reused: 0, failed: 0, issues: [] };
  const pending = options.entries.filter((entry) => (entry.source_value ?? "").trim().length > 0);
  if (pending.length === 0) return result;

  const [{ data: glossaryRows }, { data: memoryRows }] = await Promise.all([
    supabase
      .from("translation_glossary")
      .select("term, locale, translation, do_not_translate")
      .eq("store_id", options.storeId)
      .limit(500),
    supabase
      .from("translation_memory")
      .select("source_hash, target_text")
      .eq("store_id", options.storeId)
      .eq("source_locale", options.sourceLocale)
      .eq("target_locale", options.targetLocale)
      .eq("approved", true)
      .limit(5000),
  ]);

  const memory = new Map((memoryRows ?? []).map((row) => [row.source_hash, row.target_text]));
  const glossary = (glossaryRows ?? [])
    .filter((row) => !row.locale || row.locale === options.targetLocale)
    .map((row) => ({
      term: row.term,
      translation: row.translation,
      doNotTranslate: row.do_not_translate,
    }));

  const needsProvider: typeof pending = [];

  // 1) Çeviri hafızası
  for (const entry of pending) {
    const hit = memory.get(sourceHash(entry.source_value!));
    if (!hit) {
      needsProvider.push(entry);
      continue;
    }
    await writeTranslation(supabase, entry, hit, "memory", "translated", options.userId ?? null);
    result.reused += 1;
  }

  // 2) Sağlayıcı (parçalı istekler)
  for (let index = 0; index < needsProvider.length; index += BATCH_SIZE) {
    const chunk = needsProvider.slice(index, index + BATCH_SIZE);
    const characters = chunk.reduce((sum, entry) => sum + (entry.source_value?.length ?? 0), 0);
    try {
      const output = await callTranslationProvider(settings.provider, {
        sourceLocale: options.sourceLocale,
        targetLocale: options.targetLocale,
        brandVoice: settings.brand_voice,
        model: settings.model,
        glossary,
        doNotTranslate: settings.do_not_translate ?? [],
        items: chunk.map((entry) => ({
          key: entry.translation_key,
          text: entry.source_value!,
          ...(entry.field?.includes("slug") ? { isSlug: true } : {}),
          ...(/description|body|excerpt/.test(entry.field ?? "") ? { html: true } : {}),
        })),
      });
      const byKey = new Map(output.map((item) => [item.key, item.value]));

      for (const entry of chunk) {
        const raw = byKey.get(entry.translation_key);
        if (!raw) {
          result.failed += 1;
          continue;
        }
        const isSlug = entry.field?.includes("slug") ?? false;
        const value = isSlug ? slugifyTranslation(raw) : sanitizeTranslation(raw);
        const issues = checkTranslation(entry.source_value!, value);
        const blocking = issues.filter((issue) => issue !== "identical" && issue !== "too_long");
        const status = blocking.length > 0 ? "needs_review" : "machine";
        await writeTranslation(supabase, entry, value, settings.provider, status, options.userId ?? null);
        if (issues.length > 0) result.issues.push({ key: entry.translation_key, issues });
        result.translated += 1;
      }

      await recordUsage(
        supabase,
        options.storeId,
        options.targetLocale,
        settings.provider,
        characters,
        1,
      );
    } catch (cause) {
      result.failed += chunk.length;
      const message = cause instanceof Error ? cause.message : "çeviri başarısız";
      if (/kredisi|yapılandırılmamış|Desteklenmeyen/.test(message)) throw cause;
    }
  }

  return result;
}

async function writeTranslation(
  supabase: Client,
  entry: { id: string },
  value: string,
  provider: string,
  status: Database["public"]["Enums"]["translation_status"],
  userId: string | null,
) {
  const { error } = await supabase
    .from("translation_entries")
    .update({
      translated_value: value,
      status,
      provider,
      ...(userId ? { updated_by: userId } : {}),
    })
    .eq("id", entry.id);
  if (error) throw new Error(error.message);
}

/** Onaylanan çeviriyi hafızaya yazar. */
export async function rememberTranslation(
  supabase: Client,
  input: {
    storeId: string;
    sourceLocale: string;
    targetLocale: string;
    sourceText: string;
    targetText: string;
  },
) {
  const { error } = await supabase.from("translation_memory").upsert(
    {
      store_id: input.storeId,
      source_locale: input.sourceLocale,
      target_locale: input.targetLocale,
      source_hash: sourceHash(input.sourceText),
      source_text: input.sourceText,
      target_text: input.targetText,
      approved: true,
    },
    { onConflict: "store_id,source_locale,target_locale,source_hash" },
  );
  if (error) throw new Error(error.message);
}

/* ---------------------------------------------------- toplu çeviri kuyruğu */

export async function createTranslationJob(
  supabase: Client,
  input: {
    storeId: string;
    sourceLocale: string;
    targetLocales: string[];
    contentTypes: ContentType[];
    userId: string | null;
    onlyMissing?: boolean;
  },
): Promise<{ jobId: string; total: number }> {
  const items = await collectSourceItems(supabase, input.storeId, input.contentTypes);
  for (const locale of input.targetLocales) {
    await syncSourceEntries(supabase, input.storeId, locale, items);
  }

  const { data: job, error } = await supabase
    .from("translation_jobs")
    .insert({
      store_id: input.storeId,
      source_locale: input.sourceLocale,
      target_locales: input.targetLocales,
      content_types: input.contentTypes,
      status: "queued",
      created_by: input.userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  let total = 0;
  for (const locale of input.targetLocales) {
    let query = supabase
      .from("translation_entries")
      .select("translation_key, content_type, entity_id, field, source_value, status")
      .eq("store_id", input.storeId)
      .eq("locale", locale);
    if (input.contentTypes.length > 0) query = query.in("content_type", input.contentTypes);
    if (input.onlyMissing !== false) query = query.eq("status", "missing");

    const { data: entries, error: entriesError } = await query.limit(10000);
    if (entriesError) throw new Error(entriesError.message);

    const rows = (entries ?? []).map((entry) => ({
      job_id: job.id,
      store_id: input.storeId,
      locale,
      translation_key: entry.translation_key,
      content_type: entry.content_type,
      entity_id: entry.entity_id,
      field: entry.field,
      source_value: entry.source_value,
      status: "queued" as const,
    }));
    for (let index = 0; index < rows.length; index += 500) {
      const { error: itemError } = await supabase
        .from("translation_job_items")
        .insert(rows.slice(index, index + 500));
      if (itemError) throw new Error(itemError.message);
    }
    total += rows.length;
  }

  await supabase.from("translation_jobs").update({ total_items: total }).eq("id", job.id);

  // Kuyruğa alma yetki kontrolü bu fonksiyonda yapıldı; kuyruk kaydı sunucu
  // tarafındaki yönetici bağlantısıyla yazılır (tarayıcı oturumu kuyruk
  // fonksiyonunu doğrudan çağıramaz).
  const { enqueueJob } = await import("@/lib/queue.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await enqueueJob(supabaseAdmin, {
    kind: "ai",
    storeId: input.storeId,
    payload: { translationJobId: job.id },
    dedupeKey: `translation:${job.id}`,
  });

  return { jobId: job.id, total };
}

/** Kuyruk worker'ı tarafından çağrılır; işi parça parça ilerletir. */
export async function runTranslationJob(
  supabase: Client,
  jobId: string,
  limit = 100,
): Promise<{ processed: number; remaining: number }> {
  const { data: job, error } = await supabase
    .from("translation_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!job) throw new Error("Çeviri işi bulunamadı");
  if (job.status === "cancelled" || job.status === "completed") return { processed: 0, remaining: 0 };

  await supabase
    .from("translation_jobs")
    .update({ status: "running", started_at: job.started_at ?? new Date().toISOString() })
    .eq("id", jobId);

  const { data: items, error: itemsError } = await supabase
    .from("translation_job_items")
    .select("*")
    .eq("job_id", jobId)
    .eq("status", "queued")
    .limit(limit);
  if (itemsError) throw new Error(itemsError.message);

  const settings = await loadTranslationSettings(supabase, job.store_id);
  let processed = 0;
  let failed = 0;

  const byLocale = new Map<string, typeof items>();
  for (const item of items ?? []) {
    const list = byLocale.get(item.locale) ?? [];
    list.push(item);
    byLocale.set(item.locale, list);
  }

  for (const [locale, list] of byLocale) {
    const keys = (list ?? []).map((item) => item.translation_key);
    const { data: entries } = await supabase
      .from("translation_entries")
      .select("id, translation_key, source_value, field")
      .eq("store_id", job.store_id)
      .eq("locale", locale)
      .in("translation_key", keys);

    const outcome = await translateEntries(supabase, {
      storeId: job.store_id,
      sourceLocale: job.source_locale,
      targetLocale: locale,
      entries: entries ?? [],
      settings,
      userId: job.created_by,
    });

    const done = outcome.translated + outcome.reused;
    processed += done;
    failed += outcome.failed;

    const ids = (list ?? []).map((item) => item.id);
    await supabase
      .from("translation_job_items")
      .update({ status: outcome.failed >= (list?.length ?? 0) ? "failed" : "completed" })
      .in("id", ids);
  }

  const { count: remaining } = await supabase
    .from("translation_job_items")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("status", "queued");

  await supabase
    .from("translation_jobs")
    .update({
      done_items: job.done_items + processed,
      failed_items: job.failed_items + failed,
      ...(remaining && remaining > 0
        ? {}
        : { status: "completed" as const, finished_at: new Date().toISOString() }),
    })
    .eq("id", jobId);

  if (remaining && remaining > 0) {
    const { enqueueJob } = await import("@/lib/queue.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await enqueueJob(supabaseAdmin, {
      kind: "ai",
      storeId: job.store_id,
      payload: { translationJobId: jobId },
      dedupeKey: `translation:${jobId}:${Date.now()}`,
    });
  }

  return { processed, remaining: remaining ?? 0 };
}

/* ---------------------------------------------------- vitrin locale paketi */

/** Vitrin için yalnızca ilgili dilin çeviri sözlüğünü döner (tam tablo çekilmez). */
export async function loadLocaleBundle(
  supabase: Client,
  storeId: string,
  locale: string,
  contentTypes: ContentType[] = ["system", "theme", "menu"],
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("translation_entries")
    .select("translation_key, translated_value")
    .eq("store_id", storeId)
    .eq("locale", locale)
    .in("content_type", contentTypes)
    .not("translated_value", "is", null)
    .limit(4000);
  if (error) throw new Error(error.message);

  const bundle: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.translated_value) bundle[row.translation_key] = row.translated_value;
  }
  return bundle;
}
