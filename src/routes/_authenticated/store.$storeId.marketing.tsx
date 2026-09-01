import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MessageCircle,
  PenLine,
  Search,
  Tag,
  Ticket,
  Users,
  Zap,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/store/$storeId/marketing")({
  head: () => ({
    meta: [
      { title: "Pazarlama Merkezi — Mefticaret" },
      {
        name: "description",
        content: "Kuponlar, otomasyonlar, segmentler, WhatsApp ve içerik pazarlaması tek merkezden.",
      },
      { property: "og:title", content: "Pazarlama Merkezi — Mefticaret" },
      {
        property: "og:description",
        content: "Tüm büyüme araçlarını tek ekrandan yönet: kampanya, otomasyon, segment, WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketingHub,
});

const LINKS = [
  {
    to: "/store/$storeId/discounts" as const,
    label: "Kuponlar & İndirimler",
    description: "Yüzde, sabit tutar ve kargo bedava kampanyaları oluştur.",
    icon: Ticket,
  },
  {
    to: "/store/$storeId/campaigns" as const,
    label: "Kampanya Performansı",
    description: "Kupon başına ciro, indirim maliyeti ve yeni müşteri kazanımı.",
    icon: Tag,
  },
  {
    to: "/store/$storeId/automations" as const,
    label: "Pazarlama Otomasyonu",
    description: "Terk edilen sepet, sipariş sonrası ve stok bildirim akışları.",
    icon: Zap,
  },
  {
    to: "/store/$storeId/customer-segments" as const,
    label: "Müşteri Segmentleri",
    description: "Kural bazlı segmentlerle doğru kitleye ulaş.",
    icon: Users,
  },
  {
    to: "/store/$storeId/whatsapp" as const,
    label: "WhatsApp Business",
    description: "Şablon mesaj, otomatik yanıt ve konuşma yönetimi.",
    icon: MessageCircle,
  },
  {
    to: "/store/$storeId/blog" as const,
    label: "Blog & İçerik",
    description: "İçerik pazarlaması ile organik trafiği büyüt.",
    icon: PenLine,
  },
  {
    to: "/store/$storeId/seo" as const,
    label: "SEO Denetimi",
    description: "Başlık, açıklama ve teknik SEO eksiklerini kapat.",
    icon: Search,
  },
];

function MarketingHub() {
  const { storeId } = Route.useParams();

  return (
    <AppShell title="Pazarlama" description="Büyüme araçlarının tamamına tek merkezden eriş.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {LINKS.map((link) => (
          <Link
            key={link.label}
            to={link.to}
            params={{ storeId }}
            className="surface-card group flex flex-col gap-2 p-5 transition-colors hover:border-primary/50"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <link.icon className="size-4" />
            </span>
            <p className="font-display text-base font-semibold">{link.label}</p>
            <p className="text-sm text-muted-foreground">{link.description}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
