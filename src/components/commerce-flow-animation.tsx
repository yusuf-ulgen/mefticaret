import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, Check, CreditCard, Gem, Gift, LockKeyhole, Package, Palette, ShoppingBag, Sparkles } from "lucide-react";

type FlowLocale = "tr" | "en" | "de" | "fr" | "ar";

const FLOW_COPY: Record<FlowLocale, {
  products: string[];
  transferred: string;
  orders: string;
  total: string;
  productCount: string;
  selected: string;
  cards: string;
  choose: string;
  pay: string;
  sent: string;
  label: string;
}> = {
  tr: { products: ["El örgüsü çanta", "Ev yapımı reçel", "Soya mum seti", "Boncuk kolye", "Hasır sepet", "Doğal sabun"], transferred: "Sipariş ödemeniz hesabınıza aktarıldı", orders: "Siparişler", total: "Toplam", productCount: "3 ürün", selected: "Seçilen", cards: "Ödeme kartları", choose: "Ödemeye ilerle", pay: "Güvenli ödeme yap", sent: "Siparişler gönderildi", label: "Mefticaret sipariş ve ödeme akışı animasyonu" },
  en: { products: ["Hand-knit bag", "Homemade jam", "Soy candle set", "Beaded necklace", "Wicker basket", "Natural soap"], transferred: "Your order payment was transferred", orders: "Orders", total: "Total", productCount: "3 products", selected: "Selected", cards: "Payment cards", choose: "Continue to payment", pay: "Pay securely", sent: "Orders sent", label: "Mefticaret order and payment flow" },
  de: { products: ["Handgestrickte Tasche", "Hausgemachte Marmelade", "Sojakerzen-Set", "Perlenkette", "Weidenkorb", "Naturseife"], transferred: "Ihre Bestellzahlung wurde überwiesen", orders: "Bestellungen", total: "Gesamt", productCount: "3 Produkte", selected: "Ausgewählt", cards: "Zahlungskarten", choose: "Weiter zur Zahlung", pay: "Sicher bezahlen", sent: "Bestellungen gesendet", label: "Mefticaret Bestell- und Zahlungsablauf" },
  fr: { products: ["Sac tricoté main", "Confiture maison", "Bougies de soja", "Collier de perles", "Panier en osier", "Savon naturel"], transferred: "Le paiement de votre commande a été transféré", orders: "Commandes", total: "Total", productCount: "3 produits", selected: "Sélection", cards: "Cartes de paiement", choose: "Passer au paiement", pay: "Payer en sécurité", sent: "Commandes envoyées", label: "Flux de commande et de paiement Mefticaret" },
  ar: { products: ["حقيبة محبوكة", "مربى منزلي", "مجموعة شموع الصويا", "عقد خرز", "سلة خوص", "صابون طبيعي"], transferred: "تم تحويل قيمة الطلب إلى حسابك", orders: "الطلبات", total: "الإجمالي", productCount: "3 منتجات", selected: "المحدد", cards: "بطاقات الدفع", choose: "متابعة الدفع", pay: "ادفع بأمان", sent: "تم إرسال الطلبات", label: "تدفق الطلب والدفع في Mefticaret" },
};

const cards = [
  { digits: "5530", brand: "VISA", className: "commerce-card-visa" },
  { digits: "4420", brand: "mastercard", className: "commerce-card-master" },
  { digits: "2209", brand: "AMEX", className: "commerce-card-amex" },
];

/** Videodaki sipariş → ürün seçimi → kart seçimi → ödeme zaman çizelgesi. */
export function CommerceFlowAnimation({ locale = "tr" }: { locale?: FlowLocale }) {
  const copy = FLOW_COPY[locale];
  const products: { icon: LucideIcon; title: string; price: string; delay: string }[] = [
    { icon: ShoppingBag, title: copy.products[0] ?? "", price: "1,200", delay: "0s" },
    { icon: Gift, title: copy.products[1] ?? "", price: "2,800", delay: "1.1s" },
    { icon: Sparkles, title: copy.products[2] ?? "", price: "2,200", delay: "2.2s" },
    { icon: Gem, title: copy.products[3] ?? "", price: "1,500", delay: "3.3s" },
    { icon: Package, title: copy.products[4] ?? "", price: "1,000", delay: "4.4s" },
    { icon: Palette, title: copy.products[5] ?? "", price: "900", delay: "5.5s" },
  ];
  return (
    <div className="commerce-demo" aria-label={copy.label}>
      <div className="commerce-demo-glow" aria-hidden="true" />
      <div className="commerce-demo-stage">
        <div className="commerce-brand">
          <span>Mefticaret</span>
          <i aria-hidden="true" />
          <i aria-hidden="true" />
        </div>

        <div className="commerce-notice">
          <span className="commerce-notice-mark">M</span>
          <span><strong>Mefticaret</strong>{copy.transferred}</span>
          <Bell className="size-4" aria-hidden="true" />
        </div>

        <section className="commerce-order-card" aria-label={copy.orders}>
          <h3>{copy.orders}</h3>
          {products.slice(0, 3).map((product) => {
            const ProductIcon = product.icon;
            return (
            <div className="commerce-order-line" key={product.title}>
              <span><ProductIcon className="size-5" /></span>
              <p>{product.title}<strong>{product.price}</strong></p>
            </div>
            );
          })}
          <footer><span>{copy.total}</span><strong>6,200</strong></footer>
        </section>

        <div className="commerce-lock"><LockKeyhole className="size-5" /></div>

        <section className="commerce-products" aria-label={copy.selected}>
          {products.map((product, index) => {
            const ProductIcon = product.icon;
            return (
            <article
              className={`commerce-product commerce-product-${index + 1}`}
              key={product.title}
              style={{ "--product-delay": product.delay } as CSSProperties}
            >
              <span className="commerce-product-art"><ProductIcon className="size-8" strokeWidth={1.5} /></span>
              <p>{product.title}<strong>{product.price}</strong></p>
              <span className="commerce-check"><Check className="size-3" strokeWidth={3} /></span>
            </article>
            );
          })}
        </section>

        <section className="commerce-selection" aria-label={copy.selected}>
          <h3>{copy.orders}</h3>
          <div className="commerce-selection-line commerce-selection-all">
            <ShoppingBag className="size-5" /><span>{copy.productCount}<strong>6,200</strong></span><Check className="commerce-selection-check" />
          </div>
          {products.slice(0, 2).map((product) => {
            const ProductIcon = product.icon;
            return (
            <div className="commerce-selection-line" key={product.title}>
              <ProductIcon className="size-6" /><span>{product.title}<strong>{product.price}</strong></span><Check className="commerce-selection-check" />
            </div>
            );
          })}
          <footer><span>{copy.selected}</span><strong>10,200</strong></footer>
        </section>

        <div className="commerce-cards" aria-label={copy.cards}>
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
          <span className="commerce-action-products">{copy.choose}</span>
          <span className="commerce-action-pay">{copy.pay}</span>
          <span className="commerce-action-sent">{copy.sent}</span>
          <strong>6,200</strong>
        </div>

        <div className="commerce-sound-bars" aria-hidden="true">
          <i /><i /><i /><i /><i /><i /><i /><i /><i />
        </div>
      </div>
    </div>
  );
}