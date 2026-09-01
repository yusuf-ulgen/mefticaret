import { createFileRoute, notFound } from "@tanstack/react-router";

import { InfoPage, infoHead, type InfoContent } from "@/components/storefront-info-route";
import { StorefrontFallback } from "@/components/storefront-parts";
import { storefrontQuery } from "@/lib/storefront-queries";

const content: InfoContent = {
  title: "Sıkça sorulan sorular",
  description: "Kargo, ödeme, iade ve sipariş takibi hakkında en çok sorulan soruların yanıtları.",
  intro: "Aradığın yanıtı bulamazsan iletişim sayfasından bize yazabilirsin.",
  sections: [
    { heading: "Siparişim ne zaman kargoya verilir?", body: "Hafta içi 16:00'ya kadar verilen siparişler aynı gün, sonrasındakiler bir sonraki iş günü kargoya teslim edilir." },
    { heading: "Kargo takibimi nasıl görebilirim?", body: "Sipariş numaran ve e-postan ile \"Siparişim\" sayfasından kargo durumunu anlık olarak görebilirsin." },
    { heading: "Hangi ödeme yöntemleri geçerli?", body: "Kredi/banka kartı, kapıda ödeme ve havale/EFT seçenekleri mağaza ayarlarına göre ödeme adımında listelenir." },
    { heading: "Ürünü değiştirebilir miyim?", body: "Teslimden itibaren 14 gün içinde beden/renk değişimi talebi oluşturabilirsin; ürün kullanılmamış olmalıdır." },
    { heading: "Faturamı nasıl alırım?", body: "E-arşiv faturan sipariş tamamlandığında e-posta adresine otomatik gönderilir." },
  ],
};

export const Route = createFileRoute("/s/$slug/faq")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { storeName: data.store.name };
  },
  head: ({ loaderData }) => infoHead(loaderData, content),
  errorComponent: () => <StorefrontFallback text="Sayfa şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: FaqPage,
});

function FaqPage() {
  const { slug } = Route.useParams();
  return <InfoPage slug={slug} content={content} />;
}
