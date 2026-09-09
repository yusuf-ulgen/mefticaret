import { createFileRoute } from "@tanstack/react-router";

/**
 * Blog kapak görsellerini herkese açık olarak sunar. Depolama kovası özel
 * olduğu için görsel sunucu tarafında okunur; yalnızca bu kovadaki dosyalar
 * ve güvenli yol karakterleri kabul edilir.
 */
export const Route = createFileRoute("/api/public/blog-cover/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!/^[A-Za-z0-9/_-]+\.(jpg|jpeg|png|webp)$/.test(path) || path.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("blog-covers").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });

        return new Response(await data.arrayBuffer(), {
          headers: {
            "content-type": data.type || "image/jpeg",
            "cache-control": "public, max-age=3600, s-maxage=86400, immutable",
          },
        });
      },
    },
  },
});
