/** OAuth 2.0 sabitleri: grant tipleri, token ömürleri ve scope kaynağı. */

import { API_SCOPES, API_SCOPE_LABELS, type ApiScope } from "@/lib/api-keys";

export const OAUTH_SCOPES = API_SCOPES;
export const OAUTH_SCOPE_LABELS = API_SCOPE_LABELS;
export type OAuthScope = ApiScope;

export const OAUTH_GRANT_TYPES = [
  "authorization_code",
  "client_credentials",
  "refresh_token",
] as const;
export type OAuthGrantType = (typeof OAUTH_GRANT_TYPES)[number];

export const OAUTH_GRANT_LABELS: Record<OAuthGrantType, string> = {
  authorization_code: "Yetkilendirme kodu (kullanıcı onaylı)",
  client_credentials: "İstemci kimlik bilgileri (sunucudan sunucuya)",
  refresh_token: "Yenileme belirteci",
};

/** Erişim belirteci ömrü: 1 saat, yenileme belirteci: 30 gün. */
export const OAUTH_ACCESS_TOKEN_TTL_SECONDS = 3600;
export const OAUTH_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 3600;
export const OAUTH_CODE_TTL_SECONDS = 600;

export const OAUTH_ENDPOINTS = {
  authorize: "/oauth/authorize",
  token: "/api/public/oauth/token",
  revoke: "/api/public/oauth/revoke",
  introspect: "/api/public/oauth/introspect",
} as const;
