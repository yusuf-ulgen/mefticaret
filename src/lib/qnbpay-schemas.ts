import { z } from "zod";

/** QNBpay panel işlemleri için paylaşılan doğrulama şemaları (istemci + sunucu). */

export const qnbpaySettingsSchema = z.object({
  environment: z.enum(["test", "live"]),
  isEnabled: z.boolean(),
  testMerchantKey: z.string().trim().max(200),
  testAppId: z.string().trim().max(120),
  liveMerchantKey: z.string().trim().max(200),
  liveAppId: z.string().trim().max(120),
  currencyCode: z.enum(["TRY", "USD", "EUR"]),
  maxInstallments: z.number().int().min(1).max(12),
  selectedInstallments: z.array(z.number().int().min(1).max(12)).max(12),
  isCommissionFromUser: z.boolean(),
  transactionType: z.enum(["Auth", "PreAuth"]),
  paymentCompletedBy: z.enum(["app", "merchant"]),
  force3d: z.boolean(),
  saleWebhookKey: z.string().trim().max(120).optional(),
  refundWebhookKey: z.string().trim().max(120).optional(),
  returnOrigin: z.string().trim().max(300).optional(),
});
export type QnbpaySettingsInput = z.infer<typeof qnbpaySettingsSchema>;

export const chargePurposeSchema = z.enum([
  "plan",
  "theme",
  "app",
  "commission",
  "invoice",
  "other",
]);

export const createChargeLinkSchema = z.object({
  purpose: chargePurposeSchema,
  storeId: z.guid().optional(),
  chargeItemCode: z.string().trim().max(80).optional(),
  description: z.string().trim().min(2).max(200),
  amount: z.number().positive().max(1_000_000),
  currency: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
  buyerName: z.string().trim().min(1).max(80),
  buyerSurname: z.string().trim().min(1).max(80),
  selectedInstallments: z.array(z.number().int().min(1).max(12)).max(12).optional(),
});

export const installmentQuerySchema = z.object({
  creditCard: z.string().trim().min(6).max(24),
  amount: z.number().positive().max(1_000_000),
  currency: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
});

export const transactionIdSchema = z.object({ transactionId: z.guid() });

export const refundSchema = z.object({
  transactionId: z.guid(),
  amount: z.number().min(0).max(1_000_000),
  requestKey: z.string().min(8).max(120).optional(),
});

export const completeSchema = z.object({
  transactionId: z.guid(),
  action: z.enum(["complete", "cancel"]),
});

export const confirmSchema = z.object({
  transactionId: z.guid(),
  action: z.enum(["approve", "cancel"]),
  amount: z.number().positive().max(1_000_000).optional(),
});

export const chargeItemSchema = z.object({
  id: z.guid().optional(),
  kind: z.enum(["theme", "service", "commission", "other"]),
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(400).optional(),
  price: z.number().min(0).max(1_000_000),
  currency: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
  commissionRate: z.number().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const planPriceSchema = z.object({
  planId: z.guid(),
  priceMonthly: z.number().min(0).max(1_000_000),
  priceYearly: z.number().min(0).max(1_000_000),
  commissionRate: z.number().min(0).max(100),
});

export const appPriceSchema = z.object({
  appId: z.guid(),
  price: z.number().min(0).max(1_000_000),
});
