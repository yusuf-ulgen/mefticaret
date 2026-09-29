/** Kasada verilen politika onaylarını değişmez kanıt olarak kaydeder (yalnız sunucu). */

const CHECKOUT_KEYS = ["privacy", "distance_selling", "refund"];

export async function recordCheckoutAcceptances(input: {
  slug: string;
  orderNumber: string;
  email: string;
  userId?: string | null;
  request?: Request | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as { from: (t: string) => any };
  const { data: store } = await db.from("stores").select("id").eq("slug", input.slug).maybeSingle();
  if (!store) return 0;
  const { data: policies } = await db
    .from("policies")
    .select("id, version, current_version_id, acceptance_count")
    .eq("store_id", store.id)
    .in("policy_key", CHECKOUT_KEYS)
    .not("current_version_id", "is", null);
  const list = (policies ?? []) as Array<{ id: string; version: string; current_version_id: string; acceptance_count: number }>;
  if (!list.length) return 0;
  const req = input.request;
  const ip =
    req?.headers.get("cf-connecting-ip") ?? req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req?.headers.get("user-agent")?.slice(0, 500) ?? null;
  const { error } = await db.from("policy_acceptances").insert(
    list.map((p) => ({
      policy_id: p.id,
      policy_version_id: p.current_version_id,
      store_id: store.id,
      version_label: p.version,
      user_type: "customer",
      user_id: input.userId ?? null,
      subject_email: input.email.trim().toLowerCase(),
      order_number: input.orderNumber,
      ip_address: ip,
      user_agent: ua,
      acceptance_method: "checkout",
    })),
  );
  if (error) throw new Error(error.message);
  for (const p of list) await db.from("policies").update({ acceptance_count: p.acceptance_count + 1 }).eq("id", p.id);
  return list.length;
}
