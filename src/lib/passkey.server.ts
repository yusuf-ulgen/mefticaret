/**
 * Passkey (WebAuthn) hızlı kasa — sunucu katmanı.
 *
 * Gerçek WebAuthn doğrulaması yapılır: kayıt ve giriş sırasında üretilen challenge
 * veritabanında saklanır, imza `@simplewebauthn/server` ile doğrulanır ve sayaç
 * güncellenir. Passkey yalnızca oturumu açık kullanıcının kendi kaydına bağlanır.
 */

/**
 * `@simplewebauthn/server` bağımlılık ağacı (peculiar/x509 + tsyringe) modül
 * yüklenirken Reflect.metadata ister. Statik import edge worker'da tüm sayfaları
 * çökertiyordu; bu yüzden polyfill ile birlikte yalnızca çağrı anında yüklenir.
 */
async function webauthn() {
  await import("reflect-metadata");
  return await import("@simplewebauthn/server");
}

type Any = any;

const RP_NAME = "Mefticaret";

function originFrom(request: Request): { origin: string; rpID: string } {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return { origin: `${proto}://${host}`, rpID: host.split(":")[0] ?? host };
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Any;
}

async function storeChallenge(userId: string, kind: "register" | "authenticate", challenge: string) {
  const db = await admin();
  await db.from("webauthn_challenges").delete().eq("user_id", userId).eq("kind", kind);
  const { error } = await db.from("webauthn_challenges").insert({ user_id: userId, kind, challenge });
  if (error) throw new Error(error.message);
}

async function takeChallenge(userId: string, kind: "register" | "authenticate"): Promise<string> {
  const db = await admin();
  const { data, error } = await db
    .from("webauthn_challenges")
    .select("id, challenge, expires_at")
    .eq("user_id", userId)
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Doğrulama süresi doldu, tekrar deneyin.");
  await db.from("webauthn_challenges").delete().eq("id", data.id);
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error("Doğrulama süresi doldu, tekrar deneyin.");
  }
  return String(data.challenge);
}

export type PasskeyRow = { id: string; label: string; createdAt: string; lastUsedAt: string | null };

export async function listPasskeys(userId: string): Promise<PasskeyRow[]> {
  const db = await admin();
  const { data, error } = await db
    .from("webauthn_credentials")
    .select("id, label, created_at, last_used_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Any[]).map((row) => ({
    id: String(row.id),
    label: String(row.label ?? "Passkey"),
    createdAt: String(row.created_at),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
  }));
}

export async function deletePasskey(userId: string, id: string) {
  const db = await admin();
  const { error } = await db.from("webauthn_credentials").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function beginPasskeyRegistration(options: {
  request: Request;
  userId: string;
  userName: string;
}) {
  const { rpID } = originFrom(options.request);
  const db = await admin();
  const { data: existing } = await db
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", options.userId);

  const result = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new TextEncoder().encode(options.userId),
    userName: options.userName,
    attestationType: "none",
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    excludeCredentials: ((existing ?? []) as Any[]).map((row) => ({ id: String(row.credential_id) })),
  });

  await storeChallenge(options.userId, "register", result.challenge);
  return result;
}

export async function finishPasskeyRegistration(options: {
  request: Request;
  userId: string;
  label: string;
  response: unknown;
}) {
  const { origin, rpID } = originFrom(options.request);
  const expectedChallenge = await takeChallenge(options.userId, "register");

  const verification = await verifyRegistrationResponse({
    response: options.response as Any,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Passkey doğrulanamadı. Lütfen tekrar deneyin.");
  }

  const credential = verification.registrationInfo.credential;
  const db = await admin();
  const { error } = await db.from("webauthn_credentials").insert({
    user_id: options.userId,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString("base64"),
    counter: credential.counter ?? 0,
    transports: (credential.transports ?? []).join(","),
    label: options.label.slice(0, 60) || "Passkey",
  });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function beginPasskeyAuthentication(options: { request: Request; userId: string }) {
  const { rpID } = originFrom(options.request);
  const db = await admin();
  const { data: credentials } = await db
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", options.userId);
  const rows = (credentials ?? []) as Any[];
  if (rows.length === 0) throw new Error("Bu hesapta kayıtlı passkey yok.");

  const result = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: rows.map((row) => ({ id: String(row.credential_id) })),
  });
  await storeChallenge(options.userId, "authenticate", result.challenge);
  return result;
}

/** Passkey imzasını doğrular; başarılıysa sayaç güncellenir. */
export async function verifyPasskeyAssertion(options: {
  request: Request;
  userId: string;
  response: unknown;
}): Promise<{ verified: true }> {
  const { origin, rpID } = originFrom(options.request);
  const expectedChallenge = await takeChallenge(options.userId, "authenticate");
  const credentialId = String((options.response as Any)?.id ?? "");
  if (!credentialId) throw new Error("Passkey yanıtı geçersiz.");

  const db = await admin();
  const { data: row, error } = await db
    .from("webauthn_credentials")
    .select("id, credential_id, public_key, counter, transports")
    .eq("user_id", options.userId)
    .eq("credential_id", credentialId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Bu passkey hesabınıza kayıtlı değil.");

  const verification = await verifyAuthenticationResponse({
    response: options.response as Any,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
    credential: {
      id: String(row.credential_id),
      publicKey: new Uint8Array(Buffer.from(String(row.public_key), "base64")),
      counter: Number(row.counter ?? 0),
      transports: String(row.transports ?? "")
        .split(",")
        .filter(Boolean) as Any,
    },
  });
  if (!verification.verified) throw new Error("Passkey doğrulaması başarısız.");

  await db
    .from("webauthn_credentials")
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  return { verified: true };
}
