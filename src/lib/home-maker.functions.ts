import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "@/lib/mefti";

/**
 * Ev hanımları portalı (v6.0) — izole modül.
 * Rol ataması ve panel türü yalnızca sunucuda, giriş yapmış kullanıcının
 * token'ından türetilen kullanıcı kimliğiyle yazılır; frontend'e güvenilmez.
 */

export const HOME_MAKER_CATEGORIES = [
  "El Emeği Örgü",
  "Yöresel Gıda",
  "Takı & Aksesuar",
  "Ev Dekorasyon",
  "Doğal Kozmetik",
  "Bebek & Çocuk",
  "Pasta & Tatlı",
  "Diğer El Emeği",
] as const;

export const getHomeMakerProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "home_maker")
      .maybeSingle();
    if (!role) return null;
    const { data, error } = await supabase
      .from("home_maker_profiles")
      .select("user_id, full_name, store_name, category, panel_mode, store_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.store_id) return null;

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("store_kind")
      .eq("id", data.store_id)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    return store?.store_kind === "micro" ? data : null;
  });

export const createHomeMakerStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(80),
        storeName: z.string().trim().min(2).max(60),
        category: z.enum(HOME_MAKER_CATEGORIES),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("create_home_maker_store", {
      _user_id: userId,
      _full_name: data.fullName,
      _store_name: data.storeName,
      _category: data.category,
      _slug_base: slugify(data.storeName) || "magaza",
    });
    if (error) throw new Error(error.message);
    const store = rows?.[0];
    if (!store) throw new Error("Kolay Panel mağazası oluşturulamadı");
    return { ok: true as const, storeId: store.store_id, slug: store.store_slug };
  });

/** Kolay Panel kapısı: rol + mikro mağaza + mağazayı yönetme yetkisi sunucuda doğrulanır. */
export const checkKolayAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const [{ data: role }, { data: store }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "home_maker").maybeSingle(),
      supabase.from("stores").select("id, store_kind").eq("id", data.storeId).maybeSingle(),
    ]);
    if (!role) return { ok: false as const, reason: "role" as const };
    // stores RLS yalnız yöneticinin görebileceği satırı döndürür.
    if (!store || store.store_kind !== "micro") return { ok: false as const, reason: "store" as const };
    return { ok: true as const };
  });
