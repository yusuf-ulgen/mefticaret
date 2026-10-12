import "./lib/reflect-shim";
import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { agentDiscoveryResponse, DISCOVERY_LINK_HEADER, htmlToMarkdown } from "./lib/agent-discovery";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

// Tarayıcı isteği iptal ettiğinde ("aborted") bu bir uygulama hatası değildir.
function isClientAbortError(error: unknown, depth = 0): boolean {
  if (error == null || depth > 5) return false;
  const err = error as { name?: unknown; message?: unknown; code?: unknown; cause?: unknown };
  if (
    err.name === "AbortError" ||
    err.code === "ECONNRESET" ||
    err.code === "ABORT_ERR" ||
    (typeof err.message === "string" &&
      /(^|\n)\s*(Error:\s*)?(aborted|The user aborted a request\.)\s*($|\n)/.test(err.message))
  ) {
    return true;
  }
  return isClientAbortError(err.cause, depth + 1);
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  request: Request,
): Promise<Response> {
  if (response.status < 500) return response;
  // İstemci bağlantıyı kapattıysa h3 isteği 500'e çevirir; bu bir uygulama hatası değildir.
  if (request.signal?.aborted) return new Response(null, { status: 499 });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

async function decorateForAgents(response: Response, request: Request): Promise<Response> {
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("text/html") || response.status >= 400) return response;
  const headers = new Headers(response.headers);
  headers.append("link", DISCOVERY_LINK_HEADER);
  headers.append("vary", "Accept");
  const accept = request.headers.get("accept") ?? "";
  if (request.method === "GET" && /text\/markdown/i.test(accept)) {
    const md = htmlToMarkdown(await response.text());
    headers.set("content-type", "text/markdown; charset=utf-8");
    headers.delete("content-length");
    headers.delete("content-encoding");
    return new Response(md, { status: response.status, headers });
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (request.method === "GET" || request.method === "HEAD") {
      const discovery = agentDiscoveryResponse(url.pathname);
      if (discovery) return discovery;
    }
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response, request);
      return await decorateForAgents(normalized, request);
    } catch (error) {
      // İstemci bağlantıyı kapattıysa (sayfadan ayrılma/yenileme) hata raporlamayız.
      if (isClientAbortError(error) || request.signal?.aborted) {
        return new Response(null, { status: 499 });
      }
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
