import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deleteSiteKit,
  listSiteKit,
  saveSiteKit,
  saveSiteKitSchema,
  storeIdSchema,
  testSiteKit,
  testSiteKitSchema,
  toggleSiteKit,
  toggleSiteKitSchema,
} from "@/lib/site-kit.server";

export const listStoreSiteKit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listSiteKit(context.supabase, data));

export const saveStoreSiteKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => saveSiteKitSchema.parse(data))
  .handler(async ({ data, context }) => saveSiteKit(context.supabase, data));

export const toggleStoreSiteKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => toggleSiteKitSchema.parse(data))
  .handler(async ({ data, context }) => toggleSiteKit(context.supabase, data));

export const removeStoreSiteKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => toggleSiteKitSchema.parse(data))
  .handler(async ({ data, context }) => deleteSiteKit(context.supabase, data));

export const testStoreSiteKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => testSiteKitSchema.parse(data))
  .handler(async ({ data, context }) => testSiteKit(context.supabase, data));

/**
 * Vitrin için yalnızca herkese açık kimlikler. Anonim anahtarla, kolon bazlı
 * yetkilendirme (yalnızca public_config) ve yayınlanmış mağaza koşullu RLS
 * üzerinden okunur; gizli anahtarlar veritabanı seviyesinde erişilemez.
 */
export const getStorefrontSiteKit = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabase = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!store?.id) return [];

    const { data: rows, error } = await supabase
      .from("store_site_kit")
      .select("provider, public_config")
      .eq("store_id", store.id);
    if (error) return [];
    const list = (rows ?? []) as { provider: string; public_config: Record<string, string> | null }[];
    return list.map((row) => ({
      provider: row.provider,
      config: row.public_config ?? {},
    }));
  });
