/**
 * Abonelik ticareti + mağaza cüzdanı — sunucu katmanı (gerçek veritabanı işlemleri).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { nextOrderDate, walletBalance, walletDelta, type WalletTxKind } from "@/lib/retention";

type Client = SupabaseClient<Database>;
type Any = any;

/* ------------------------------ abonelikler ------------------------------- */

export async function listSubscriptionPlans(client: Client, storeId: string) {
  const db = client as unknown as Any;
  const [plans, products, subs] = await Promise.all([
    db
      .from("product_subscription_plans")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("products").select("id, title, base_price").eq("store_id", storeId).order("title").limit(300),
    db
      .from("customer_subscriptions")
      .select("id, plan_id, customer_id, quantity, status, next_order_at, last_order_at, cycles_completed, note, customers(full_name, email)")
      .eq("store_id", storeId)
      .order("next_order_at", { ascending: true })
      .limit(300),
  ]);
  if (plans.error) throw new Error(plans.error.message);

  return {
    plans: (plans.data ?? []).map((row: Any) => ({
      id: row.id as string,
      productId: (row.product_id ?? null) as string | null,
      name: row.name as string,
      intervalDays: Number(row.interval_days ?? 30),
      discountPercent: Number(row.discount_percent ?? 0),
      minCycles: Number(row.min_cycles ?? 1),
      isActive: Boolean(row.is_active),
    })),
    products: (products.data ?? []).map((row: Any) => ({
      id: row.id as string,
      title: row.title as string,
      basePrice: Number(row.base_price ?? 0),
    })),
    subscriptions: (subs.data ?? []).map((row: Any) => ({
      id: row.id as string,
      planId: row.plan_id as string,
      customerId: row.customer_id as string,
      customerName: (row.customers?.full_name ?? row.customers?.email ?? "Müşteri") as string,
      quantity: Number(row.quantity ?? 1),
      status: row.status as string,
      nextOrderAt: row.next_order_at as string,
      lastOrderAt: (row.last_order_at ?? null) as string | null,
      cyclesCompleted: Number(row.cycles_completed ?? 0),
      note: (row.note ?? null) as string | null,
    })),
  };
}

export type SubscriptionPlanInput = {
  id?: string | null | undefined;
  productId?: string | null | undefined;
  name: string;
  intervalDays: number;
  discountPercent: number;
  minCycles: number;
  isActive: boolean;
};

export async function saveSubscriptionPlan(args: { client: Client; storeId: string; input: SubscriptionPlanInput }) {
  const db = args.client as unknown as Any;
  const payload = {
    store_id: args.storeId,
    product_id: args.input.productId ?? null,
    name: args.input.name,
    interval_days: args.input.intervalDays,
    discount_percent: args.input.discountPercent,
    min_cycles: args.input.minCycles,
    is_active: args.input.isActive,
  };
  const query = args.input.id
    ? db.from("product_subscription_plans").update(payload).eq("id", args.input.id).eq("store_id", args.storeId)
    : db.from("product_subscription_plans").insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function deleteSubscriptionPlan(args: { client: Client; storeId: string; id: string }) {
  const db = args.client as unknown as Any;
  const { error } = await db
    .from("product_subscription_plans")
    .delete()
    .eq("id", args.id)
    .eq("store_id", args.storeId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/** Müşteriyi bir plana abone eder; ilk gönderim tarihi bugünden itibaren hesaplanır. */
export async function enrollCustomerSubscription(args: {
  client: Client;
  storeId: string;
  input: { customerId: string; planId: string; quantity: number; note?: string | undefined };
}) {
  const db = args.client as unknown as Any;
  const plan = await db
    .from("product_subscription_plans")
    .select("interval_days")
    .eq("id", args.input.planId)
    .eq("store_id", args.storeId)
    .maybeSingle();
  if (plan.error) throw new Error(plan.error.message);
  if (!plan.data) throw new Error("Abonelik planı bulunamadı");

  const { error } = await db.from("customer_subscriptions").insert({
    store_id: args.storeId,
    customer_id: args.input.customerId,
    plan_id: args.input.planId,
    quantity: args.input.quantity,
    status: "active",
    next_order_at: nextOrderDate(new Date(), Number(plan.data.interval_days ?? 30)).toISOString(),
    note: args.input.note ?? null,
  });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/** Aboneliği duraklatır, yeniden başlatır veya iptal eder. */
export async function setSubscriptionStatus(args: {
  client: Client;
  storeId: string;
  id: string;
  status: "active" | "paused" | "canceled";
}) {
  const db = args.client as unknown as Any;
  const { error } = await db
    .from("customer_subscriptions")
    .update({ status: args.status })
    .eq("id", args.id)
    .eq("store_id", args.storeId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/* -------------------------------- cüzdan ---------------------------------- */

export async function listWallets(client: Client, storeId: string) {
  const db = client as unknown as Any;
  const [wallets, customers] = await Promise.all([
    db
      .from("customer_wallets")
      .select("id, customer_id, balance, currency, updated_at, customers(full_name, email)")
      .eq("store_id", storeId)
      .order("updated_at", { ascending: false })
      .limit(200),
    db.from("customers").select("id, full_name, email").eq("store_id", storeId).order("created_at", { ascending: false }).limit(300),
  ]);
  if (wallets.error) throw new Error(wallets.error.message);

  const walletIds = (wallets.data ?? []).map((row: Any) => row.id as string);
  let txRows: Any[] = [];
  if (walletIds.length > 0) {
    const tx = await db
      .from("wallet_transactions")
      .select("id, wallet_id, kind, amount, currency, note, created_at")
      .eq("store_id", storeId)
      .in("wallet_id", walletIds)
      .order("created_at", { ascending: false })
      .limit(400);
    if (tx.error) throw new Error(tx.error.message);
    txRows = tx.data ?? [];
  }

  return {
    wallets: (wallets.data ?? []).map((row: Any) => ({
      id: row.id as string,
      customerId: row.customer_id as string,
      customerName: (row.customers?.full_name ?? row.customers?.email ?? "Müşteri") as string,
      balance: Number(row.balance ?? 0),
      currency: (row.currency ?? "TRY") as string,
      transactions: txRows
        .filter((tx) => tx.wallet_id === row.id)
        .map((tx) => ({
          id: tx.id as string,
          kind: tx.kind as string,
          amount: Number(tx.amount ?? 0),
          note: (tx.note ?? null) as string | null,
          createdAt: tx.created_at as string,
        })),
    })),
    customers: (customers.data ?? []).map((row: Any) => ({
      id: row.id as string,
      name: (row.full_name ?? row.email ?? "Müşteri") as string,
    })),
  };
}

/**
 * Cüzdana hareket yazar ve bakiyeyi hareketlerden yeniden hesaplar.
 * Harcama bakiyeyi aşarsa reddedilir (negatif bakiye oluşmaz).
 */
export async function addWalletTransaction(args: {
  client: Client;
  storeId: string;
  userId: string;
  input: { customerId: string; kind: WalletTxKind; amount: number; note?: string | undefined; currency?: string | undefined };
}) {
  const db = args.client as unknown as Any;
  const currency = args.input.currency ?? "TRY";

  let wallet = await db
    .from("customer_wallets")
    .select("id, balance, currency")
    .eq("store_id", args.storeId)
    .eq("customer_id", args.input.customerId)
    .maybeSingle();
  if (wallet.error) throw new Error(wallet.error.message);

  if (!wallet.data) {
    const created = await db
      .from("customer_wallets")
      .insert({ store_id: args.storeId, customer_id: args.input.customerId, balance: 0, currency })
      .select("id, balance, currency")
      .single();
    if (created.error) throw new Error(created.error.message);
    wallet = created;
  }

  const walletId = wallet.data.id as string;
  const delta = walletDelta(args.input.kind, args.input.amount);
  const current = Number(wallet.data.balance ?? 0);
  if (current + delta < 0) throw new Error("Cüzdan bakiyesi bu harcama için yetersiz");

  const inserted = await db.from("wallet_transactions").insert({
    store_id: args.storeId,
    wallet_id: walletId,
    kind: args.input.kind,
    amount: args.input.amount,
    currency: wallet.data.currency ?? currency,
    note: args.input.note ?? null,
    created_by: args.userId,
  });
  if (inserted.error) throw new Error(inserted.error.message);

  const all = await db.from("wallet_transactions").select("kind, amount").eq("wallet_id", walletId);
  if (all.error) throw new Error(all.error.message);
  const balance = walletBalance((all.data ?? []).map((row: Any) => ({ kind: row.kind, amount: Number(row.amount ?? 0) })));

  const updated = await db.from("customer_wallets").update({ balance }).eq("id", walletId).eq("store_id", args.storeId);
  if (updated.error) throw new Error(updated.error.message);
  return { ok: true as const, balance };
}

/* ------------------------ akıllı sipariş bölme ---------------------------- */

/** Depo stoklarını okuyup verilen kalemleri parçalara böler. */
export async function simulateOrderSplit(args: {
  client: Client;
  storeId: string;
  lines: Array<{ productId: string; quantity: number }>;
  destinationCountry: string;
}) {
  const db = args.client as unknown as Any;
  const { splitOrderAcrossWarehouses } = await import("@/lib/retention");

  const [warehouses, inventory, products] = await Promise.all([
    db.from("fulfillment_warehouses").select("id, name, country_code, priority, is_active").eq("store_id", args.storeId),
    db.from("warehouse_inventory").select("warehouse_id, product_id, available").eq("store_id", args.storeId),
    db
      .from("products")
      .select("id, title")
      .eq("store_id", args.storeId)
      .in("id", args.lines.map((line) => line.productId)),
  ]);
  if (warehouses.error) throw new Error(warehouses.error.message);
  if (inventory.error) throw new Error(inventory.error.message);

  const titleById = new Map<string, string>((products.data ?? []).map((row: Any) => [String(row.id), String(row.title)]));

  const mapped = (warehouses.data ?? []).map((row: Any) => ({
    id: row.id as string,
    name: row.name as string,
    countryCode: (row.country_code ?? "TR") as string,
    priority: Number(row.priority ?? 0),
    isActive: Boolean(row.is_active),
    stock: Object.fromEntries(
      (inventory.data ?? [])
        .filter((inv: Any) => inv.warehouse_id === row.id)
        .map((inv: Any) => [inv.product_id as string, Number(inv.available ?? 0)]),
    ) as Record<string, number>,
  }));

  return splitOrderAcrossWarehouses(
    mapped,
    args.lines.map((line) => ({
      sku: line.productId,
      title: titleById.get(line.productId) ?? "Ürün",
      quantity: line.quantity,
    })),
    args.destinationCountry,
  );
}
