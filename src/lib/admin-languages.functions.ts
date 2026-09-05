import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Platform genelinde dil & çeviri görünürlüğü.
 * Rol doğrulaması kullanıcı istemcisiyle yapılır; toplu okuma sonrasında admin istemciyle çalışır.
 */

async function assertPlatformAdmin(
  supabase: { from: (table: "user_roles") => any },
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "platform_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Bu işlem yalnızca platform yöneticileri içindir");
}

export type PlatformLanguageOverview = {
  totals: { stores: number; locales: number; entries: number; translated: number; jobs: number };
  localeUsage: { locale: string; stores: number; entries: number; translated: number }[];
  stores: {
    storeId: string;
    storeName: string;
    locales: number;
    defaultLocale: string | null;
    entries: number;
    translated: number;
    provider: string | null;
  }[];
  usage: { storeId: string; storeName: string; tokens: number; characters: number; cost: number }[];
};

export const platformLanguageOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformLanguageOverview> => {
    await assertPlatformAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [storesRes, localesRes, entriesRes, jobsRes, settingsRes, usageRes] = await Promise.all([
      supabaseAdmin.from("stores").select("id, name"),
      supabaseAdmin.from("store_locales").select("store_id, locale, is_default, is_active"),
      supabaseAdmin.from("translation_entries").select("store_id, locale, status"),
      supabaseAdmin.from("translation_jobs").select("id"),
      supabaseAdmin.from("translation_settings").select("store_id, provider"),
      supabaseAdmin.from("translation_usage").select("store_id, tokens_used, characters, cost"),
    ]);

    const storeName = new Map((storesRes.data ?? []).map((row) => [row.id, row.name]));
    const providers = new Map((settingsRes.data ?? []).map((row) => [row.store_id, row.provider]));
    const done = new Set(["translated", "approved", "machine", "needs_review"]);

    const localeUsage = new Map<string, { stores: Set<string>; entries: number; translated: number }>();
    const perStore = new Map<
      string,
      { locales: Set<string>; defaultLocale: string | null; entries: number; translated: number }
    >();

    const bucket = (id: string) => {
      let row = perStore.get(id);
      if (!row) {
        row = { locales: new Set(), defaultLocale: null, entries: 0, translated: 0 };
        perStore.set(id, row);
      }
      return row;
    };

    for (const row of localesRes.data ?? []) {
      if (!row.is_active) continue;
      const store = bucket(row.store_id);
      store.locales.add(row.locale);
      if (row.is_default) store.defaultLocale = row.locale;
      const usage = localeUsage.get(row.locale) ?? { stores: new Set(), entries: 0, translated: 0 };
      usage.stores.add(row.store_id);
      localeUsage.set(row.locale, usage);
    }

    for (const row of entriesRes.data ?? []) {
      const store = bucket(row.store_id);
      store.entries += 1;
      const isDone = done.has(row.status as string);
      if (isDone) store.translated += 1;
      const usage = localeUsage.get(row.locale) ?? { stores: new Set(), entries: 0, translated: 0 };
      usage.entries += 1;
      if (isDone) usage.translated += 1;
      localeUsage.set(row.locale, usage);
    }

    const usageTotals = new Map<string, { tokens: number; characters: number; cost: number }>();
    for (const row of usageRes.data ?? []) {
      const current = usageTotals.get(row.store_id) ?? { tokens: 0, characters: 0, cost: 0 };
      current.tokens += Number(row.tokens_used ?? 0);
      current.characters += Number(row.characters ?? 0);
      current.cost += Number(row.cost ?? 0);
      usageTotals.set(row.store_id, current);
    }

    const stores = [...perStore.entries()]
      .map(([storeId, row]) => ({
        storeId,
        storeName: storeName.get(storeId) ?? "—",
        locales: row.locales.size,
        defaultLocale: row.defaultLocale,
        entries: row.entries,
        translated: row.translated,
        provider: providers.get(storeId) ?? null,
      }))
      .sort((a, b) => b.entries - a.entries);

    return {
      totals: {
        stores: perStore.size,
        locales: localeUsage.size,
        entries: entriesRes.data?.length ?? 0,
        translated: stores.reduce((sum, row) => sum + row.translated, 0),
        jobs: jobsRes.data?.length ?? 0,
      },
      localeUsage: [...localeUsage.entries()]
        .map(([locale, row]) => ({
          locale,
          stores: row.stores.size,
          entries: row.entries,
          translated: row.translated,
        }))
        .sort((a, b) => b.stores - a.stores),
      stores,
      usage: [...usageTotals.entries()]
        .map(([storeId, row]) => ({ storeId, storeName: storeName.get(storeId) ?? "—", ...row }))
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 20),
    };
  });
