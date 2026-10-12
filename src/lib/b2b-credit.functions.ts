import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** B2B cari hesap sunucu uçları (mantık b2b-credit.server.ts içinde). */

const storeId = z.guid();

export const fetchCreditAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId }).parse(data))
  .handler(async ({ data, context }) => {
    const { listCreditAccounts } = await import("@/lib/b2b-credit.server");
    return listCreditAccounts(context.supabase, data.storeId);
  });

export const saveCreditAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        id: z.guid().nullish(),
        companyName: z.string().trim().min(2).max(200),
        contactEmail: z.string().trim().max(200).optional(),
        taxId: z.string().trim().max(50).optional(),
        currency: z.string().trim().min(3).max(3).optional(),
        creditLimit: z.number().min(0).max(100000000),
        termDays: z.number().int().min(0).max(365),
        status: z.enum(["active", "on_hold", "closed"]),
        notes: z.string().trim().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { saveCreditAccount } = await import("@/lib/b2b-credit.server");
    const { storeId: store, ...input } = data;
    return saveCreditAccount({
      client: context.supabase,
      storeId: store,
      userId: context.userId,
      input,
    });
  });

export const deleteCreditAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { deleteCreditAccount } = await import("@/lib/b2b-credit.server");
    return deleteCreditAccount({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      id: data.id,
    });
  });

export const addCreditTransactionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        accountId: z.guid(),
        kind: z.enum(["charge", "payment", "adjustment"]),
        amount: z.number().min(0.01).max(100000000),
        note: z.string().trim().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { addCreditTransaction } = await import("@/lib/b2b-credit.server");
    return addCreditTransaction({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      accountId: data.accountId,
      kind: data.kind,
      amount: data.amount,
      ...(data.note ? { note: data.note } : {}),
    });
  });
