import { expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { assertStoreManager } from "./store-access.server";

function client(role: string | null, platformAdmin = false) {
  return { from(table: string) {
    const filters = new Map<string, unknown>();
    const q = { select: () => q, eq: (key: string, value: unknown) => { filters.set(key, value); return q; }, maybeSingle: async () => ({ data: table === "stores" ? filters.get("id") === "store-a" ? { id: "store-a", owner_id: "owner-a" } : null : table === "store_users" ? filters.get("store_id") === "store-a" && filters.get("user_id") === "member-a" && role ? { role } : null : platformAdmin && filters.get("user_id") === "platform-a" ? { role: "platform_admin" } : null, error: null }) };
    return q;
  } } as unknown as SupabaseClient<Database>;
}
it("allows store owners/admins and denies staff, suppliers and other-store identities", async () => {
  await expect(assertStoreManager(client(null), "store-a", "owner-a")).resolves.toBeUndefined();
  await expect(assertStoreManager(client("admin"), "store-a", "member-a")).resolves.toBeUndefined();
  for (const role of ["staff", "marketing", "support", null]) await expect(assertStoreManager(client(role), "store-a", "member-a")).rejects.toThrow("yöneticisi");
  await expect(assertStoreManager(client("admin"), "store-b", "member-a")).rejects.toThrow("yetkiniz");
  await expect(assertStoreManager(client("admin"), "store-a", "supplier-a")).rejects.toThrow("yöneticisi");
});
it("keeps the explicit platform admin exception on the server", async () => {
  await expect(assertStoreManager(client(null, true), "store-a", "platform-a")).resolves.toBeUndefined();
});
