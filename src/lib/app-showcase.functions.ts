import { createServerFn } from "@tanstack/react-start";

/** Ana sayfadaki animasyonlu logo şeridi için herkese açık, salt-okunur uygulama kataloğu. */
export const getPublicAppShowcase = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("apps")
    .select("code, name, category, logo_url, logo_emoji")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return [];
  return (data ?? []).map((app) => ({
    code: app.code,
    name: app.name,
    category: app.category,
    logoUrl: app.logo_url,
    logoEmoji: app.logo_emoji,
  }));
});
