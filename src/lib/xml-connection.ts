/**
 * Besleme bağlantı türleri (adres / FTP / SFTP / webhook) — tarayıcı ve sunucu
 * tarafında paylaşılan tipler ve güvenli okuma-yazma yardımcıları.
 *
 * Şifre gibi gizli alanlar veritabanında tutulur; tarayıcıya yalnızca
 * "kayıtlı mı" bilgisi gönderilir (bkz. maskFtpConfig).
 */

export const CONNECTION_TYPES = ["url", "ftp", "sftp", "webhook"] as const;
export type ConnectionType = (typeof CONNECTION_TYPES)[number];

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  url: "Bağlantı adresi (HTTP/HTTPS)",
  ftp: "FTP sunucusu",
  sftp: "SFTP sunucusu",
  webhook: "Webhook (tedarikçi gönderir)",
};

export const CONNECTION_TYPE_HINTS: Record<ConnectionType, string> = {
  url: "Dosya adresini biz belirli aralıklarla indiririz.",
  ftp: "Dosyayı FTP sunucusundan biz indiririz.",
  sftp: "Güvenli FTP (SSH) sunucusundan indirme bu ortamda desteklenmiyor.",
  webhook: "Tedarikçi dosyayı size verilen gizli adrese gönderir; biz beklemeyiz.",
};

/** Bağlantı türüne göre varsayılan port. */
export const DEFAULT_PORTS: Record<ConnectionType, number> = {
  url: 443,
  ftp: 21,
  sftp: 22,
  webhook: 443,
};

export type FtpConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  passive: boolean;
  ssl: boolean;
  filePath: string;
};

export const DEFAULT_FTP_CONFIG: FtpConfig = {
  host: "",
  port: 21,
  username: "",
  password: "",
  passive: true,
  ssl: false,
  filePath: "/export/products.xml",
};

const asText = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;

const asBool = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

export function parseConnectionType(value: unknown): ConnectionType {
  return CONNECTION_TYPES.includes(value as ConnectionType) ? (value as ConnectionType) : "url";
}

/** Veritabanı JSON'unu güvenli okur; hem snake_case hem camelCase kabul eder. */
export function parseFtpConfig(value: unknown): FtpConfig {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const port = Number(raw["port"] ?? DEFAULT_FTP_CONFIG.port);
  return {
    host: asText(raw["host"]).trim().slice(0, 253),
    port: Number.isFinite(port) && port > 0 && port <= 65535 ? Math.round(port) : DEFAULT_FTP_CONFIG.port,
    username: asText(raw["username"]).slice(0, 200),
    password: asText(raw["password"]).slice(0, 400),
    passive: asBool(raw["passive"], true),
    ssl: asBool(raw["ssl"], false),
    filePath: asText(raw["file_path"] ?? raw["filePath"], DEFAULT_FTP_CONFIG.filePath).slice(0, 500),
  };
}

export function serializeFtpConfig(config: FtpConfig): Record<string, unknown> {
  return {
    host: config.host.trim(),
    port: config.port,
    username: config.username,
    password: config.password,
    passive: config.passive,
    ssl: config.ssl,
    file_path: config.filePath.trim() || DEFAULT_FTP_CONFIG.filePath,
  };
}

/** Tarayıcıya gönderilecek güvenli özet — şifre yerine yalnızca bir işaret. */
export function maskFtpConfig(value: unknown): Omit<FtpConfig, "password"> & { hasPassword: boolean } {
  const parsed = parseFtpConfig(value);
  const { password, ...rest } = parsed;
  return { ...rest, hasPassword: password.length > 0 };
}
