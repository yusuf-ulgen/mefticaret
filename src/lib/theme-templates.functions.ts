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

    return { ok: true, sections: rows.length };
  });
