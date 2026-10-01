import { createFileRoute, Link } from "@tanstack/react-router";

const TITLE = "Tedarikçi Paneli — XML Entegratör ve Toptan Sipariş | Mefticaret";
const DESCRIPTION =
  "Mefticaret tedarikçi paneli: ürün XML'inizi bağlayın, mağazalardan toptan sipariş alın, iyzico veya PayTR ile ödemenizi alın, kargo ve mesajlaşmayı tek ekrandan yönetin.";

export const Route = createFileRoute("/supplier/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://mefticaret.com/supplier" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://mefticaret.com/supplier" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Mefticaret Tedarikçi Paneli",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: "https://mefticaret.com/supplier",
          description: DESCRIPTION,
        }),
      },
    ],
  }),
  component: SupplierLanding,
});

const FEATURES = [
  { title: "XML entegratör", text: "Ürün XML bağlantınızı ekleyin; stok kodu, ad, fiyat, stok ve görseller otomatik eşleşir ve düzenli güncellenir." },
  { title: "Toptan sipariş alın", text: "Mağazalar sizden satın alma siparişi verir. Kabul edin, hazırlayın, takip numarasıyla kargoya verin." },
  { title: "iyzico ve PayTR ile ödeme", text: "Mağaza siparişinizi kendi üye işyeri hesabınıza kartla öder; ödeme doğrulanınca sipariş otomatik ödendi olur." },
  { title: "Mağaza ile mesajlaşma", text: "Her sipariş için mağazayla yazışın; durum değişiklikleri karşı tarafa anında not düşülür." },
  { title: "Hakediş ve ödeme talebi", text: "Bakiyenizi görün, IBAN'ınızı kaydedin ve tek tıkla ödeme talebi oluşturun." },
  { title: "Mobil uyumlu panel", text: "Telefondan sipariş hazırlayın, kargo etiketi yazdırın, analizleri takip edin." },
];

function SupplierLanding() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Tedarikçiler için</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Tedarikçi paneli: XML'ini bağla, mağazalara toptan sat</h1>
      <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">{DESCRIPTION}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/tedarikci-giris" className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">
          Tedarikçi girişi
        </Link>
        <Link to="/supplier/panel" className="inline-flex h-11 items-center rounded-full border px-6 text-sm font-medium">
          Panele git
        </Link>
      </div>
      <section aria-labelledby="ozellikler" className="mt-16">
        <h2 id="ozellikler" className="text-xl font-semibold">Neler yapabilirsiniz?</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="rounded-xl border bg-card p-5">
              <h3 className="font-medium">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="mt-16 rounded-xl border bg-muted/30 p-6">
        <h2 className="text-xl font-semibold">Nasıl başlarım?</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Mefticaret'te mağaza sahibi olarak kayıtlı olun.</li>
          <li>Platform yöneticisi hesabınıza tedarikçi erişimi açsın.</li>
          <li>Panelden XML adresinizi ve iyzico/PayTR bilgilerinizi ekleyin; siparişler gelmeye başlasın.</li>
        </ol>
      </section>
    </main>
  );
}
