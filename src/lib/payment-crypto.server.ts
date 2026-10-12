/** Ödeme sağlayıcı kimlik bilgileri için AES-GCM şifreleme (yalnız sunucu). */

async function key() {
  const secret = process.env["PAYMENT_CREDENTIALS_KEY"];
  if (!secret) throw new Error("Ödeme şifreleme anahtarı yapılandırılmamış");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

export async function encryptCredentials(value: Record<string, string>): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), data));
  return `v1:${b64(iv)}:${b64(cipher)}`;
}

export async function decryptCredentials(payload: string | null): Promise<Record<string, string>> {
  if (!payload) return {};
  const [version, iv, cipher] = payload.split(":");
  if (version !== "v1" || !iv || !cipher) throw new Error("Kimlik bilgisi okunamadı");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(iv, "base64") },
    await key(),
    Buffer.from(cipher, "base64"),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as Record<string, string>;
}

/** Arayüzde gösterilecek maskeli ipucu (son 4 karakter). */
export function hintOf(value: Record<string, string>) {
  const hint: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) if (v) hint[k] = v.length > 4 ? `••••${v.slice(-4)}` : "••••";
  return hint;
}
