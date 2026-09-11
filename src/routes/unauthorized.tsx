import { Link, createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/** 403 sayfası: yetkisiz panel erişim denemelerinin indiği yer. */
export const Route = createFileRoute("/unauthorized")({
  head: () => ({
    meta: [
      { title: "Erişim yetkiniz yok — Mefticaret" },
      {
        name: "description",
        content: "Bu alana erişim yetkiniz bulunmuyor. Yetkiler sunucu ve veritabanı seviyesinde denetlenir.",
      },
      { property: "og:title", content: "Erişim yetkiniz yok — Mefticaret" },
      { property: "og:description", content: "Yetkisiz alan. Kendi mağaza paneline dönebilirsin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="surface-card flex max-w-md flex-col items-center gap-4 px-6 py-14 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="size-6" />
        </span>
        <div>
          <h1 className="font-display text-xl font-semibold">Erişim yetkiniz yok (403)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bu alan hesabınıza kapalı. Yetkiler sunucu tarafında ve veritabanı kurallarıyla denetlenir;
            arayüzden değiştirilemez. Bu deneme güvenlik kayıtlarına yazıldı.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/stores">Mağazalarıma dön</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Ana sayfa</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
