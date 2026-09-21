import { createFileRoute } from "@tanstack/react-router";

import { GlobalLanding, globalLandingHead, type LandingCopy } from "@/components/global-landing";

const COPY: LandingCopy = {
  locale: "de",
  dir: "ltr",
  eyebrow: "E-Commerce-Plattform",
  title: "Mefticaret — Weltweit verkaufen aus einem Dashboard",
  subtitle:
    "Eröffnen Sie Ihren Onlineshop in Minuten und steuern Sie Produkte, Lager, Bestellungen, Versand, Marktplätze und den Export aus einem Panel. Mehrwährungspreise, EU- und US-Steuerregeln sowie Exportdokumente sind enthalten.",
  primaryCta: "Kostenlos starten",
  headerCta: "Registrieren",
  secondaryCta: "Rufen Sie uns an",
  menuLabel: "Hauptnavigation",
  closeMenuLabel: "Menü schließen",
  skipLabel: "Zum Inhalt springen",
  benefits: ["Schnelle Einrichtung", "24/7 Support", "Sichere Infrastruktur"],
  featuresTitle: "Alles, was ein wachsender Shop braucht",
  features: [
    {
      title: "Produkte und Lager",
      body: "Varianten, Barcodes, Lagerorte und Warnungen bei niedrigem Bestand. Der Bestand bleibt zwischen Shop und Marktplätzen synchron.",
    },
    {
      title: "Zahlungen und Kasse",
      body: "Kartenzahlung mit 3D Secure, Überweisung und Nachnahme. Lokale Zahlarten lassen sich pro Land und Währung aktivieren.",
    },
    {
      title: "Versand und Sendungsverfolgung",
      body: "Versandpreise an der Kasse, Etiketten zum Ausdrucken und automatische Statusupdates mit eigener Tracking-Seite.",
    },
    {
      title: "Auswertungen zum Handeln",
      body: "Tagesumsatz, Conversion, abgebrochene Warenkörbe und Bestseller — dazu Länderberichte für den Export.",
    },
    {
      title: "Übersetzungen mit KI",
      body: "Produkttitel, Beschreibungen und SEO-Angaben in einem Klick auf Englisch, Deutsch, Arabisch, Französisch und Russisch übersetzen und danach frei bearbeiten.",
    },
    {
      title: "SEO von Anfang an",
      body: "Saubere URLs, Metadaten pro Seite, strukturierte Daten, sprachbezogene Sitemaps und hreflang-Angaben für jeden Markt.",
    },
  ],
  exportTitle: "Grenzüberschreitend verkaufen ohne Papierkram",
  exportBody:
    "Das Global- & Exportmodul zeigt Preise in der Währung des Käufers, berechnet die Steuer des Ziellandes und erstellt die Dokumente, die Ihr Versanddienst verlangt.",
  exportPoints: [
    "Länderspezifische Preise plus Live-Wechselkurs mit eigener Risikomarge",
    "EU OSS/IOSS-Umsatzsteuer, 150-EUR-Grenze und B2B-Reverse-Charge",
    "US-Sales-Tax je Bundesstaat mit Nexus-Einstellungen",
    "DDP/DDU-Simulator für die Gesamtkosten an der Kasse",
    "Handelsrechnung, Packliste und ETGB-Exportdokumente als PDF",
    "Anbindungen an DHL, FedEx, UPS, PTT, Navlungo, ShipEntegra und Aramex",
  ],
  faqTitle: "Häufige Fragen",
  faq: [
    {
      q: "Wie lange dauert die Einrichtung?",
      a: "Wenige Minuten. Theme wählen, erste Produkte anlegen, Zahlart verbinden — und Sie können am selben Tag Bestellungen annehmen.",
    },
    {
      q: "Kann ich in anderen Währungen verkaufen?",
      a: "Ja. Live-Kurse decken USD, EUR, GBP, AED, SAR und CAD ab; pro Land ist auch ein fester Preis möglich.",
    },
    {
      q: "Brauche ich Entwickler?",
      a: "Nein. Themes, Seiten, Produkte, Steuern und Versand werden im Dashboard eingestellt.",
    },
  ],
  closingTitle: "Starten Sie heute Ihren Shop",
  closingBody: "Kostenlos beginnen, Team einladen und erst dann upgraden, wenn Ihr Bestellvolumen es verlangt.",
  trLink: "Türkçe sayfa",
};

export const Route = createFileRoute("/de/")({
  head: () => globalLandingHead(COPY, "/de"),
  component: () => <GlobalLanding copy={COPY} />,
});
