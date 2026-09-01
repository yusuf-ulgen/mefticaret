import { createFileRoute, notFound } from "@tanstack/react-router";

import { InfoPage, infoHead, type InfoContent } from "@/components/storefront-info-route";
import { StorefrontFallback } from "@/components/storefront-parts";
import { storefrontQuery } from "@/lib/storefront-queries";

const content: InfoContent = {
  title: "Gizlilik politikası",
  description: "Kişisel verilerin hangi amaçla işlendiği, saklandığı ve KVKK kapsamındaki haklarınız.",
  intro: "6698 sayılı KVKK kapsamında veri sorumlusu olarak kişisel verilerini yalnızca aşağıda belirtilen amaçlarla işliyoruz.",
  sections: [
    { heading: "İşlenen veriler", body: "Ad-soyad, iletişim bilgileri, teslimat adresi, sipariş geçmişi ve site kullanım kayıtları (çerezler)." },
    { heading: "İşleme amaçları", body: "Sipariş oluşturma ve teslimi, ödeme doğrulaması, müşteri desteği, yasal yükümlülüklerin yerine getirilmesi ve talep halinde pazarlama iletişimi." },
    { heading: "Aktarım", body: "Veriler yalnızca kargo, ödeme kuruluşu ve altyapı hizmet sağlayıcılarımızla, hizmetin gerektirdiği ölçüde paylaşılır." },
    { heading: "Saklama süresi", body: "Ticari ve vergisel mevzuat gereği sipariş kayıtları 10 yıl saklanır; pazarlama izinleri geri çekildiğinde derhal silinir." },
    { heading: "Haklarınız", body: "Verilerine erişme, düzeltme, silme, işlemeye itiraz etme ve taşınabilirlik haklarını iletişim kanallarımızdan kullanabilirsin." },
    { heading: "Çerezler", body: "Zorunlu çerezler oturum ve sepet işlevleri için gereklidir; analitik çerezler tarayıcı ayarlarından reddedilebilir." },
  ],
};

export const Route = createFileRoute("/s/$slug/privacy")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { storeName: data.store.name };
  },
  head: ({ loaderData }) => infoHead(loaderData, content),
  errorComponent: () => <StorefrontFallback text="Sayfa şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: PrivacyPage,
});

function PrivacyPage() {
  const { slug } = Route.useParams();
  return <InfoPage slug={slug} content={content} />;
}
