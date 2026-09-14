/**
 * QNB eSolutions e-fatura entegrasyonunun sunucu tarafı.
 *
 * Yalnızca platform yöneticileri kullanır (çağıran taraf `einvoice.functions.ts`
 * içinde doğrulanır). Kimlik bilgileri ortam değişkenlerinde tutulur, servis
 * adresleri ve gönderici bilgileri süper yönetici panelinden yönetilir.
 */

import { createHash } from "node:crypto";

import type { SendInput, SettingsInput } from "./einvoice-schemas";

import { buildUblInvoice, type UblLine } from "./einvoice-ubl.server";
import { postSoap, readTag, readSoapCredentials, soapLogin } from "./einvoice-soap.server";
import { recordAudit } from "./audit.server";

export type { SettingsInput, SendInput } from "./einvoice-schemas";

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
  check_user_operation: string;
  list_users_operation: string;
  resend_operation: string;
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
      .select("id, invoice_id, store_id, environment, document_number, ettn, belge_oid, status, operation, error_message, ulasti_mi, durum_kodu, yanit_durum, yanit_durum_kodu, service_message, last_checked_at, sent_at, created_at")
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
    credentialsConfigured: readSoapCredentials() !== null,
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
      check_user_operation: input.checkUserOperation,
      list_users_operation: input.listUsersOperation,
      resend_operation: input.resendOperation,
      updated_by: userId,
    })
    .eq("id", settings.id);
  if (error) throw new Error(error.message);


  await recordAudit(null, {
    action: "einvoice.settings.updated",
    actorId: userId,
    entity: "einvoice_settings",
    entityId: settings.id,
    newValue: { environment: input.environment, authMode: input.authMode, enabled: input.isEnabled },
  });

  return { ok: true as const };
}

/** Bağlantı testi: cookie yönteminde gerçek `wsLogin`, wsse yönteminde servis erişimi. */
export async function testConnection(userId: string) {
  const settings = await loadSettingsRow();
  const credentials = readSoapCredentials();
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

  await recordAudit(null, {
    action: "einvoice.connection.tested",
    actorId: userId,
    entity: "einvoice_settings",
    entityId: settings.id,
    newValue: { authMode: settings.auth_mode, environment: settings.environment },
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

/** Fatura servisine çağrı yapar; cookie yönteminde önce `wsLogin` çalıştırır. */
async function serviceCall(settings: SettingsRow, body: string) {
  const credentials = readSoapCredentials();
  if (!credentials) throw new Error("QNB kullanıcı adı/şifresi tanımlı değil");
  if (!settings.service_url) throw new Error("Servis adresi tanımlı değil");

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
  return result;
}

/** `kayitZamani` (YYYYAAGGSSDDss) değerini Date'e çevirir. */
function parseKayitZamani(raw: string | null): Date | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}T${
    digits.slice(8, 10) || "00"
  }:${digits.slice(10, 12) || "00"}:${digits.slice(12, 14) || "00"}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Akışın ilk adımı: alıcı e-fatura mükellefi mi?
 * `efaturaKullaniciBilgisi` çağrılır; dönen `etiket`, `unvan`, `kayitZamani` ve
 * `kamuKurulusu` alanları okunur. Kayıt zamanından önceki bir tarihe e-Fatura
 * düzenlenemez; bu durumda belge e-Arşiv olarak düzenlenir.
 */
export async function checkRecipient(taxId: string, issueDate?: string | null) {
  const settings = await loadSettingsRow();
  const operation = settings.check_user_operation;
  const result = await serviceCall(
    settings,
    `<ser:${operation}><vergiTcKimlikNo>${taxId}</vergiTcKimlikNo></ser:${operation}>`,
  );

  const alias = readTag(result.xml, "etiket") ?? readTag(result.xml, "alias") ?? readTag(result.xml, "gbEtiketi");
  const title = readTag(result.xml, "unvan") ?? readTag(result.xml, "title");
  const registeredAtRaw = readTag(result.xml, "kayitZamani");
  const registeredAt = parseKayitZamani(registeredAtRaw);
  const publicInstitution = (readTag(result.xml, "kamuKurulusu") ?? "").toLowerCase() === "true";
  const registered = Boolean(alias) || /<(?:[a-zA-Z0-9_-]+:)?return[\s>]/i.test(result.xml);

  // Fatura tarihi mükellefin kayıt tarihinden önceyse e-Fatura düzenlenemez.
  const issued = issueDate ? new Date(issueDate) : null;
  const beforeRegistration = Boolean(
    registered && registeredAt && issued && !Number.isNaN(issued.getTime()) && issued < registeredAt,
  );

  return {
    registered,
    beforeRegistration,
    publicInstitution,
    profile: (registered && !beforeRegistration ? "TEMELFATURA" : "EARSIVFATURA") as
      | "TEMELFATURA"
      | "EARSIVFATURA",
    ...(alias ? { alias } : {}),
    ...(title ? { title } : {}),
    ...(registeredAt ? { registeredAt: registeredAt.toISOString() } : {}),
  };
}

const DURUM_LABEL: Record<number, string> = {
  1: "Alındı",
  2: "Servis tarafından işleniyor",
  3: "Şema/şematron hatası",
};

const YANIT_LABEL: Record<number, string> = {
  [-2]: "Ticari faturanın cevap süresi doldu",
  [-1]: "Temel fatura (uygulama yanıtı beklenmez)",
  0: "Ticari fatura: alıcı henüz yanıt vermedi",
  1: "Ticari fatura: alıcı yanıt verdi",
  2: "Ticari fatura: alıcı yanıt verdi",
};

/**
 * Akışın son adımı: `gidenBelgeDurumSorgulaExt` ile belge durumu sorgulanır.
 * `ulastiMi` alanı true ise fatura alıcıya ulaşmıştır; ticari faturalarda
 * `yanitDurum` / `yanitDurumKodu` alanları kabul/ret bilgisini taşır.
 */
export async function queryDocumentStatus(documentId: string, userId: string) {
  const client = await db();
  const settings = await loadSettingsRow();

  const { data: doc, error } = await client
    .from("einvoice_documents")
    .select("id, belge_oid, document_number, ettn, store_id")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!doc) throw new Error("Gönderim kaydı bulunamadı");

  const operation = settings.status_operation;
  const selector = doc.belge_oid
    ? `<belgeOid>${doc.belge_oid}</belgeOid>`
    : `<yerelBelgeNo>${doc.document_number ?? ""}</yerelBelgeNo>`;
  const result = await serviceCall(settings, `<ser:${operation}>${selector}</ser:${operation}>`);

  const num = (name: string) => {
    const raw = readTag(result.xml, name);
    if (raw === null || raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };

  const ulastiMi = (readTag(result.xml, "ulastiMi") ?? "").toLowerCase() === "true";
  const durum = num("durum");
  const yanitDurum = num("yanitDurum");
  const yanitDurumKodu = num("yanitDurumKodu");
  const aciklama = readTag(result.xml, "aciklama");
  const resendable = (readTag(result.xml, "yenidenGonderilebilirMi") ?? "").toLowerCase() === "true";

  const parts: string[] = [];
  if (durum !== null) parts.push(DURUM_LABEL[durum] ?? `Durum kodu ${durum}`);
  if (ulastiMi) parts.push("Fatura alıcıya iletildi");
  else if (durum === 3) parts.push("Şema/şematron kontrolünden geçemedi, düzeltip yeniden gönderin");
  else parts.push("Belirli aralıklarla yeniden sorgulanmalı");
  if (yanitDurum !== null) parts.push(YANIT_LABEL[yanitDurum] ?? `Yanıt durumu ${yanitDurum}`);
  if (yanitDurumKodu === 1) parts.push("Fatura kabul edildi");
  if (yanitDurumKodu === 2) parts.push("Fatura reddedildi");
  if (aciklama) parts.push(aciklama.slice(0, 300));

  const detail = parts.join(" · ");
  const failed = durum === 3 || yanitDurumKodu === 2;

  await client
    .from("einvoice_documents")
    .update({
      ulasti_mi: ulastiMi,
      durum_kodu: durum,
      yanit_durum: yanitDurum,
      yanit_durum_kodu: yanitDurumKodu,
      service_message: detail.slice(0, 800),
      resendable,
      last_checked_at: new Date().toISOString(),
      ...(failed ? { status: "failed", error_message: detail.slice(0, 800) } : {}),
    })
    .eq("id", doc.id);

  await recordAudit(null, {
    action: "einvoice.status.queried",
    actorId: userId,
    entity: "einvoice_documents",
    entityId: doc.id,
    newValue: { ulastiMi, durum, yanitDurum, yanitDurumKodu },
  });

  return { ok: true as const, detail, ulastiMi, durum, yanitDurum, yanitDurumKodu, resendable };
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
  const credentials = readSoapCredentials();
  if (!credentials) throw new Error("QNB kullanıcı adı/şifresi tanımlı değil");

  const { data: invoice, error: invoiceError } = await client
    .from("invoices")
    .select("id, store_id, invoice_number, subtotal, tax_total, total, currency, line_items, issued_at")
    .eq("id", input.invoiceId)
    .maybeSingle();
  if (invoiceError) throw new Error(invoiceError.message);
  if (!invoice) throw new Error("Fatura bulunamadı");

  // Akış adımı 1: alıcı e-fatura mükellefi mi? "AUTO" seçiliyse servise sorulur.
  let profile: "TEMELFATURA" | "EARSIVFATURA";
  let recipientRegistered: boolean | null = null;
  if (input.profile === "AUTO") {
    const check = await checkRecipient(input.buyerTaxId, invoice.issued_at ?? null);
    profile = check.profile;
    recipientRegistered = check.registered;
  } else {
    profile = input.profile;
  }

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
    profile,
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
      country: settings.sender_country,
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
      request_summary: { profile, recipientRegistered, total, currency, bytes: xml.length },
      created_by: userId,
    })
    .select("id")
    .single();
  if (docError) throw new Error(docError.message);

  const base64 = Buffer.from(xml, "utf8").toString("base64");
  // belgeGonderExt: parametreler bloğu; belgeHash MD5, mimeType application/xml, belgeVersiyon 1.0
  const belgeHash = createHash("md5").update(Buffer.from(xml, "utf8")).digest("hex");
  const body =
    `<ser:${settings.send_operation}><parametreler>` +
    `<vergiTcKimlikNo>${settings.sender_tax_id}</vergiTcKimlikNo>` +
    `<belgeTuru>FATURA_UBL</belgeTuru>` +
    `<belgeNo>${documentNumber}</belgeNo>` +
    `<veri>${base64}</veri>` +
    `<belgeHash>${belgeHash}</belgeHash>` +
    `<mimeType>application/xml</mimeType>` +
    `<belgeVersiyon>1.0</belgeVersiyon>` +
    `</parametreler></ser:${settings.send_operation}>`;

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

    // Akış adımı 2: dönüş değerindeki <belgeOid> kaydedilir; durum sorgulaması bununla yapılır.
    const belgeOid =
      readTag(result.xml, "belgeOid") ?? readTag(result.xml, "oid") ?? readTag(result.xml, "return");

    await client
      .from("einvoice_documents")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        belge_oid: belgeOid,
        response_summary: {
          httpStatus: result.status,
          belgeOid,
          returnCode: readTag(result.xml, "returnCode") ?? readTag(result.xml, "resultCode"),
          message: (readTag(result.xml, "returnMessage") ?? readTag(result.xml, "message") ?? "").slice(0, 500),
        },
        error_message: null,
      })
      .eq("id", doc.id);

    await recordAudit(null, {
      action: "einvoice.invoice.sent",
      storeId: invoice.store_id,
      actorId: userId,
      entity: "einvoice_documents",
      entityId: doc.id,
      newValue: { documentNumber, ettn, belgeOid, profile, environment: settings.environment },
    });

    return { ok: true as const, documentNumber, ettn, profile, belgeOid, documentId: doc.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    await client
      .from("einvoice_documents")
      .update({ status: "failed", error_message: message.slice(0, 800) })
      .eq("id", doc.id);
    throw new Error(message);
  }
}
