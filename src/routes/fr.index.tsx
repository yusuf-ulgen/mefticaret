import { createFileRoute } from "@tanstack/react-router";

import { GlobalLanding, globalLandingHead, type LandingCopy } from "@/components/global-landing";

const COPY: LandingCopy = {
  locale: "fr",
  dir: "ltr",
  eyebrow: "Plateforme e-commerce",
  title: "Mefticaret — Vendez dans le monde entier depuis un seul tableau de bord",
  subtitle:
    "Ouvrez votre boutique en ligne en quelques minutes et gérez produits, stocks, commandes, expéditions, marketplaces et export depuis un seul panneau. Prix multidevises, règles de TVA européennes et taxes américaines, documents d'export inclus.",
  primaryCta: "Commencer gratuitement",
  headerCta: "S'inscrire",
  secondaryCta: "Appelez-nous",
  menuLabel: "Navigation principale",
  closeMenuLabel: "Fermer le menu",
  skipLabel: "Aller au contenu",
  benefits: ["Installation rapide", "Assistance 24/7", "Infrastructure sécurisée"],
  featuresTitle: "Tout ce dont une boutique en croissance a besoin",
  features: [
    {
      title: "Produits et stocks",
      body: "Variantes, codes-barres, emplacements et alertes de stock bas. Les quantités restent synchronisées entre la boutique et les marketplaces.",
    },
    {
      title: "Paiements et caisse",
      body: "Carte bancaire avec 3D Secure, virement et paiement à la livraison. Activez les moyens de paiement locaux par pays et par devise.",
    },
    {
      title: "Expédition et suivi",
      body: "Tarifs à la caisse, étiquettes prêtes à imprimer et mises à jour automatiques du statut sur votre page de suivi personnalisée.",
    },
    {
      title: "Des rapports utiles",
      body: "Chiffre d'affaires quotidien, taux de conversion, paniers abandonnés et meilleures ventes, avec une répartition par pays pour l'export.",
    },
    {
      title: "Traduction par IA",
      body: "Traduisez titres, descriptions et métadonnées SEO en anglais, allemand, français, russe et arabe en un clic, puis modifiez librement.",
    },
    {
      title: "SEO dès le premier jour",
      body: "URL propres, métadonnées par page, données structurées, sitemaps par langue et balises hreflang pour chaque marché.",
    },
  ],
  exportTitle: "Vendez à l'international sans paperasse",
  exportBody:
    "Le module Global & Export affiche les prix dans la devise de l'acheteur, calcule la taxe du pays de destination et génère les documents exigés par votre transporteur.",
  exportPoints: [
    "Prix par pays et taux de change en direct avec votre propre marge de risque",
    "TVA OSS/IOSS de l'UE, seuil de 150 EUR et autoliquidation B2B",
    "Sales Tax américaine par État avec réglages de nexus",
    "Simulateur DDP/DDU pour le coût total à la caisse",
    "Facture commerciale, liste de colisage et documents d'export ETGB en PDF",
    "Connexions DHL, FedEx, UPS, PTT, Navlungo, ShipEntegra et Aramex",
  ],
  faqTitle: "Questions fréquentes",
  faq: [
    {
      q: "Combien de temps prend la mise en place ?",
      a: "Quelques minutes. Choisissez un thème, ajoutez vos premiers produits, connectez un moyen de paiement et vous pouvez recevoir des commandes le jour même.",
    },
    {
      q: "Puis-je vendre dans d'autres devises ?",
      a: "Oui. Les taux en direct couvrent USD, EUR, GBP, AED, SAR et CAD, et vous pouvez fixer un prix dédié par pays.",
    },
    {
      q: "Ai-je besoin d'un développeur ?",
      a: "Non. Thèmes, pages, produits, taxes et livraison se configurent depuis le tableau de bord.",
    },
  ],
  closingTitle: "Lancez votre boutique aujourd'hui",
  closingBody:
    "Commencez gratuitement, invitez votre équipe et passez à une offre supérieure seulement quand votre volume de commandes l'exige.",
  trLink: "Türkçe sayfa",
};

export const Route = createFileRoute("/fr/")({
  head: () => globalLandingHead(COPY, "/fr"),
  component: () => <GlobalLanding copy={COPY} />,
});
