import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight, BarChart3, Boxes, Check, CreditCard, Globe2, Headphones, Languages,
  MailCheck, MapPinned, Menu, Package, PackageCheck, ShieldCheck, ShoppingBag,
  Smartphone, Sparkles, Store, Truck, X, Zap,
} from "lucide-react";
import { useState } from "react";

import gdprBadge from "@/assets/gdpr-badge.webp.asset.json";
import { CommerceFlowAnimation } from "@/components/commerce-flow-animation";
import { PlatformLocaleSwitcher } from "@/components/platform-locale-switcher";
import { Button } from "@/components/ui/button";
import { formatMoney, planLimitLabel } from "@/lib/mefti";
import { plansQuery } from "@/lib/store-queries";

export type LandingCopy = {
  locale: "en" | "de" | "ar" | "fr";
  dir: "ltr" | "rtl";
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: string;
  headerCta: string;
  secondaryCta: string;
  menuLabel: string;
  closeMenuLabel: string;
  skipLabel: string;
  benefits: [string, string, string];
  featuresTitle: string;
  features: { title: string; body: string }[];
  exportTitle: string;
  exportBody: string;
  exportPoints: string[];
  faqTitle: string;
  faq: { q: string; a: string }[];
  closingTitle: string;
  closingBody: string;
  trLink: string;
};

type ExtraCopy = {
  nav: [string, string, string, string];
  login: string;
  flowEyebrow: string; flowTitle: string; flowBody: string;
  makersEyebrow: string; makersTitle: string; makersBody: string; makersPoints: string[];
  easyStart: string; freeStart: string; noCard: string; setupSteps: string[]; easyLogin: string; standardLogin: string;
  platformEyebrow: string; platformTitle: string; platformBody: string;
  capabilityGroups: { eyebrow: string; title: string; body: string; items: string[] }[];
  growthEyebrow: string; growthTitle: string; growthBody: string;
  growthCards: { eyebrow: string; title: string; body: string; points: string[] }[];
  appsEyebrow: string; appsTitle: string; appsBody: string; appsCta: string;
  pricingEyebrow: string; pricingTitle: string; pricingBody: string; monthly: string; yearly: string;
  free: string; perMonth: string; perYear: string; trial: string; product: string; order: string; staff: string; domain: string;
  guidesEyebrow: string; guidesTitle: string; guidesBody: string; readGuide: string;
  guides: { eyebrow: string; title: string; body: string }[];
  supplierEyebrow: string; supplierTitle: string; supplierBody: string; supplierLogin: string; supplierRegister: string;
  footerBody: string; footerProduct: string; footerCompany: string; footerStart: string; privacy: string; terms: string; contact: string; gdpr: string;
};

const EXTRAS: Record<LandingCopy["locale"], ExtraCopy> = {
  en: {
    nav: ["Features", "Global sales", "Pricing", "Resources"], login: "Log in",
    flowEyebrow: "Live sales flow", flowTitle: "Every step from order to payment, in one place", flowBody: "Product selection, secure payment and order notifications move through one seamless flow.",
    makersEyebrow: "Made for independent makers", makersTitle: "Sell what you make online, with ease", makersBody: "Add products without technical knowledge, follow orders from your phone and talk to customers from one screen.", makersPoints: ["Mobile-friendly Easy Panel", "Fast product and order management", "Simple tools for home businesses"],
    easyStart: "Easy start", freeStart: "Start free", noCard: "No credit card", setupSteps: ["Create your store", "Add your products", "Manage orders in Easy Panel"], easyLogin: "Easy Panel login", standardLogin: "Standard store login",
    platformEyebrow: "Platform features", platformTitle: "Everything you need to grow sales is included", platformBody: "Apps, AI automation, marketplaces, shipping and payments work together in Mefticaret.",
    capabilityGroups: [
      { eyebrow: "APP STORE", title: "Apps installed in one click", body: "Add the modules your store needs and start immediately.", items: ["Instagram DM and comment automation", "TikTok messaging and sales", "Facebook Marketplace publishing", "Language and translation center"] },
      { eyebrow: "AUTOMATION & AI", title: "Smart tools that do the work", body: "Build visual workflows and create content with AI.", items: ["Visual automation builder", "AI blog and product writer", "Automatic SEO improvements", "Abandoned cart notifications"] },
      { eyebrow: "CHANNELS, SHIPPING & PAYMENTS", title: "Every sales channel in one dashboard", body: "Stock, prices and orders stay synchronized everywhere.", items: ["Marketplace product and order sync", "Returns and automatic stock updates", "Carriers and shipping labels", "Payment providers and installments"] },
    ],
    growthEyebrow: "GLOBAL SALES & GROWTH", growthTitle: "All global commerce operations in one dashboard", growthBody: "From local pricing and multilingual SEO to export documents and automated campaigns.",
    growthCards: [
      { eyebrow: "REGIONAL COMMERCE", title: "Country pricing and tax", body: "Manage currencies, country catalogs and destination taxes.", points: ["Multiple currencies", "DDP / DDU calculation"] },
      { eyebrow: "MULTILINGUAL GROWTH", title: "AI translation and global SEO", body: "Adapt product content and technical SEO for every market.", points: ["EN, DE, FR, AR and more", "Language sitemaps"] },
      { eyebrow: "EXPORT & LOGISTICS", title: "One flow from warehouse to customs", body: "Speed up operations with routing, carrier comparisons and documents.", points: ["ETGB and invoices", "Carrier-ready"] },
      { eyebrow: "MARKETING", title: "The right message, right on time", body: "Manage cart recovery, newsletters and campaigns visually.", points: ["A/B tests and reports", "Storefront campaigns"] },
      { eyebrow: "GROWTH & B2B", title: "Affiliate and wholesale sales", body: "Run commissions, MOQ, tiered pricing and quote requests.", points: ["Influencer ROI", "RFQ readiness"] },
    ],
    appsEyebrow: "APP STORE", appsTitle: "50+ apps and integrations in one dashboard", appsBody: "Marketplaces, shipping, marketing and automation tools install in one click.", appsCta: "Explore the app store",
    pricingEyebrow: "PRICING", pricingTitle: "A plan that grows with your store", pricingBody: "Start free and move up when your business needs more.", monthly: "Monthly", yearly: "Yearly", free: "Free", perMonth: "/month", perYear: "/year", trial: "day trial", product: "products", order: "orders", staff: "staff", domain: "custom domains",
    guidesEyebrow: "GUIDES", guidesTitle: "Useful guides before you start selling", guidesBody: "Make the right decision with practical resources from the Mefticaret team.", readGuide: "Read guide",
    guides: [{ eyebrow: "GETTING STARTED", title: "How to start an online store", body: "From choosing products to your first order in five practical steps." }, { eyebrow: "COMPARISON", title: "Choosing an ecommerce platform", body: "Compare fees, features and growth capabilities." }, { eyebrow: "INTEGRATIONS", title: "Marketplace integration", body: "Manage products, stock and orders from one place." }],
    supplierEyebrow: "BUSINESS PARTNERS", supplierTitle: "Are you a Mefticaret supplier?", supplierBody: "Manage orders, product transfers, stock sync and earnings in the supplier portal.", supplierLogin: "Supplier login", supplierRegister: "New registration",
    footerBody: "Commerce infrastructure for selling locally and worldwide.", footerProduct: "Product", footerCompany: "Company", footerStart: "Get started", privacy: "Privacy", terms: "Terms", contact: "Contact", gdpr: "GDPR compliant",
  },
  de: {
    nav: ["Funktionen", "Globaler Verkauf", "Preise", "Ressourcen"], login: "Anmelden",
    flowEyebrow: "Live-Verkaufsablauf", flowTitle: "Von der Bestellung bis zur Zahlung an einem Ort", flowBody: "Produktauswahl, sichere Zahlung und Bestellmeldungen laufen nahtlos zusammen.",
    makersEyebrow: "Für Selbstgemachtes", makersTitle: "Verkaufen Sie Ihre Produkte einfach online", makersBody: "Produkte ohne Technikkenntnisse anlegen, Bestellungen mobil verfolgen und Kunden zentral betreuen.", makersPoints: ["Mobiles Easy Panel", "Schnelle Produkt- und Bestellverwaltung", "Einfache Bedienung für Kleinbetriebe"],
    easyStart: "Einfacher Start", freeStart: "Kostenlos starten", noCard: "Keine Kreditkarte", setupSteps: ["Shop erstellen", "Produkte hinzufügen", "Bestellungen im Easy Panel verwalten"], easyLogin: "Easy Panel Anmeldung", standardLogin: "Standard-Shop anmelden",
    platformEyebrow: "PLATTFORMFUNKTIONEN", platformTitle: "Alles für mehr Umsatz ist bereits enthalten", platformBody: "Apps, KI-Automatisierung, Marktplätze, Versand und Zahlungen arbeiten gemeinsam.",
    capabilityGroups: [
      { eyebrow: "APP-STORE", title: "Apps mit einem Klick", body: "Benötigte Module hinzufügen und sofort nutzen.", items: ["Instagram-DM-Automatisierung", "TikTok Nachrichten und Verkauf", "Facebook Marketplace", "Sprach- und Übersetzungszentrum"] },
      { eyebrow: "AUTOMATISIERUNG & KI", title: "Intelligente Werkzeuge", body: "Visuelle Abläufe erstellen und Inhalte mit KI erzeugen.", items: ["Visueller Workflow-Builder", "KI-Textassistent", "Automatische SEO-Optimierung", "Warenkorberinnerungen"] },
      { eyebrow: "KANÄLE, VERSAND & ZAHLUNG", title: "Alle Verkaufskanäle in einem Panel", body: "Bestand, Preise und Bestellungen bleiben synchron.", items: ["Marktplatz-Synchronisierung", "Retouren und Bestandsupdate", "Versandetiketten", "Zahlungsanbieter und Raten"] },
    ],
    growthEyebrow: "GLOBALER VERKAUF & WACHSTUM", growthTitle: "Der gesamte Welthandel in einem Dashboard", growthBody: "Lokale Preise, mehrsprachiges SEO, Exportdokumente und Kampagnen aus einer Hand.",
    growthCards: [
      { eyebrow: "REGIONALER HANDEL", title: "Preise und Steuern je Land", body: "Währungen, Länderkataloge und Zielsteuern verwalten.", points: ["Mehrere Währungen", "DDP / DDU"] },
      { eyebrow: "MEHRSPRACHIG", title: "KI-Übersetzung und globales SEO", body: "Inhalte und SEO auf jeden Markt abstimmen.", points: ["EN, DE, FR, AR und mehr", "Sprach-Sitemaps"] },
      { eyebrow: "EXPORT & LOGISTIK", title: "Vom Lager bis zum Zoll", body: "Versandwege, Anbieter und Dokumente zentral steuern.", points: ["ETGB und Rechnung", "Versandbereit"] },
      { eyebrow: "MARKETING", title: "Die richtige Botschaft zur richtigen Zeit", body: "Newsletter, Kampagnen und Warenkorbrückgewinnung verwalten.", points: ["A/B-Tests", "Shop-Kampagnen"] },
      { eyebrow: "GROWTH & B2B", title: "Affiliate und Großhandel", body: "Provisionen, MOQ, Staffelpreise und Anfragen verwalten.", points: ["Influencer-ROI", "RFQ"] },
    ],
    appsEyebrow: "APP-STORE", appsTitle: "50+ Apps und Integrationen in einem Panel", appsBody: "Marktplatz-, Versand-, Marketing- und Automationswerkzeuge mit einem Klick.", appsCta: "App-Store entdecken",
    pricingEyebrow: "PREISE", pricingTitle: "Ein Tarif, der mit Ihrem Shop wächst", pricingBody: "Kostenlos starten und bei Bedarf erweitern.", monthly: "Monatlich", yearly: "Jährlich", free: "Kostenlos", perMonth: "/Monat", perYear: "/Jahr", trial: "Tage testen", product: "Produkte", order: "Bestellungen", staff: "Mitarbeiter", domain: "Domains",
    guidesEyebrow: "RATGEBER", guidesTitle: "Wissenswertes vor dem Verkaufsstart", guidesBody: "Treffen Sie mit praktischen Mefticaret-Ratgebern die richtige Entscheidung.", readGuide: "Ratgeber lesen",
    guides: [{ eyebrow: "START", title: "Einen Onlineshop starten", body: "In fünf Schritten vom Produkt zur ersten Bestellung." }, { eyebrow: "VERGLEICH", title: "Die richtige Shop-Plattform", body: "Gebühren, Funktionen und Wachstum vergleichen." }, { eyebrow: "INTEGRATION", title: "Marktplatz-Integration", body: "Produkte, Bestand und Bestellungen zentral verwalten." }],
    supplierEyebrow: "GESCHÄFTSPARTNER", supplierTitle: "Sind Sie Mefticaret-Lieferant?", supplierBody: "Bestellungen, Produktübertragungen, Bestand und Erträge im Lieferantenportal verwalten.", supplierLogin: "Lieferanten-Login", supplierRegister: "Neu registrieren",
    footerBody: "E-Commerce-Infrastruktur für lokalen und weltweiten Verkauf.", footerProduct: "Produkt", footerCompany: "Unternehmen", footerStart: "Loslegen", privacy: "Datenschutz", terms: "Bedingungen", contact: "Kontakt", gdpr: "DSGVO-konform",
  },
  fr: {
    nav: ["Fonctionnalités", "Vente mondiale", "Tarifs", "Ressources"], login: "Connexion",
    flowEyebrow: "Flux de vente en direct", flowTitle: "De la commande au paiement, tout au même endroit", flowBody: "Sélection des produits, paiement sécurisé et notifications avancent sans interruption.",
    makersEyebrow: "Pour les créateurs indépendants", makersTitle: "Vendez facilement vos créations en ligne", makersBody: "Ajoutez vos produits sans connaissances techniques, suivez les commandes sur mobile et échangez avec vos clients.", makersPoints: ["Easy Panel adapté au mobile", "Gestion rapide des produits et commandes", "Utilisation simple pour les petites activités"],
    easyStart: "Démarrage facile", freeStart: "Commencer gratuitement", noCard: "Sans carte bancaire", setupSteps: ["Créez votre boutique", "Ajoutez vos produits", "Gérez les commandes dans Easy Panel"], easyLogin: "Connexion Easy Panel", standardLogin: "Connexion boutique standard",
    platformEyebrow: "FONCTIONNALITÉS", platformTitle: "Tout est prêt pour développer vos ventes", platformBody: "Applications, automatisation IA, marketplaces, livraison et paiements réunis.",
    capabilityGroups: [
      { eyebrow: "BOUTIQUE D’APPLICATIONS", title: "Des applications en un clic", body: "Ajoutez les modules utiles et commencez immédiatement.", items: ["Automatisation Instagram", "Messages et ventes TikTok", "Publication Facebook Marketplace", "Centre de traduction"] },
      { eyebrow: "AUTOMATISATION & IA", title: "Des outils intelligents", body: "Créez des scénarios visuels et du contenu avec l’IA.", items: ["Créateur de scénarios", "Rédaction IA", "SEO automatique", "Relances de panier"] },
      { eyebrow: "CANAUX, LIVRAISON & PAIEMENT", title: "Tous vos canaux dans un tableau de bord", body: "Stocks, prix et commandes restent synchronisés.", items: ["Synchronisation marketplace", "Retours et mise à jour du stock", "Transporteurs et étiquettes", "Paiements et échéances"] },
    ],
    growthEyebrow: "VENTE MONDIALE & CROISSANCE", growthTitle: "Toutes vos opérations internationales au même endroit", growthBody: "Tarification locale, SEO multilingue, documents d’export et campagnes automatisées.",
    growthCards: [
      { eyebrow: "COMMERCE RÉGIONAL", title: "Prix et taxes par pays", body: "Gérez devises, catalogues locaux et taxes de destination.", points: ["Multidevise", "Calcul DDP / DDU"] },
      { eyebrow: "CROISSANCE MULTILINGUE", title: "Traduction IA et SEO mondial", body: "Adaptez contenus et SEO à chaque marché.", points: ["EN, DE, FR, AR et plus", "Sitemaps par langue"] },
      { eyebrow: "EXPORT & LOGISTIQUE", title: "De l’entrepôt à la douane", body: "Centralisez acheminement, transporteurs et documents.", points: ["ETGB et factures", "Prêt pour les transporteurs"] },
      { eyebrow: "MARKETING", title: "Le bon message au bon moment", body: "Gérez paniers abandonnés, newsletters et campagnes.", points: ["Tests A/B", "Campagnes boutique"] },
      { eyebrow: "GROWTH & B2B", title: "Affiliation et vente en gros", body: "Commissions, MOQ, tarifs dégressifs et devis.", points: ["ROI influenceurs", "Demandes RFQ"] },
    ],
    appsEyebrow: "BOUTIQUE D’APPLICATIONS", appsTitle: "Plus de 50 applications et intégrations", appsBody: "Marketplace, livraison, marketing et automatisation en un clic.", appsCta: "Découvrir les applications",
    pricingEyebrow: "TARIFS", pricingTitle: "Une offre qui grandit avec votre boutique", pricingBody: "Commencez gratuitement et évoluez lorsque nécessaire.", monthly: "Mensuel", yearly: "Annuel", free: "Gratuit", perMonth: "/mois", perYear: "/an", trial: "jours d’essai", product: "produits", order: "commandes", staff: "collaborateurs", domain: "domaines",
    guidesEyebrow: "GUIDES", guidesTitle: "Les guides utiles avant de vendre", guidesBody: "Prenez les bonnes décisions avec les ressources pratiques de Mefticaret.", readGuide: "Lire le guide",
    guides: [{ eyebrow: "DÉMARRAGE", title: "Créer une boutique en ligne", body: "Du choix des produits à la première commande en cinq étapes." }, { eyebrow: "COMPARAISON", title: "Choisir sa plateforme e-commerce", body: "Comparez frais, fonctions et potentiel de croissance." }, { eyebrow: "INTÉGRATION", title: "Intégration marketplace", body: "Centralisez produits, stocks et commandes." }],
    supplierEyebrow: "PARTENAIRES", supplierTitle: "Vous êtes fournisseur Mefticaret ?", supplierBody: "Gérez commandes, transferts de produits, stocks et revenus depuis le portail fournisseur.", supplierLogin: "Connexion fournisseur", supplierRegister: "Nouvelle inscription",
    footerBody: "L’infrastructure e-commerce pour vendre localement et partout dans le monde.", footerProduct: "Produit", footerCompany: "Entreprise", footerStart: "Commencer", privacy: "Confidentialité", terms: "Conditions", contact: "Contact", gdpr: "Conforme au RGPD",
  },
  ar: {
    nav: ["الميزات", "البيع العالمي", "الأسعار", "المصادر"], login: "تسجيل الدخول",
    flowEyebrow: "تدفق المبيعات المباشر", flowTitle: "من الطلب إلى الدفع، كل خطوة في مكان واحد", flowBody: "اختيار المنتج والدفع الآمن وإشعارات الطلب ضمن تدفق متكامل.",
    makersEyebrow: "لأصحاب المنتجات المنزلية", makersTitle: "بِع ما تصنعه بسهولة عبر الإنترنت", makersBody: "أضف منتجاتك دون خبرة تقنية، وتابع الطلبات من هاتفك وتواصل مع عملائك.", makersPoints: ["لوحة سهلة للهاتف", "إدارة سريعة للمنتجات والطلبات", "استخدام بسيط للمشاريع المنزلية"],
    easyStart: "بداية سهلة", freeStart: "ابدأ مجانًا", noCard: "لا تحتاج بطاقة", setupSteps: ["أنشئ متجرك", "أضف منتجاتك", "أدر الطلبات من اللوحة السهلة"], easyLogin: "دخول اللوحة السهلة", standardLogin: "دخول المتجر القياسي",
    platformEyebrow: "ميزات المنصة", platformTitle: "كل ما تحتاجه لتنمية مبيعاتك جاهز", platformBody: "التطبيقات وأتمتة الذكاء الاصطناعي والأسواق والشحن والدفع تعمل معًا.",
    capabilityGroups: [
      { eyebrow: "متجر التطبيقات", title: "تطبيقات بنقرة واحدة", body: "أضف الوحدات التي تحتاجها وابدأ فورًا.", items: ["أتمتة رسائل إنستغرام", "رسائل ومبيعات تيك توك", "النشر في فيسبوك ماركت", "مركز اللغات والترجمة"] },
      { eyebrow: "الأتمتة والذكاء الاصطناعي", title: "أدوات ذكية تنجز العمل", body: "أنشئ تدفقات مرئية ومحتوى بالذكاء الاصطناعي.", items: ["منشئ الأتمتة المرئي", "كاتب المحتوى الذكي", "تحسين SEO تلقائي", "تنبيهات السلة المتروكة"] },
      { eyebrow: "القنوات والشحن والدفع", title: "كل قنوات البيع في لوحة واحدة", body: "المخزون والأسعار والطلبات متزامنة دائمًا.", items: ["مزامنة الأسواق", "المرتجعات وتحديث المخزون", "الشحن والملصقات", "الدفع والتقسيط"] },
    ],
    growthEyebrow: "المبيعات العالمية والنمو", growthTitle: "كل عمليات التجارة العالمية في لوحة واحدة", growthBody: "من التسعير المحلي وSEO متعدد اللغات إلى مستندات التصدير والحملات الآلية.",
    growthCards: [
      { eyebrow: "التجارة الإقليمية", title: "السعر والضريبة حسب البلد", body: "إدارة العملات والكتالوجات وضرائب الوجهة.", points: ["عملات متعددة", "حساب DDP / DDU"] },
      { eyebrow: "النمو متعدد اللغات", title: "ترجمة ذكية وSEO عالمي", body: "تكييف المحتوى وSEO لكل سوق.", points: ["EN وDE وFR وAR وأكثر", "خرائط موقع لغوية"] },
      { eyebrow: "التصدير واللوجستيات", title: "من المستودع إلى الجمارك", body: "إدارة المسارات والناقلين والمستندات.", points: ["ETGB والفواتير", "جاهز للناقلين"] },
      { eyebrow: "التسويق", title: "الرسالة المناسبة في الوقت المناسب", body: "إدارة السلات المتروكة والنشرات والحملات.", points: ["اختبارات A/B", "حملات المتجر"] },
      { eyebrow: "النمو وB2B", title: "التسويق بالعمولة والجملة", body: "إدارة العمولات والحد الأدنى والأسعار وطلبات العروض.", points: ["عائد المؤثرين", "طلبات RFQ"] },
    ],
    appsEyebrow: "متجر التطبيقات", appsTitle: "+50 تطبيقًا وتكاملًا في لوحة واحدة", appsBody: "أدوات الأسواق والشحن والتسويق والأتمتة بنقرة واحدة.", appsCta: "استكشف متجر التطبيقات",
    pricingEyebrow: "الأسعار", pricingTitle: "باقة تنمو مع متجرك", pricingBody: "ابدأ مجانًا وطوّر باقتك عند الحاجة.", monthly: "شهري", yearly: "سنوي", free: "مجاني", perMonth: "/شهر", perYear: "/سنة", trial: "يومًا تجريبيًا", product: "منتج", order: "طلب", staff: "موظف", domain: "نطاق خاص",
    guidesEyebrow: "الأدلة", guidesTitle: "أدلة مفيدة قبل بدء البيع", guidesBody: "اتخذ القرار الصحيح مع أدلة Mefticaret العملية.", readGuide: "اقرأ الدليل",
    guides: [{ eyebrow: "البداية", title: "بدء متجر إلكتروني", body: "من اختيار المنتج إلى أول طلب في خمس خطوات." }, { eyebrow: "المقارنة", title: "اختيار منصة التجارة", body: "قارن الرسوم والميزات وإمكانات النمو." }, { eyebrow: "التكامل", title: "تكامل الأسواق", body: "إدارة المنتجات والمخزون والطلبات مركزيًا." }],
    supplierEyebrow: "شركاء الأعمال", supplierTitle: "هل أنت مورد في Mefticaret؟", supplierBody: "أدر الطلبات ونقل المنتجات ومزامنة المخزون والأرباح من بوابة الموردين.", supplierLogin: "دخول المورد", supplierRegister: "تسجيل جديد",
    footerBody: "بنية التجارة الإلكترونية للبيع محليًا وعالميًا.", footerProduct: "المنتج", footerCompany: "الشركة", footerStart: "ابدأ", privacy: "الخصوصية", terms: "الشروط", contact: "اتصل بنا", gdpr: "متوافق مع GDPR",
  },
};

const FEATURE_ICONS = [Package, CreditCard, Truck, BarChart3, Languages, Globe2];
const CAPABILITY_ICONS = [ShoppingBag, Sparkles, Truck];
const GROWTH_ICONS = [MapPinned, Languages, PackageCheck, MailCheck, Boxes];
const APP_NAMES = ["Trendyol", "Amazon", "Instagram", "Google", "WhatsApp", "DHL", "PayPal", "Klarna"];

const PLAN_NAMES: Record<LandingCopy["locale"], Record<string, string>> = {
  en: { free: "Free", starter: "Starter", professional: "Professional", business: "Business", enterprise: "Enterprise" },
  de: { free: "Kostenlos", starter: "Starter", professional: "Professionell", business: "Business", enterprise: "Enterprise" },
  fr: { free: "Gratuit", starter: "Essentiel", professional: "Professionnel", business: "Business", enterprise: "Entreprise" },
  ar: { free: "مجاني", starter: "البداية", professional: "احترافي", business: "الأعمال", enterprise: "المؤسسات" },
};

export function GlobalLanding({ copy }: { copy: LandingCopy }) {
  const t = EXTRAS[copy.locale];
  const { data: plans } = useQuery(plansQuery());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const home = copy.locale === "en" ? "/en" : copy.locale === "de" ? "/de" : copy.locale === "fr" ? "/fr" : "/ar";

  return (
    <div dir={copy.dir} className="min-h-screen overflow-x-clip bg-background">
      <a href="#content" className="skip-link">{copy.skipLabel}</a>
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto grid min-h-18 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 md:flex md:gap-4 lg:px-8">
          <Link to={home} className="min-w-0 truncate font-display text-xl font-extrabold sm:text-2xl">mefticaret</Link>
          <nav aria-label={copy.menuLabel} className="mx-auto hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features">{t.nav[0]}</a><a href="#global">{t.nav[1]}</a><a href="#pricing">{t.nav[2]}</a><a href="#guides">{t.nav[3]}</a>
          </nav>
          <div className="ms-auto flex min-w-0 items-center gap-2">
            <PlatformLocaleSwitcher active={copy.locale} />
            <Button asChild variant="ghost" className="hidden rounded-full sm:inline-flex"><Link to="/auth" search={{ mode: "login" }}>{t.login}</Link></Button>
            <Button asChild className="hidden max-w-36 rounded-full px-4 min-[360px]:inline-flex"><Link to="/auth" search={{ mode: "register" }}><span className="truncate">{copy.headerCta}</span></Link></Button>
            <Button variant="outline" size="icon" className="rounded-full md:hidden" aria-label={mobileOpen ? copy.closeMenuLabel : copy.menuLabel} aria-expanded={mobileOpen} onClick={() => setMobileOpen((value) => !value)}>{mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}</Button>
          </div>
        </div>
        {mobileOpen ? <nav aria-label={copy.menuLabel} className="border-t border-border bg-background px-4 py-3 md:hidden"><div className="mx-auto grid max-w-lg gap-1">{[["#features", t.nav[0]], ["#global", t.nav[1]], ["#pricing", t.nav[2]], ["#guides", t.nav[3]]].map(([href, label]) => <a key={href} href={href} onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold">{label}</a>)}</div></nav> : null}
      </header>

      <main id="content" tabIndex={-1}>
        <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}><div className="mx-auto max-w-7xl px-4 py-16 text-center lg:px-8 lg:py-24"><div className="mx-auto max-w-3xl">
          <span className="eyebrow">{copy.eyebrow}</span><h1 className="mt-6 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">{copy.title}</h1><p className="mx-auto mt-6 max-w-xl leading-relaxed text-muted-foreground">{copy.subtitle}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><Button asChild size="lg" variant="outline" className="rounded-full px-6"><a href="mailto:info@mefticaret.com">{copy.secondaryCta}</a></Button><Button asChild size="lg" className="rounded-full px-6"><Link to="/auth" search={{ mode: "register" }}>{copy.primaryCta}<ArrowRight className="ms-2 size-4" /></Link></Button></div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-7 gap-y-3 text-sm text-muted-foreground">{copy.benefits.map((label, i) => { const Icon = [Zap, Headphones, ShieldCheck][i] ?? Check; return <li key={label} className="flex items-center gap-2"><Icon className="size-4 text-brand" />{label}</li>; })}</ul>
        </div></div></section>

        <section className="border-y border-border py-16 lg:py-24"><div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] lg:gap-20 lg:px-8"><div className="max-w-xl"><span className="eyebrow">{t.flowEyebrow}</span><h2 className="mt-5 text-3xl font-extrabold sm:text-4xl lg:text-5xl">{t.flowTitle}</h2><p className="mt-5 leading-relaxed text-muted-foreground">{t.flowBody}</p></div><CommerceFlowAnimation locale={copy.locale} /></div></section>

        <section className="border-y border-border bg-secondary/40 py-16 lg:py-20"><div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-8"><div><span className="eyebrow">{t.makersEyebrow}</span><h2 className="mt-5 text-3xl font-extrabold sm:text-4xl lg:text-5xl">{t.makersTitle}</h2><p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">{t.makersBody}</p><div className="mt-7 grid gap-3 sm:grid-cols-3">{t.makersPoints.map((label, i) => { const Icon = [Smartphone, Package, Store][i] ?? Check; return <div key={label} className="flex items-center gap-3 text-sm font-medium"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Icon className="size-4" /></span>{label}</div>; })}</div></div>
          <article className="showcase-card p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><span className="eyebrow">{t.easyStart}</span><h3 className="mt-3 text-2xl font-extrabold">{t.freeStart}</h3></div><span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">{t.noCard}</span></div><ul className="mt-6 space-y-3 text-sm">{t.setupSteps.map((item) => <li key={item} className="flex items-center gap-3"><Check className="size-4 text-success" />{item}</li>)}</ul><div className="mt-7 grid gap-3 sm:grid-cols-2"><Button asChild className="rounded-full"><Link to="/ev-hanimlari">{t.freeStart}</Link></Button><Button asChild variant="outline" className="rounded-full"><Link to="/ev-hanimlari">{t.easyLogin}</Link></Button></div><div className="mt-4 border-t border-border pt-4 text-center"><Link to="/auth" search={{ mode: "login" }} className="text-sm text-muted-foreground hover:text-foreground">{t.standardLogin}</Link></div></article>
        </div></section>

        <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28"><div className="text-center"><span className="eyebrow">{t.appsEyebrow}</span><h2 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold sm:text-4xl lg:text-5xl">{t.appsTitle}</h2><p className="mx-auto mt-5 max-w-2xl text-muted-foreground">{t.appsBody}</p></div><div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{APP_NAMES.slice(0, 4).map((name, i) => { const Icon = [ShoppingBag, Globe2, Languages, BarChart3][i] ?? Boxes; return <article key={name} className="showcase-card flex items-center gap-3 p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></span><div><p className="font-semibold">{name}</p><p className="text-xs text-muted-foreground">{t.nav[0]}</p></div></article>; })}</div></section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28"><div className="text-center"><span className="eyebrow">{t.platformEyebrow}</span><h2 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold sm:text-4xl lg:text-5xl">{t.platformTitle}</h2><p className="mx-auto mt-5 max-w-2xl text-muted-foreground">{t.platformBody}</p></div><div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{t.capabilityGroups.map((group, i) => { const Icon = CAPABILITY_ICONS[i] ?? Sparkles; return <article key={group.title} className="showcase-card flex flex-col p-6"><span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></span><span className="eyebrow mt-5">{group.eyebrow}</span><h3 className="mt-3 text-lg font-semibold">{group.title}</h3><p className="mt-2 text-sm text-muted-foreground">{group.body}</p><ul className="mt-6 space-y-3 text-sm">{group.items.map(item => <li key={item} className="flex gap-2"><Check className="mt-0.5 size-4 text-success" />{item}</li>)}</ul></article>; })}</div></section>

        <section className="border-y border-border bg-secondary/40 py-20 lg:py-28"><div className="mx-auto max-w-7xl px-4 lg:px-8"><h2 className="text-3xl font-extrabold sm:text-4xl">{copy.featuresTitle}</h2><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{copy.features.map((feature, i) => { const Icon = FEATURE_ICONS[i] ?? Package; return <article key={feature.title} className="showcase-card p-6"><Icon className="size-6 text-primary" /><h3 className="mt-4 text-lg font-semibold">{feature.title}</h3><p className="mt-2 text-sm text-muted-foreground">{feature.body}</p></article>; })}</div></div></section>

        <section id="global" className="py-20 lg:py-28"><div className="mx-auto max-w-7xl px-4 lg:px-8"><div className="text-center"><span className="eyebrow">{t.growthEyebrow}</span><h2 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold sm:text-4xl lg:text-5xl">{t.growthTitle}</h2><p className="mx-auto mt-5 max-w-2xl text-muted-foreground">{t.growthBody}</p></div><div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">{t.growthCards.map((card, i) => { const Icon = GROWTH_ICONS[i] ?? Globe2; return <article key={card.title} className={`showcase-card flex flex-col p-6 ${i < 2 ? "lg:col-span-3" : "lg:col-span-2"}`}><span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></span><span className="eyebrow mt-5">{card.eyebrow}</span><h3 className="mt-3 text-xl font-semibold">{card.title}</h3><p className="mt-3 text-sm text-muted-foreground">{card.body}</p><ul className="mt-5 space-y-2 text-xs font-medium">{card.points.map(point => <li key={point} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-success" />{point}</li>)}</ul></article>; })}</div></div></section>

        <section className="border-y border-border bg-secondary/40"><div className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28"><h2 className="text-3xl font-bold">{copy.exportTitle}</h2><p className="mt-3 max-w-3xl text-muted-foreground">{copy.exportBody}</p><ul className="mt-6 grid gap-3 sm:grid-cols-2">{copy.exportPoints.map(point => <li key={point} className="showcase-card flex gap-3 p-4 text-sm"><Check className="size-4 shrink-0 text-success" />{point}</li>)}</ul></div></section>

        <section className="overflow-hidden py-20 lg:py-28"><div className="mx-auto max-w-7xl px-4 text-center lg:px-8"><span className="eyebrow">{t.appsEyebrow}</span><h2 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold sm:text-4xl lg:text-5xl">{t.appsTitle}</h2><p className="mx-auto mt-5 max-w-2xl text-muted-foreground">{t.appsBody}</p><div className="mt-12 flex flex-wrap justify-center gap-3">{APP_NAMES.map(name => <div key={name} className="showcase-card flex items-center gap-3 px-5 py-4"><span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand"><Boxes className="size-4" /></span><span className="font-semibold">{name}</span></div>)}</div><Button asChild variant="outline" className="mt-10 rounded-full"><Link to="/auth" search={{ mode: "register" }}>{t.appsCta}<ArrowRight className="ms-2 size-4" /></Link></Button></div></section>

        <section id="pricing" className="border-y border-border bg-secondary/40 py-20 lg:py-28"><div className="mx-auto max-w-7xl px-4 lg:px-8"><div className="text-center"><span className="eyebrow">{t.pricingEyebrow}</span><h2 className="mt-6 text-3xl font-extrabold sm:text-4xl lg:text-5xl">{t.pricingTitle}</h2><p className="mx-auto mt-5 max-w-xl text-muted-foreground">{t.pricingBody}</p><div className="mx-auto mt-8 inline-flex rounded-full border bg-card p-1"><Button size="sm" variant={interval === "monthly" ? "default" : "ghost"} className="rounded-full" onClick={() => setInterval("monthly")}>{t.monthly}</Button><Button size="sm" variant={interval === "yearly" ? "default" : "ghost"} className="rounded-full" onClick={() => setInterval("yearly")}>{t.yearly}</Button></div></div>
          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-5">{(plans ?? []).map(plan => { const limits = (plan.limits ?? {}) as Record<string, number>; const price = interval === "yearly" ? Number(plan.price_yearly ?? 0) : Number(plan.price_monthly ?? 0); const localizedName = PLAN_NAMES[copy.locale][plan.code] ?? plan.name; return <article key={plan.id} className="showcase-card flex flex-col p-6"><h3 className="text-base font-semibold">{localizedName}</h3><p className="mt-5 text-2xl font-extrabold">{price === 0 ? t.free : formatMoney(price, plan.currency)}{price > 0 ? <span className="text-sm text-muted-foreground">{interval === "yearly" ? t.perYear : t.perMonth}</span> : null}</p><ul className="mt-5 space-y-2 text-sm">{[[planLimitLabel(limits["products"]), t.product], [planLimitLabel(limits["orders"]), t.order], [planLimitLabel(limits["staff"]), t.staff], [planLimitLabel(limits["domains"]), t.domain]].map(([value, label]) => <li key={label} className="flex gap-2"><Check className="size-4 text-success" />{value} {label}</li>)}</ul>{plan.trial_days > 0 ? <p className="mt-3 text-xs text-muted-foreground">{plan.trial_days} {t.trial}</p> : null}<Button asChild variant={plan.code === "professional" ? "default" : "outline"} className="mt-6 w-full rounded-full"><Link to="/auth" search={{ mode: "register" }}>{copy.primaryCta}</Link></Button></article>; })}</div>
        </div></section>

        <section id="guides" className="mx-auto max-w-7xl px-4 py-20 lg:px-8"><span className="eyebrow">{t.guidesEyebrow}</span><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><h2 className="max-w-2xl text-3xl font-extrabold sm:text-4xl">{t.guidesTitle}</h2><p className="max-w-sm text-sm text-muted-foreground">{t.guidesBody}</p></div><div className="mt-10 grid gap-5 md:grid-cols-3">{t.guides.map(guide => <article key={guide.title} className="showcase-card flex flex-col p-7"><span className="eyebrow">{guide.eyebrow}</span><h3 className="mt-3 text-xl font-bold">{guide.title}</h3><p className="mt-3 flex-1 text-sm text-muted-foreground">{guide.body}</p><Link to="/auth" search={{ mode: "register" }} className="mt-6 inline-flex items-center gap-1 text-sm font-semibold">{t.readGuide}<ArrowRight className="size-4" /></Link></article>)}</div></section>

        <section className="border-y border-border bg-secondary/30 py-20 lg:py-28"><div className="mx-auto max-w-7xl px-4 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-6"><div><span className="eyebrow">{t.nav[3]}</span><h2 className="mt-6 max-w-2xl text-3xl font-extrabold sm:text-4xl">{t.guidesTitle}</h2><p className="mt-4 max-w-xl text-muted-foreground">{t.guidesBody}</p></div><Button asChild variant="outline" className="rounded-full"><Link to="/auth" search={{ mode: "register" }}>{t.readGuide}<ArrowRight className="ms-2 size-4" /></Link></Button></div><div className="mt-12 grid gap-4 md:grid-cols-3">{t.guides.map(guide => <article key={`resource-${guide.title}`} className="showcase-card p-6"><span className="eyebrow">{guide.eyebrow}</span><h3 className="mt-4 text-lg font-semibold">{guide.title}</h3><p className="mt-2 text-sm text-muted-foreground">{guide.body}</p></article>)}</div></div></section>

        <section id="faq" className="border-t border-border bg-secondary/40 py-20 lg:py-28"><div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[minmax(0,380px)_1fr] lg:px-8"><div><span className="eyebrow">FAQ</span><h2 className="mt-6 text-3xl font-extrabold sm:text-4xl">{copy.faqTitle}</h2></div><div className="showcase-card px-5 py-2">{copy.faq.map(item => <details key={item.q} className="border-b border-border py-4 last:border-0"><summary className="cursor-pointer font-semibold">{item.q}</summary><p className="mt-3 text-sm text-muted-foreground">{item.a}</p></details>)}</div></div></section>

        <section className="border-y border-border py-12"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between lg:px-8"><div className="flex max-w-2xl items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-full border bg-background text-brand"><Boxes className="size-5" /></span><div><span className="eyebrow">{t.supplierEyebrow}</span><h2 className="mt-2 text-2xl font-bold sm:text-3xl">{t.supplierTitle}</h2><p className="mt-2 text-sm text-muted-foreground sm:text-base">{t.supplierBody}</p></div></div><div className="flex gap-2"><Button asChild className="rounded-full"><Link to="/tedarikci-giris" search={{ mode: "login" }}>{t.supplierLogin}</Link></Button><Button asChild variant="outline" className="rounded-full"><Link to="/tedarikci-giris" search={{ mode: "register" }}>{t.supplierRegister}</Link></Button></div></div></section>

        <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8"><div className="showcase-card px-6 py-14 text-center" style={{ background: "var(--gradient-hero)" }}><h2 className="text-3xl font-extrabold sm:text-4xl">{copy.closingTitle}</h2><p className="mx-auto mt-4 max-w-lg text-muted-foreground">{copy.closingBody}</p><Button asChild size="lg" className="mt-8 rounded-full"><Link to="/auth" search={{ mode: "register" }}>{copy.primaryCta}<ArrowRight className="ms-2 size-4" /></Link></Button></div></section>
      </main>

      <footer className="border-t border-border py-14"><div className="mx-auto max-w-7xl px-4 lg:px-8"><div className="grid gap-10 md:grid-cols-4"><div><span className="text-2xl font-extrabold">mefticaret</span><p className="mt-3 max-w-xs text-sm text-muted-foreground">{t.footerBody}</p></div><nav aria-label={t.footerProduct}><p className="text-xs font-semibold uppercase text-muted-foreground">{t.footerProduct}</p><ul className="mt-4 space-y-2 text-sm"><li><a href="#features">{t.nav[0]}</a></li><li><a href="#global">{t.nav[1]}</a></li><li><a href="#pricing">{t.nav[2]}</a></li></ul></nav><nav aria-label={t.footerCompany}><p className="text-xs font-semibold uppercase text-muted-foreground">{t.footerCompany}</p><ul className="mt-4 space-y-2 text-sm"><li><a href="mailto:info@mefticaret.com">{t.contact}</a></li><li><a href="/gizlilik">{t.privacy}</a></li><li><a href="/kullanim-kosullari">{t.terms}</a></li></ul></nav><div><p className="text-xs font-semibold uppercase text-muted-foreground">{t.footerStart}</p><Button asChild className="mt-4 rounded-full"><Link to="/auth" search={{ mode: "register" }}>{copy.primaryCta}</Link></Button></div></div><div className="mt-10 flex flex-col items-center gap-4 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:justify-between"><span>© {new Date().getFullYear()} Mefticaret</span><img src={gdprBadge.url} alt={t.gdpr} width={48} height={48} className="size-12 object-contain" /><span>{t.gdpr}</span></div></div></footer>
    </div>
  );
}

export const LANDING_ALTERNATES = [
  { hrefLang: "tr", href: "https://mefticaret.com/" }, { hrefLang: "en", href: "https://mefticaret.com/en" },
  { hrefLang: "de", href: "https://mefticaret.com/de" }, { hrefLang: "fr", href: "https://mefticaret.com/fr" }, { hrefLang: "ar", href: "https://mefticaret.com/ar" },
];

/** Ana sayfa meta metinleri: Türkçe başlık/açıklamanın birebir karşılıkları. */
const HOME_META: Record<LandingCopy["locale"], { title: string; description: string; ogLocale: string }> = {
  en: { title: "Mefticaret — Build Your Online Store, Sell on Marketplaces", description: "Open your online store in minutes with Mefticaret; manage products, orders, payments, shipping and marketplace sales from one panel.", ogLocale: "en_US" },
  de: { title: "Mefticaret — Onlineshop erstellen, auf Marktplätzen verkaufen", description: "Eröffnen Sie mit Mefticaret in wenigen Minuten Ihren Onlineshop und verwalten Sie Produkte, Bestellungen, Zahlungen, Versand und Marktplatzverkäufe in einem Panel.", ogLocale: "de_DE" },
  fr: { title: "Mefticaret — Créez votre boutique en ligne, vendez sur les marketplaces", description: "Ouvrez votre boutique en ligne en quelques minutes avec Mefticaret ; gérez produits, commandes, paiements, livraisons et ventes sur marketplaces depuis un seul panneau.", ogLocale: "fr_FR" },
  ar: { title: "مفتيجاريت — أنشئ متجرك الإلكتروني وبِع في الأسواق الإلكترونية", description: "افتح متجرك الإلكتروني في دقائق مع مفتيجاريت، وأدر المنتجات والطلبات والمدفوعات والشحن ومبيعات الأسواق الإلكترونية من لوحة واحدة.", ogLocale: "ar_AE" },
};

const OG_IMAGE = "https://mefticaret.com/og-mefticaret.jpg";

export function globalLandingHead(copy: LandingCopy, path: string) {
  const url = `https://mefticaret.com${path}`;
  const { title, description, ogLocale } = HOME_META[copy.locale];
  return {
    meta: [
      { title }, { name: "description", content: description }, { name: "content-language", content: copy.locale },
      { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" },
      { property: "og:url", content: url }, { property: "og:site_name", content: "Mefticaret" }, { property: "og:locale", content: ogLocale },
      { property: "og:image", content: OG_IMAGE }, { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title }, { name: "twitter:description", content: description }, { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: url }, ...LANDING_ALTERNATES.map(alt => ({ rel: "alternate", hrefLang: alt.hrefLang, href: alt.href })), { rel: "alternate", hrefLang: "x-default", href: "https://mefticaret.com/" }],
    scripts: [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Mefticaret", applicationCategory: "BusinessApplication", applicationSubCategory: "E-commerce", operatingSystem: "Web", url, image: OG_IMAGE, description, inLanguage: copy.locale, publisher: { "@type": "Organization", name: "Mefticaret" } }) }],
  };
}
