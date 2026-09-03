/** Süper admin sistem ayarları ekranının alan tanımları.
 *  Değerler kodda sabit tutulmaz; burada yalnızca hangi anahtarın nasıl düzenleneceği tanımlanır.
 *  Varsayılanlar veritabanında kayıt yoksa form için başlangıç değeridir. */

export type SettingFieldType = "text" | "textarea" | "number" | "boolean" | "select" | "color";

export type SettingField = {
  key: string;
  label: string;
  description?: string;
  type: SettingFieldType;
  isPublic: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  default: string | number | boolean;
};

export type SettingGroup = {
  id: string;
  title: string;
  description: string;
  fields: SettingField[];
};

export const PLATFORM_SETTING_GROUPS: SettingGroup[] = [
  {
    id: "brand",
    title: "Marka ve kimlik",
    description: "Platform adı, iletişim bilgileri ve storefront'ta görünen kimlik alanları.",
    fields: [
      {
        key: "platform.name",
        label: "Platform adı",
        description: "Panel başlıkları, e-postalar ve storefront alt bilgisinde kullanılır.",
        type: "text",
        isPublic: true,
        placeholder: "Mefticaret",
        default: "Mefticaret",
      },
      {
        key: "platform.tagline",
        label: "Slogan",
        type: "text",
        isPublic: true,
        placeholder: "Mağazanızı kurun, hemen satışa başlayın",
        default: "Mağazanızı kurun, hemen satışa başlayın",
      },
      {
        key: "platform.support_email",
        label: "Destek e-postası",
        type: "text",
        isPublic: true,
        placeholder: "destek@mefticaret.com",
        default: "destek@mefticaret.com",
      },
      {
        key: "platform.support_phone",
        label: "Destek telefonu",
        type: "text",
        isPublic: true,
        placeholder: "+90 ...",
        default: "",
      },
      {
        key: "platform.root_domain",
        label: "Kök alan adı",
        description: "Mağaza alt alan adları bu domain altında üretilir.",
        type: "text",
        isPublic: true,
        placeholder: "mefticaret.com",
        default: "mefticaret.com",
      },
      {
        key: "platform.brand_color",
        label: "Marka rengi",
        type: "color",
        isPublic: true,
        default: "#111111",
      },
    ],
  },
  {
    id: "access",
    title: "Erişim ve bakım",
    description: "Kayıt akışı, bakım modu ve mağaza oluşturma kuralları.",
    fields: [
      {
        key: "platform.signup_enabled",
        label: "Yeni kayıtlar açık",
        description: "Kapatıldığında yeni hesap oluşturma engellenir.",
        type: "boolean",
        isPublic: true,
        default: true,
      },
      {
        key: "platform.maintenance_mode",
        label: "Bakım modu",
        description: "Açıkken kullanıcılar bakım bilgilendirmesi görür.",
        type: "boolean",
        isPublic: true,
        default: false,
      },
      {
        key: "platform.maintenance_message",
        label: "Bakım mesajı",
        type: "textarea",
        isPublic: true,
        placeholder: "Kısa bir bakım çalışması yapıyoruz.",
        default: "Kısa süreli bakım çalışması yapıyoruz. Kısa süre içinde geri döneceğiz.",
      },
      {
        key: "platform.store_approval_required",
        label: "Mağaza açılışı onay gerektirir",
        type: "boolean",
        isPublic: false,
        default: false,
      },
      {
        key: "platform.max_stores_per_user",
        label: "Kullanıcı başına mağaza limiti",
        type: "number",
        isPublic: false,
        min: 1,
        max: 200,
        step: 1,
        default: 5,
      },
      {
        key: "platform.default_trial_days",
        label: "Varsayılan deneme süresi",
        type: "number",
        isPublic: false,
        min: 0,
        max: 120,
        step: 1,
        suffix: "gün",
        default: 14,
      },
    ],
  },
  {
    id: "commerce",
    title: "Ticaret varsayılanları",
    description: "Para birimi, vergi, komisyon ve sipariş varsayılanları.",
    fields: [
      {
        key: "platform.default_currency",
        label: "Varsayılan para birimi",
        type: "select",
        isPublic: true,
        options: [
          { value: "TRY", label: "TRY — Türk Lirası" },
          { value: "USD", label: "USD — Amerikan Doları" },
          { value: "EUR", label: "EUR — Euro" },
          { value: "GBP", label: "GBP — Sterlin" },
        ],
        default: "TRY",
      },
      {
        key: "platform.default_locale",
        label: "Varsayılan dil",
        type: "select",
        isPublic: true,
        options: [
          { value: "tr", label: "Türkçe" },
          { value: "en", label: "İngilizce" },
        ],
        default: "tr",
      },
      {
        key: "platform.default_tax_rate",
        label: "Varsayılan KDV oranı",
        description: "Ondalık olarak girin (0.20 = %20).",
        type: "number",
        isPublic: false,
        min: 0,
        max: 1,
        step: 0.01,
        default: 0.2,
      },
      {
        key: "platform.default_commission_rate",
        label: "Varsayılan komisyon oranı",
        description: "Marketplace satıcılarından kesilen oran (0.02 = %2).",
        type: "number",
        isPublic: false,
        min: 0,
        max: 1,
        step: 0.005,
        default: 0.02,
      },
      {
        key: "platform.free_shipping_threshold",
        label: "Ücretsiz kargo eşiği",
        type: "number",
        isPublic: true,
        min: 0,
        max: 100000,
        step: 10,
        default: 750,
      },
      {
        key: "platform.abandoned_cart_hours",
        label: "Terk edilmiş sepet süresi",
        type: "number",
        isPublic: false,
        min: 1,
        max: 168,
        step: 1,
        suffix: "saat",
        default: 6,
      },
    ],
  },
  {
    id: "security",
    title: "Güvenlik ve limitler",
    description: "API hız limitleri, oturum ve güvenlik politikaları.",
    fields: [
      {
        key: "platform.api_rate_limit_per_minute",
        label: "API istek limiti (dakika)",
        type: "number",
        isPublic: false,
        min: 10,
        max: 10000,
        step: 10,
        default: 120,
      },
      {
        key: "platform.session_timeout_minutes",
        label: "Oturum zaman aşımı",
        type: "number",
        isPublic: false,
        min: 15,
        max: 20160,
        step: 15,
        suffix: "dakika",
        default: 1440,
      },
      {
        key: "platform.require_2fa_for_admins",
        label: "Yöneticiler için 2FA zorunlu",
        type: "boolean",
        isPublic: false,
        default: false,
      },
      {
        key: "platform.webhook_retry_limit",
        label: "Webhook yeniden deneme limiti",
        type: "number",
        isPublic: false,
        min: 0,
        max: 20,
        step: 1,
        default: 5,
      },
      {
        key: "platform.audit_retention_days",
        label: "Audit kayıt saklama süresi",
        type: "number",
        isPublic: false,
        min: 30,
        max: 3650,
        step: 30,
        suffix: "gün",
        default: 365,
      },
    ],
  },
  {
    id: "notifications",
    title: "Bildirim ve pazarlama",
    description: "E-posta, SMS ve bildirim davranışı.",
    fields: [
      {
        key: "platform.transactional_email_from",
        label: "Gönderen e-posta adı",
        type: "text",
        isPublic: false,
        placeholder: "Mefticaret <bilgi@mefticaret.com>",
        default: "Mefticaret <bilgi@mefticaret.com>",
      },
      {
        key: "platform.order_email_enabled",
        label: "Sipariş e-postaları açık",
        type: "boolean",
        isPublic: false,
        default: true,
      },
      {
        key: "platform.sms_enabled",
        label: "SMS bildirimleri açık",
        type: "boolean",
        isPublic: false,
        default: false,
      },
      {
        key: "platform.whatsapp_enabled",
        label: "WhatsApp bildirimleri açık",
        type: "boolean",
        isPublic: false,
        default: false,
      },
      {
        key: "platform.newsletter_double_optin",
        label: "Bültende çift onay",
        type: "boolean",
        isPublic: true,
        default: true,
      },
    ],
  },
  {
    id: "seo",
    title: "SEO ve analitik",
    description: "Arama motoru ve ölçümleme varsayılanları.",
    fields: [
      {
        key: "platform.default_meta_title",
        label: "Varsayılan meta başlık",
        type: "text",
        isPublic: true,
        placeholder: "Mefticaret — E-ticaret altyapısı",
        default: "Mefticaret — E-ticaret altyapısı",
      },
      {
        key: "platform.default_meta_description",
        label: "Varsayılan meta açıklama",
        type: "textarea",
        isPublic: true,
        default: "Mefticaret ile mağazanızı kurun, ürünlerinizi yönetin ve satışa hemen başlayın.",
      },
      {
        key: "platform.robots_indexable",
        label: "Arama motorları indeksleyebilir",
        type: "boolean",
        isPublic: true,
        default: true,
      },
      {
        key: "platform.analytics_enabled",
        label: "Analitik toplama açık",
        type: "boolean",
        isPublic: true,
        default: true,
      },
      {
        key: "platform.cookie_banner_enabled",
        label: "Çerez bildirimi göster",
        type: "boolean",
        isPublic: true,
        default: true,
      },
    ],
  },
];

export const MANAGED_SETTING_KEYS = new Set(
  PLATFORM_SETTING_GROUPS.flatMap((group) => group.fields.map((field) => field.key)),
);

/** Veritabanındaki jsonb değerini form alanı için metne çevirir. */
export function toFormValue(field: SettingField, raw: unknown): string {
  if (raw === null || raw === undefined) return String(field.default);
  if (typeof raw === "boolean") return raw ? "true" : "false";
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "string") return raw;
  return JSON.stringify(raw);
}

/** Form metnini saklanacak JSON metnine çevirir. */
export function toStoredValue(field: SettingField, value: string): string {
  if (field.type === "boolean") return value === "true" ? "true" : "false";
  if (field.type === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? String(parsed) : "0";
  }
  return JSON.stringify(value);
}
