import { createServerFn } from "@tanstack/react-start";

/**
 * Tanıtım sayfaları için herkese açık mağaza vitrini listesi.
 * Yalnızca yayında olan mağazalar döner; anon politikalar geçerlidir.
 */
export const fetchShowcaseStores = createServerFn({ method: "GET" }).handler(async () => {
  const { publicSupabase } = await import("@/lib/public-supabase.server");
  const supabase = publicSupabase();
  const { data, error } = await supabase
    .from("stores")
    .select("slug, name, industry")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) return [];
  return (data ?? []).map((store) => ({
    slug: store.slug,
    name: store.name,
    industry: store.industry ?? "E-ticaret",
  }));
});
