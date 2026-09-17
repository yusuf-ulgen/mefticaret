import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    const { data, error } = await supabase
      .from("home_maker_profiles")
      .select("user_id, full_name, store_name, category, panel_mode, store_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });

export const saveHomeMakerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(80),
        storeName: z.string().trim().min(2).max(60),
        category: z.enum(HOME_MAKER_CATEGORIES),
        storeId: z.guid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Mağaza sahipliği kullanıcının kendi token'ı ile (RLS altında) doğrulanır.
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id")
      .eq("id", data.storeId)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) throw new Error("Mağaza bulunamadı");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("home_maker_profiles").upsert(
      {
        user_id: userId,
        full_name: data.fullName,
        store_name: data.storeName,
        category: data.category,
        store_id: store.id,
        panel_mode: "micro",
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);

    // Kurulum tamamlanınca gerçek mağaza vitrini de kullanıma hazır olur.
    const publishedAt = new Date().toISOString();
    const { error: themeError } = await supabaseAdmin.from("store_themes").upsert(
      {
        store_id: store.id,
        preset: "home-maker-shop",
        primary_color: "#11162f",
        accent_color: "#6d28d9",
        background_color: "#ffffff",
        font_pair: "sora-manrope",
        radius: 0.75,
        layout: "card-grid",
        hero_title: data.storeName,
        hero_subtitle: `${data.category} ürünleri`,
        hero_cta_label: "Ürünleri incele",
        announcement: null,
        show_announcement: false,
        button_style: "solid",
        card_style: "flat",
        content_width: 900,
        section_spacing: 32,
        is_published: true,
        published_at: publishedAt,
      },
      { onConflict: "store_id" },
    );
    if (themeError) throw new Error(themeError.message);

    const { error: settingsError } = await supabaseAdmin
      .from("store_settings")
      .update({ bio: `${data.category} ürünleri` })
      .eq("store_id", store.id);
    if (settingsError) throw new Error(settingsError.message);

    const { error: publishError } = await supabaseAdmin
      .from("stores")
      .update({ status: "active", published_at: publishedAt, onboarding_completed: true })
      .eq("id", store.id)
      .eq("owner_id", userId);
    if (publishError) throw new Error(publishError.message);

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "home_maker" }, { onConflict: "user_id,role" });

    return { ok: true as const, storeId: store.id };
  });

/**
 * Kurumsal panele yükseltme: yalnızca panel türü ve rol değişir.
 * Mağaza, ürün ve sipariş kayıtlarının kimlikleri korunur; veri silinmez.
 */
export const upgradeHomeMakerToCorporate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: readError } = await supabase
      .from("home_maker_profiles")
      .select("user_id, store_id, panel_mode")
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!profile) throw new Error("Ev hanımı kaydı bulunamadı");
    if (profile.panel_mode === "corporate") {
      return { ok: true as const, storeId: profile.store_id, alreadyUpgraded: true };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("home_maker_profiles")
      .update({ panel_mode: "corporate" })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).eq("role", "home_maker");

    return { ok: true as const, storeId: profile.store_id, alreadyUpgraded: false };
  });
