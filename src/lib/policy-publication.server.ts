import { nextVersion } from "@/lib/policy-content";
import { readAllPages } from "@/lib/read-all-pages";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type DbError = { message: string; code?: string };
type Db = SupabaseClient<Database>;
type Policy = { id: string; store_id: string | null; title: string; updated_at: string };
type Publication = {
  content: string;
  bump: "minor" | "major";
  effectiveDate: string;
  changeSummary: string;
  requiresAcceptance: boolean;
};

/** Called only after the existing policy server function checks manager access and placeholders. */
export async function publishPolicyVersion(
  db: Db,
  policy: Policy,
  input: Publication,
  actorId: string,
) {
  if (!input.content.replace(/<[^>]*>/g, "").trim()) throw new Error("Politika metni eksik");
  const rpc = db as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: DbError | null }>;
  };
  const result = await rpc.rpc("publish_policy_version", {
    p_policy_id: policy.id,
    p_store_id: policy.store_id,
    p_content: input.content,
    p_bump: input.bump,
    p_effective_date: input.effectiveDate,
    p_change_summary: input.changeSummary,
    p_requires_acceptance: input.requiresAcceptance,
    p_expected_updated_at: policy.updated_at,
  });
  if (!result.error) return result.data as { version: string };
  // A Git-only release may precede its database migration. Never retry an unknown RPC outcome.
  if (result.error.code !== "PGRST202" || !result.error.message.includes("publish_policy_version"))
    throw new Error(result.error.message);

  const history = await readAllPages<{ version: string }>((from, to) =>
    db
      .from("policy_versions")
      .select("version")
      .eq("policy_id", policy.id)
      .order("id")
      .range(from, to),
  );
  const latest = (history.data ?? [])
    .map((row) => row.version)
    .filter((value) => /^\d+\.\d+$/.test(value))
    .sort(
      (a, b) =>
        Number(b.split(".")[0]) - Number(a.split(".")[0]) ||
        Number(b.split(".")[1]) - Number(a.split(".")[1]),
    )[0];
  const version = nextVersion(latest ?? null, input.bump);
  const now = new Date().toISOString();
  const { data: created, error: insertError } = await db
    .from("policy_versions")
    .insert({
      policy_id: policy.id,
      store_id: policy.store_id,
      version,
      title: policy.title,
      content: input.content,
      effective_date: input.effectiveDate,
      change_summary: input.changeSummary,
      requires_acceptance: input.requiresAcceptance,
      created_by: actorId,
      published_at: now,
      is_active: false,
    })
    .select("id")
    .single();
  if (insertError || !created)
    throw new Error(insertError?.message ?? "Politika sürümü oluşturulamadı");

  // Keep the old public version valid until a ready replacement is pointed to atomically.
  const { error: activateError } = await db
    .from("policy_versions")
    .update({ is_active: true })
    .eq("id", created.id);
  if (activateError) throw new Error(activateError.message);
  const { data: published, error: pointerError } = await db
    .from("policies")
    .update({
      current_version_id: created.id,
      version,
      effective_date: input.effectiveDate,
      change_summary: input.changeSummary,
      requires_acceptance: input.requiresAcceptance,
      last_reviewed_at: now,
      last_reviewed_by: actorId,
      is_visible: true,
    })
    .eq("id", policy.id)
    .eq("updated_at", policy.updated_at)
    .select("id")
    .maybeSingle();
  if (pointerError || !published) {
    const { error: rollbackError } = await db
      .from("policy_versions")
      .update({ is_active: false })
      .eq("id", created.id);
    if (rollbackError)
      throw new Error("Yayın tamamlanamadı. Belge durumunu kontrol edip tekrar deneyin.");
    throw new Error(
      pointerError?.message ?? "Taslak değişti. Sayfayı yenileyip tekrar yayınlayın.",
    );
  }
  const { error: cleanupError } = await db
    .from("policy_versions")
    .update({ is_active: false })
    .eq("policy_id", policy.id)
    .neq("id", created.id);
  if (cleanupError)
    throw new Error(
      "Belge yayınlandı ancak sürüm geçmişi güncellenemedi. Lütfen sayfayı yenileyin.",
    );
  return { version };
}
