import { createFileRoute } from "@tanstack/react-router";

/**
 * Ürün görsellerini herkese açık HTTPS adresi ile sunar (pazaryeri XML
 * beslemeleri süresi dolmayan adres ister). Depo özel olduğu için dosya
 * sunucu tarafında okunur ve yalnızca yayında mağazanın yayında ürününe ait
 * kayıtlı görsel yolları kabul edilir.
 */
export const Route = createFileRoute("/api/public/product-image/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const raw = (params as { _splat?: string })._splat ?? "";
        const path = raw
          .split("/")
          .map((part) => {
            try {
              return decodeURIComponent(part);
            } catch {
              return part;
            }
          })
          .join("/");

        if (!/^[A-Za-z0-9/._-]+\.(jpg|jpeg|png|webp|avif|gif)$/i.test(path) || path.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: imageRow } = await supabaseAdmin
          .from("product_images")
          .select("id, product_id, products!inner(status, stores!inner(status))")
          .eq("storage_path", path)
          .maybeSingle();

        const image = imageRow as Record<string, any> | null;
        if (!image || image["products"]?.status !== "active" || image["products"]?.stores?.status !== "active") {
          return new Response("Not found", { status: 404 });
        }

        const { data, error } = await supabaseAdmin.storage.from("store-media").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });

        return new Response(await data.arrayBuffer(), {
          headers: {
            "content-type": data.type || "image/jpeg",
            "cache-control": "public, max-age=3600, s-maxage=86400",
          },
        });
      },
    },
  },
});
