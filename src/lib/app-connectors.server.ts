/** Uygulama mağazası entegrasyonları için sunucu tarafı bağlantı doğrulaması.
 *  Kimlik bilgileri yalnızca sunucuda okunur; sağlayıcıya doğrudan istek atılır. */

import { getVerimorBalance } from "./sms.server";

export type ConnectionResult = {
  status: "connected" | "configured" | "error";
  message: string;
};

type Settings = Record<string, unknown>;

const str = (settings: Settings, key: string) => String(settings[key] ?? "").trim();

function missing(settings: Settings, keys: string[]): string[] {
  return keys.filter((key) => !str(settings, key));
}

async function request(
  url: string,
  init: RequestInit,
  okMessage: string,
): Promise<ConnectionResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const response = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) return { status: "connected", message: okMessage };
    const body = (await response.text()).slice(0, 200);
    return {
      status: "error",
      message: `Sağlayıcı ${response.status} döndü: ${body || "ayrıntı yok"}`,
    };
  } catch (error) {
    return {
      status: "error",
      message: `Sağlayıcıya ulaşılamadı: ${(error as Error).message}`,
    };
  }
}

const basic = (user: string, pass: string) =>
  `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

/** Sağlayıcı bazlı doğrulayıcılar. Doğrulama endpoint'i olmayan sağlayıcılarda
 *  kimlik bilgileri kaydedilir ve durum "configured" olarak işaretlenir. */
const CHECKS: Record<
  string,
  { required: string[]; run: (settings: Settings) => Promise<ConnectionResult> }
> = {
  "trendyol-marketplace": {
    required: ["supplier_id", "api_key", "api_secret"],
    run: (s) =>
      request(
        `https://apigw.trendyol.com/integration/sellers/${encodeURIComponent(str(s, "supplier_id"))}/addresses`,
        {
          headers: {
            Authorization: basic(str(s, "api_key"), str(s, "api_secret")),
            "User-Agent": `${str(s, "supplier_id")} - MefTicaret`,
            Accept: "application/json",
          },
        },
        "Trendyol satıcı hesabı doğrulandı",
      ),
  },
  "trendyol-efatura": {
    required: ["username", "password", "company_vkn"],
    run: async () => ({
      status: "configured",
      message: "Kimlik bilgileri kaydedildi. Fatura gönderiminde doğrulanacak.",
    }),
  },
  "beymen-partner": {
    required: ["vendor_id", "api_key", "api_secret"],
    run: async () => ({
      status: "configured",
      message: "Kimlik bilgileri kaydedildi. Beymen Partner onayı sonrası aktifleşir.",
    }),
  },
  "ebay-marketplace": {
    required: ["client_id", "client_secret", "refresh_token"],
    run: (s) => {
      const host =
        str(s, "environment") === "sandbox" ? "api.sandbox.ebay.com" : "api.ebay.com";
      return request(
        `https://${host}/identity/v1/oauth2/token`,
        {
          method: "POST",
          headers: {
            Authorization: basic(str(s, "client_id"), str(s, "client_secret")),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: str(s, "refresh_token"),
          }).toString(),
        },
        "eBay erişim token'ı alındı",
      );
    },
  },
  "parasut-accounting": {
    required: ["company_id", "client_id", "client_secret", "username", "password"],
    run: (s) =>
      request(
        "https://api.parasut.com/oauth/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "password",
            client_id: str(s, "client_id"),
            client_secret: str(s, "client_secret"),
            username: str(s, "username"),
            password: str(s, "password"),
            redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
          }).toString(),
        },
        "Paraşüt hesabı doğrulandı",
      ),
  },
  "klaviyo-marketing": {
    required: ["private_api_key"],
    run: (s) =>
      request(
        "https://a.klaviyo.com/api/accounts/",
        {
          headers: {
            Authorization: `Klaviyo-API-Key ${str(s, "private_api_key")}`,
            revision: "2024-10-15",
            Accept: "application/json",
          },
        },
        "Klaviyo hesabı doğrulandı",
      ),
  },
  "lighthouse-audit": {
    required: ["api_key"],
    run: (s) =>
      request(
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
          "https://example.com",
        )}&strategy=${str(s, "strategy") === "desktop" ? "DESKTOP" : "MOBILE"}&key=${encodeURIComponent(
          str(s, "api_key"),
        )}`,
        { headers: { Accept: "application/json" } },
        "PageSpeed (Lighthouse) API anahtarı doğrulandı",
      ),
  },
  "google-marketing-platform": {
    required: ["organization_id", "client_id", "client_secret", "refresh_token"],
    run: (s) =>
      request(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: str(s, "client_id"),
            client_secret: str(s, "client_secret"),
            refresh_token: str(s, "refresh_token"),
          }).toString(),
        },
        "Google Marketing Platform yetkilendirmesi doğrulandı",
      ),
  },
  "tiktok-business": {
    required: ["advertiser_id", "access_token"],
    run: async (s) => {
      const result = await request(
        `https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=${encodeURIComponent(
          JSON.stringify([str(s, "advertiser_id")]),
        )}`,
        { headers: { "Access-Token": str(s, "access_token"), Accept: "application/json" } },
        "TikTok reklam hesabı doğrulandı",
      );
      return result;
    },
  },
  "meta-embedded-signup": {
    required: ["app_id", "business_id", "system_user_token"],
    run: (s) =>
      request(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(str(s, "business_id"))}?fields=id,name&access_token=${encodeURIComponent(
          str(s, "system_user_token"),
        )}`,
        { headers: { Accept: "application/json" } },
        "Meta işletme hesabı doğrulandı",
      ),
  },

  "hepsiburada-marketplace": {
    required: ["merchant_id", "username", "password"],
    run: (s) =>
      request(
        `https://listing-external.hepsiburada.com/listings/merchantid/${encodeURIComponent(
          str(s, "merchant_id"),
        )}?offset=0&limit=1`,
        {
          headers: {
            Authorization: basic(str(s, "username"), str(s, "password")),
            "User-Agent": `${str(s, "merchant_id")} - MefTicaret`,
            Accept: "application/json",
          },
        },
        "Hepsiburada satıcı hesabı doğrulandı",
      ),
  },
  "n11-marketplace": {
    required: ["app_key", "app_secret"],
    run: (s) =>
      request(
        "https://api.n11.com/cdn/cities",
        {
          headers: {
            appkey: str(s, "app_key"),
            appsecret: str(s, "app_secret"),
            Accept: "application/json",
          },
        },
        "n11 API anahtarları doğrulandı",
      ),
  },
  "aliexpress-marketplace": {
    required: ["client_id", "client_secret", "refresh_token"],
    run: async () => ({
      status: "configured",
      message: "Kimlik bilgileri kaydedildi. İmzalı istekler senkronizasyonda doğrulanacak.",
    }),
  },
  "walmart-marketplace": {
    required: ["client_id", "client_secret"],
    run: (s) => {
      const host =
        str(s, "environment") === "sandbox"
          ? "sandbox.walmartapis.com"
          : "marketplace.walmartapis.com";
      return request(
        `https://${host}/v3/token`,
        {
          method: "POST",
          headers: {
            Authorization: basic(str(s, "client_id"), str(s, "client_secret")),
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "WM_SVC.NAME": "Walmart Marketplace",
            "WM_QOS.CORRELATION_ID": crypto.randomUUID(),
          },
          body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
        },
        "Walmart erişim token'ı alındı",
      );
    },
  },
  "allegro-marketplace": {
    required: ["client_id", "client_secret"],
    run: (s) => {
      const host =
        str(s, "environment") === "sandbox" ? "allegro.pl.allegrosandbox.pl" : "allegro.pl";
      return request(
        `https://${host}/auth/oauth/token`,
        {
          method: "POST",
          headers: {
            Authorization: basic(str(s, "client_id"), str(s, "client_secret")),
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
        },
        "Allegro erişim token'ı alındı",
      );
    },
  },
  "verimor-sms": {
    required: ["username", "password", "source_addr"],
    run: async (s) => {
      const result = await getVerimorBalance({
        username: str(s, "username"),
        password: str(s, "password"),
      });
      return result.ok
        ? { status: "connected", message: result.message }
        : { status: "error", message: result.message };
    },
  },
  "pazarama-marketplace": {
    required: ["client_id", "client_secret"],
    run: (s) =>
      request(
        "https://isortagimgiris.pazarama.com/connect/token",
        {
          method: "POST",
          headers: {
            Authorization: basic(str(s, "client_id"), str(s, "client_secret")),
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            scope: "merchantgatewayapi.fullaccess",
          }).toString(),
        },
        "Pazarama erişim token'ı alındı",
      ),
  },
  "megabutik-marketplace": {
    required: ["seller_id", "api_key", "api_secret"],
    run: async () => ({
      status: "configured",
      message: "Kimlik bilgileri kaydedildi. İlk senkronizasyonda doğrulanacak.",
    }),
  },
  "printful-dropshipping": {
    required: ["api_key"],
    run: (s) =>
      request(
        "https://api.printful.com/v2/stores",
        {
          headers: {
            Authorization: `Bearer ${str(s, "api_key")}`,
            Accept: "application/json",
          },
        },
        "Printful hesabı doğrulandı",
      ),
  },
  "perads-marketing": {
    required: ["api_key"],
    run: async () => ({
      status: "configured",
      message: "Kimlik bilgileri kaydedildi. İlk kampanya senkronizasyonunda doğrulanacak.",
    }),
  },
  "make-automation": {
    required: ["api_key"],
    run: async () => ({
      status: "configured",
      message: "Kimlik bilgileri kaydedildi. Senaryo tetikleyicisi ilk çalıştığında doğrulanacak.",
    }),
  },
  "kargo-entegrator-shipping": {
    required: ["api_key"],
    run: async () => ({
      status: "configured",
      message: "Kimlik bilgileri kaydedildi. İlk kargo oluşturulduğunda doğrulanacak.",
    }),
  },
  "shipink-shipping": {
    required: ["access_token"],
    run: (s) =>
      request(
        "https://api.shipink.io/shipments?page=1&limit=1",
        {
          headers: {
            Authorization: `Bearer ${str(s, "access_token")}`,
            Accept: "application/json",
          },
        },
        "Shipink hesabı doğrulandı",
      ),
  },
  "google-tag-manager": {
    required: ["account_id", "container_id"],
    run: async () => ({
      status: "configured",
      message: "Container bilgileri kaydedildi. Site Kit entegrasyonunda doğrulanacak.",
    }),
  },
  "pts-shipping": {
    required: ["username", "password"],
    run: async () => ({
      status: "configured",
      message: "Kimlik bilgileri kaydedildi. İlk gönderide doğrulanacak.",
    }),
  },
  "ozon-marketplace": {
    required: ["client_id", "api_key"],
    run: (s) =>
      request(
        "https://api-seller.ozon.ru/v1/seller/info",
        {
          headers: {
            "Client-Id": str(s, "client_id"),
            "Api-Key": str(s, "api_key"),
            Accept: "application/json",
          },
        },
        "Ozon satıcı hesabı doğrulandı",
      ),
  },
  "iyzico-pay": {
    required: ["api_key", "secret_key"],
    run: async (s) => {
      const { createHmac, randomBytes } = await import("crypto");
      const host = s["sandbox"] === false || str(s, "sandbox") === "false"
        ? "api.iyzipay.com"
        : "sandbox-api.iyzipay.com";
      const path = "/payment/bin/check";
      const body = JSON.stringify({ locale: "tr", conversationId: "mef-check", binNumber: "552879" });
      const rnd = `${Date.now()}${randomBytes(4).toString("hex")}`;
      const sig = createHmac("sha256", str(s, "secret_key")).update(rnd + path + body).digest("hex");
      const auth = Buffer.from(
        `apiKey:${str(s, "api_key")}&randomKey:${rnd}&signature:${sig}`,
      ).toString("base64");
      try {
        const res = await fetch(`https://${host}${path}`, {
          method: "POST",
          headers: {
            Authorization: `IYZWSv2 ${auth}`,
            "x-iyzi-rnd": rnd,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body,
        });
        const json = (await res.json().catch(() => ({}))) as { status?: string; errorMessage?: string };
        if (json.status === "success") return { status: "connected", message: "iyzico hesabı doğrulandı" };
        return { status: "error", message: `iyzico: ${json.errorMessage ?? `yanıt ${res.status}`}` };
      } catch (error) {
        return { status: "error", message: `iyzico'ya ulaşılamadı: ${(error as Error).message}` };
      }
    },
  },
  klaviyo: {
    required: ["private_api_key", "list_id"],
    run: async (s) => {
      const { verifyKlaviyo } = await import("./klaviyo.server");
      try {
        const info = await verifyKlaviyo(str(s, "private_api_key"), str(s, "list_id"));
        if ((s["send_campaigns"] === true || str(s, "send_campaigns") === "true") && !str(s, "from_email")) {
          return { status: "error", message: "Kampanyaları Klaviyo'dan göndermek için gönderen e-posta gerekli." };
        }
        return {
          status: "connected",
          message: `Klaviyo bağlandı${info.organization ? ` (${info.organization})` : ""} · liste: ${info.listName ?? str(s, "list_id")}`,
        };
      } catch (error) {
        return { status: "error", message: (error as Error).message };
      }
    },
  },
  "paytr-pay": {
    required: ["merchant_id", "merchant_key", "merchant_salt"],
    run: async (s) =>
      /^\d+$/.test(str(s, "merchant_id"))
        ? {
            status: "configured",
            message: "PayTR bilgileri kaydedildi. İlk ödemede PayTR tarafından doğrulanır.",
          }
        : { status: "error", message: "PayTR mağaza numarası yalnız rakamlardan oluşmalı." },
  },
};


/** Kodu bilinen entegrasyonlar için bağlantı testi yapar. */
export async function runConnectionCheck(
  appCode: string,
  settings: Settings,
): Promise<ConnectionResult> {
  const check = CHECKS[appCode];
  if (!check) {
    return { status: "configured", message: "Bu uygulama için ayarlar kaydedildi." };
  }
  const gaps = missing(settings, check.required);
  if (gaps.length > 0) {
    return { status: "error", message: `Eksik alanlar: ${gaps.join(", ")}` };
  }
  return check.run(settings);
}

export const CONNECTOR_APP_CODES = Object.keys(CHECKS);
