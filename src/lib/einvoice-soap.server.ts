/**
 * QNB eSolutions (Özel Entegratör) SOAP taşıyıcı katmanı.
 *
 * Dokümantasyonda tanımlı iki kimlik doğrulama yöntemi desteklenir:
 *  - `wsse`  : Her istekte SOAP Header içinde WS-Security UsernameToken.
 *  - `cookie`: Önce `wsLogin` çağrılır, dönen oturum çerezi (JSESSIONID vb.)
 *              sonraki isteklerde `Cookie` başlığıyla taşınır.
 *
 * Kimlik bilgileri yalnızca sunucu ortam değişkenlerinden okunur
 * (`QNB_EINVOICE_USERNAME` / `QNB_EINVOICE_PASSWORD`); veritabanında veya
 * istemcide tutulmaz. Dış isteklerde SSRF koruması için `safeFetch` kullanılır.
 */

import { safeFetch } from "./safe-fetch.server";

export type SoapAuthMode = "wsse" | "cookie";

export interface SoapCredentials {
  username: string;
  password: string;
}

/** Ortam değişkenlerinden kimlik bilgisi okur; eksikse null döner. */
export function readSoapCredentials(): SoapCredentials | null {
  const username = process.env["QNB_EINVOICE_USERNAME"];
  const password = process.env["QNB_EINVOICE_PASSWORD"];
  if (!username || !password) return null;
  return { username, password };
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const WSSE_NS =
  "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd";

function wsseHeader(credentials: SoapCredentials): string {
  return `<soapenv:Header><wsse:Security xmlns:wsse="${WSSE_NS}"><wsse:UsernameToken><wsse:Username>${escapeXml(
    credentials.username,
  )}</wsse:Username><wsse:Password>${escapeXml(
    credentials.password,
  )}</wsse:Password></wsse:UsernameToken></wsse:Security></soapenv:Header>`;
}

export function buildEnvelope(input: {
  namespace: string;
  body: string;
  credentials?: SoapCredentials | undefined;
}): string {
  const header = input.credentials ? wsseHeader(input.credentials) : "<soapenv:Header/>";
  return `<?xml version="1.0" encoding="utf-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="${escapeXml(
    input.namespace,
  )}">${header}<soapenv:Body>${input.body}</soapenv:Body></soapenv:Envelope>`;
}

/** Yanıt gövdesinden yerel etiket adına göre ilk değeri okur. */
export function readTag(xml: string, localName: string): string | null {
  const pattern = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${localName}[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9_-]+:)?${localName}>`, "i");
  const match = pattern.exec(xml);
  return match?.[1]?.trim() ?? null;
}

/** Yanıt gövdesindeki aynı adlı tüm etiketlerin değerlerini döner. */
export function readTags(xml: string, localName: string): string[] {
  const pattern = new RegExp(
    `<(?:[a-zA-Z0-9_-]+:)?${localName}[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9_-]+:)?${localName}>`,
    "gi",
  );
  const values: string[] = [];
  for (const match of xml.matchAll(pattern)) {
    values.push((match[1] ?? "").trim());
  }
  return values;
}

/** SOAP Fault varsa mesajını döner. */
export function readFault(xml: string): string | null {
  if (!/<(?:[a-zA-Z0-9_-]+:)?Fault[\s>]/i.test(xml)) return null;
  return (
    readTag(xml, "faultstring") ??
    readTag(xml, "Reason") ??
    readTag(xml, "Text") ??
    "Servis SOAP Fault döndürdü"
  );
}

export interface SoapResult {
  status: number;
  xml: string;
  cookie: string | null;
  fault: string | null;
}

/** Set-Cookie başlıklarını `ad=değer` çiftlerine indirger. */
function collectCookies(response: Response): string | null {
  const raw =
    typeof (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (response.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [response.headers.get("set-cookie") ?? ""].filter(Boolean);
  const pairs = raw
    .map((line) => line.split(";")[0]?.trim() ?? "")
    .filter((pair) => pair.includes("="));
  return pairs.length > 0 ? pairs.join("; ") : null;
}

export async function postSoap(input: {
  url: string;
  namespace: string;
  body: string;
  soapAction?: string | undefined;
  credentials?: SoapCredentials | undefined;
  cookie?: string | null | undefined;
  timeoutMs?: number;
}): Promise<SoapResult> {
  const envelope = buildEnvelope({
    namespace: input.namespace,
    body: input.body,
    ...(input.credentials ? { credentials: input.credentials } : {}),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 30_000);
  try {
    const response = await safeFetch(input.url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
        ...(input.soapAction ? { SOAPAction: `"${input.soapAction}"` } : {}),
        ...(input.cookie ? { Cookie: input.cookie } : {}),
      },
      body: envelope,
      signal: controller.signal,
    });
    const xml = await response.text();
    return {
      status: response.status,
      xml,
      cookie: collectCookies(response),
      fault: readFault(xml),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * `wsLogin` çağrısı yapar ve oturum çerezini döner (cookie container yöntemi).
 */
export async function soapLogin(input: {
  url: string;
  namespace: string;
  operation: string;
  credentials: SoapCredentials;
  lang?: string;
}): Promise<{ cookie: string; raw: string }> {
  const body = `<ser:${input.operation}><userId>${escapeXml(
    input.credentials.username,
  )}</userId><password>${escapeXml(input.credentials.password)}</password><lang>${escapeXml(
    input.lang ?? "tr",
  )}</lang></ser:${input.operation}>`;

  const result = await postSoap({ url: input.url, namespace: input.namespace, body });
  if (result.fault) throw new Error(`Giriş başarısız: ${result.fault}`);
  if (result.status >= 400) {
    throw new Error(`Giriş başarısız (HTTP ${result.status})`);
  }
  if (!result.cookie) {
    throw new Error("Servis oturum çerezi döndürmedi; kimlik bilgilerini ve giriş adresini kontrol edin");
  }
  return { cookie: result.cookie, raw: result.xml.slice(0, 4000) };
}
