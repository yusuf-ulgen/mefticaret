import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Süper yönetici içgörüleri: dikkat gerektiren işler, genel arama ve kullanıcı 360° görünümü.
 * Her çağrıda platform_admin doğrulanır; servis rolü yalnız doğrulamadan sonra yüklenir.
 */

async function admin(context: { supabase: any; userId: string }) {
  const guard = await import("@/lib/platform-admin.server");
  await guard.assertPlatformAdmin(context.supabase, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function count(db: any, table: string, apply?: (q: any) => any) {
  let query = db.from(table).select("id", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count: total } = await query;
  return Number(total ?? 0);
}

export const getAdminAttention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin(context);
    const day = new Date(Date.now() - 24 * 3600_000).toISOString();
    const [payouts, reports, tickets, errors, criticalErrors, suspended, attacks, newStores, newUsers, pendingPayments] =
      await Promise.all([
        count(db, "payout_requests", (q) => q.eq("status", "pending")),
        count(db, "chat_reports", (q) => q.eq("status", "open")),
        count(db, "support_tickets", (q) => q.in("status", ["open", "pending"])),
        count(db, "app_error_logs", (q) => q.is("resolved_at", null)),
        count(db, "app_error_logs", (q) => q.is("resolved_at", null).in("severity", ["critical", "fatal", "error"])),
        count(db, "stores", (q) => q.eq("status", "suspended")),
        count(db, "sec_attack_logs", (q) => q.gte("created_at", day).eq("is_false_positive", false)),
        count(db, "stores", (q) => q.gte("created_at", day)),
        count(db, "profiles", (q) => q.gte("created_at", day)),
        count(db, "orders", (q) => q.eq("payment_status", "pending").gte("created_at", day)),
      ]);
    const { data: recentStores } = await db
      .from("stores")
      .select("id, name, slug, status, created_at")
      .order("created_at", { ascending: false })
      .limit(6);
    const { data: recentUsers } = await db
      .from("profiles")
      .select("id, full_name, email, created_at")
      .order("created_at", { ascending: false })
      .limit(6);
    return {
      payouts,
      reports,
      tickets,
      errors,
      criticalErrors,
      suspended,
      attacks,
      newStores,
      newUsers,
      pendingPayments,
      recentStores: (recentStores ?? []) as { id: string; name: string; slug: string; status: string; created_at: string }[],
      recentUsers: (recentUsers ?? []) as { id: string; full_name: string | null; email: string | null; created_at: string }[],
    };
  });

export const adminGlobalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ term: z.string().trim().min(2).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin(context);
    const safe = data.term.replace(/[%,()*]/g, " ");
    const like = `%${safe}%`;
    const [stores, users, orders] = await Promise.all([
      db.from("stores").select("id, name, slug, status").or(`name.ilike.${like},slug.ilike.${like}`).limit(8),
      db
        .from("profiles")
        .select("id, full_name, email")
        .or(`email.ilike.${like},full_name.ilike.${like},phone.ilike.${like}`)
        .limit(8),
      db
        .from("orders")
        .select("id, order_number, store_id, grand_total, customer_email")
        .or(`order_number.ilike.${like},customer_email.ilike.${like}`)
        .limit(8),
    ]);
    return {
      stores: (stores.data ?? []) as { id: string; name: string; slug: string; status: string }[],
      users: (users.data ?? []) as { id: string; full_name: string | null; email: string | null }[],
      orders: (orders.data ?? []) as {
        id: string;
        order_number: string;
        store_id: string;
        grand_total: number;
        customer_email: string | null;
      }[],
    };
  });

export const getAdminUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin(context);
    const [profile, roles, owned, memberships, auditRows, authUser, errors] = await Promise.all([
      db.from("profiles").select("id, full_name, email, phone, locale, created_at").eq("id", data.userId).maybeSingle(),
      db.from("user_roles").select("role").eq("user_id", data.userId),
      db.from("stores").select("id, name, slug, status, created_at").eq("owner_id", data.userId).limit(50),
      db.from("store_users").select("role, store_id, stores(id, name, slug, status)").eq("user_id", data.userId).limit(50),
      db
        .from("audit_logs")
        .select("id, action, entity, created_at, actor_id, entity_id")
        .or(`actor_id.eq.${data.userId},entity_id.eq.${data.userId}`)
        .order("created_at", { ascending: false })
        .limit(30),
      db.auth.admin.getUserById(data.userId),
      db
        .from("app_error_logs")
        .select("id, message, severity, last_seen_at, occurrences")
        .eq("user_id", data.userId)
        .order("last_seen_at", { ascending: false })
        .limit(10),
    ]);
    if (!profile.data) throw new Error("Kullanıcı bulunamadı");
    const u = (authUser.data?.user ?? {}) as any;
    const storeIds = (owned.data ?? []).map((s: any) => s.id);
    let orderCount = 0;
    let revenue = 0;
    if (storeIds.length) {
      const { data: orders } = await db
        .from("orders")
        .select("grand_total, payment_status")
        .in("store_id", storeIds)
        .eq("payment_status", "paid")
        .limit(10000);
      orderCount = (orders ?? []).length;
      revenue = (orders ?? []).reduce((t: number, o: any) => t + Number(o.grand_total ?? 0), 0);
    }
    return {
      profile: profile.data as {
        id: string;
        full_name: string | null;
        email: string | null;
        phone: string | null;
        locale: string;
        created_at: string;
      },
      roles: (roles.data ?? []).map((r: any) => String(r.role)),
      account: {
        bannedUntil: (u.banned_until as string | null) ?? null,
        lastSignIn: (u.last_sign_in_at as string | null) ?? null,
        emailConfirmed: Boolean(u.email_confirmed_at),
        providers: ((u.app_metadata?.providers as string[] | undefined) ?? []).join(", "),
      },
      ownedStores: (owned.data ?? []) as { id: string; name: string; slug: string; status: string; created_at: string }[],
      memberships: (memberships.data ?? [])
        .filter((m: any) => m.stores)
        .map((m: any) => ({ role: String(m.role), store: m.stores as { id: string; name: string; slug: string; status: string } })),
      audit: (auditRows.data ?? []) as { id: string; action: string; entity: string | null; created_at: string; actor_id: string | null }[],
      errors: (errors.data ?? []) as { id: string; message: string; severity: string; last_seen_at: string; occurrences: number }[],
      stats: { orderCount, revenue },
    };
  });
