import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { exchangeToken } from "@/lib/oauth.server";

/** OAuth 2.0 token endpoint: authorization_code (PKCE), client_credentials, refresh_token. */

const bodySchema = z.object({
  grant_type: z.string().trim().min(3).max(40),
  client_id: z.string().trim().min(4).max(120).optional(),
  client_secret: z.string().trim().min(8).max(400).optional(),
  code: z.string().trim().max(400).optional(),
  redirect_uri: z.string().trim().max(400).optional(),
  code_verifier: z.string().trim().min(43).max(128).optional(),
  refresh_token: z.string().trim().max(400).optional(),
  scope: z.string().trim().max(600).optional(),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Cache-Control": "no-store",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function readBody(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return await request.json();
  const form = await request.formData();
  return Object.fromEntries(Array.from(form.entries()).map(([k, v]) => [k, String(v)]));
}

export const Route = createFileRoute("/api/public/oauth/token")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await readBody(request);
        } catch {
          return json({ error: "invalid_request", error_description: "Gövde okunamadı" }, 400);
        }

        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) {
          return json(
            { error: "invalid_request", error_description: parsed.error.issues[0]?.message ?? "Geçersiz istek" },
            400,
          );
        }

        // İstemci kimliği Basic header veya gövdeden okunur.
        let clientId = parsed.data.client_id ?? "";
        let clientSecret = parsed.data.client_secret ?? "";
        const auth = request.headers.get("authorization") ?? "";
        if (auth.toLowerCase().startsWith("basic ")) {
          const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
          const index = decoded.indexOf(":");
          if (index > 0) {
            clientId = decoded.slice(0, index);
            clientSecret = decoded.slice(index + 1);
          }
        }
        if (!clientId || !clientSecret) {
          return json({ error: "invalid_client", error_description: "İstemci bilgileri eksik" }, 401);
        }

        try {
          const result = await exchangeToken({
            grantType: parsed.data.grant_type,
            clientId,
            clientSecret,
            ...(parsed.data.code ? { code: parsed.data.code } : {}),
            ...(parsed.data.redirect_uri ? { redirectUri: parsed.data.redirect_uri } : {}),
            ...(parsed.data.code_verifier ? { codeVerifier: parsed.data.code_verifier } : {}),
            ...(parsed.data.refresh_token ? { refreshToken: parsed.data.refresh_token } : {}),
            ...(parsed.data.scope ? { scope: parsed.data.scope } : {}),
          });

          if ("error" in result) {
            const { status, ...body } = result;
            return json(body, status);
          }
          return json(result, 200);
        } catch (error) {
          console.error("oauth token error", error);
          return json({ error: "server_error", error_description: "Token üretilemedi" }, 500);
        }
      },
    },
  },
});
