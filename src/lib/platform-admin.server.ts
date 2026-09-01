import { z } from "zod";

import { PLATFORM_DATASETS, PLATFORM_DATASET_KEYS, type PlatformDatasetKey } from "@/lib/platform-datasets";
import { insertAuditRow } from "./audit.server";

/** Süper admin panelinin sunucu tarafı: rol doğrulaması sonrası platform genelinde okuma/yazma. */

/** Ağ üzerinden taşınabilir satır değeri. */
export type PlatformValue = string | number | boolean | null;
export type PlatformRow = Record<string, PlatformValue>;

export const listInputSchema = z.object({
  dataset: z.enum(PLATFORM_DATASET_KEYS as [PlatformDatasetKey, ...PlatformDatasetKey[]]),
  search: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

export const ticketUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "pending", "answered", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignToMe: z.boolean().optional(),
});

export const ticketReplySchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  isInternal: z.boolean().default(false),
});

export const settingSchema = z.object({
  key: z.string().trim().min(2).max(120),
  value: z.string().max(2000),
  label: z.string().trim().max(120).optional(),
  description: z.string().trim().max(400).optional(),
  isPublic: z.boolean().default(false),
});

type SupabaseLike = {
  from: (table: string) => any;
};

/** Yalnızca platform yöneticileri devam edebilir. */
export async function assertPlatformAdmin(supabase: SupabaseLike, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "platform_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Bu alan yalnızca platform yöneticileri içindir");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseLike;
}

/** Mağaza kimliklerini isimlere çevirir (liste ekranlarında bağlam için). */
async function storeNames(db: SupabaseLike, ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 500);
  if (unique.length === 0) return {};
  const { data } = await db.from("stores").select("id, name").in("id", unique);
  return Object.fromEntries(((data ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
}

/** Beyaz listedeki bir veri kümesini platform genelinde okur. */
export async function listPlatformRows(input: z.infer<typeof listInputSchema>) {
  const dataset = PLATFORM_DATASETS[input.dataset];
  const db = await admin();

  let query = db.from(dataset.table).select("*").order(dataset.orderBy, { ascending: false, nullsFirst: false });

  for (const [column, values] of Object.entries(dataset.filter ?? {})) {
    query = query.in(column, values);
  }

  const term = input.search?.trim();
  if (term && dataset.searchColumns.length > 0) {
    query = query.or(dataset.searchColumns.map((column) => `${column}.ilike.%${term}%`).join(","));
  }

  const { data, error } = await query.limit(input.limit);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as PlatformRow[];
  if (!dataset.withStore) return { rows, storeNames: {} as Record<string, string> };

  const names = await storeNames(
    db,
    rows.map((row) => String(row["store_id"] ?? "")),
  );
  return { rows, storeNames: names };
}

/** Panel üst kısmındaki platform özeti. */
export async function platformSummary() {
  const db = await admin();
  const count = async (table: string, apply?: (q: any) => any) => {
    let query = db.from(table).select("id", { count: "exact", head: true });
    if (apply) query = apply(query);
    const { count: total } = await query;
    return Number(total ?? 0);
  };

  const [stores, activeStores, users, sellers, apps, openTickets, subscriptions] = await Promise.all([
    count("stores"),
    count("stores", (q) => q.eq("status", "active")),
    count("profiles"),
    count("marketplace_sellers"),
    count("apps"),
    count("support_tickets", (q) => q.in("status", ["open", "pending", "answered"])),
    count("subscriptions", (q) => q.in("status", ["trialing", "active"])),
  ]);

  const { data: fees } = await db
    .from("ledger_entries")
    .select("amount, kind, status")
    .in("kind", ["platform_fee", "marketplace_commission"])
    .eq("status", "posted")
    .limit(5000);

  const commission = ((fees ?? []) as { amount: number }[]).reduce(
    (total, row) => total + Number(row.amount ?? 0),
    0,
  );

  return { stores, activeStores, users, sellers, apps, openTickets, subscriptions, commission };
}

/** Destek talepleri (platform geneli) ve son yazışmalar. */
export async function listTickets(status?: string) {
  const db = await admin();
  let query = db
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as PlatformRow[];
  const names = await storeNames(db, rows.map((row) => String(row["store_id"] ?? "")));
  return { rows, storeNames: names };
}

export async function listTicketMessages(ticketId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformRow[];
}

export async function updateTicket(input: z.infer<typeof ticketUpdateSchema>, userId: string) {
  const db = await admin();
  const patch: Record<string, unknown> = {};
  if (input.status) {
    patch["status"] = input.status;
    patch["resolved_at"] = input.status === "resolved" || input.status === "closed" ? new Date().toISOString() : null;
  }
  if (input.priority) patch["priority"] = input.priority;
  if (input.assignToMe) patch["assigned_to"] = userId;
  if (Object.keys(patch).length === 0) return { id: input.id };

  const { error } = await db.from("support_tickets").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);

  await insertAuditRow(db, {
    actor_id: userId,
    action: "platform.ticket_updated",
    entity: "support_tickets",
    entity_id: input.id,
    new_value: patch,
  });
  return { id: input.id };
}

export async function replyTicket(
  input: z.infer<typeof ticketReplySchema>,
  userId: string,
  authorName: string | null,
) {
  const db = await admin();
  const { error } = await db.from("support_ticket_messages").insert({
    ticket_id: input.ticketId,
    author_id: userId,
    author_name: authorName,
    body: input.body,
    is_internal: input.isInternal,
  });
  if (error) throw new Error(error.message);

  await db
    .from("support_tickets")
    .update({
      last_reply_at: new Date().toISOString(),
      ...(input.isInternal ? {} : { status: "answered" }),
    })
    .eq("id", input.ticketId);

  return { ticketId: input.ticketId };
}

export async function listSettings() {
  const db = await admin();
  const { data, error } = await db.from("platform_settings").select("*").order("key");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformRow[];
}

export async function saveSetting(input: z.infer<typeof settingSchema>, userId: string) {
  const db = await admin();
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.value);
  } catch {
    parsed = input.value;
  }

  const { error } = await db.from("platform_settings").upsert(
    {
      key: input.key,
      value: parsed,
      label: input.label ?? null,
      description: input.description ?? null,
      is_public: input.isPublic,
      updated_by: userId,
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);

  await insertAuditRow(db, {
    actor_id: userId,
    action: "platform.setting_saved",
    entity: "platform_settings",
    entity_id: input.key,
    new_value: { key: input.key, value: parsed, is_public: input.isPublic },
  });
  return { key: input.key };
}

/** Kullanıcı platform rollerini listeler (rol yönetimi ekranı için). */
export async function listUserRoles() {
  const db = await admin();
  const { data, error } = await db.from("user_roles").select("user_id, role");
  if (error) throw new Error(error.message);
  return (data ?? []) as { user_id: string; role: string }[];
}

export const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["platform_admin", "agency", "seller", "customer"]),
  grant: z.boolean(),
});

export async function setUserRole(input: z.infer<typeof roleSchema>, userId: string) {
  const db = await admin();
  if (input.grant) {
    const { error } = await db.from("user_roles").upsert(
      { user_id: input.userId, role: input.role },
      { onConflict: "user_id,role" },
    );
    if (error) throw new Error(error.message);
  } else {
    if (input.userId === userId && input.role === "platform_admin") {
      throw new Error("Kendi platform yöneticiliğini kaldıramazsın");
    }
    const { error } = await db
      .from("user_roles")
      .delete()
      .eq("user_id", input.userId)
      .eq("role", input.role);
    if (error) throw new Error(error.message);
  }

  await insertAuditRow(db, {
    actor_id: userId,
    action: input.grant ? "platform.role_granted" : "platform.role_revoked",
    entity: "user_roles",
    entity_id: input.userId,
    new_value: { role: input.role },
  });
  return { userId: input.userId, role: input.role, grant: input.grant };
}
