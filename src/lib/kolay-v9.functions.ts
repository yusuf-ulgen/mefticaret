import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ev Hanımları Portalı v9: üretim modu, özel müşteri notları, hediye paketi,
 * sipariş bölüşme ve mentorluk puanları. Yetkiler RLS ile zorlanır.
 */

const storeInput = z.object({ storeId: z.guid() });

/* ------------------------------ üretim modu ------------------------------- */

export const getKitchenSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => storeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("kolay_promo_settings")
      .select("production_mode, production_message, gift_wrap_enabled")
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      productionMode: row?.production_mode ?? false,
      productionMessage: row?.production_message ?? "",
      giftWrapEnabled: row?.gift_wrap_enabled ?? false,
    };
  });

export const saveKitchenSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        productionMode: z.boolean(),
        productionMessage: z.string().trim().max(200),
        giftWrapEnabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kolay_promo_settings").upsert(
      {
        store_id: data.storeId,
        production_mode: data.productionMode,
        production_message: data.productionMessage || null,
        gift_wrap_enabled: data.giftWrapEnabled,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "store_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------------------------- müşteri notları ----------------------------- */

export const listOrderNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => storeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("kolay_order_notes" as never)
      .select("order_id, tags, note")
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return ((rows ?? []) as { order_id: string; tags: string[]; note: string | null }[]).map((r) => ({
      orderId: r.order_id,
      tags: r.tags ?? [],
      note: r.note ?? "",
    }));
  });

export const saveOrderNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        orderId: z.guid(),
        tags: z.array(z.string().trim().min(1).max(30)).max(8),
        note: z.string().trim().max(300),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kolay_order_notes" as never).upsert(
      {
        order_id: data.orderId,
        store_id: data.storeId,
        tags: data.tags,
        note: data.note || null,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "order_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------------------------- sipariş bölüşme ----------------------------- */

/** Satıcının seçebileceği kayıtlı ev hanımı mağazaları (ada göre arama). */
export const searchSplitPartners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ storeId: z.guid(), query: z.string().trim().max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: own } = await context.supabase
      .from("stores")
      .select("owner_id")
      .eq("id", data.storeId)
      .maybeSingle();
    const { data: member } = await context.supabase
      .from("store_users")
      .select("role")
      .eq("store_id", data.storeId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (own?.owner_id !== context.userId && !member) throw new Error("Bu mağazaya erişim yetkiniz yok");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("stores")
      .select("id, name, store_settings(city)")
      .eq("store_kind", "micro")
      .eq("status", "active")
      .neq("id", data.storeId)
      .order("name")
      .limit(20);
    if (data.query) q = q.ilike("name", `%${data.query.replace(/[%_]/g, "")}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const s = Array.isArray(r.store_settings) ? r.store_settings[0] : r.store_settings;
      return { id: r.id, name: r.name, city: (s as { city?: string | null } | null)?.city ?? "" };
    });
  });

export const createOrderSplit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        orderId: z.guid(),
        toStoreId: z.guid(),
        shareNote: z.string().trim().min(3).max(300),
        shareAmount: z.number().min(0).max(1_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kolay_order_splits" as never).insert({
      order_id: data.orderId,
      from_store_id: data.storeId,
      to_store_id: data.toStoreId,
      share_note: data.shareNote,
      share_amount: data.shareAmount,
    } as never);
    if (error) throw new Error("Bölüşme daveti gönderilemedi");
    return { ok: true as const };
  });

type SplitRow = {
  id: string;
  order_id: string;
  from_store_id: string;
  to_store_id: string;
  share_note: string;
  share_amount: number;
  status: string;
  created_at: string;
};

export const listOrderSplits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => storeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("kolay_order_splits" as never)
      .select("id, order_id, from_store_id, to_store_id, share_note, share_amount, status, created_at")
      .or(`from_store_id.eq.${data.storeId},to_store_id.eq.${data.storeId}`)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as SplitRow[];
    const ids = [...new Set(list.flatMap((r) => [r.from_store_id, r.to_store_id]))];
    const names: Record<string, string> = {};
    if (ids.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: stores } = await supabaseAdmin.from("stores").select("id, name").in("id", ids);
      for (const s of stores ?? []) names[s.id] = s.name;
    }
    return list.map((r) => ({
      id: r.id,
      orderId: r.order_id,
      incoming: r.to_store_id === data.storeId,
      partnerName: names[r.to_store_id === data.storeId ? r.from_store_id : r.to_store_id] ?? "Mağaza",
      shareNote: r.share_note,
      shareAmount: Number(r.share_amount),
      status: r.status,
    }));
  });

export const respondOrderSplit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        splitId: z.guid(),
        status: z.enum(["accepted", "declined", "cancelled"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const column = data.status === "cancelled" ? "from_store_id" : "to_store_id";
    const { data: rows, error } = await context.supabase
      .from("kolay_order_splits" as never)
      .update({ status: data.status, updated_at: new Date().toISOString() } as never)
      .eq("id", data.splitId)
      .eq(column, data.storeId)
      .eq("status", "pending")
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || (rows as unknown[]).length === 0) throw new Error("Bu davet artık yanıtlanamıyor");
    return { ok: true as const };
  });

/* ------------------------------- mentorluk -------------------------------- */

export const getMentorship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => storeInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [{ data: points }, { data: links }] = await Promise.all([
      sb.from("kolay_mentor_points" as never).select("delta").eq("store_id", data.storeId),
      sb
        .from("kolay_mentorships" as never)
        .select("mentor_store_id, mentee_store_id, rewarded_at")
        .or(`mentor_store_id.eq.${data.storeId},mentee_store_id.eq.${data.storeId}`),
    ]);
    const balance = ((points ?? []) as { delta: number }[]).reduce((a, p) => a + p.delta, 0);
    const rows = (links ?? []) as { mentor_store_id: string; mentee_store_id: string; rewarded_at: string | null }[];
    const mentees = rows.filter((r) => r.mentor_store_id === data.storeId);
    const mine = rows.find((r) => r.mentee_store_id === data.storeId);
    let mentorName: string | null = null;
    if (mine) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: s } = await supabaseAdmin.from("stores").select("name").eq("id", mine.mentor_store_id).maybeSingle();
      mentorName = s?.name ?? "Mentor";
    }
    const helped = mentees.filter((m) => m.rewarded_at).length;
    const badge = helped >= 10 ? "Altın Mentor" : helped >= 3 ? "Gümüş Mentor" : helped >= 1 ? "Bronz Mentor" : null;
    return { balance, menteeCount: mentees.length, helped, badge, mentorName };
  });

/** Yeni satıcı, kendisine yardım eden deneyimli satıcıyı mağaza adresiyle seçer. */
export const chooseMentor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ storeId: z.guid(), mentorSlug: z.string().trim().min(2).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mentor } = await supabaseAdmin
      .from("stores")
      .select("id")
      .eq("slug", data.mentorSlug.replace(/^.*\/s\//, "").replace(/\/.*$/, ""))
      .eq("store_kind", "micro")
      .eq("status", "active")
      .maybeSingle();
    if (!mentor) throw new Error("Bu adreste bir ev hanımı mağazası bulunamadı");
    if (mentor.id === data.storeId) throw new Error("Kendinizi mentor seçemezsiniz");
    const { error } = await context.supabase.from("kolay_mentorships" as never).insert({
      mentor_store_id: mentor.id,
      mentee_store_id: data.storeId,
    } as never);
    if (error) throw new Error("Mentor yalnızca ilk satışınızdan önce ve bir kez seçilebilir");
    return { ok: true as const };
  });
