import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * İsteğin mutlak kök adresini döner (canonical, og:image ve sitemap için).
 * Sunucu tarafında çalışır; window kullanmaz.
 */
export const getRequestOrigin = createServerFn({ method: "GET" }).handler(() => {
  const request = getRequest();
  const url = new URL(request.url);
  const sandboxHost =
    url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
  return sandboxHost ? `https://${sandboxHost}` : url.origin;
});
