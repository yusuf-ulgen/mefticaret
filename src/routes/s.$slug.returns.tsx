import { createFileRoute, notFound } from "@tanstack/react-router";

import { InfoPage, infoHead, type InfoContent } from "@/components/storefront-info-route";
import { StorefrontFallback } from "@/components/storefront-parts";
import { storefrontQuery } from "@/lib/storefront-queries";

const content: InfoContent = {
  title: "İade ve değişim politikası",
  description: "Cayma hakkı, iade süreci, kargo bedeli ve para iadesi süreleri.",
  intro: "Mesafeli Satış Sözleşmesi kapsamında teslim tarihinden itibaren 14 gün içinde cayma hakkına sahipsin.",
  sections: [
    { heading: "İade koşulları", body: "Ürün kullanılmamış, orijinal ambalajı ve tüm aksesuarları eksiksiz olmalıdır. Hijyen grubu ürünlerde ambalaj açılmışsa iade kabul edilmez." },
    { heading: "İade süreci", body: "Hesabım > Siparişlerim üzerinden iade talebi oluştur; onay sonrası kargo kodu ile ürünü gönder." },
    { heading: "Kargo bedeli", body: "Ayıplı/yanlış gönderilen üründe kargo bedeli tarafımıza aittir; cayma hakkı kaynaklı iadelerde anlaşmalı kargo ücreti alıcıya aittir." },
    { heading: "Para iadesi", body: "İade ürün kontrolünden geçtikten sonra 1-3 iş günü içinde ödeme yöntemine iade başlatılır; bankaya yansıma süresi 2-10 iş günüdür." },
  ],
};

export const Route = createFileRoute("/s/$slug/returns")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { storeName: data.store.name };
  },
  head: ({ loaderData }) => infoHead(loaderData, content),
  errorComponent: () => <StorefrontFallback text="Sayfa şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: ReturnsPage,
});

function ReturnsPage() {
  const { slug } = Route.useParams();
  return <InfoPage slug={slug} content={content} />;
}
