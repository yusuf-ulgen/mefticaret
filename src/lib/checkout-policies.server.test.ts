import { expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { checkoutPolicies } from "./checkout-policies.server";

type Row = Record<string, unknown>;
function database(change: (policies: Row[], versions: Row[]) => void = () => {}) {
  const policies = ["privacy", "refund", "distance_selling"].map((key) => ({
    id: key,
    policy_key: key,
    store_id: "store-a",
    current_version_id: `${key}-v1`,
    is_visible: true,
  }));
  const versions = policies.map((policy) => ({
    id: policy.current_version_id,
    policy_id: policy.id,
    store_id: "store-a",
    content: "Reviewed text",
    version: "1.0",
    title: policy.policy_key,
    is_active: true,
    published_at: "2026-01-01",
    effective_date: "2026-01-01",
  }));
  change(policies, versions);
  return {
    from: (table: string) => {
      let data: Row[] = table === "policies" ? policies : versions;
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          data = data.filter((row) => row[key] === value);
          return query;
        },
        in: (key: string, values: unknown[]) => {
          data = data.filter((row) => values.includes(row[key]));
          return query;
        },
        not: (key: string) => {
          data = data.filter((row) => row[key] != null);
          return query;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data, error: null }).then(resolve),
      };
      return query;
    },
  } as unknown as SupabaseClient<Database>;
}
it("F03/F11: all three published store versions allow checkout", async () => {
  const result = await checkoutPolicies(database(), "store-a");
  expect(result.ready).toBe(true);
  expect(result.versions).toHaveLength(3);
  expect(result.missing).toEqual([]);
});
it.each(["draft", "hidden", "inactive", "future", "empty", "other-store", "wrong-policy"])(
  "F03/F11: %s policy cannot be accepted",
  async (scenario) => {
    const db = database((policies, versions) => {
      const policy = policies[0]!;
      const version = versions[0]!;
      if (scenario === "draft") version["published_at"] = null;
      if (scenario === "hidden") policy["is_visible"] = false;
      if (scenario === "inactive") version["is_active"] = false;
      if (scenario === "future") version["effective_date"] = "2099-01-01";
      if (scenario === "empty") version["content"] = " ";
      if (scenario === "other-store") version["store_id"] = "store-b";
      if (scenario === "wrong-policy") version["policy_id"] = "refund";
    });
    expect(await checkoutPolicies(db, "store-a")).toMatchObject({
      ready: false,
      missing: ["privacy"],
    });
  },
);
