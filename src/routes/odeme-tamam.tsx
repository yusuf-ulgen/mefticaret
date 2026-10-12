import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/odeme-tamam")({
  head: () => ({
    meta: [
      { title: "Ödeme tamamlandı — Mefticaret" },
      {
        name: "description",
        content:
          "Abonelik ödemeniz alındı. Paketiniz birkaç saniye içinde panelinizde etkinleşir.",
      },
      { property: "og:title", content: "Ödeme tamamlandı — Mefticaret" },
      {
        property: "og:description",
        content: "Abonelik ödemeniz alındı, paketiniz etkinleştiriliyor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentSuccessPage,
});

function PaymentSuccessPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <CheckCircle2 className="size-14 text-primary" />
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Ödemeniz alındı</h1>
        <p className="text-muted-foreground">
          Paketiniz birkaç saniye içinde etkinleşir ve faturanız panelinizdeki Abonelik
          bölümünde görünür. Sayfayı yenileyerek durumu kontrol edebilirsiniz.
        </p>
      </div>
      <Button asChild>
        <Link to="/">Panele dön</Link>
      </Button>
    </main>
  );
}
