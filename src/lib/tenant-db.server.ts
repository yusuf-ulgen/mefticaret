/**
 * Tenant veritabanı çözücü (abstraction).
 *
 * Bugün tüm mağazalar paylaşımlı veritabanı + `store_id` + RLS modelinde
 * çalışır ve bu davranış hiç değişmez. Bu katman yalnızca ileride Enterprise
 * mağazaları ayrı (dedicated) bir veritabanına taşımayı mümkün kılmak için
 * tek bir giriş noktası sağlar; mevcut sorgular yeniden yazılmadan bu
 * çözücüye kademeli olarak taşınabilir.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type TenantPlacement = "shared" | "dedicated";

export type TenantConnection = {
  storeId: string;
  placement: TenantPlacement;
  /** Servis rolü istemcisi — çağrı öncesi yetkilendirme yapılmış olmalıdır. */
  client: SupabaseClient<Database>;
};

/**
 * Mağazanın hangi altyapıda çalıştığını çözer.
 * Şu an tüm mağazalar paylaşımlı altyapıdadır.
 */
export async function resolveTenantPlacement(_storeId: string): Promise<TenantPlacement> {
  return "shared";
}

/**
 * Mağaza için veritabanı bağlantısını döner.
 *
 * ÖNEMLİ: Bu fonksiyon yetkilendirme yapmaz. Çağırmadan önce mutlaka
 * `requireStoreMember` / `requireStorePermission` veya `requirePlatformAdmin`
 * ile yetki doğrulanmalı ve tüm sorgular `store_id` ile sınırlandırılmalıdır.
 */
export async function resolveTenantDatabase(storeId: string): Promise<TenantConnection> {
  const placement = await resolveTenantPlacement(storeId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { storeId, placement, client: supabaseAdmin as unknown as SupabaseClient<Database> };
}
