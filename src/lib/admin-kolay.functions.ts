import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { insertAuditRow } from "./audit.server";

/**
 * Süper yönetici için Kolay Panel (ev üreticisi / micro) mağazalarının
 * merkezi denetimi. Kolay Panel kurumsal paketlerden bağımsızdır; bu yüzden
 * kurumsal mağaza listeleri micro mağazaları göstermez. Bu dosya yalnızca
 * platform yöneticisi doğrulandıktan sonra service-role bağlantısıyla okuma
 * ve durum yönetimi yapar.
 */

type Supa = SupabaseClient<Database>;

async function assertPlatformAdmin(supabase: Supa, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "platform_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Bu işlem yalnızca platform yöneticileri içindir");
}

const STATUSES = ["draft", "active", "suspended", "archived"] as const;
/** Ciroya sayılmayan sipariş durumları; panel ile aynı kural. */
const EXCLUDED_ORDER_STATUSES = new Set(["cancelled", "failed", "abandoned", "refunded"]);

export type MicroStoreRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  category: string | null;
  createdAt: string;
  publishedAt: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  productCount: number;
  orderCount: number;
  revenue: number;
  lastOrderAt: string | null;
};

export const listMicroStores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ stores: MicroStoreRow[] }> => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: stores, error } = await supabaseAdmin
      .from("stores")
      .select("id, name, slug, status, industry, owner_id, created_at, published_at")
      .eq("store_kind", "micro")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const rows = stores ?? [];
    const storeIds = rows.map((row) => row.id);
    const ownerIds = [...new Set(rows.map((row) => row.owner_id).filter((id): id is string => Boolean(id)))];

    const [profilesRes, makerRes, productsRes, ordersRes] = await Promise.all([
      ownerIds.length
        ? supabaseAdmin.from("profiles").select("id, full_name, email, phone").in("id", ownerIds)
        : Promise.resolve({ data: [], error: null } as const),
      storeIds.length
        ? supabaseAdmin.from("home_maker_profiles").select("store_id, category, full_name").in("store_id", storeIds)
        : Promise.resolve({ data: [], error: null } as const),
      storeIds.length
        ? supabaseAdmin.from("products").select("store_id").in("store_id", storeIds).limit(20000)
        : Promise.resolve({ data: [], error: null } as const),
      storeIds.length
        ? supabaseAdmin
            .from("orders")
            .select("store_id, status, grand_total, placed_at, created_at")
            .in("store_id", storeIds)
            .limit(20000)
        : Promise.resolve({ data: [], error: null } as const),
    ]);

    const profiles = new Map(
      ((profilesRes.data ?? []) as { id: string; full_name: string | null; email: string | null; phone: string | null }[]).map(
        (row) => [row.id, row],
      ),
    );
    const makers = new Map(
      ((makerRes.data ?? []) as { store_id: string | null; category: string | null; full_name: string | null }[])
        .filter((row) => row.store_id)
        .map((row) => [row.store_id as string, row]),
    );

    const productCounts = new Map<string, number>();
    for (const row of (productsRes.data ?? []) as { store_id: string }[]) {
      productCounts.set(row.store_id, (productCounts.get(row.store_id) ?? 0) + 1);
    }

    const orderStats = new Map<string, { count: number; revenue: number; last: string | null }>();
    for (const row of (ordersRes.data ?? []) as {
      store_id: string;
      status: string | null;
      grand_total: number | string | null;
      placed_at: string | null;
      created_at: string | null;
    }[]) {
      const current = orderStats.get(row.store_id) ?? { count: 0, revenue: 0, last: null };
      const at = row.placed_at ?? row.created_at;
      current.count += 1;
      if (!EXCLUDED_ORDER_STATUSES.has(row.status ?? "")) {
        current.revenue += Number(row.grand_total ?? 0);
      }
      if (at && (!current.last || at > current.last)) current.last = at;
      orderStats.set(row.store_id, current);
    }

    return {
      stores: rows.map((store) => {
        const owner = store.owner_id ? profiles.get(store.owner_id) : undefined;
        const maker = makers.get(store.id);
        const stats = orderStats.get(store.id);
        return {
          id: store.id,
          name: store.name,
          slug: store.slug,
          status: store.status,
          category: maker?.category ?? store.industry ?? null,
          createdAt: store.created_at,
          publishedAt: store.published_at,
          ownerId: store.owner_id,
          ownerName: maker?.full_name ?? owner?.full_name ?? null,
          ownerEmail: owner?.email ?? null,
          ownerPhone: owner?.phone ?? null,
          productCount: productCounts.get(store.id) ?? 0,
          orderCount: stats?.count ?? 0,
          revenue: stats?.revenue ?? 0,
          lastOrderAt: stats?.last ?? null,
        };
      }),
    };
  });

export const setMicroStoreStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), status: z.enum(STATUSES) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: store, error: readError } = await supabaseAdmin
      .from("stores")
      .select("id, status, store_kind")
      .eq("id", data.storeId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!store) throw new Error("Mağaza bulunamadı");
    if (store.store_kind !== "micro") throw new Error("Bu işlem yalnızca Kolay Panel mağazaları içindir");

    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "active") patch["published_at"] = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("stores")
      .update(patch as never)
      .eq("id", data.storeId);
    if (error) throw new Error(error.message);

    await insertAuditRow(context.supabase, {
      store_id: data.storeId,
      actor_id: context.userId,
      action: "platform.micro_store_status_changed",
      entity: "stores",
      entity_id: data.storeId,
      old_value: { status: store.status } as never,
      new_value: { status: data.status } as never,
    });

    return { ok: true as const };
  });

/* ------------------- Tedarikçi ürün aktarım kotası ------------------- */

export const getKolaySupplierQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readKolayQuotaSetting } = await import("./supplier-catalog.server");
    const db = supabaseAdmin as never as { from: (t: string) => any };
    const setting = await readKolayQuotaSetting(db);
    const { data: micro } = await supabaseAdmin.from("stores").select("id").eq("store_kind", "micro").limit(500);
    const ids = (micro ?? []).map((s) => s.id);
    const used: Record<string, number> = {};
    if (ids.length) {
      const { data: rows } = await db.from("store_supplier_imports").select("store_id").in("store_id", ids).limit(50000);
      for (const r of (rows ?? []) as { store_id: string }[]) used[r.store_id] = (used[r.store_id] ?? 0) + 1;
    }
    return { default: setting.default, stores: setting.stores, used };
  });

export const saveKolaySupplierQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        defaultLimit: z.number().int().min(0).max(100000).optional(),
        storeId: z.guid().optional(),
        storeLimit: z.number().int().min(0).max(100000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readKolayQuotaSetting, KOLAY_QUOTA_KEY } = await import("./supplier-catalog.server");
    const db = supabaseAdmin as never as { from: (t: string) => any };
    const setting = await readKolayQuotaSetting(db);
    if (data.defaultLimit !== undefined) setting.default = data.defaultLimit;
    if (data.storeId) {
      if (data.storeLimit == null) delete setting.stores[data.storeId];
      else setting.stores[data.storeId] = data.storeLimit;
    }
    const { error } = await db.from("platform_settings").upsert(
      {
        key: KOLAY_QUOTA_KEY,
        value: setting,
        label: "Kolay Panel tedarikçi ürün kotası",
        description: "Kolay Panel mağazalarının tedarikçi kataloğundan aktarabileceği en fazla ürün sayısı.",
        is_public: false,
        updated_by: context.userId,
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    await insertAuditRow(context.supabase, {
      store_id: data.storeId ?? null,
      actor_id: context.userId,
      action: "platform.kolay_supplier_quota_changed",
      entity: "platform_settings",
      entity_id: null,
      new_value: data as never,
    } as never);
    return { ok: true as const };
  });
