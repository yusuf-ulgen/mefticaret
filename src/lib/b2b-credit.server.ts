/**
 * B2B cari hesap yönetimi — sunucu katmanı.
 * Bakiye yalnızca hareket kayıtlarından türetilir; istemciden gelen bakiye değerine
 * güvenilmez. Yazma işlemleri mağaza yöneticisi doğrulamasından geçer.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
type Any = any;

export type CreditAccountRow = {
  id: string;
  companyName: string;
  contactEmail: string;
  taxId: string;
  currency: string;
  creditLimit: number;
  balance: number;
  available: number;
  termDays: number;
  status: "active" | "on_hold" | "closed";
  notes: string;
  updatedAt: string;
};

export type CreditTransactionRow = {
  id: string;
  accountId: string;
  kind: "charge" | "payment" | "adjustment";
  amount: number;
  currency: string;
  note: string;
  createdAt: string;
};

export const CREDIT_STATUS_LABELS: Record<CreditAccountRow["status"], string> = {
  active: "Aktif",
  on_hold: "Beklemede",
  closed: "Kapalı",
};

export const CREDIT_KIND_LABELS: Record<CreditTransactionRow["kind"], string> = {
  charge: "Borç (satış)",
  payment: "Tahsilat",
  adjustment: "Düzeltme",
};

function mapAccount(row: Any): CreditAccountRow {
  const limit = Number(row.credit_limit ?? 0);
  const balance = Number(row.balance ?? 0);
  return {
    id: String(row.id),
    companyName: String(row.company_name),
    contactEmail: String(row.contact_email ?? ""),
    taxId: String(row.tax_id ?? ""),
    currency: String(row.currency ?? "TRY"),
    creditLimit: limit,
    balance,
    available: Math.max(0, limit - balance),
    termDays: Number(row.term_days ?? 30),
    status: String(row.status ?? "active") as CreditAccountRow["status"],
    notes: String(row.notes ?? ""),
    updatedAt: String(row.updated_at ?? row.created_at),
  };
}

export async function listCreditAccounts(client: Client, storeId: string) {
  const db = client as unknown as Any;
  const [accounts, transactions] = await Promise.all([
    db
      .from("b2b_credit_accounts")
      .select("*")
      .eq("store_id", storeId)
      .order("company_name", { ascending: true })
      .limit(300),
    db
      .from("b2b_credit_transactions")
      .select("id, account_id, kind, amount, currency, note, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (accounts.error) throw new Error(accounts.error.message);
  if (transactions.error) throw new Error(transactions.error.message);

  return {
    accounts: ((accounts.data ?? []) as Any[]).map(mapAccount),
    transactions: ((transactions.data ?? []) as Any[]).map((row) => ({
      id: String(row.id),
      accountId: String(row.account_id),
      kind: String(row.kind) as CreditTransactionRow["kind"],
      amount: Number(row.amount ?? 0),
      currency: String(row.currency ?? "TRY"),
      note: String(row.note ?? ""),
      createdAt: String(row.created_at),
    })) as CreditTransactionRow[],
  };
}

export type SaveCreditAccountInput = {
  id?: string | null | undefined;
  companyName: string;
  contactEmail?: string | undefined;
  taxId?: string | undefined;
  currency?: string | undefined;
  creditLimit: number;
  termDays: number;
  status: CreditAccountRow["status"];
  notes?: string | undefined;
};

export async function saveCreditAccount(options: {
  client: Client;
  storeId: string;
  userId: string;
  input: SaveCreditAccountInput;
}) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(options.client, options.storeId, options.userId);

  const { input } = options;
  const row: Record<string, unknown> = {
    store_id: options.storeId,
    company_name: input.companyName,
    contact_email: input.contactEmail ?? "",
    tax_id: input.taxId ?? "",
    currency: (input.currency ?? "TRY").toUpperCase(),
    credit_limit: input.creditLimit,
    term_days: input.termDays,
    status: input.status,
    notes: input.notes ?? "",
    updated_at: new Date().toISOString(),
  };
  if (input.id) row["id"] = input.id;

  const { data, error } = await (options.client as unknown as Any)
    .from("b2b_credit_accounts")
    .upsert(row, { onConflict: "id" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: String(data.id) };
}

export async function deleteCreditAccount(options: {
  client: Client;
  storeId: string;
  userId: string;
  id: string;
}) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(options.client, options.storeId, options.userId);
  const { error } = await (options.client as unknown as Any)
    .from("b2b_credit_accounts")
    .delete()
    .eq("id", options.id)
    .eq("store_id", options.storeId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/**
 * Cari hareket ekler ve bakiyeyi yeniden hesaplar.
 * Borç kaydı kredi limitini aşıyorsa işlem reddedilir (limit sunucuda uygulanır).
 */
export async function addCreditTransaction(options: {
  client: Client;
  storeId: string;
  userId: string;
  accountId: string;
  kind: CreditTransactionRow["kind"];
  amount: number;
  note?: string | undefined;
}) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(options.client, options.storeId, options.userId);

  const db = options.client as unknown as Any;
  const { data: account, error: accountError } = await db
    .from("b2b_credit_accounts")
    .select("id, credit_limit, balance, currency, status")
    .eq("id", options.accountId)
    .eq("store_id", options.storeId)
    .maybeSingle();
  if (accountError) throw new Error(accountError.message);
  if (!account) throw new Error("Cari hesap bulunamadı");
  if (account.status === "closed") throw new Error("Kapalı cari hesaba hareket eklenemez");

  const amount = Math.abs(Number(options.amount));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Geçerli bir tutar girin");

  const delta = options.kind === "payment" ? -amount : amount;
  const nextBalance = Number(account.balance ?? 0) + delta;
  const limit = Number(account.credit_limit ?? 0);

  if (options.kind === "charge" && limit > 0 && nextBalance > limit) {
    throw new Error(
      `Kredi limiti aşılıyor. Kalan limit: ${(limit - Number(account.balance ?? 0)).toLocaleString("tr-TR")} ${account.currency}`,
    );
  }

  const { error: insertError } = await db.from("b2b_credit_transactions").insert({
    store_id: options.storeId,
    account_id: options.accountId,
    kind: options.kind,
    amount,
    currency: String(account.currency ?? "TRY"),
    note: options.note ?? "",
    created_by: options.userId,
  });
  if (insertError) throw new Error(insertError.message);

  const { error: updateError } = await db
    .from("b2b_credit_accounts")
    .update({ balance: Math.max(0, nextBalance), updated_at: new Date().toISOString() })
    .eq("id", options.accountId)
    .eq("store_id", options.storeId);
  if (updateError) throw new Error(updateError.message);

  return { balance: Math.max(0, nextBalance), currency: String(account.currency ?? "TRY") };
}
