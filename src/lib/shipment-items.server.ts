import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { physicalShipmentItems } from "./shipment-items";

export async function loadPhysicalShipmentItems(
  db: SupabaseClient<Database>,
  orderId: string,
  storeId: string,
  requested: Array<{ orderItemId: string; quantity: number }> = [],
) {
  const { data, error } = await db
    .from("order_items")
    .select("id, title, quantity, is_digital")
    .eq("order_id", orderId)
    .eq("store_id", storeId);
  if (error) throw new Error(error.message);
  const items = data ?? [];
  return {
    lines: physicalShipmentItems(items, requested),
    items: items.filter((item) => !item.is_digital),
    hasDigital: items.some((item) => item.is_digital),
  };
}
