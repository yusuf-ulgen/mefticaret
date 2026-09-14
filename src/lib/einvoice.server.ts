/**
 * QNB eSolutions e-fatura entegrasyonunun sunucu tarafı.
 *
 * Yalnızca platform yöneticileri kullanır (çağıran taraf `einvoice.functions.ts`
 * içinde doğrulanır). Kimlik bilgileri ortam değişkenlerinde tutulur, servis
 * adresleri ve gönderici bilgileri süper yönetici panelinden yönetilir.
 */

import { z } from "zod";

import { buildUblInvoice, type UblLine } from "./einvoice-ubl.server";
import { postSoap, readTag, readSoapCredentialsSafe, soapLogin } from "./einvoice-transport.server";
import { insertAuditRow } from "./audit.server";

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
});

export const sendSchema = z.object({
  invoiceId: z.string().uuid(),
  buyerTaxId: z.string().trim().regex(/^\d{10,11}$/, "VKN 10, TCKN 11 hane olmalı"),
  buyerTitle: z.string().trim().min(2).max(200),
  buyerAddress: z.string().trim().min(2).max(300),
  buyerCity: z.string().trim().min(2).max(80),
  buyerEmail: z.string().trim().email().max(160).optional().or(z.literal("")),
  profile: z.enum(["TEMELFATURA", "EARSIVFATURA"]),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
export type SendInput = z.infer<typeof sendSchema>;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type SettingsRow = {
  id: string;
  environment: string;
  auth_mode: string;
  login_url: string | null;
  service_url: string | null;
  login_operation: string;
  send_operation: string;
  status_operation: string;
  service_namespace: string;
  login_namespace: string;
  sender_tax_id: string | null;
  sender_title: string | null;
  sender_address: string | null;
  sender_city: string | null;
  sender_country: string;
  invoice_prefix: string;
  is_enabled: boolean;
  updated_at: string;
};

async function loadSettingsRow(): Promise<SettingsRow> {
  const client = await db();
  const { data, error } = await client
    .from("einvoice_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("E-fatura yapılandırması bulunamadı");
  return data as unknown as SettingsRow;
}

/** Panel için tüm veriler: ayarlar, kimlik durumu, gönderim kayıtları, bekleyen faturalar. */
export async function loadOverview() {
  const client = await db();
  const settings = await loadSettingsRow();

  const [documents, invoices] = await Promise.all([
    client
      .from("einvoice_documents")
      .select("id, invoice_id, store_id, environment, document_number, ettn, status, operation, error_message, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    client
      .from("invoices")
      .select("id, store_id, invoice_number, status, total, currency, issued_at, stores(name)")
      .order("issued_at", { ascending: false })
      .limit(50),
  ]);

  if (documents.error) throw new Error(documents.error.message);
  if (invoices.error) throw new Error(invoices.error.message);

  return {
    settings,
    credentialsConfigured: readSoapCredentialsSafe() !== null,
    documents: documents.data ?? [],
    invoices: (invoices.data ?? []).map((row) => ({
      id: row.id,
      storeId: row.store_id,
      storeName: (row as unknown as { stores?: { name?: string } }).stores?.name ?? "—",
      invoiceNumber: row.invoice_number,
      status: row.status,
      total: Number(row.total ?? 0),
      currency: row.currency ?? "TRY",
      issuedAt: row.issued_at,
    })),
  };
}

export async function saveSettings(input: SettingsInput, userId: string) {
  const client = await db();
  const settings = await loadSettingsRow();
  const { error } = await client
    .from("einvoice_settings")
    .update({
      environment: input.environment,
      auth_mode: input.authMode,
      login_url: input.loginUrl || null,
      service_url: input.serviceUrl || null,
      login_operation: input.loginOperation,
      send_operation: input.sendOperation,
      status_operation: input.statusOperation,
      service_namespace: input.serviceNamespace,
      login_namespace: input.loginNamespace,
      sender_tax_id: input.senderTaxId || null,
      sender_title: input.senderTitle || null,
      sender_address: input.senderAddress || null,
      sender_city: input.senderCity || null,
      sender_country: input.senderCountry,
      invoice_prefix: input.invoicePrefix,
      is_enabled: input.isEnabled,
      updated_by: userId,
    })
    .eq("id", settings.id);
  if (error) throw new Error(error.message);

  await insertAuditRow({
    storeId: null,
    userId,
    action: "einvoice.settings.updated",
    entityType: "einvoice_settings",
    entityId: settings.id,
    meta: { environment: input.environment, authMode: input.authMode, enabled: input.isEnabled },
  });

  return { ok: true as const };
}

/** Bağlantı testi: cookie yönteminde gerçek `wsLogin`, wsse yönteminde servis erişimi. */
export async function testConnection(userId: string) {
  const settings = await loadSettingsRow();
  const credentials = readSoapCredentialsSafe();
  if (!credentials) {
    throw new Error("QNB kullanıcı adı/şifresi tanımlı değil");
  }

  let detail: string;
  if (settings.auth_mode === "cookie") {
    if (!settings.login_url) throw new Error("Giriş servisi adresi tanımlı değil");
    const login = await soapLogin({
      url: settings.login_url,
      namespace: settings.login_namespace,
      operation: settings.login_operation,
      credentials,
    });
    detail = `Oturum açıldı (${login.cookie.split("=")[0]})`;
  } else {
    if (!settings.service_url) throw new Error("Servis adresi tanımlı değil");
    const result = await postSoap({
      url: settings.service_url,
      namespace: settings.service_namespace,
      body: `<ser:${settings.status_operation}><invoiceUUID>00000000-0000-0000-0000-000000000000</invoiceUUID></ser:${settings.status_operation}>`,
      credentials,
    });
    if (result.status >= 500 && !result.fault) {
      throw new Error(`Servis yanıt vermedi (HTTP ${result.status})`);
    }
    if (result.status === 401 || result.status === 403) {
      throw new Error("Kimlik doğrulama reddedildi (HTTP " + result.status + ")");
    }
    detail = result.fault
      ? `Servise ulaşıldı, servis yanıtı: ${result.fault.slice(0, 200)}`
      : `Servise ulaşıldı (HTTP ${result.status})`;
  }

  await insertAuditRow({
    storeId: null,
    userId,
    action: "einvoice.connection.tested",
    entityType: "einvoice_settings",
    entityId: settings.id,
    meta: { authMode: settings.auth_mode, environment: settings.environment },
  });

  return { ok: true as const, detail };
}

function parseLines(raw: unknown, fallbackTotal: number, taxTotal: number, subtotal: number): UblLine[] {
  const rows = Array.isArray(raw) ? raw : [];
  const parsed = rows.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const name = String(row["name"] ?? row["description"] ?? row["title"] ?? "Abonelik hizmeti");
    const quantity = Number(row["quantity"] ?? row["qty"] ?? 1) || 1;
    const lineTotal = Number(row["total"] ?? row["amount"] ?? row["subtotal"] ?? 0);
    const unitPrice = Number(row["unit_price"] ?? row["unitPrice"] ?? (quantity ? lineTotal / quantity : 0));
    return { name, quantity, unitPrice, lineTotal };
  });

  const base = parsed.length > 0 ? parsed : [
    { name: "Mefticaret abonelik hizmeti", quantity: 1, unitPrice: subtotal || fallbackTotal, lineTotal: subtotal || fallbackTotal },
  ];

  const totalBase = base.reduce((sum, line) => sum + line.lineTotal, 0) || 1;
  return base.map((line) => {
    const share = (line.lineTotal / totalBase) * taxTotal;
    const rate = line.lineTotal > 0 ? (share / line.lineTotal) * 100 : 0;
    return { ...line, taxAmount: Number(share.toFixed(2)), taxRate: Number(rate.toFixed(2)) } satisfies UblLine;
  });
}

/** Platform aboneliği faturasını QNB servisine gönderir. */
export async function sendInvoice(input: SendInput, userId: string) {
  const client = await db();
  const settings = await loadSettingsRow();
  if (!settings.is_enabled) throw new Error("E-fatura entegrasyonu kapalı");
  if (!settings.service_url) throw new Error("Servis adresi tanımlı değil");
  if (!settings.sender_tax_id || !settings.sender_title) {
    throw new Error("Gönderici vergi kimlik numarası ve unvanı zorunlu");
  }
  const credentials = readSoapCredentialsSafe();
  if (!credentials) throw new Error("QNB kullanıcı adı/şifresi tanımlı değil");

  const { data: invoice, error: invoiceError } = await client
    .from("invoices")
    .select("id, store_id, invoice_number, subtotal, tax_total, total, currency, line_items, issued_at")
    .eq("id", input.invoiceId)
    .maybeSingle();
  if (invoiceError) throw new Error(invoiceError.message);
  if (!invoice) throw new Error("Fatura bulunamadı");

  const ettn = crypto.randomUUID();
  const issued = new Date(invoice.issued_at ?? Date.now());
  const documentNumber = `${settings.invoice_prefix}${issued.getFullYear()}${String(
    invoice.invoice_number ?? "",
  ).replace(/\D/g, "").padStart(9, "0").slice(-9)}`;

  const currency = invoice.currency ?? "TRY";
  const subtotal = Number(invoice.subtotal ?? 0);
  const taxTotal = Number(invoice.tax_total ?? 0);
  const total = Number(invoice.total ?? 0);

  const xml = buildUblInvoice({
    ettn,
    documentNumber,
    issueDate: issued.toISOString().slice(0, 10),
    issueTime: issued.toISOString().slice(11, 19),
    currency,
    profile: input.profile,
    supplier: {
      taxId: settings.sender_tax_id,
      title: settings.sender_title,
      address: settings.sender_address ?? "",
      city: settings.sender_city ?? "",
      country: settings.sender_country,
    },
    customer: {
      taxId: input.buyerTaxId,
      title: input.buyerTitle,
      address: input.buyerAddress,
      city: input.buyerCity,
      ...(input.buyerEmail ? { email: input.buyerEmail } : {}),
    },
    lines: parseLines(invoice.line_items, total, taxTotal, subtotal),
    subtotal,
    taxTotal,
    total,
    note: `Mefticaret abonelik faturası ${invoice.invoice_number ?? ""}`.trim(),
  });

  const { data: doc, error: docError } = await client
    .from("einvoice_documents")
    .insert({
      invoice_id: invoice.id,
      store_id: invoice.store_id,
      environment: settings.environment,
      document_number: documentNumber,
      ettn,
      status: "queued",
      operation: settings.send_operation,
      request_summary: { profile: input.profile, total, currency, bytes: xml.length },
      created_by: userId,
    })
    .select("id")
    .single();
  if (docError) throw new Error(docError.message);

  const base64 = Buffer.from(xml, "utf8").toString("base64");
  const body = `<ser:${settings.send_operation}><invoiceUUID>${ettn}</invoiceUUID><docType>XML</docType><fileName>${documentNumber}.xml</fileName><binaryData>${base64}</binaryData></ser:${settings.send_operation}>`;

  try {
    let cookie: string | null = null;
    if (settings.auth_mode === "cookie") {
      if (!settings.login_url) throw new Error("Giriş servisi adresi tanımlı değil");
      cookie = (
        await soapLogin({
          url: settings.login_url,
          namespace: settings.login_namespace,
          operation: settings.login_operation,
          credentials,
        })
      ).cookie;
    }

    const result = await postSoap({
      url: settings.service_url,
      namespace: settings.service_namespace,
      body,
      cookie,
      ...(settings.auth_mode === "wsse" ? { credentials } : {}),
    });

    if (result.fault) throw new Error(result.fault);
    if (result.status >= 400) throw new Error(`Servis hatası (HTTP ${result.status})`);

    await client
      .from("einvoice_documents")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        response_summary: {
          httpStatus: result.status,
          returnCode: readTag(result.xml, "returnCode") ?? readTag(result.xml, "resultCode"),
          message: (readTag(result.xml, "returnMessage") ?? readTag(result.xml, "message") ?? "").slice(0, 500),
        },
        error_message: null,
      })
      .eq("id", doc.id);

    await insertAuditRow({
      storeId: invoice.store_id,
      userId,
      action: "einvoice.invoice.sent",
      entityType: "einvoice_documents",
      entityId: doc.id,
      meta: { documentNumber, ettn, environment: settings.environment },
    });

    return { ok: true as const, documentNumber, ettn };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    await client
      .from("einvoice_documents")
      .update({ status: "failed", error_message: message.slice(0, 800) })
      .eq("id", doc.id);
    throw new Error(message);
  }
}
