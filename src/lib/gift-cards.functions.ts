import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeGiftCardCode } from "@/lib/gift-cards";
import { insertAuditRow } from "./audit.server";

/** Hediye kartı işlemleri. Tenant izolasyonu RLS politikalarıyla zorlanır. */

export const issueGiftCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        code: z.string().trim().min(4).max(40),
        amount: z.number().positive().max(1_000_000),
        currency: z.string().trim().min(3).max(3).default("TRY"),
        customerEmail: z.string().trim().email().max(180).optional(),
        note: z.string().trim().max(300).optional(),
        expiresAt: z.string().trim().min(4).max(40).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = normalizeGiftCardCode(data.code);
    const amount = Math.round(data.amount * 100) / 100;

    const { data: card, error } = await supabase
      .from("gift_cards")
      .insert({
        store_id: data.storeId,
        code,
        initial_amount: amount,
        balance: amount,
        currency: data.currency.toUpperCase(),
        customer_email: data.customerEmail?.toLowerCase() ?? null,
        note: data.note ?? null,
        expires_at: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
        created_by: userId,
      })
      .select("id, code, balance")
      .single();
    if (error) {
      if (error.code === "23505" || error.message.includes("duplicate")) {
        throw new Error("Bu kod bu mağazada zaten kullanılıyor");
      }
      throw new Error(error.message);
    }

    await supabase.from("gift_card_transactions").insert({
      store_id: data.storeId,
      gift_card_id: card.id,
      kind: "issue",
      amount,
      balance_after: amount,
      note: data.note ?? "Hediye kartı tanımlandı",
      created_by: userId,
    });

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: "gift_card.issue",
      entity: "gift_card",
      entity_id: card.id,
      new_value: { code: card.code, amount },
    } as never);

    return { id: card.id, code: card.code };
  });

export const adjustGiftCardBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        giftCardId: z.guid(),
        delta: z.number().refine((value) => value !== 0, "Tutar sıfır olamaz"),
        note: z.string().trim().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: card, error } = await supabase
      .from("gift_cards")
      .select("id, store_id, balance, status, initial_amount")
      .eq("id", data.giftCardId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!card) throw new Error("Hediye kartı bulunamadı");

    const next = Math.round((Number(card.balance) + data.delta) * 100) / 100;
    if (next < 0) throw new Error("Bakiye negatif olamaz");

    const { error: updateError } = await supabase
      .from("gift_cards")
      .update({
        balance: next,
        status: next === 0 ? "depleted" : card.status === "depleted" ? "active" : card.status,
      })
      .eq("id", card.id);
    if (updateError) throw new Error(updateError.message);

    await supabase.from("gift_card_transactions").insert({
      store_id: card.store_id,
      gift_card_id: card.id,
      kind: "adjust",
      amount: Math.round(data.delta * 100) / 100,
      balance_after: next,
      note: data.note ?? "Manuel bakiye düzeltmesi",
      created_by: userId,
    });

    await insertAuditRow(supabase, {
      store_id: card.store_id,
      actor_id: userId,
      action: "gift_card.adjust",
      entity: "gift_card",
      entity_id: card.id,
      old_value: { balance: Number(card.balance) },
      new_value: { balance: next },
    } as never);

    return { balance: next };
  });

export const setGiftCardStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        giftCardId: z.guid(),
        status: z.enum(["active", "disabled"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: card, error } = await supabase
      .from("gift_cards")
      .update({ status: data.status })
      .eq("id", data.giftCardId)
      .select("id, store_id, status")
      .single();
    if (error) throw new Error(error.message);

    await insertAuditRow(supabase, {
      store_id: card.store_id,
      actor_id: userId,
      action: "gift_card.status",
      entity: "gift_card",
      entity_id: card.id,
      new_value: { status: card.status },
    } as never);

    return { status: card.status };
  });
