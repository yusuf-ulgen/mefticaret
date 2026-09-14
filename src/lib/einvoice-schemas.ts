import { z } from "zod";

/** QNB eSolutions e-fatura formlarının doğrulama şemaları (istemci + sunucu). */

export const settingsSchema = z.object({
  environment: z.enum(["test", "live"]),
  authMode: z.enum(["wsse", "cookie"]),
  loginUrl: z.string().trim().max(400).optional().or(z.literal("")),
  serviceUrl: z.string().trim().max(400).optional().or(z.literal("")),
  loginOperation: z.string().trim().min(2).max(80),
  sendOperation: z.string().trim().min(2).max(80),
  statusOperation: z.string().trim().min(2).max(80),
  serviceNamespace: z.string().trim().min(4).max(200),
  loginNamespace: z.string().trim().min(4).max(200),
  senderTaxId: z.string().trim().max(20).optional().or(z.literal("")),
  senderTitle: z.string().trim().max(200).optional().or(z.literal("")),
  senderAddress: z.string().trim().max(300).optional().or(z.literal("")),
  senderCity: z.string().trim().max(80).optional().or(z.literal("")),
  senderCountry: z.string().trim().min(2).max(80),
  invoicePrefix: z.string().trim().min(2).max(8),
  isEnabled: z.boolean(),
  checkUserOperation: z.string().trim().min(2).max(80),
  listUsersOperation: z.string().trim().min(2).max(80),
  resendOperation: z.string().trim().min(2).max(80),
  downloadOperation: z.string().trim().min(2).max(80),
  inboxListOperation: z.string().trim().min(2).max(80),
  inboxDownloadOperation: z.string().trim().min(2).max(80),
  earsivServiceUrl: z.string().trim().max(400).optional().or(z.literal("")),
  earsivNamespace: z.string().trim().min(4).max(200),
  earsivOperation: z.string().trim().min(2).max(80),
  earsivBranch: z.string().trim().min(1).max(20),
  earsivCashbox: z.string().trim().min(1).max(20),
  erpCode: z.string().trim().max(40).optional().or(z.literal("")),
});

/** Belge indirme formatları (QNB: HTML / PDF / UBL). */
export const documentFormatSchema = z.enum(["UBL", "PDF", "HTML"]);

export const downloadSchema = z.object({
  documentId: z.string().uuid(),
  format: documentFormatSchema,
});

export const inboxDownloadSchema = z.object({
  ettn: z.string().trim().min(8).max(80),
  format: documentFormatSchema,
});

export const inboxSyncSchema = z.object({
  /** Boş bırakılırsa ayarlardaki son alınan belge sıra numarası kullanılır. */
  fromSequence: z.string().trim().max(40).optional().or(z.literal("")),
});

export const sendSchema = z.object({
  invoiceId: z.string().uuid(),
  buyerTaxId: z.string().trim().regex(/^\d{10,11}$/, "VKN 10, TCKN 11 hane olmalı"),
  buyerTitle: z.string().trim().min(2).max(200),
  buyerAddress: z.string().trim().min(2).max(300),
  buyerCity: z.string().trim().min(2).max(80),
  buyerEmail: z.string().trim().email().max(160).optional().or(z.literal("")),
  /** `AUTO`: alıcı e-fatura mükellefi ise e-Fatura, değilse e-Arşiv olarak düzenlenir. */
  profile: z.enum(["AUTO", "TEMELFATURA", "EARSIVFATURA"]),
});

export const recipientSchema = z.object({
  taxId: z.string().trim().regex(/^\d{10,11}$/, "VKN 10, TCKN 11 hane olmalı"),
});

export const statusSchema = z.object({
  documentId: z.string().uuid(),
});

export type DocumentFormat = z.infer<typeof documentFormatSchema>;
export type DownloadInput = z.infer<typeof downloadSchema>;
export type InboxDownloadInput = z.infer<typeof inboxDownloadSchema>;
export type InboxSyncInput = z.infer<typeof inboxSyncSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type SendInput = z.infer<typeof sendSchema>;
export type RecipientInput = z.infer<typeof recipientSchema>;
export type StatusInput = z.infer<typeof statusSchema>;
