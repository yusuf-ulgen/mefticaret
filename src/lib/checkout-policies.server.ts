import { CHECKOUT_POLICY_KEYS } from "@/lib/checkout-policies";
import { policySlug } from "@/lib/policy-content";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Yalnız mağazanın görünür, yürürlükte ve yayınlanmış sürümleri kabul için kullanılabilir. */
export async function checkoutPolicies(db: SupabaseClient<Database>, storeId: string) {
  const { data: policies, error } = await db
    .from("policies")
    .select("id, policy_key, current_version_id, is_visible")
    .eq("store_id", storeId)
    .in("policy_key", [...CHECKOUT_POLICY_KEYS])
    .eq("is_visible", true)
    .not("current_version_id", "is", null);
  if (error) throw new Error(error.message);
  const rows = (policies ?? []) as Array<{
    id: string;
    policy_key: string;
    current_version_id: string;
  }>;
  const { data: versions, error: versionError } = rows.length
    ? await db
        .from("policy_versions")
        .select("id, policy_id, version, title, content, effective_date, published_at")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .in(
          "id",
          rows.map((row) => row.current_version_id),
        )
    : { data: [], error: null };
  if (versionError) throw new Error(versionError.message);
  const today = new Date().toISOString().slice(0, 10);
  const available = rows.flatMap((row) => {
    const version = (versions ?? []).find(
      (v) =>
        v.id === row.current_version_id &&
        v.policy_id === row.id &&
        v.published_at &&
        v.content?.trim() &&
        (!v.effective_date || v.effective_date <= today),
    );
    return version
      ? [
          {
            key: row.policy_key,
            policyId: row.id,
            versionId: String(version.id),
            version: String(version.version),
            title: String(version.title),
            slug: policySlug("store", row.policy_key),
          },
        ]
      : [];
  });
  const missing = CHECKOUT_POLICY_KEYS.filter(
    (key) => !available.some((policy) => policy.key === key),
  );
  return { ready: missing.length === 0, missing, versions: available };
}
