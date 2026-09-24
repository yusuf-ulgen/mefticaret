/** Müşteri bildirimleri — istemci ve sunucuda ortak sabitler. */

export const NOTIFY_EVENTS = [
  "ORDER_CREATED",
  "ORDER_CONFIRMED",
  "ORDER_SHIPPED",
  "SHIPMENT_OUT_FOR_DELIVERY",
  "ORDER_DELIVERED",
  "REFUND_PROCESSED",
] as const;
export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];

export const NOTIFY_CHANNELS = ["email", "sms", "whatsapp"] as const;
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number];

export const EVENT_LABELS: Record<NotifyEvent, string> = {
  ORDER_CREATED: "Sipariş alındı",
  ORDER_CONFIRMED: "Sipariş onaylandı",
  ORDER_SHIPPED: "Kargoya verildi",
  SHIPMENT_OUT_FOR_DELIVERY: "Dağıtımda",
  ORDER_DELIVERED: "Teslim edildi",
  REFUND_PROCESSED: "İade tamamlandı",
};

export const CHANNEL_LABELS: Record<NotifyChannel, string> = {
  email: "E-posta",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

export const TEMPLATE_VARIABLES = [
  "customer_name",
  "order_number",
  "order_total",
  "tracking_number",
  "carrier_name",
  "tracking_url",
  "refund_amount",
  "store_name",
  "store_logo_url",
] as const;

export type DefaultTemplate = { subject?: string; body: string };

/** Varsayılan Türkçe şablonlar. Kanal tanımlı değilse o olayda o kanal varsayılan olarak kapalıdır. */
export const DEFAULT_TEMPLATES: Record<NotifyEvent, Partial<Record<NotifyChannel, DefaultTemplate>>> = {
  ORDER_CREATED: {
    email: {
      subject: "Siparişiniz alındı #{{order_number}}",
      body: "Merhaba {{customer_name}},\n\n#{{order_number}} numaralı siparişinizi aldık. Toplam: {{order_total}}.\n\nTeşekkür ederiz,\n{{store_name}}",
    },
    sms: { body: "{{store_name}}: #{{order_number}} siparisiniz alindi. Toplam {{order_total}}." },
  },
  ORDER_CONFIRMED: {
    email: {
      subject: "Siparişiniz onaylandı #{{order_number}}",
      body: "Merhaba {{customer_name}},\n\n#{{order_number}} numaralı siparişiniz onaylandı ve hazırlanıyor.\n\n{{store_name}}",
    },
  },
  ORDER_SHIPPED: {
    email: {
      subject: "Siparişiniz kargoya verildi #{{order_number}}",
      body: "Merhaba {{customer_name}},\n\nSiparişiniz kargoya verildi!\nKargo: {{carrier_name}} | Takip: {{tracking_number}}\nTakip linki: {{tracking_url}}\n\n{{store_name}}",
    },
    sms: { body: "{{store_name}}: Siparisiniz kargoda. {{carrier_name}} {{tracking_number}} {{tracking_url}}" },
    whatsapp: {
      body: "Siparişiniz kargoya verildi! 🚚\nKargo: {{carrier_name}} | Takip: {{tracking_number}}\nTakip linki: {{tracking_url}}",
    },
  },
  SHIPMENT_OUT_FOR_DELIVERY: {
    sms: { body: "{{store_name}}: #{{order_number}} siparisiniz bugun teslim edilecek! {{tracking_url}}" },
  },
  ORDER_DELIVERED: {
    email: {
      subject: "Siparişiniz teslim edildi #{{order_number}}",
      body: "Merhaba {{customer_name}},\n\n#{{order_number}} numaralı siparişiniz teslim edildi. Bizi tercih ettiğiniz için teşekkürler!\n\n{{store_name}}",
    },
    whatsapp: { body: "Siparişinizi aldınız mı? #{{order_number}} için değerlendirme yapabilirsiniz 👇\n{{tracking_url}}" },
  },
  REFUND_PROCESSED: {
    email: {
      subject: "İadeniz tamamlandı #{{order_number}}",
      body: "Merhaba {{customer_name}},\n\n#{{order_number}} numaralı siparişiniz için {{refund_amount}} tutarındaki iade işleminiz tamamlandı.\n\n{{store_name}}",
    },
    sms: { body: "{{store_name}}: #{{order_number}} icin {{refund_amount}} iade isleminiz tamamlandi." },
  },
};

export const SMS_STOP_SUFFIX = " Iptal: STOP yazin";
export const SMS_MAX = 160;

export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

export const SAMPLE_VARS: Record<string, string> = {
  customer_name: "Ayşe Yılmaz",
  order_number: "1234",
  order_total: "₺450,00",
  tracking_number: "YK123456789",
  carrier_name: "Yurtiçi Kargo",
  tracking_url: "https://mefticaret.com/kargo-takip/YK123456789",
  refund_amount: "₺225,00",
  store_name: "Mağazam",
  store_logo_url: "",
};

/** Müşteri tercihleri: prefs[event][channel] === false ise kapalı. */
export type CustomerPrefs = Partial<Record<NotifyEvent, Partial<Record<NotifyChannel, boolean>>>>;
