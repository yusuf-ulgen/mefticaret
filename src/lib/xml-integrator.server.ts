/**
 * XmlIntegrator — sunucu katmanı.
 *
 * Tedarikçi/pazaryeri kaynaklarını güvenli şekilde indirir (SSRF korumalı),
 * içeriği satırlara çevirir ve alan envanterini üretir. Kimlik bilgileri
 * yalnızca sunucuda kullanılır; tarayıcıya asla gönderilmez.
 */

import {
  detectFormat,
  parseSourceText,
  suggestMapping,
  type FieldMapping,
  type ParsedSource,
  type XmlAuthType,
  type XmlSourceFormat,
} from "@/lib/xml-integrator";
import { safeFetch } from "@/lib/safe-fetch.server";
import { parseConnectionType, type ConnectionType } from "@/lib/xml-connection";

const MAX_BYTES = 40 * 1024 * 1024; // 40 MB

export type AuthConfig = {
  username?: string;
  password?: string;
  token?: string;
  headerName?: string;
  headerValue?: string;
  queryName?: string;
  queryValue?: string;
};

/** Kimlik doğrulama ayarını istek başlıklarına / adrese uygular. */
function applyAuth(rawUrl: string, authType: XmlAuthType, config: AuthConfig) {
  const headers: Record<string, string> = {
    accept: "application/xml, text/xml, text/csv, application/json;q=0.9, */*;q=0.8",
    "user-agent": "Mefticaret-XmlIntegrator/1.0",
  };
  let url = rawUrl;

  if (authType === "basic" && config.username) {
    const raw = `${config.username}:${config.password ?? ""}`;
    headers["authorization"] = `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
  }
  if (authType === "bearer" && config.token) headers["authorization"] = `Bearer ${config.token}`;
  if (authType === "header" && config.headerName) headers[config.headerName.toLowerCase()] = config.headerValue ?? "";
  if (authType === "query" && config.queryName) {
    const parsed = new URL(url);
    parsed.searchParams.set(config.queryName, config.queryValue ?? "");
    url = parsed.toString();
  }

  return { url, headers };
}

export type FetchedSource = {
  content: string;
  format: XmlSourceFormat;
  bytes: number;
  contentType: string | null;
};

/**
 * Kaynağı indirir; boyut sınırını aşan yanıtlar reddedilir.
 *
 * Bağlantı türüne göre: "url" adresten indirir, "ftp"/"sftp" dosya sunucusundan
 * çeker, "webhook" beslemelerinde içerik tedarikçi tarafından gönderilmiş olur
 * ve inlineContent ile verilir.
 */
export async function fetchSource(input: {
  url?: string | null;
  authType?: XmlAuthType;
  authConfig?: AuthConfig;
  format?: XmlSourceFormat | null;
  connectionType?: ConnectionType;
  ftpConfig?: unknown;
  /** Webhook ile gönderilen ham içerik. */
  inlineContent?: string | null;
}): Promise<FetchedSource> {
  const connectionType = parseConnectionType(input.connectionType ?? "url");

  if (input.inlineContent != null) {
    const content = input.inlineContent;
    const bytes = new TextEncoder().encode(content).length;
    if (bytes > MAX_BYTES) throw new Error("Gönderilen dosya 40 MB sınırını aşıyor");
    return {
      content,
      format: input.format ?? detectFormat("", content),
      bytes,
      contentType: null,
    };
  }

  if (connectionType === "ftp" || connectionType === "sftp") {
    const { fetchFromFtp } = await import("@/lib/xml-ftp.server");
    const fetched = await fetchFromFtp(input.ftpConfig, connectionType);
    return {
      content: fetched.content,
      format: input.format ?? detectFormat(fetched.filePath, fetched.content),
      bytes: fetched.bytes,
      contentType: null,
    };
  }

  if (connectionType === "webhook") {
    throw new Error("Webhook beslemesi kendi kendine indirme yapmaz; tedarikçinin dosyayı göndermesi beklenir");
  }

  if (!input.url) throw new Error("Kaynak bağlantısı tanımlı değil");
  const { url, headers } = applyAuth(input.url, input.authType ?? "none", input.authConfig ?? {});

  let response: Response;
  try {
    response = await safeFetch(url, { headers, signal: AbortSignal.timeout(60_000) });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Kaynağa ulaşılamadı";
    throw new Error(`Kaynak indirilemedi: ${message}`);
  }
  if (!response.ok) {
    throw new Error(`Kaynak ${response.status} durum kodu döndürdü`);
  }

  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared && declared > MAX_BYTES) throw new Error("Kaynak dosya 40 MB sınırını aşıyor");

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) throw new Error("Kaynak dosya 40 MB sınırını aşıyor");

  const contentType = response.headers.get("content-type");
  const content = new TextDecoder("utf-8").decode(buffer);
  const format =
    input.format ??
    (contentType?.includes("json")
      ? "json"
      : contentType?.includes("csv")
        ? "csv"
        : detectFormat(new URL(url).pathname, content));

  return { content, format, bytes: buffer.byteLength, contentType };
}

export type SourceAnalysis = ParsedSource & {
  suggestedMapping: FieldMapping;
  bytes: number;
};

/** Kaynağı indirir, satırlara çevirir ve eşleştirme önerisi üretir. */
export async function analyzeSource(input: {
  url?: string | null;
  authType?: XmlAuthType;
  authConfig?: AuthConfig;
  format?: XmlSourceFormat | null;
  itemPath?: string | null;
  limit?: number;
  connectionType?: ConnectionType;
  ftpConfig?: unknown;
  inlineContent?: string | null;
}): Promise<SourceAnalysis> {
  const fetched = await fetchSource(input);
  const parsed = parseSourceText(fetched.content, fetched.format, {
    itemPath: input.itemPath ?? null,
    limit: input.limit ?? 200,
  });
  return { ...parsed, suggestedMapping: suggestMapping(parsed.columns), bytes: fetched.bytes };
}

type Client = { from: (table: string) => any };

/** Alan envanterini (sütun listesi + örnek değerler) kaydeder. */
export async function saveFieldSchema(
  admin: Client,
  input: { storeId: string; feedId: string; parsed: ParsedSource },
): Promise<number> {
  const samples = new Map<string, string[]>();
  for (const row of input.parsed.rows.slice(0, 25)) {
    for (const [key, value] of Object.entries(row)) {
      const path = key.replace(/\[\d+\]/g, "[]");
      const list = samples.get(path) ?? [];
      if (value && list.length < 3 && !list.includes(value)) list.push(value.slice(0, 200));
      samples.set(path, list);
    }
  }

  const rows = input.parsed.columns.map((column) => ({
    store_id: input.storeId,
    feed_id: input.feedId,
    field_path: column,
    label: column.split(".").pop() ?? column,
    sample_values: samples.get(column) ?? [],
    occurrence: input.parsed.rows.filter((row) =>
      Object.keys(row).some((key) => key.replace(/\[\d+\]/g, "[]") === column),
    ).length,
    detected_type: detectType(samples.get(column) ?? []),
  }));

  if (!rows.length) return 0;

  // Kaynak değişince eski alanlar kalmasın.
  await admin.from("xml_field_schemas").delete().eq("feed_id", input.feedId);
  const { error } = await admin.from("xml_field_schemas").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

function detectType(samples: string[]): string {
  if (!samples.length) return "unknown";
  if (samples.every((value) => /^-?\d+([.,]\d+)?$/.test(value.trim()))) return "number";
  if (samples.every((value) => /^https?:\/\//i.test(value.trim()))) return "url";
  if (samples.every((value) => /^(true|false|1|0|evet|hayır|var|yok)$/i.test(value.trim()))) return "boolean";
  return "text";
}
