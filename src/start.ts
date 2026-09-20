// WebAuthn/x509 bağımlılıkları Reflect.metadata gerektirir; polyfill en başta yüklenir.
import "reflect-metadata";

import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { applyCacheHeaders } from "./lib/cache-headers";
import { renderErrorPage } from "./lib/error-page";
import { applySecurityHeaders } from "./lib/security-headers";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// HSTS, CSP, referrer/permissions politikaları her yanıta eklenir.
const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  const response = (result as { response?: Response }).response;
  if (response instanceof Response) applySecurityHeaders(response);
  return result;
});

// CDN/tarayıcı önbellek politikası: vitrin kısa süreli, panel/API önbelleksiz.
const cacheHeadersMiddleware = createMiddleware().server(async ({ next, request }) => {
  const result = await next();
  const response = (result as { response?: Response }).response;
  if (response instanceof Response) applyCacheHeaders(response, request.url, request.method);
  return result;
});

// Tarayıcı sayfayı terk ettiğinde bağlantı kopar ("aborted"); bu bir uygulama
// hatası değildir, hata olarak raporlanmamalı.
export function isClientAbortError(error: unknown, depth = 0): boolean {
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

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (isClientAbortError(error)) {
      return new Response(null, { status: 499 });
    }
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [securityHeadersMiddleware, cacheHeadersMiddleware, errorMiddleware, csrfMiddleware],
}));
