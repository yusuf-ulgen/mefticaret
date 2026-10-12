import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { getRequest, useSession } from "@tanstack/react-start/server";

import { logSecurityEvent } from "./access-guard.server";
import { requestIp } from "./audit.server";

/**
 * Süper admin paneli için Supabase Auth'tan bağımsız giriş akışı.
 *
 * - Panel şifresi yalnızca sunucu ortam değişkeninde tutulur (ADMIN_PANEL_PASSWORD)
 *   ve sabit süreli karşılaştırma ile doğrulanır.
 * - İkinci faktör: RFC 6238 TOTP. Anahtar servis rolüyle erişilen
 *   `admin_panel_auth` tablosunda saklanır, istemciye yalnızca kurulum anında
 *   bir kez gösterilir.
 * - Başarılı girişte httpOnly + şifreli oturum çerezi yazılır (24 saat).
 * - Panelin veri erişimi mevcut RLS ile çalışmaya devam etsin diye giriş
 *   sonunda ilgili süper admin hesabı için tek kullanımlık bir Supabase
 *   devir token'ı üretilir; kullanıcı hiçbir zaman Supabase giriş formunu
 *   kullanmaz.
 */

const SESSION_NAME = "mef-admin";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 saat
const CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000; // şifre adımı 5 dakika geçerli
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export type AdminPanelSession = {
  stage?: "password" | "authenticated";
  userId?: string;
  email?: string;
  at?: number;
  pendingSecret?: string | undefined;
};

function sessionConfig() {
  const password = process.env["ADMIN_SESSION_SECRET"];
  if (!password) throw new Error("ADMIN_SESSION_SECRET tanımlı değil");
  return {
    password,
    name: SESSION_NAME,
    maxAge: SESSION_MAX_AGE,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export async function adminSession() {
  return useSession<AdminPanelSession>(sessionConfig());
}

export async function readAdminSession(): Promise<AdminPanelSession> {
  try {
    const session = await adminSession();
    return session.data;
  } catch {
    return {};
  }
}

export function hasAdminPanelSession(data: AdminPanelSession): boolean {
  if (data.stage !== "authenticated" || !data.userId || !data.at) return false;
  return Date.now() - data.at < SESSION_MAX_AGE * 1000;
}

export async function clearAdminSession(): Promise<void> {
  const session = await adminSession();
  await session.clear();
}

/* ------------------------------- şifre ---------------------------------- */

export function panelPasswordConfigured(): boolean {
  return Boolean(process.env["ADMIN_PANEL_PASSWORD"]);
}

export function panelPasswordMatches(input: string): boolean {
  const expected = process.env["ADMIN_PANEL_PASSWORD"];
  if (!expected) return false;
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/* --------------------------------- TOTP --------------------------------- */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.replace(/[^A-Za-z2-7]/g, "").toUpperCase();
  let bits = "";
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) continue;
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter % 0x100000000, 4);
  const digest = createHmac("sha1", key).update(buf).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

/** ±1 adım (30 sn) tolerans ile TOTP doğrulaması. */
export function verifyTotp(secret: string, code: string): boolean {
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== 6) return false;
  const step = Math.floor(Date.now() / 30_000);
  for (const drift of [-1, 0, 1]) {
    const expected = hotp(secret, step + drift);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))) return true;
  }
  return false;
}

export function otpauthUri(email: string, secret: string): string {
  const label = encodeURIComponent(`Mefticaret Süper Admin (${email})`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=Mefticaret&algorithm=SHA1&digits=6&period=30`;
}

/* ------------------------------ veri erişimi ---------------------------- */

export type AdminAuthRow = {
  id: string;
  user_id: string;
  email: string;
  totp_secret: string | null;
  totp_enrolled_at: string | null;
  failed_attempts: number;
  locked_until: string | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function loadAdminAuthRow(): Promise<AdminAuthRow | null> {
  const db = await admin();
  const { data, error } = await db
    .from("admin_panel_auth")
    .select("id, user_id, email, totp_secret, totp_enrolled_at, failed_attempts, locked_until")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("admin_panel_auth read failed", error);
    return null;
  }
  return (data as AdminAuthRow | null) ?? null;
}

export function isLocked(row: AdminAuthRow): boolean {
  return Boolean(row.locked_until && new Date(row.locked_until).getTime() > Date.now());
}

export async function registerFailure(row: AdminAuthRow, reason: string): Promise<number> {
  const attempts = row.failed_attempts + 1;
  const lockedUntil =
    attempts >= MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
      : row.locked_until;
  const db = await admin();
  await db
    .from("admin_panel_auth")
    .update({ failed_attempts: attempts, locked_until: lockedUntil })
    .eq("id", row.id);

  await logSecurityEvent({
    userId: row.user_id,
    kind: "admin_panel_login_failed",
    severity: attempts >= MAX_FAILED_ATTEMPTS ? "critical" : "warning",
    meta: { reason, attempts, locked: attempts >= MAX_FAILED_ATTEMPTS },
  });
  return attempts;
}

export async function registerSuccess(row: AdminAuthRow): Promise<void> {
  let ip: string | null = null;
  try {
    ip = requestIp(getRequest());
  } catch {
    ip = null;
  }
  const db = await admin();
  await db
    .from("admin_panel_auth")
    .update({
      failed_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
      last_login_ip: ip,
    })
    .eq("id", row.id);

  await logSecurityEvent({
    userId: row.user_id,
    kind: "admin_panel_login_success",
    severity: "info",
    meta: {},
  });
}

export async function enrollTotpSecret(row: AdminAuthRow, secret: string): Promise<void> {
  const db = await admin();
  await db
    .from("admin_panel_auth")
    .update({ totp_secret: secret, totp_enrolled_at: new Date().toISOString() })
    .eq("id", row.id);
  await logSecurityEvent({
    userId: row.user_id,
    kind: "admin_panel_totp_enrolled",
    severity: "info",
    meta: {},
  });
}

/** Hesabın gerçekten platform yöneticisi olduğunu veritabanından doğrular. */
export async function isPlatformAdminUser(userId: string): Promise<boolean> {
  const db = await admin();
  const { data } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "platform_admin")
    .maybeSingle();
  return Boolean(data);
}

/**
 * Panel verisi mevcut RLS ile okunduğu için giriş sonunda tek kullanımlık bir
 * Supabase devir token'ı üretilir. Şifre asla kullanılmaz.
 */
export async function mintSupabaseHandoff(email: string): Promise<string | null> {
  try {
    const db = await admin();
    const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
    if (error) {
      console.error("admin handoff link failed", error);
      return null;
    }
    return data.properties?.hashed_token ?? null;
  } catch (error) {
    console.error("admin handoff link threw", error);
    return null;
  }
}

export function challengeIsFresh(data: AdminPanelSession): boolean {
  return data.stage === "password" && Boolean(data.at) && Date.now() - data.at! < CHALLENGE_MAX_AGE_MS;
}

export const ADMIN_LOCK_MINUTES = LOCK_MINUTES;
