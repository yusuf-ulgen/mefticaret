import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireHomeMaker } from "@/lib/home-maker-guard";

export const getStoreReadiness = createServerFn({ method: "GET" })
  .middleware([requireHomeMaker])
  .inputValidator((input) => z.object({ storeId: z.guid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const store = await supabase.from("stores").select("id").eq("id", data.storeId).maybeSingle();
    if (store.error) throw new Error(store.error.message);
    if (!store.data) throw new Error("Mağazaya erişiminiz yok");
    const { checkoutPolicies } = await import("@/lib/checkout-policies.server");
    const [policies, products] = await Promise.all([
      checkoutPolicies(supabase, data.storeId),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", data.storeId)
        .eq("status", "active"),
    ]);
    if (products.error) throw new Error(products.error.message);
    return { policies, publishedProducts: products.count ?? 0 };
  });
