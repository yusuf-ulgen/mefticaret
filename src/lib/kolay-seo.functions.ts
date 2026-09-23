import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Kolay Panel: mağazanın Google başlığı/açıklaması (yalnız bu iki alan okunur). */
export const getKolayStoreSeo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("store_settings")
      .select("seo")
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const seo = (row?.seo ?? {}) as Record<string, unknown>;
    return {
      title: typeof seo["homeTitle"] === "string" ? (seo["homeTitle"] as string) : "",
      description: typeof seo["homeDescription"] === "string" ? (seo["homeDescription"] as string) : "",
      hidden: seo["noindexStore"] === true,
    };
  });

/** Başlık/açıklamayı mevcut SEO ayarlarını silmeden günceller ve mağazayı Google'a açar. */
export const saveKolayStoreSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        title: z.string().trim().max(70),
        description: z.string().trim().max(170),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: canManage } = await supabase.rpc("can_manage_store" as never, {
      _store_id: data.storeId,
      _user_id: context.userId,
    } as never);
    const { data: row, error } = await supabase
      .from("store_settings")
      .select("store_id, seo")
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row && canManage === false) throw new Error("Bu mağazayı düzenleme yetkiniz yok");
    const seo = { ...((row?.seo ?? {}) as Record<string, unknown>) };
    if (data.title) seo["homeTitle"] = data.title;
    else delete seo["homeTitle"];
    if (data.description) seo["homeDescription"] = data.description;
    else delete seo["homeDescription"];
    delete seo["noindexStore"];
    const { error: saveError } = await supabase
      .from("store_settings")
      .upsert({ store_id: data.storeId, seo: seo as never }, { onConflict: "store_id" });
    if (saveError) throw new Error(saveError.message);
    return { ok: true };
  });
