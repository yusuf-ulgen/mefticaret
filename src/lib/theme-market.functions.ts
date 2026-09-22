/**
 * Tema mağazası: katalog, mağazaya kurulu temalar, aktifleştirme ve
 * ücretli tema lisansı satın alma. Fiyat ve lisans durumu yalnızca sunucuda
 * doğrulanır; ücretli tema ödeme onaylanmadan kurulamaz.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ThemeRow = {
  id: string;
  slug: string;
  name: string;
  version: string;
  author: string;
  preview_image: string | null;
  description: string;
  tagline: string;
  features: unknown;
  template_code: string;
  price: number | string;
  currency: string;
  price_note: string;
  is_featured: boolean;
  sort_order: number;
};

const CATALOG_COLUMNS =
  "id, slug, name, version, author, preview_image, description, tagline, features, template_code, price, currency, price_note, is_featured, sort_order";

/** Katalog + mağazanın kurulu temaları + lisans durumu. */
export const listThemeMarket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);

    const [catalogRes, installedRes, purchasesRes] = await Promise.all([
      context.supabase
        .from("themes")
        .select(CATALOG_COLUMNS)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      context.supabase
        .from("store_installed_themes")
        .select("id, theme_id, is_active, installed_at, activated_at")
        .eq("store_id", data.storeId),
      context.supabase
        .from("store_theme_purchases")
        .select("theme_id, status, amount, currency, paid_at")
        .eq("store_id", data.storeId),
    ]);
    if (catalogRes.error) throw new Error(catalogRes.error.message);
    if (installedRes.error) throw new Error(installedRes.error.message);

    const installs = new Map(
      ((installedRes.data ?? []) as Array<{
        id: string;
        theme_id: string;
        is_active: boolean;
        installed_at: string;
        activated_at: string | null;
      }>).map((row) => [row.theme_id, row]),
    );
    const purchases = (purchasesRes.data ?? []) as Array<{
      theme_id: string;
      status: string;
      amount: number | string;
      currency: string;
      paid_at: string | null;
    }>;
    const paidThemes = new Set(purchases.filter((row) => row.status === "paid").map((row) => row.theme_id));
    const pendingThemes = new Set(
      purchases.filter((row) => row.status === "pending").map((row) => row.theme_id),
    );

    return {
      themes: ((catalogRes.data ?? []) as unknown as ThemeRow[]).map((theme) => {
        const install = installs.get(theme.id) ?? null;
        const price = Number(theme.price);
        return {
          id: theme.id,
          slug: theme.slug,
          name: theme.name,
          version: theme.version,
          author: theme.author,
          previewImage: theme.preview_image,
          description: theme.description,
          tagline: theme.tagline,
          features: Array.isArray(theme.features) ? (theme.features as string[]) : [],
          templateCode: theme.template_code,
          price,
          currency: theme.currency,
          priceNote: theme.price_note,
          isFeatured: theme.is_featured,
          installId: install?.id ?? null,
          isInstalled: Boolean(install),
          isActive: install?.is_active ?? false,
          installedAt: install?.installed_at ?? null,
          /* Ücretsiz temaların lisansı zaten vardır. */
          hasLicense: price <= 0 || paidThemes.has(theme.id),
          purchasePending: pendingThemes.has(theme.id),
        };
      }),
    };
  });

/** Temayı mağazaya kurar. Ücretli temalarda ödenmiş lisans zorunludur. */
export const installTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), themeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);

    const { data: theme, error } = await context.supabase
      .from("themes")
      .select("id, name, price, is_active")
      .eq("id", data.themeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!theme || !theme.is_active) throw new Error("Tema bulunamadı");

    if (Number(theme.price) > 0) {
      const { data: paid } = await context.supabase
        .from("store_theme_purchases")
        .select("id")
        .eq("store_id", data.storeId)
        .eq("theme_id", data.themeId)
        .eq("status", "paid")
        .limit(1);
      if (!paid?.length) throw new Error("Bu tema ücretli — kurmak için önce lisansı satın alın.");
    }

    const { data: row, error: insertError } = await context.supabase
      .from("store_installed_themes")
      .upsert(
        {
          store_id: data.storeId,
          theme_id: data.themeId,
          installed_by: context.userId,
        },
        { onConflict: "store_id,theme_id" },
      )
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);

    return { installId: (row as { id: string }).id, message: "Tema kuruldu" };
  });

/** Kurulu temayı kaldırır. Aktif tema kaldırılamaz. */
export const uninstallTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), installId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);

    const { data: install, error } = await context.supabase
      .from("store_installed_themes")
      .select("id, is_active")
      .eq("id", data.installId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!install) throw new Error("Kurulu tema bulunamadı");
    if (install.is_active) throw new Error("Aktif tema kaldırılamaz — önce başka bir temayı aktifleştirin.");

    const { error: deleteError } = await context.supabase
      .from("store_installed_themes")
      .delete()
      .eq("id", data.installId)
      .eq("store_id", data.storeId);
    if (deleteError) throw new Error(deleteError.message);

    return { message: "Tema kaldırıldı" };
  });

/** Kurulu temayı aktifleştirir: diğerleri pasife düşer ve şablon mağazaya uygulanır. */
export const activateTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), installId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);

    const { data: install, error } = await context.supabase
      .from("store_installed_themes")
      .select("id, theme_id, themes(template_code, name, price)")
      .eq("id", data.installId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = install as unknown as {
      id: string;
      theme_id: string;
      themes: { template_code: string; name: string; price: number | string } | null;
    } | null;
    if (!row?.themes) throw new Error("Kurulu tema bulunamadı");

    /* Ücretli temanın lisansı aktifleştirme sırasında da doğrulanır. */
    if (Number(row.themes.price) > 0) {
      const { data: paid } = await context.supabase
        .from("store_theme_purchases")
        .select("id")
        .eq("store_id", data.storeId)
        .eq("theme_id", row.theme_id)
        .eq("status", "paid")
        .limit(1);
      if (!paid?.length) throw new Error("Bu temanın lisansı yok — önce satın alın.");
    }

    /* Önce hepsi pasife düşer (tek aktif tema kuralı), sonra bu satır aktif olur. */
    const { error: resetError } = await context.supabase
      .from("store_installed_themes")
      .update({ is_active: false })
      .eq("store_id", data.storeId)
      .neq("id", data.installId);
    if (resetError) throw new Error(resetError.message);

    const { error: activateError } = await context.supabase
      .from("store_installed_themes")
      .update({ is_active: true, activated_at: new Date().toISOString() })
      .eq("id", data.installId)
      .eq("store_id", data.storeId);
    if (activateError) throw new Error(activateError.message);

    const { applyTemplateToStore } = await import("@/lib/theme-templates.server");
    const applied = await applyTemplateToStore(context.supabase, data.storeId, row.themes.template_code);

    return { message: "Tema aktifleştirildi", themeName: row.themes.name, sections: applied.sections };
  });

/** Ücretli tema lisansı için ödeme bağlantısı üretir. */
export const startThemePurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), themeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { startThemeLicenseCheckout } = await import("@/lib/theme-market.server");
    return await startThemeLicenseCheckout(context.supabase, data, context.userId);
  });
