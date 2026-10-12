import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Süper admin Kontrol Merkezi: şikayetler, hesap askıya alma/şifre sıfırlama,
 * ödeme talepleri ve AI kredi paketleri. Her çağrıda platform_admin doğrulanır;
 * servis rolü yalnız doğrulamadan sonra yüklenir.
 */

async function admin(context: { supabase: any; userId: string }) {
  const server = await import("@/lib/platform-admin.server");
  await server.assertPlatformAdmin(context.supabase, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function audit(db: any, actor: string, action: string, entity: string, entityId: string | null, meta: object) {
  await db.from("audit_logs").insert({ actor_id: actor, action, entity, entity_id: entityId, new_value: meta } as never);
}

async function emailsFor(db: any, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {} as Record<string, string>;
  const { data } = await db.from("profiles").select("id, email, full_name").in("id", unique);
  return Object.fromEntries((data ?? []).map((p: any) => [p.id, p.full_name ? `${p.full_name} (${p.email})` : p.email]));
}

// ---------- Şikayetler ----------
export const listChatReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.enum(["open", "reviewed", "dismissed"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin(context);
    const { data: rows, error } = await db
      .from("chat_reports")
      .select("id, reporter_id, reported_user_id, reason, note, message_snapshot, status, created_at")
      .eq("status", data.status)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const names = await emailsFor(db, (rows ?? []).flatMap((r: any) => [r.reporter_id, r.reported_user_id]));
    return (rows ?? []).map((r: any) => ({ ...r, reporter: names[r.reporter_id] ?? "—", reported: names[r.reported_user_id] ?? "—" }));
  });

export const setChatReportStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.guid(), status: z.enum(["open", "reviewed", "dismissed"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin(context);
    const { error } = await db.from("chat_reports").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "chat_report.status", "chat_report", data.id, { status: data.status });
    return { ok: true };
  });

// ---------- Hesaplar ----------
export const getUserAccountState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin(context);
    const { data: res, error } = await db.auth.admin.getUserById(data.userId);
    if (error) throw new Error(error.message);
    const u = res.user as any;
    return { email: u?.email ?? null, bannedUntil: u?.banned_until ?? null, lastSignIn: u?.last_sign_in_at ?? null };
  });

export const setUserSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.guid(), suspend: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("Kendi hesabınızı askıya alamazsınız");
    const db = await admin(context);
    const { error } = await db.auth.admin.updateUserById(data.userId, { ban_duration: data.suspend ? "876000h" : "none" } as never);
    if (error) throw new Error(error.message);
    await audit(db, context.userId, data.suspend ? "user.suspend" : "user.unsuspend", "user", data.userId, {});
    return { ok: true };
  });

export const sendUserPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.guid(), origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin(context);
    const { data: res, error } = await db.auth.admin.getUserById(data.userId);
    if (error || !res.user?.email) throw new Error("Kullanıcının e-postası bulunamadı");
    const { error: sendError } = await db.auth.resetPasswordForEmail(res.user.email, { redirectTo: `${data.origin}/auth` });
    if (sendError) throw new Error(sendError.message);
    await audit(db, context.userId, "user.password_reset_sent", "user", data.userId, {});
    return { ok: true, email: res.user.email };
  });

// ---------- Ödeme talepleri ----------
export const listPayoutRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.enum(["pending", "approved", "paid", "rejected"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin(context);
    const { data: rows, error } = await db
      .from("payout_requests")
      .select("id, store_id, amount, currency, status, iban, account_holder, note, created_at, stores(name)")
      .eq("status", data.status)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setPayoutRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.guid(), status: z.enum(["approved", "paid", "rejected"]), note: z.string().max(300).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin(context);
    const patch: Record<string, unknown> = { status: data.status };
    if (data.note) patch["note"] = data.note;
    const { error } = await db.from("payout_requests").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(db, context.userId, `payout_request.${data.status}`, "payout_request", data.id, { note: data.note ?? null });
    return { ok: true };
  });

// ---------- AI kredi paketleri ----------
export const listAiCreditPackages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin(context);
    const { data, error } = await db.from("ai_credit_packages").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const packageSchema = z.object({
  id: z.guid().optional(),
  code: z.string().trim().min(2).max(40).regex(/^[a-z0-9_-]+$/),
  name: z.string().trim().min(2).max(80),
  credits: z.number().int().positive().max(10_000_000),
  price: z.number().nonnegative().max(1_000_000),
  currency: z.string().length(3),
  description: z.string().max(300).nullable().optional(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(1000),
});

export const saveAiCreditPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => packageSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin(context);
    const { id, ...row } = data;
    const q = id ? db.from("ai_credit_packages").update(row as never).eq("id", id) : db.from("ai_credit_packages").insert(row as never);
    const { error } = await q;
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "ai_credit_package.save", "ai_credit_package", id ?? null, row);
    return { ok: true };
  });
