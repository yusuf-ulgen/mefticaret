import { Outlet, createFileRoute } from "@tanstack/react-router";

/** Süper admin bölümünün layout route'u; alt sayfalar kendi kabuk başlıklarını verir. */
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Süper Admin — Mefticaret" },
      {
        name: "description",
        content: "Platform genelinde mağazaları, paketleri, komisyonları ve denetim kayıtlarını yönet.",
      },
      { property: "og:title", content: "Süper Admin — Mefticaret" },
      { property: "og:description", content: "Çok kiracılı platformun merkezi yönetim konsolu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Outlet />,
});
