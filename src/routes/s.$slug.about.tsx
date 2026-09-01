import { createFileRoute, notFound } from "@tanstack/react-router";

import { InfoPage, infoHead, type InfoContent } from "@/components/storefront-info-route";
import { StorefrontFallback } from "@/components/storefront-parts";
import { storefrontQuery } from "@/lib/storefront-queries";

const content: InfoContent = {
  title: "Hakkımızda",
  description: "Mağazamızın hikayesi, değerlerimiz ve müşteri deneyimi yaklaşımımız.",
  intro: "Kaliteli ürünleri doğru fiyatla, hızlı ve güvenli biçimde sunmak için çalışıyoruz. Bu sayfada bizi daha yakından tanıyabilirsin.",
  sections: [
    { heading: "Hikayemiz", body: "Küçük bir katalogla başladık; bugün geniş bir ürün yelpazesiyle binlerce siparişi güvenle teslim ediyoruz." },
    { heading: "Değerlerimiz", body: "Şeffaf fiyatlandırma, gerçek stok bilgisi, hızlı kargo ve sorunsuz iade. Söz verdiğimiz teslim süresine bağlı kalırız." },
    { heading: "Müşteri deneyimi", body: "Sipariş öncesi ve sonrası tüm sorularını yanıtlıyoruz. İletişim sayfasından bize her zaman ulaşabilirsin." },
  ],
};

export const Route = createFileRoute("/s/$slug/about")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { storeName: data.store.name };
  },
  head: ({ loaderData }) => infoHead(loaderData, content),
  errorComponent: () => <StorefrontFallback text="Sayfa şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: AboutPage,
});

function AboutPage() {
  const { slug } = Route.useParams();
  return <InfoPage slug={slug} content={content} />;
}
