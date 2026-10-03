/**
 * Ev Hanımları (Evde Üretenler) giriş sayfasının dil sözlüğü.
 * Türkçe metin anahtardır; tüm diller aynı sayfa düzenini kullanır.
 */
export type HomeMakerLocale = "tr" | "en" | "de" | "fr" | "ar";

export const HOME_MAKER_LOCALES: HomeMakerLocale[] = ["tr", "en", "de", "fr", "ar"];

export function homeMakerPath(locale: HomeMakerLocale) {
  return locale === "tr" ? "/ev-hanimlari" : `/${locale}/ev-hanimlari`;
}

export const HOME_MAKER_LANG_LABEL: Record<HomeMakerLocale, string> = {
  tr: "Türkçe",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  ar: "العربية",
};

type Meta = { title: string; description: string; keywords: string; categories: string[]; listName: string; crumb: string; ogLocale: string; inLanguage: string };

export const HOME_MAKER_META: Record<HomeMakerLocale, Meta> = {
  tr: {
    title: "Evden Satış Yap: El Emeği Ürünlerini Online Sat | Mefticaret",
    description:
      "Ev hanımları için kolay online satış: el örgüsü, takı, ev yemeği, sabun ve dekor ürünlerinizi telefonunuzdan açacağınız mağazada satın.",
    keywords:
      "evden satış, ev hanımları online satış, el emeği ürün satma, el örgüsü satış, ev yemeği satışı, doğal sabun satışı, takı satışı",
    categories: ["El örgüsü ve tığ işi", "Takı ve aksesuar", "Ev yemekleri ve reçel", "Doğal sabun ve kozmetik", "Ev dekorasyonu", "Bebek ve çocuk ürünleri"],
    listName: "Ev hanımlarının satabileceği ürün kategorileri",
    crumb: "Ev Hanımları",
    ogLocale: "tr_TR",
    inLanguage: "tr-TR",
  },
  en: {
    title: "Sell From Home: Sell Your Handmade Products Online | Mefticaret",
    description:
      "Easy online selling for home makers: sell knitwear, jewelry, homemade food, soap and decor from a shop you open on your phone.",
    keywords: "sell from home, home makers online selling, sell handmade products, sell knitwear, sell homemade food, sell natural soap, sell jewelry",
    categories: ["Knitting and crochet", "Jewelry and accessories", "Homemade food and jam", "Natural soap and cosmetics", "Home decor", "Baby and kids products"],
    listName: "Product categories home makers can sell",
    crumb: "Home Makers",
    ogLocale: "en_US",
    inLanguage: "en",
  },
  de: {
    title: "Von zu Hause verkaufen: Handgemachtes online verkaufen | Mefticaret",
    description:
      "Einfach online verkaufen für Selbermacher: Strickwaren, Schmuck, Hausgemachtes, Seife und Deko aus einem Shop, den Sie am Handy eröffnen.",
    keywords: "von zu Hause verkaufen, handgemachte Produkte verkaufen, Strickwaren verkaufen, Hausgemachtes verkaufen, Naturseife verkaufen, Schmuck verkaufen",
    categories: ["Stricken und Häkeln", "Schmuck und Accessoires", "Hausgemachtes Essen und Marmelade", "Naturseife und Kosmetik", "Wohndeko", "Baby- und Kinderprodukte"],
    listName: "Produktkategorien für Selbermacher",
    crumb: "Von zu Hause verkaufen",
    ogLocale: "de_DE",
    inLanguage: "de",
  },
  fr: {
    title: "Vendre depuis chez soi : vendez vos créations en ligne | Mefticaret",
    description:
      "Vente en ligne facile pour créatrices à domicile : tricot, bijoux, cuisine maison, savon et déco depuis une boutique ouverte sur votre téléphone.",
    keywords: "vendre depuis chez soi, vendre fait main, vendre tricot, vendre cuisine maison, vendre savon naturel, vendre bijoux",
    categories: ["Tricot et crochet", "Bijoux et accessoires", "Cuisine maison et confitures", "Savon naturel et cosmétiques", "Décoration intérieure", "Produits bébé et enfant"],
    listName: "Catégories de produits à vendre depuis chez soi",
    crumb: "Vendre depuis chez soi",
    ogLocale: "fr_FR",
    inLanguage: "fr",
  },
  ar: {
    title: "بيعي من المنزل: بيعي منتجاتك اليدوية أونلاين | مفتيجاريت",
    description:
      "بيع إلكتروني سهل لربات البيوت: بيعي المنسوجات والإكسسوارات والأطعمة المنزلية والصابون والديكور من متجر تفتحينه من هاتفك.",
    keywords: "البيع من المنزل، بيع المنتجات اليدوية، بيع الكروشيه، بيع الطعام المنزلي، بيع الصابون الطبيعي، بيع الإكسسوارات",
    categories: ["الحياكة والكروشيه", "الإكسسوارات والمجوهرات", "الأطعمة المنزلية والمربى", "الصابون الطبيعي ومستحضرات التجميل", "ديكور المنزل", "منتجات الأطفال والرضع"],
    listName: "فئات المنتجات التي يمكن لربات البيوت بيعها",
    crumb: "ربات البيوت",
    ogLocale: "ar_AE",
    inLanguage: "ar",
  },
};

type Dict = Record<string, string>;

const EN: Dict = {
  "Kod gönder": "Send code",
  "Tek ekranda mağaza, ürün ve sipariş": "Shop, products and orders on one screen",
  "Fotoğraf arka planını yapay zeka temizler": "AI cleans up your photo backgrounds",
  "Kargosuz teslimat için kod üretir": "Generates codes for hand delivery without shipping",
  "Evde Üretenler Portalı": "Home Makers Portal",
  "Telefon numaranızla kod alarak ya da e-posta ve şifrenizle girin.": "Sign in with a code sent to your phone, or with your email and password.",
  Telefonla: "By phone",
  "Giriş yap": "Sign in",
  "Hesap aç": "Sign up",
  "Telefonunuza gelen 4 haneli kod": "4-digit code sent to your phone",
  "Numaramı değiştir / yeni kod isteyin": "Change my number / request a new code",
  "Telefon numaranız": "Your phone number",
  "Kod gönder": "Send code",
  "Kod ücretsizdir ve 5 dakika geçerlidir.": "The code is free and valid for 5 minutes.",
  "E-postanızı kontrol edin.": "Check your email.",
  "Gönderdiğimiz onay bağlantısına dokunduktan sonra bu sayfadan giriş yapabilirsiniz.": "After tapping the confirmation link we sent, you can sign in on this page.",
  "Girişe dön": "Back to sign in",
  "Adınız": "Your name",
  "E-posta adresiniz": "Your email address",
  "Şifreniz": "Your password",
  "En az 8 karakter": "At least 8 characters",
  "Hesabımı oluştur": "Create my account",
  "Şifremi unuttum": "Forgot my password",
  "Bilgileriniz KVKK kapsamında korunur": "Your data is protected under data protection law",
  "Kurumsal panele giriş": "Business panel sign in",
  "Geçerli bir e-posta adresi yazın.": "Enter a valid email address.",
  "Şifreniz en az 8 karakter olmalı.": "Your password must be at least 8 characters.",
  "Adınızı yazın.": "Enter your name.",
  "E-postanıza onay bağlantısı gönderdik.": "We sent a confirmation link to your email.",
  "Hoş geldiniz!": "Welcome!",
  "E-posta veya şifre hatalı.": "Email or password is incorrect.",
  "Kodu telefonunuza gönderdik.": "We sent the code to your phone.",
  "Kod gönderilemedi.": "The code could not be sent.",
  "Giriş yapılamadı.": "Sign-in failed.",
  "Dil": "Language",
};

const DE: Dict = {
  "Kod gönder": "Code senden",
  "Tek ekranda mağaza, ürün ve sipariş": "Shop, Produkte und Bestellungen auf einem Bildschirm",
  "Fotoğraf arka planını yapay zeka temizler": "KI bereinigt den Hintergrund Ihrer Fotos",
  "Kargosuz teslimat için kod üretir": "Erstellt Codes für die persönliche Übergabe ohne Versand",
  "Evde Üretenler Portalı": "Portal für Selbermacher",
  "Telefon numaranızla kod alarak ya da e-posta ve şifrenizle girin.": "Melden Sie sich mit einem Code per SMS oder mit E-Mail und Passwort an.",
  Telefonla: "Per Telefon",
  "Giriş yap": "Anmelden",
  "Hesap aç": "Registrieren",
  "Telefonunuza gelen 4 haneli kod": "4-stelliger Code auf Ihrem Telefon",
  "Numaramı değiştir / yeni kod isteyin": "Nummer ändern / neuen Code anfordern",
  "Telefon numaranız": "Ihre Telefonnummer",
  "Kod gönder": "Code senden",
  "Kod ücretsizdir ve 5 dakika geçerlidir.": "Der Code ist kostenlos und 5 Minuten gültig.",
  "E-postanızı kontrol edin.": "Prüfen Sie Ihre E-Mails.",
  "Gönderdiğimiz onay bağlantısına dokunduktan sonra bu sayfadan giriş yapabilirsiniz.": "Nachdem Sie auf den Bestätigungslink getippt haben, können Sie sich hier anmelden.",
  "Girişe dön": "Zurück zur Anmeldung",
  "Adınız": "Ihr Name",
  "E-posta adresiniz": "Ihre E-Mail-Adresse",
  "Şifreniz": "Ihr Passwort",
  "En az 8 karakter": "Mindestens 8 Zeichen",
  "Hesabımı oluştur": "Konto erstellen",
  "Şifremi unuttum": "Passwort vergessen",
  "Bilgileriniz KVKK kapsamında korunur": "Ihre Daten sind nach Datenschutzrecht geschützt",
  "Kurumsal panele giriş": "Anmeldung zum Business-Panel",
  "Geçerli bir e-posta adresi yazın.": "Geben Sie eine gültige E-Mail-Adresse ein.",
  "Şifreniz en az 8 karakter olmalı.": "Ihr Passwort muss mindestens 8 Zeichen haben.",
  "Adınızı yazın.": "Geben Sie Ihren Namen ein.",
  "E-postanıza onay bağlantısı gönderdik.": "Wir haben Ihnen einen Bestätigungslink gesendet.",
  "Hoş geldiniz!": "Willkommen!",
  "E-posta veya şifre hatalı.": "E-Mail oder Passwort ist falsch.",
  "Kodu telefonunuza gönderdik.": "Wir haben den Code an Ihr Telefon gesendet.",
  "Kod gönderilemedi.": "Der Code konnte nicht gesendet werden.",
  "Giriş yapılamadı.": "Anmeldung fehlgeschlagen.",
  "Dil": "Sprache",
};

const FR: Dict = {
  "Kod gönder": "Envoyer le code",
  "Tek ekranda mağaza, ürün ve sipariş": "Boutique, produits et commandes sur un seul écran",
  "Fotoğraf arka planını yapay zeka temizler": "L'IA nettoie l'arrière-plan de vos photos",
  "Kargosuz teslimat için kod üretir": "Génère des codes pour la remise en main propre",
  "Evde Üretenler Portalı": "Portail des créatrices à domicile",
  "Telefon numaranızla kod alarak ya da e-posta ve şifrenizle girin.": "Connectez-vous avec un code reçu par téléphone ou avec votre e-mail et mot de passe.",
  Telefonla: "Par téléphone",
  "Giriş yap": "Se connecter",
  "Hesap aç": "Créer un compte",
  "Telefonunuza gelen 4 haneli kod": "Code à 4 chiffres reçu par téléphone",
  "Numaramı değiştir / yeni kod isteyin": "Changer de numéro / demander un nouveau code",
  "Telefon numaranız": "Votre numéro de téléphone",
  "Kod gönder": "Envoyer le code",
  "Kod ücretsizdir ve 5 dakika geçerlidir.": "Le code est gratuit et valable 5 minutes.",
  "E-postanızı kontrol edin.": "Vérifiez votre e-mail.",
  "Gönderdiğimiz onay bağlantısına dokunduktan sonra bu sayfadan giriş yapabilirsiniz.": "Après avoir touché le lien de confirmation envoyé, vous pourrez vous connecter ici.",
  "Girişe dön": "Retour à la connexion",
  "Adınız": "Votre nom",
  "E-posta adresiniz": "Votre adresse e-mail",
  "Şifreniz": "Votre mot de passe",
  "En az 8 karakter": "Au moins 8 caractères",
  "Hesabımı oluştur": "Créer mon compte",
  "Şifremi unuttum": "Mot de passe oublié",
  "Bilgileriniz KVKK kapsamında korunur": "Vos données sont protégées par la loi sur la protection des données",
  "Kurumsal panele giriş": "Connexion au panneau professionnel",
  "Geçerli bir e-posta adresi yazın.": "Saisissez une adresse e-mail valide.",
  "Şifreniz en az 8 karakter olmalı.": "Votre mot de passe doit contenir au moins 8 caractères.",
  "Adınızı yazın.": "Saisissez votre nom.",
  "E-postanıza onay bağlantısı gönderdik.": "Nous vous avons envoyé un lien de confirmation.",
  "Hoş geldiniz!": "Bienvenue !",
  "E-posta veya şifre hatalı.": "E-mail ou mot de passe incorrect.",
  "Kodu telefonunuza gönderdik.": "Nous avons envoyé le code sur votre téléphone.",
  "Kod gönderilemedi.": "Le code n'a pas pu être envoyé.",
  "Giriş yapılamadı.": "Connexion impossible.",
  "Dil": "Langue",
};

const AR: Dict = {
  "Kod gönder": "إرسال الرمز",
  "Tek ekranda mağaza, ürün ve sipariş": "المتجر والمنتجات والطلبات في شاشة واحدة",
  "Fotoğraf arka planını yapay zeka temizler": "الذكاء الاصطناعي ينظّف خلفية صورك",
  "Kargosuz teslimat için kod üretir": "ينشئ رموزًا للتسليم باليد بدون شحن",
  "Evde Üretenler Portalı": "بوابة المنتِجات من المنزل",
  "Telefon numaranızla kod alarak ya da e-posta ve şifrenizle girin.": "سجّلي الدخول برمز يصل إلى هاتفك أو بالبريد الإلكتروني وكلمة المرور.",
  Telefonla: "بالهاتف",
  "Giriş yap": "تسجيل الدخول",
  "Hesap aç": "إنشاء حساب",
  "Telefonunuza gelen 4 haneli kod": "الرمز المكوّن من 4 أرقام المرسل إلى هاتفك",
  "Numaramı değiştir / yeni kod isteyin": "تغيير الرقم / طلب رمز جديد",
  "Telefon numaranız": "رقم هاتفك",
  "Kod gönder": "إرسال الرمز",
  "Kod ücretsizdir ve 5 dakika geçerlidir.": "الرمز مجاني وصالح لمدة 5 دقائق.",
  "E-postanızı kontrol edin.": "تحقّقي من بريدك الإلكتروني.",
  "Gönderdiğimiz onay bağlantısına dokunduktan sonra bu sayfadan giriş yapabilirsiniz.": "بعد الضغط على رابط التأكيد المرسل يمكنك تسجيل الدخول من هذه الصفحة.",
  "Girişe dön": "العودة إلى تسجيل الدخول",
  "Adınız": "اسمك",
  "E-posta adresiniz": "بريدك الإلكتروني",
  "Şifreniz": "كلمة المرور",
  "En az 8 karakter": "8 أحرف على الأقل",
  "Hesabımı oluştur": "إنشاء حسابي",
  "Şifremi unuttum": "نسيت كلمة المرور",
  "Bilgileriniz KVKK kapsamında korunur": "بياناتك محمية بموجب قانون حماية البيانات",
  "Kurumsal panele giriş": "الدخول إلى لوحة الشركات",
  "Geçerli bir e-posta adresi yazın.": "أدخلي بريدًا إلكترونيًا صالحًا.",
  "Şifreniz en az 8 karakter olmalı.": "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.",
  "Adınızı yazın.": "أدخلي اسمك.",
  "E-postanıza onay bağlantısı gönderdik.": "أرسلنا رابط التأكيد إلى بريدك الإلكتروني.",
  "Hoş geldiniz!": "أهلًا بك!",
  "E-posta veya şifre hatalı.": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "Kodu telefonunuza gönderdik.": "أرسلنا الرمز إلى هاتفك.",
  "Kod gönderilemedi.": "تعذّر إرسال الرمز.",
  "Giriş yapılamadı.": "تعذّر تسجيل الدخول.",
  "Dil": "اللغة",
};

const DICTS: Record<Exclude<HomeMakerLocale, "tr">, Dict> = { en: EN, de: DE, fr: FR, ar: AR };

export function hmT(locale: HomeMakerLocale, text: string) {
  if (locale === "tr") return text;
  return DICTS[locale][text] ?? text;
}

/** Ev Hanımları sayfası için tam head (başlık, açıklama, hreflang, JSON-LD). */
export function homeMakerHead(locale: HomeMakerLocale) {
  const m = HOME_MAKER_META[locale];
  const url = `https://mefticaret.com${homeMakerPath(locale)}`;
  const home = locale === "tr" ? "https://mefticaret.com/" : `https://mefticaret.com/${locale}`;
  return {
    meta: [
      { title: m.title },
      { name: "description", content: m.description },
      { name: "keywords", content: m.keywords },
      { property: "og:title", content: m.title },
      { property: "og:description", content: m.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:locale", content: m.ogLocale },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: m.title },
      { name: "twitter:description", content: m.description },
    ],
    links: [
      { rel: "canonical", href: url },
      ...HOME_MAKER_LOCALES.map((l) => ({ rel: "alternate", hrefLang: l, href: `https://mefticaret.com${homeMakerPath(l)}` })),
      { rel: "alternate", hrefLang: "x-default", href: "https://mefticaret.com/ev-hanimlari" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              "@id": url,
              url,
              name: m.title,
              description: m.description,
              inLanguage: m.inLanguage,
              isPartOf: { "@type": "WebSite", name: "Mefticaret", url: "https://mefticaret.com" },
              about: m.categories.map((name) => ({ "@type": "Thing", name })),
            },
            {
              "@type": "ItemList",
              name: m.listName,
              itemListElement: m.categories.map((name, i) => ({ "@type": "ListItem", position: i + 1, name })),
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Mefticaret", item: home },
                { "@type": "ListItem", position: 2, name: m.crumb, item: url },
              ],
            },
          ],
        }),
      },
    ],
  };
}
