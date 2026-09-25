import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  addBlockedCountry,
  assertSecurityAdmin,
  attackListSchema,
  countrySchema,
  createIpRule,
  deleteBlockedCountry,
  deleteIpRule,
  falsePositiveSchema,
  fraudReviewSchema,
  getOverview,
  getSettingsRow,
  idSchema,
  ipRuleSchema,
  listAttacks,
  listBlockedCountries,
  listFraudQueue,
  listIpRules,
  listLockouts,
  listRetentionPolicies,
  listSessions,
  listWafRules,
  markFalsePositive,
  releaseLockout,
  retentionSchema,
  reviewFraudScore,
  revokeSession,
  saveRetentionPolicy,
  saveSettings,
  settingsSchema,
  toggleWafRule,
  wafToggleSchema,
} from "@/lib/security-admin.server";

/** Güvenlik paneli server function'ları — hepsi platform yöneticisi doğrulaması yapar. */

export const getSecurityOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return getOverview();
  });

export const getSecurityAttacks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => attackListSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return listAttacks(data);
  });

export const setAttackFalsePositive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => falsePositiveSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return markFalsePositive(context.userId, data);
  });

export const getSecurityIpRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return listIpRules();
  });

export const addSecurityIpRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ipRuleSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return createIpRule(context.userId, data);
  });

export const removeSecurityIpRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return deleteIpRule(context.userId, data);
  });

export const getSecurityCountries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return listBlockedCountries();
  });

export const addSecurityCountry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => countrySchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return addBlockedCountry(context.userId, data);
  });

export const removeSecurityCountry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return deleteBlockedCountry(data);
  });

export const getSecurityFraudQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return listFraudQueue();
  });

export const reviewSecurityFraud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => fraudReviewSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return reviewFraudScore(context.userId, data);
  });

export const getSecurityLockouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return listLockouts();
  });

export const releaseSecurityLockout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return releaseLockout(context.userId, data);
  });

export const getSecurityWafRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return listWafRules();
  });

export const toggleSecurityWafRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => wafToggleSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return toggleWafRule(context.userId, data);
  });

export const getSecuritySettingsRow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return getSettingsRow();
  });

export const saveSecuritySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => settingsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return saveSettings(context.userId, data);
  });

export const getSecuritySessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return listSessions();
  });

export const revokeSecuritySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return revokeSession(context.userId, data);
  });

export const getSecurityRetention = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return listRetentionPolicies();
  });

export const saveSecurityRetention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => retentionSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    return saveRetentionPolicy(context.userId, data);
  });
