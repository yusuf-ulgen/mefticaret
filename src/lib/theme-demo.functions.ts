import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Herkese açık tema demosu: yalnız yayınlanmış ve ücretsiz temaların yapısı döner. */
export const getThemeDemo = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().regex(/^[a-z0-9-]{1,60}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("v2_theme_templates").select("name, slug, description, price, structure_json").eq("slug", data.slug).eq("is_published", true).maybeSingle();
    if (!row || Number(row.price) > 0) return null;
    return { name: row.name as string, slug: row.slug as string, description: (row.description as string) ?? "", structure_json: JSON.stringify(row.structure_json ?? {}) };
  });
