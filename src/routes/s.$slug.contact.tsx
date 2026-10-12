import { createFileRoute } from "@tanstack/react-router";

import { InfoPage, infoHead, infoLoader, type InfoContent } from "@/components/storefront-info-route";
import { StorefrontFallback } from "@/components/storefront-parts";

const content: InfoContent = {
  route: "contact",
  title: "İletişim",
  description: "Sipariş, kargo ve iade konularında bize ulaşabileceğin iletişim kanalları.",
  intro: "Sorularını en kısa sürede yanıtlıyoruz. Mesai saatlerimiz hafta içi 09:00-18:00 arasındadır.",
  sections: [
    { heading: "Müşteri hizmetleri", body: "Sipariş numaranı belirterek yazdığında talebini daha hızlı sonuçlandırıyoruz." },
    { heading: "Yanıt süresi", body: "E-posta ve form talepleri ortalama 4 saat içinde, en geç 1 iş günü içinde yanıtlanır." },
    { heading: "Toptan ve iş birlikleri", body: "Kurumsal alım, toptan fiyat listesi ve iş birliği teklifleri için de aynı kanalları kullanabilirsin." },
  ],
};

export const Route = createFileRoute("/s/$slug/contact")({
  loader: ({ context, params }) => infoLoader(context.queryClient, params.slug),
  head: ({ loaderData, params }) => infoHead(loaderData, content, params.slug),
  errorComponent: () => <StorefrontFallback text="Sayfa şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: ContactPage,
});

function ContactPage() {
  const { slug } = Route.useParams();
  return <InfoPage slug={slug} content={content} />;
}
