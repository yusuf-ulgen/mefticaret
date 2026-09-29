/** Medya v2 kota/paket yardımcıları (yalnız sunucu). */
type Db = { from: (t: string) => any };

function today() {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
}

/** Paket bayrağı + günlük kota (MB; null = sınırsız). Yetki RLS + can_manage_store ile. */
export async function mediaEntitlement(supabase: unknown, storeId: string) {
  const { loadEntitlements } = await import("@/lib/entitlements.server");
  const ent = await loadEntitlements(supabase as never, storeId);
  const limitMb = ent.limits["media_daily_upload_mb"];
  return {
    enabled: ent.modules["v2_media_system"] === true,
    limitBytes: limitMb === undefined || limitMb === null ? null : Number(limitMb) * 1024 * 1024,
  };
}


export async function usedToday(storeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as Db;
  const { data } = await db
    .from("media_upload_usage")
    .select("bytes_uploaded")
    .eq("store_id", storeId)
    .eq("usage_date", today())
    .maybeSingle();
  return Number(data?.bytes_uploaded ?? 0);
}

/** Kaydı yapılan yüklemeyi günlük sayaca işler; kota aşılırsa hata verir. */
export async function consumeMediaQuota(storeId: string, bytes: number, limitBytes: number | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as Db;
  const used = await usedToday(storeId);
  if (limitBytes !== null && used + bytes > limitBytes) {
    throw new Error(
      `Günlük yükleme kotası doldu (${Math.round(limitBytes / 1048576)} MB). Yarın tekrar deneyin veya paketinizi yükseltin.`,
    );
  }
  const { data: row } = await db
    .from("media_upload_usage")
    .select("files_uploaded")
    .eq("store_id", storeId)
    .eq("usage_date", today())
    .maybeSingle();
  const { error } = await db.from("media_upload_usage").upsert(
    {
      store_id: storeId,
      usage_date: today(),
      bytes_uploaded: used + bytes,
      files_uploaded: Number(row?.files_uploaded ?? 0) + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "store_id,usage_date" },
  );
  if (error) throw new Error(error.message);
}

