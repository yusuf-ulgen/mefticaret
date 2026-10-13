import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Panel seçimi yalnız oturum sahibinin rol ve mağaza üyeliklerinden çıkarılır. */
export const getPanelDestinations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: memberships, error: memberError }, { data: role, error: roleError }] =
      await Promise.all([
        supabase.from("store_users").select("store_id").eq("user_id", userId),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "home_maker")
          .maybeSingle(),
      ]);
    if (memberError || roleError) throw new Error((memberError ?? roleError)!.message);
    const ids = (memberships ?? []).map((row) => row.store_id);
    const { data: stores, error } = await supabase
      .from("stores")
      .select("id, name, store_kind")
      .or(`owner_id.eq.${userId}${ids.length ? `,id.in.(${ids.join(",")})` : ""}`)
      .order("created_at");
    if (error) throw new Error(error.message);
    const choices: Array<{ label: string; path: string }> = [];
    if ((stores ?? []).some((store) => store.store_kind === "corporate"))
      choices.push({ label: "Kurumsal mağazalarım", path: "/stores" });
    if (role)
      for (const store of stores ?? []) {
        if (store.store_kind === "micro")
          choices.push({ label: `${store.name} · Kolay Panel`, path: `/store/${store.id}/kolay` });
      }
    return choices.length ? choices : [{ label: "Mağazalarım", path: "/stores" }];
  });
