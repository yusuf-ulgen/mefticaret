import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SECTION_BY_TYPE, type SectionSettings } from "@/lib/theme-sections";
import { TEMPLATE_BY_CODE, THEME_TEMPLATES } from "@/lib/theme-templates";

/**
 * Tema mağazası şablonunu mağazaya uygular.
 * Tenant izolasyonu ve yetki RLS ile zorlanır (app_private.can_manage_store).
 */

const codes = THEME_TEMPLATES.map((template) => template.code) as [string, ...string[]];

export const applyThemeTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), code: z.enum(codes) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const template = TEMPLATE_BY_CODE.get(data.code);
    if (!template) throw new Error("Şablon bulunamadı.");
    const t = template.theme;

    const { error: themeError } = await context.supabase.from("store_themes").upsert(
      {
        store_id: data.storeId,
        preset: template.code,
        primary_color: t.primaryColor,
        accent_color: t.accentColor,
        background_color: t.backgroundColor,
        font_pair: t.fontPair,
        radius: t.radius,
        layout: t.layout,
        hero_title: t.heroTitle,
        hero_subtitle: t.heroSubtitle,
        hero_cta_label: t.heroCtaLabel,
        announcement: t.announcement || null,
        show_announcement: t.showAnnouncement,
        button_style: t.buttonStyle,
        card_style: t.cardStyle,
        content_width: t.contentWidth,
        section_spacing: t.sectionSpacing,
      },
      { onConflict: "store_id" },
    );
    if (themeError) throw new Error(themeError.message);

    const { error: deleteError } = await context.supabase
      .from("store_theme_sections")
      .delete()
      .eq("store_id", data.storeId);
    if (deleteError) throw new Error(deleteError.message);

    // Şablon uygulanırken mağazanın gerçek katalog / kargo / ödeme verisiyle doldurulur.
    const [collectionsRes, productsRes, zonesRes, paymentsRes] = await Promise.all([
      context.supabase
        .from("collections")
        .select("slug, title")
        .eq("store_id", data.storeId)
        .order("sort_order"),
      context.supabase
        .from("products")
        .select("product_type")
        .eq("store_id", data.storeId)
        .eq("status", "active")
        .limit(200),
      context.supabase
        .from("shipping_zones")
        .select("is_active, shipping_rates(free_over, eta_days, is_active)")
        .eq("store_id", data.storeId),
      context.supabase
        .from("store_payment_methods")
        .select("display_name, installments_enabled, is_active")
        .eq("store_id", data.storeId)
        .order("sort_order"),
    ]);

    const collectionSlugs = (collectionsRes.data ?? []).map((collection) => collection.slug);
    const productTypes = Array.from(
      new Set((productsRes.data ?? []).map((product) => product.product_type ?? "").filter(Boolean)),
    );
    const rates = (zonesRes.data ?? [])
      .filter((zone) => zone.is_active)
      .flatMap((zone) => (zone.shipping_rates ?? []).filter((rate) => rate.is_active));
    const freeOvers = rates
      .map((rate) => Number(rate.free_over))
      .filter((value) => Number.isFinite(value) && value > 0);
    const freeShippingThreshold = freeOvers.length ? Math.min(...freeOvers) : null;
    const hasPayments = (paymentsRes.data ?? []).some((method) => method.is_active);

    let collectionCursor = 0;
    let typeCursor = 0;

    const rows = template.sections.map((section, index) => {
      const definition = SECTION_BY_TYPE.get(section.type)!;
      const settings: SectionSettings = { ...definition.defaults };
      for (const [key, value] of Object.entries(section.settings ?? {})) {
        if (!(key in definition.defaults)) continue;
        const fallback = definition.defaults[key];
        if (typeof fallback === "number") settings[key] = Number.isFinite(Number(value)) ? Number(value) : fallback;
        else if (typeof fallback === "boolean") settings[key] = Boolean(value);
        else settings[key] = String(value ?? "");
      }

      // Koleksiyon referansları gerçek koleksiyon slug'larıyla doldurulur.
      if ("collectionSlug" in settings && !String(settings["collectionSlug"] ?? "").trim() && collectionSlugs.length) {
        settings["collectionSlug"] = collectionSlugs[collectionCursor % collectionSlugs.length]!;
        collectionCursor += 1;
      }
      // Ürün filtreleri gerçek ürün tiplerinden seçilir.
      if ("filter" in settings && !String(settings["filter"] ?? "").trim() && productTypes.length) {
        settings["filter"] = productTypes[typeCursor % productTypes.length]!;
        typeCursor += 1;
      }
      // Ücretsiz kargo eşiği gerçek kargo tarifelerinden gelir.
      if (section.type === "free_shipping_bar" && freeShippingThreshold !== null) {
        settings["threshold"] = freeShippingThreshold;
      }
      // Rozetler boş bırakılır; vitrin bunları gerçek ödeme/kargo verisinden üretir.
      if (section.type === "trust_badges" && hasPayments) {
        settings["items"] = "";
      }

      return {
        store_id: data.storeId,
        type: section.type,
        position: index,
        is_enabled: true,
        settings,
      };
    });

    const { error: insertError } = await context.supabase.from("store_theme_sections").insert(rows);
    if (insertError) throw new Error(insertError.message);

    // Vitrin önbelleğini temizle: yeni tema anında mağazada görünsün.
    const { invalidateStoreCache } = await import("@/lib/cache.server");
    await invalidateStoreCache(data.storeId);

    return { ok: true, sections: rows.length };
  });
