import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Tema uygulama katmanı. Tenant izolasyonu ve yetki RLS ile zorlanır
 * (app_private.can_manage_store).
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Geçerli bir renk kodu gir");

export const saveTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        preset: z.string().trim().min(2).max(40),
        primaryColor: hex,
        accentColor: hex,
        backgroundColor: hex,
        fontPair: z.string().trim().min(2).max(40),
        radius: z.number().min(0).max(2),
        layout: z.string().trim().min(2).max(40),
        heroTitle: z.string().trim().min(2).max(120),
        heroSubtitle: z.string().trim().max(240),
        heroCtaLabel: z.string().trim().min(2).max(40),
        announcement: z.string().trim().max(160).nullish(),
        showAnnouncement: z.boolean(),
        logoUrl: z.string().trim().max(200000).nullish(),
        buttonStyle: z.enum(["solid", "outline", "pill", "ghost", "square"]).default("solid"),
        cardStyle: z.enum(["soft", "bordered", "flat", "shadow"]).default("soft"),
        contentWidth: z.number().int().min(900).max(1600).default(1140),
        sectionSpacing: z.number().int().min(0).max(160).default(48),
        isPublished: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const row = {
      store_id: data.storeId,
      preset: data.preset,
      primary_color: data.primaryColor,
      accent_color: data.accentColor,
      background_color: data.backgroundColor,
      font_pair: data.fontPair,
      radius: data.radius,
      layout: data.layout,
      hero_title: data.heroTitle,
      hero_subtitle: data.heroSubtitle,
      hero_cta_label: data.heroCtaLabel,
      announcement: data.announcement || null,
      show_announcement: data.showAnnouncement,
      logo_url: data.logoUrl || null,
      button_style: data.buttonStyle,
      card_style: data.cardStyle,
      content_width: data.contentWidth,
      section_spacing: data.sectionSpacing,
      is_published: data.isPublished,
      published_at: data.isPublished ? new Date().toISOString() : null,
    };

    const { error } = await context.supabase
      .from("store_themes")
      .upsert(row, { onConflict: "store_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
