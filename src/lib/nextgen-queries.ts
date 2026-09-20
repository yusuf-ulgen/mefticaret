import { queryOptions } from "@tanstack/react-query";

import { fetchCreditAccounts } from "@/lib/b2b-credit.functions";
import { fetchGamificationCampaigns } from "@/lib/gamification.functions";
import { fetchPickupLocations, fetchRfqDesk, fetchStockForecast } from "@/lib/retail-ops.functions";
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

export const gamificationQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["gamification-campaigns", storeId],
    queryFn: () => fetchGamificationCampaigns({ data: { storeId } }),
  });

export const stockForecastQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["stock-forecast", storeId],
    queryFn: () => fetchStockForecast({ data: { storeId } }),
  });

export const pickupLocationsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["pickup-locations", storeId],
    queryFn: () => fetchPickupLocations({ data: { storeId } }),
  });

export const rfqDeskQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["rfq-desk", storeId],
    queryFn: () => fetchRfqDesk({ data: { storeId } }),
  });
