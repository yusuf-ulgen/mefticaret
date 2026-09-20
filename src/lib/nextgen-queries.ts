import { queryOptions } from "@tanstack/react-query";

import { fetchCreditAccounts } from "@/lib/b2b-credit.functions";
import { fetchMyPasskeys } from "@/lib/passkey.functions";
import { fetchRepricingEvents, fetchRepricingRules } from "@/lib/repricing.functions";

/** Yeni nesil modüller için okuma sorguları (sunucu fonksiyonları üzerinden, RLS altında). */

export const repricingRulesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["repricing-rules", storeId],
    queryFn: () => fetchRepricingRules({ data: { storeId } }),
  });

export const repricingEventsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["repricing-events", storeId],
    queryFn: () => fetchRepricingEvents({ data: { storeId } }),
  });

export const creditAccountsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["b2b-credit-accounts", storeId],
    queryFn: () => fetchCreditAccounts({ data: { storeId } }),
  });

export const myPasskeysQuery = () =>
  queryOptions({
    queryKey: ["my-passkeys"],
    queryFn: () => fetchMyPasskeys(),
  });
