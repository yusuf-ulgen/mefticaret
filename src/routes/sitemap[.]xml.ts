import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/**
 * Kök site haritası: pazarlama sayfaları + yayınlanmış mağaza vitrinleri.
 * Mağaza içi detaylı haritalar /api/public/sitemap/<slug> altında.
 */
const BASE_URL = "https://mefticaret.lovable.app";

const STORE_PATHS = [
  "",
  "/products",
  "/categories",
  "/collections",
  "/blog",
  "/about",
  "/contact",
  "/faq",
  "/privacy",
  "/terms",
];

type SitemapEntry = { path: string; changefreq?: string; priority?: string };

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/en-iyi-e-ticaret-altyapisi", changefreq: "monthly", priority: "0.9" },
        ];

        const { createClient } = await import("@supabase/supabase-js");
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
                headers.delete("Authorization");
              headers.set("apikey", key);
              return fetch(input, { ...init, headers });
            },
          },
        });

        const pageSize = 1000;
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await supabase
            .from("stores")
            .select("slug")
            .eq("status", "active")
            .order("slug")
            .range(offset, offset + pageSize - 1);
          if (error) break;
          const rows = data ?? [];
          for (const store of rows) {
            const slug = encodeURIComponent(String(store.slug));
            for (const suffix of STORE_PATHS) {
              entries.push({
                path: `/s/${slug}${suffix}`,
                changefreq: suffix === "" ? "daily" : "weekly",
                priority: suffix === "" ? "0.8" : "0.5",
              });
            }
          }
          if (rows.length < pageSize) break;
        }

        const urls = entries.map((entry) =>
          [
            "  <url>",
            `    <loc>${BASE_URL}${entry.path}</loc>`,
            entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
            entry.priority ? `    <priority>${entry.priority}</priority>` : null,
            "  </url>",
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls,
          "</urlset>",
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
