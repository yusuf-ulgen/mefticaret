/**
 * Gürcistan / uluslararası e-ihracat (B2C) kuralları — tarayıcı ve sunucu ortak.
 * Tutarlar ve vergi kararı sunucuda yeniden hesaplanır; burası yalnız tek kaynak tanımdır.
 */

export const SHIP_COUNTRIES = [
  { value: "Türkiye", code: "TR" },
  { value: "Gürcistan", code: "GE" },
] as const;

/** Gürcistan gümrük mevzuatındaki bireysel gönderi muafiyet eşiği (GEL). */
export const GEORGIA_CUSTOMS_LIMIT_GEL = 300;

export const GE_CITIES = [
  "Tiflis (Tbilisi)",
  "Batum (Batumi)",
  "Kutaisi",
  "Rustavi",
  "Poti",
  "Zugdidi",
  "Gori",
  "Telavi",
  "Ahıska (Akhaltsikhe)",
  "Kobuleti",
  "Samtredia",
  "Senaki",
  "Marneuli",
  "Zestaponi",
  "Borjomi",
] as const;

export function isGeorgia(country: string | null | undefined): boolean {
  return /^(gürcistan|gurcistan|georgia|საქართველო)$/i.test(String(country ?? "").trim());
}

/** ETGB beyanı için pasaport / kimlik numarası: 5–20 harf-rakam. */
export const CUSTOMS_ID_PATTERN = /^[A-Za-z0-9]{5,20}$/;

/** Yalnız Türkiye içinde geçerli ödeme yöntemleri (yurt dışı siparişte gizlenir). */
export const DOMESTIC_ONLY_PAYMENT_CODES = ["bank_transfer", "cash_on_delivery"] as const;
/** Yabancı para birimi / yabancı kart kabul eden sanal POS bağlayıcıları. */
export const INTERNATIONAL_POS_CODES = ["mefpay", "iyzico", "paytr", "stripe"] as const;

export const EXPORT_INVOICE_LABEL = "ETGB İhracat Faturası";

export type ExportLang = "tr" | "en" | "ka";

const TERMS = {
  tr: {
    language: "Dil",
    currency: "Para birimi",
    shipTo: "Teslimat ülkesi",
    addToCart: "Sepete Ekle",
    pay: "Ödeme Yap",
    shippingAddress: "Teslimat Adresi",
    customsTitle: "Gümrük Uyarısı",
    customsText:
      "Gürcistan gümrük mevzuatı gereği 300 GEL üzerindeki siparişlerde gümrük vergisi doğabilir. Vergisel sorumluluk alıcıya aittir.",
    country: "Ülke",
    city: "Şehir",
    selectCity: "Şehir seçin",
    customsId: "Pasaport veya Kimlik No (ETGB)",
    customsIdHint: "Mikro ihracat gümrük beyanı (ETGB) için zorunludur.",
    customsIdError: "Gürcistan teslimatı için geçerli bir pasaport veya kimlik numarası yazın (5–20 harf/rakam).",
    vatZero: "KDV %0 (Mikro İhracat)",
    posTitle: "Sanal POS",
    posNote: "Kartınızdan {base} olarak tahsil edilir; {display} karşılığı yaklaşık {amount}. Kur farkını bankanız uygular.",
    posForeign: "Yabancı kart kabul eder",
    noPos: "Bu mağazada yurt dışı kart ödemesi açık değil. Sipariş ödeme beklemede oluşturulur.",
    stepAddress: "Adres",
    stepShipping: "Kargo",
    stepPayment: "Ödeme",
  },
  en: {
    language: "Language",
    currency: "Currency",
    shipTo: "Ship to",
    addToCart: "Add to Cart",
    pay: "Pay Now",
    shippingAddress: "Shipping Address",
    customsTitle: "Customs Notice",
    customsText:
      "Under Georgian customs regulations, orders over 300 GEL may be subject to customs duty. Tax liability belongs to the buyer.",
    country: "Country",
    city: "City",
    selectCity: "Select a city",
    customsId: "Passport or ID No. (ETGB)",
    customsIdHint: "Required for the micro-export customs declaration (ETGB).",
    customsIdError: "Enter a valid passport or ID number for delivery to Georgia (5–20 letters/digits).",
    vatZero: "VAT 0% (Micro Export)",
    posTitle: "Virtual POS",
    posNote: "Your card is charged in {base}; approx. {amount} in {display}. Your bank applies the exchange rate.",
    posForeign: "Accepts foreign cards",
    noPos: "International card payment is not enabled for this store. The order will be created as payment pending.",
    stepAddress: "Address",
    stepShipping: "Shipping",
    stepPayment: "Payment",
  },
  ka: {
    language: "ენა",
    currency: "ვალუტა",
    shipTo: "მიწოდების ქვეყანა",
    addToCart: "კალათაში დამატება",
    pay: "გადახდა",
    shippingAddress: "მიწოდების მისამართი",
    customsTitle: "საბაჟო გაფრთხილება",
    customsText:
      "საქართველოს საბაჟო კანონმდებლობის თანახმად, 300 ლარზე მეტი ღირებულების შეკვეთებზე შესაძლოა დაწესდეს საბაჟო გადასახადი. საგადასახადო პასუხისმგებლობა ეკისრება მყიდველს.",
    country: "ქვეყანა",
    city: "ქალაქი",
    selectCity: "აირჩიეთ ქალაქი",
    customsId: "პასპორტის ან პირადობის ნომერი (ETGB)",
    customsIdHint: "სავალდებულოა მიკრო ექსპორტის საბაჟო დეკლარაციისთვის (ETGB).",
    customsIdError: "საქართველოში მიწოდებისთვის მიუთითეთ სწორი პასპორტის ან პირადობის ნომერი (5–20 სიმბოლო).",
    vatZero: "დღგ 0% (მიკრო ექსპორტი)",
    posTitle: "ვირტუალური POS",
    posNote: "ბარათიდან ჩამოიჭრება {base}-ში; დაახლოებით {amount} ({display}). კურსს თქვენი ბანკი იყენებს.",
    posForeign: "იღებს უცხოურ ბარათებს",
    noPos: "ამ მაღაზიაში საერთაშორისო ბარათით გადახდა არ არის ჩართული. შეკვეთა შეიქმნება გადახდის მოლოდინში.",
    stepAddress: "მისამართი",
    stepShipping: "მიწოდება",
    stepPayment: "გადახდა",
  },
} as const;

export type ExportTermKey = keyof (typeof TERMS)["tr"];

export function normalizeExportLang(value: unknown): ExportLang {
  const short = String(value ?? "").slice(0, 2).toLowerCase();
  return short === "en" || short === "ka" ? short : "tr";
}

export function exportT(lang: ExportLang, key: ExportTermKey, vars?: Record<string, string>): string {
  let text: string = TERMS[lang][key] ?? TERMS.tr[key];
  for (const [name, value] of Object.entries(vars ?? {})) text = text.replace(`{${name}}`, value);
  return text;
}
