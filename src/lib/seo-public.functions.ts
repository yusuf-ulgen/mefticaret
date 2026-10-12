import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { readSeo, readStoreSeo, type SeoFields, type StoreSeoSettings } from "@/lib/seo";

/**
 * Vitrin SEO bağlamı: mağaza kimliği, mağaza SEO ayarları, kurumsal bilgiler
 * ve istenen içeriğin (koleksiyon / sayfa) SEO alanları. Anon politikalarla okur.
 */

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type StoreSeoContext = {
  storeName: string;
  storeSlug: string;
  /** "micro" = Kolay Panel vitrini, "corporate" = kurumsal mağaza. */
  storeKind: "micro" | "corporate";
  /** Mağaza yayında değilse (askı/taslak) vitrin arama motorlarından gizlenir. */
  storeActive: boolean;
  logoUrl: string | null;
  legalName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: {
    street?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  social: string[];
  settings: StoreSeoSettings;
  entity: (SeoFields & { kind?: string; author?: string | null; publishedAt?: string | null; updatedAt?: string | null }) | null;
  /** Vitrinin etkin dilleri (hreflang üretimi için). */
  locales?: string[];
  /** Mağazanın varsayılan dili (x-default). */
  defaultLocale?: string;
  /** Ziyaretçinin seçtiği dil (`?lang=`), mağazada etkinse. */
  activeLocale?: string | null;
  /** İstenen anahtarların bu dildeki çevirileri (yalnız gerçekten çevrilmiş olanlar). */
  translations?: Record<string, string>;
};

export const getStoreSeoContext = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        slug: z.string().trim().min(1).max(120),
        collectionSlug: z.string().trim().max(160).optional(),
        pageSlug: z.string().trim().max(160).optional(),
        /** Ziyaretçi dili (`?lang=en`). */
        locale: z.string().trim().toLowerCase().regex(/^[a-z]{2}(-[a-z]{2})?$/i).optional(),
        /** Çevirisi istenen içerik anahtarları. */
        keys: z.array(z.string().trim().min(1).max(160)).max(40).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<StoreSeoContext | null> => {
    const supabase = publicClient();
    const { data: store, error } = await supabase
      .from("stores")
      .select("id, name, slug, logo_url, store_kind, status")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!store) return null;

    const { data: settings } = await supabase
      .from("store_settings")
      .select("seo, legal_name, contact_email, contact_phone, address, social")
      .eq("store_id", store.id)
      .maybeSingle();

    let entity: StoreSeoContext["entity"] = null;
    if (data.collectionSlug) {
      const { data: row } = await supabase
        .from("collections")
        .select("seo, updated_at")
        .eq("store_id", store.id)
        .eq("slug", data.collectionSlug)
        .maybeSingle();
      if (row) entity = { ...readSeo(row.seo), kind: "collection", updatedAt: row.updated_at };
    } else if (data.pageSlug) {
      const { data: row } = await supabase
        .from("store_pages")
        .select("seo, page_kind, author_name, published_at, updated_at")
        .eq("store_id", store.id)
        .eq("slug", data.pageSlug)
        .eq("is_published", true)
        .maybeSingle();
      if (row) {
        entity = {
          ...readSeo(row.seo),
          kind: row.page_kind ?? "page",
          author: row.author_name,
          publishedAt: row.published_at,
          updatedAt: row.updated_at,
        };
      }
    }

    const addressRaw =
      settings?.address && typeof settings.address === "object" && !Array.isArray(settings.address)
        ? (settings.address as Record<string, unknown>)
        : {};
    const pick = (key: string) => (typeof addressRaw[key] === "string" ? (addressRaw[key] as string) : undefined);

    const socialRaw =
      settings?.social && typeof settings.social === "object" && !Array.isArray(settings.social)
        ? Object.values(settings.social as Record<string, unknown>)
        : [];

    const address: StoreSeoContext["address"] = {};
    const street = pick("street") ?? pick("line1");
    const city = pick("city");
    const region = pick("region") ?? pick("state");
    const postalCode = pick("postalCode") ?? pick("zip");
    const country = pick("country");
    if (street) address.street = street;
    if (city) address.city = city;
    if (region) address.region = region;
    if (postalCode) address.postalCode = postalCode;
    if (country) address.country = country;

    // Vitrinin yayında olduğu diller: hreflang etiketleri bunlardan üretilir.
    const { data: localeRows } = await supabase
      .from("store_locales")
      .select("locale, is_default, is_active")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("sort_order");
    const locales = (localeRows ?? []).map((row) => String(row.locale));
    const defaultLocale =
      (localeRows ?? []).find((row) => row.is_default)?.locale ?? locales[0] ?? "tr-TR";

    // Ziyaretçinin seçtiği dil yalnızca mağazada etkinse uygulanır; istenen
    // anahtarların çevirisi yayınlanmış vitrinler için anon politikayla okunur.
    const short = (value: string) => value.slice(0, 2).toLowerCase();
    const wanted = data.locale ? short(data.locale) : null;
    const activeLocale =
      wanted && wanted !== short(String(defaultLocale))
        ? (locales.find((locale) => short(locale) === wanted) ?? null)
        : null;

    const translations: Record<string, string> = {};
    if (activeLocale && data.keys?.length) {
      const { data: rows } = await supabase
        .from("translation_entries")
        .select("translation_key, translated_value")
        .eq("store_id", store.id)
        .eq("locale", activeLocale)
        .neq("status", "missing")
        .in("translation_key", data.keys);
      for (const row of rows ?? []) {
        const value = (row.translated_value ?? "").trim();
        if (value) translations[row.translation_key] = value;
      }
    }

    return {
      storeName: store.name,
      storeSlug: store.slug,
      storeKind: store.store_kind === "micro" ? "micro" : "corporate",
      storeActive: store.status === "active",
      logoUrl: store.logo_url,
      legalName: settings?.legal_name ?? null,
      contactEmail: settings?.contact_email ?? null,
      contactPhone: settings?.contact_phone ?? null,
      address,
      social: socialRaw.filter((item): item is string => typeof item === "string" && /^https?:\/\//.test(item)),
      settings: readStoreSeo(settings?.seo),
      entity,
      locales,
      defaultLocale: String(defaultLocale),
      activeLocale,
      translations,
    };
  });
