import { Bell, Check, CreditCard, LockKeyhole, ShoppingBag } from "lucide-react";

const products = [
  { emoji: "🧶", title: "El örgüsü çanta", price: "1.200 TL", delay: "0s" },
  { emoji: "🫙", title: "Ev yapımı reçel", price: "2.800 TL", delay: "1.1s" },
  { emoji: "🕯️", title: "Soya mum seti", price: "2.200 TL", delay: "2.2s" },
  { emoji: "🧿", title: "Boncuk kolye", price: "1.500 TL", delay: "3.3s" },
  { emoji: "🧺", title: "Hasır sepet", price: "1.000 TL", delay: "4.4s" },
  { emoji: "🧼", title: "Doğal sabun", price: "900 TL", delay: "5.5s" },
];

const cards = [
  { digits: "5530", brand: "VISA", className: "commerce-card-visa" },
  { digits: "4420", brand: "mastercard", className: "commerce-card-master" },
  { digits: "2209", brand: "AMEX", className: "commerce-card-amex" },
];

/** Videodaki sipariş → ürün seçimi → kart seçimi → ödeme zaman çizelgesi. */
export function CommerceFlowAnimation() {
  return (
    <div className="commerce-demo" aria-label="Mefticaret sipariş ve ödeme akışı animasyonu">
      <div className="commerce-demo-glow" aria-hidden="true" />
      <div className="commerce-demo-stage">
        <div className="commerce-brand">
          <span>Mefticaret</span>
          <i aria-hidden="true" />
          <i aria-hidden="true" />
        </div>

        <div className="commerce-notice">
          <span className="commerce-notice-mark">M</span>
          <span><strong>Mefticaret</strong>Sipariş ödemeniz hesabınıza aktarıldı</span>
          <Bell className="size-4" aria-hidden="true" />
        </div>

        <section className="commerce-order-card" aria-label="Sipariş özeti">
          <h3>Siparişler</h3>
          {products.slice(0, 3).map((product) => (
            <div className="commerce-order-line" key={product.title}>
              <span>{product.emoji}</span>
              <p>{product.title}<strong>{product.price}</strong></p>
            </div>
          ))}
          <footer><span>Toplam</span><strong>6.200 TL</strong></footer>
        </section>

        <div className="commerce-lock"><LockKeyhole className="size-5" /></div>

        <section className="commerce-products" aria-label="Ürün seçimi">
          {products.map((product, index) => (
            <article
              className={`commerce-product commerce-product-${index + 1}`}
              key={product.title}
              style={{ "--product-delay": product.delay } as React.CSSProperties}
            >
              <span className="commerce-product-art">{product.emoji}</span>
              <p>{product.title}<strong>{product.price}</strong></p>
              <span className="commerce-check"><Check className="size-3" strokeWidth={3} /></span>
            </article>
          ))}
        </section>

        <section className="commerce-selection" aria-label="Seçilen siparişler">
          <h3>Siparişler</h3>
          <div className="commerce-selection-line commerce-selection-all">
            <ShoppingBag className="size-5" /><span>3 ürün<strong>6.200 TL</strong></span><Check className="commerce-selection-check" />
          </div>
          {products.slice(0, 2).map((product) => (
            <div className="commerce-selection-line" key={product.title}>
              <span className="text-2xl">{product.emoji}</span><span>{product.title}<strong>{product.price}</strong></span><Check className="commerce-selection-check" />
            </div>
          ))}
          <footer><span>Seçilen</span><strong>10.200 TL</strong></footer>
        </section>

        <div className="commerce-cards" aria-label="Ödeme kartları">
          {cards.map((card, index) => (
            <article className={`commerce-payment-card ${card.className} commerce-payment-card-${index + 1}`} key={card.digits}>
              <CreditCard className="size-5" />
              <p>•••• &nbsp;{card.digits}<span>Deniz Toprak</span></p>
              <strong>{card.brand}</strong>
              <span className="commerce-card-check"><Check className="size-3" strokeWidth={3} /></span>
            </article>
          ))}
        </div>

        <div className="commerce-action">
          <span className="commerce-action-products">Ödemeye ilerle</span>
          <span className="commerce-action-pay">Güvenli ödeme yap</span>
          <span className="commerce-action-sent">Siparişler gönderildi</span>
          <strong>6.200 TL</strong>
        </div>

        <div className="commerce-sound-bars" aria-hidden="true">
          <i /><i /><i /><i /><i /><i /><i /><i /><i />
        </div>
      </div>
    </div>
  );
}