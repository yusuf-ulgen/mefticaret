import { queryOptions } from "@tanstack/react-query";

import {
  getSecurityAttacks,
  getSecurityCountries,
  getSecurityFraudQueue,
  getSecurityIpRules,
  getSecurityLockouts,
  getSecurityOverview,
  getSecurityRetention,
  getSecuritySessions,
  getSecuritySettingsRow,
  getSecurityWafRules,
} from "@/lib/security-admin.functions";

/** Güvenlik paneli sorguları. */

export const securityOverviewQuery = () =>
  queryOptions({
    queryKey: ["security", "overview"],
    queryFn: () => getSecurityOverview(),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

export const securityAttacksQuery = (filters: {
  attackType?: string;
  severity?: "low" | "medium" | "high" | "critical";
  days: number;
}) =>
  queryOptions({
    queryKey: ["security", "attacks", filters],
    queryFn: () =>
      getSecurityAttacks({
        data: {
          days: filters.days,
          limit: 100,
          ...(filters.attackType ? { attackType: filters.attackType } : {}),
          ...(filters.severity ? { severity: filters.severity } : {}),
        },
      }),
    staleTime: 15_000,
  });

export const securityIpRulesQuery = () =>
  queryOptions({
    queryKey: ["security", "ip-rules"],
    queryFn: () => getSecurityIpRules(),
    staleTime: 30_000,
  });

export const securityCountriesQuery = () =>
  queryOptions({
    queryKey: ["security", "countries"],
    queryFn: () => getSecurityCountries(),
    staleTime: 30_000,
  });

export const securityFraudQueueQuery = () =>
  queryOptions({
    queryKey: ["security", "fraud"],
    queryFn: () => getSecurityFraudQueue(),
    staleTime: 15_000,
  });

export const securityLockoutsQuery = () =>
  queryOptions({
    queryKey: ["security", "lockouts"],
    queryFn: () => getSecurityLockouts(),
    staleTime: 15_000,
  });

export const securityWafRulesQuery = () =>
  queryOptions({
    queryKey: ["security", "waf"],
    queryFn: () => getSecurityWafRules(),
    staleTime: 60_000,
  });

export const securitySettingsQuery = () =>
  queryOptions({
    queryKey: ["security", "settings"],
    queryFn: () => getSecuritySettingsRow(),
    staleTime: 30_000,
  });

export const securitySessionsQuery = () =>
  queryOptions({
    queryKey: ["security", "sessions"],
    queryFn: () => getSecuritySessions(),
    staleTime: 15_000,
  });

export const securityRetentionQuery = () =>
  queryOptions({
    queryKey: ["security", "retention"],
    queryFn: () => getSecurityRetention(),
    staleTime: 60_000,
  });
