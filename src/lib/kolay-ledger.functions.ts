import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Süper yönetici Kolay Panel defteri: her Kolay Panel (micro) mağazasının
 * siparişleri, satış, komisyon ve aktarılacak tutarı ayrı defterde.
 * Tüm rakamlar veritabanındaki gerçek siparişlerden hesaplanır; komisyon
 * kuralı Kolay Panel bakiyesiyle aynıdır (plan oranı, yoksa %2).
 */
type Db = { from: (t: string) => any };
const CLOSED = ["cancelled", "refunded", "returned"];

async function db(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

async function guard(supabase: unknown, userId: string) {
  const { assertPlatformAdmin } = await import("@/lib/platform-admin.server");
  await assertPlatformAdmin(supabase as never, userId);
}

const range = z.object({ from: z.string().date().optional(), to: z.string().date().optional() });

function inRange(placed: string | null, from?: string, to?: string) {
  if (!placed) return !from && !to;
  const d = placed.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export const kolayLedgerOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => range.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const d = await db();
    const { data: stores } = await d.from("stores").select("id, name, slug, currency, plan_id, status").eq("store_kind", "micro").order("name").limit(1000);
    const list = (stores ?? []) as { id: string; name: string; slug: string; currency: string | null; plan_id: string | null; status: string }[];
    if (list.length === 0) return { rows: [] };
    const ids = list.map((s) => s.id);
    const planIds = [...new Set(list.map((s) => s.plan_id).filter(Boolean))] as string[];

    const [orders, payouts, plans, settings] = await Promise.all([
      d.from("orders").select("store_id, grand_total, placed_at, payment_status, status").in("store_id", ids).limit(50000),
      d.from("payout_requests").select("store_id, amount, status").in("store_id", ids).limit(10000),
      planIds.length ? d.from("plans").select("id, commission_rate").in("id", planIds) : Promise.resolve({ data: [] }),
      d.from("store_settings").select("store_id, bank_iban, bank_account_holder").in("store_id", ids),
    ]);
    const rate = new Map<string, number>(((plans.data ?? []) as { id: string; commission_rate: number | null }[]).map((p) => [p.id, p.commission_rate == null ? 0.02 : Number(p.commission_rate)]));
    const bank = new Map<string, { iban: string | null; holder: string | null }>(((settings.data ?? []) as { store_id: string; bank_iban: string | null; bank_account_holder: string | null }[]).map((s) => [s.store_id, { iban: s.bank_iban, holder: s.bank_account_holder }]));

    const rows = list.map((s) => {
      const commissionRate = s.plan_id ? rate.get(s.plan_id) ?? 0.02 : 0.02;
      let orderCount = 0, paidCount = 0, sales = 0, cancelled = 0;
      for (const o of (orders.data ?? []) as { store_id: string; grand_total: number; placed_at: string | null; payment_status: string; status: string }[]) {
        if (o.store_id !== s.id || !inRange(o.placed_at, data.from, data.to)) continue;
        orderCount += 1;
        if (CLOSED.includes(o.status)) { cancelled += 1; continue; }
        if (o.payment_status === "paid") { paidCount += 1; sales += Number(o.grand_total ?? 0); }
      }
      const commission = r2(sales * commissionRate);
      const net = r2(sales - commission);
      let transferred = 0, pending = 0;
      for (const p of (payouts.data ?? []) as { store_id: string; amount: number; status: string }[]) {
        if (p.store_id !== s.id) continue;
        if (p.status === "paid") transferred += Number(p.amount ?? 0);
        else if (p.status !== "rejected") pending += Number(p.amount ?? 0);
      }
      return {
        storeId: s.id, name: s.name, slug: s.slug, status: s.status, currency: s.currency ?? "TRY",
        orderCount, paidCount, cancelled, sales: r2(sales), commissionRate, commission, net,
        transferred: r2(transferred), pending: r2(pending),
        toTransfer: data.from || data.to ? null : r2(Math.max(0, net - transferred)),
        iban: bank.get(s.id)?.iban ?? null, holder: bank.get(s.id)?.holder ?? null,
      };
    });
    return { rows };
  });

export const kolayLedgerStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => range.extend({ storeId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const d = await db();
    const { data: store } = await d.from("stores").select("id, name, plan_id, currency, store_kind").eq("id", data.storeId).maybeSingle();
    if (!store || store.store_kind !== "micro") throw new Error("Kolay Panel mağazası bulunamadı");
    let commissionRate = 0.02;
    if (store.plan_id) {
      const { data: plan } = await d.from("plans").select("commission_rate").eq("id", store.plan_id).maybeSingle();
      if (plan?.commission_rate != null) commissionRate = Number(plan.commission_rate);
    }
    const [{ data: orders }, { data: payouts }] = await Promise.all([
      d.from("orders").select("id, order_number, customer_name, grand_total, currency, placed_at, payment_status, status").eq("store_id", data.storeId).order("placed_at", { ascending: false }).limit(2000),
      d.from("payout_requests").select("id, amount, currency, status, created_at").eq("store_id", data.storeId).order("created_at", { ascending: false }).limit(200),
    ]);
    const lines = ((orders ?? []) as { id: string; order_number: string | null; customer_name: string | null; grand_total: number; currency: string | null; placed_at: string | null; payment_status: string; status: string }[])
      .filter((o) => inRange(o.placed_at, data.from, data.to))
      .map((o) => {
        const counted = o.payment_status === "paid" && !CLOSED.includes(o.status);
        const total = Number(o.grand_total ?? 0);
        const commission = counted ? r2(total * commissionRate) : 0;
        return { id: o.id, number: o.order_number, customer: o.customer_name, placedAt: o.placed_at, total, currency: o.currency ?? store.currency ?? "TRY", status: o.status, paymentStatus: o.payment_status, counted, commission, net: counted ? r2(total - commission) : 0 };
      });
    return { name: store.name as string, commissionRate, lines, payouts: (payouts ?? []) as { id: string; amount: number; currency: string; status: string; created_at: string }[] };
  });
