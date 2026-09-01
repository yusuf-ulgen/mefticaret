import { createFileRoute } from "@tanstack/react-router";

import { InfoPage, infoHead, infoLoader, type InfoContent } from "@/components/storefront-info-route";
import { StorefrontFallback } from "@/components/storefront-parts";

const content: InfoContent = {
  route: "terms",
  title: "Kullanım şartları",
  description: "Site kullanımı, sipariş süreci, fiyatlar ve sorumluluk sınırlarına ilişkin koşullar.",
  intro: "Bu siteyi kullanarak aşağıdaki koşulları kabul etmiş olursun.",
  sections: [
    { heading: "Sipariş ve sözleşme", body: "Sipariş, ödeme onayı ve tarafımızca kabulü ile kurulur. Stok veya fiyat hatası durumunda siparişi iptal edip ödemeyi iade etme hakkımız saklıdır." },
    { heading: "Fiyatlar ve vergiler", body: "Fiyatlar KDV dahildir; kargo bedeli ödeme adımında ayrıca gösterilir. Kampanya fiyatları belirtilen süre ve stok ile sınırlıdır." },
    { heading: "Hesap güvenliği", body: "Hesap bilgilerinin gizliliğinden kullanıcı sorumludur. Şüpheli işlem tespitinde hesabı geçici olarak askıya alabiliriz." },
    { heading: "Fikri mülkiyet", body: "Sitedeki görsel, metin ve marka unsurları izinsiz kopyalanamaz veya ticari amaçla kullanılamaz." },
    { heading: "Uyuşmazlık", body: "Uyuşmazlıklarda Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir; Türkiye Cumhuriyeti hukuku uygulanır." },
  ],
};

export const Route = createFileRoute("/s/$slug/terms")({
  loader: ({ context, params }) => infoLoader(context.queryClient, params.slug),
  head: ({ loaderData, params }) => infoHead(loaderData, content, params.slug),
  errorComponent: () => <StorefrontFallback text="Sayfa şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: TermsPage,
});

function TermsPage() {
  const { slug } = Route.useParams();
  return <InfoPage slug={slug} content={content} />;
}
