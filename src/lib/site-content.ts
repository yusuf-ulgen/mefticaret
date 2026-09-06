import { queryOptions } from "@tanstack/react-query";
import {
  BarChart3,
  Boxes,
  Calculator,
  CreditCard,
  Globe,
  Headphones,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Users,
  Zap,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

/**
 * Platform pazarlama sitesinin (ana sayfa) içerik katmanı.
 * Tüm bölümler `site_sections` tablosunda tutulur; süper admin panelinden yönetilir.
 * Veritabanı okunamazsa kod içindeki varsayılanlar gösterilir.
 */

export type SiteSectionItem = Record<string, string>;

export type SiteSection = {
  id?: string;
  section_key: string;
  kind: string;
  eyebrow: string | null;
  title: string | null;
  subtitle: string | null;
  primary_label: string | null;
  primary_href: string | null;
  secondary_label: string | null;
  secondary_href: string | null;
  badge: string | null;
  items: SiteSectionItem[];
  sort_order: number;
  is_enabled: boolean;
};

const ICONS = {
  BarChart3,
  Boxes,
  Calculator,
  CreditCard,
  Globe,
  Headphones,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Users,
  Zap,
} as const;

export const ICON_NAMES = Object.keys(ICONS) as (keyof typeof ICONS)[];

export function sectionIcon(name?: string) {
  return ICONS[(name ?? "") as keyof typeof ICONS] ?? Sparkles;
}

/** Panelde bölüm türlerine göre yeni kart şablonları. */
export const ITEM_TEMPLATES: Record<string, SiteSectionItem> = {
  nav: { label: "Yeni bağlantı", href: "#" },
  hero: { label: "Yeni avantaj", icon: "Zap" },
  showcase: { title: "Yeni ürün", price: "0 TL" },
  references: {
    brand: "Yeni referans",
    quote: "Müşteri yorumu",
    person: "Ad Soyad",
    role: "Kurucu",
    stat1: "+0%",
    stat1Label: "Yıllık ciro",
    stat2: "0",
    stat2Label: "Sipariş sayısı",
    stat3: "+0%",
    stat3Label: "Organik trafik",
  },
  cards: { title: "Yeni başlık", text: "Kısa açıklama", icon: "Sparkles" },
  integrations: { label: "YENİ KATEGORİ", count: "0+", icon: "ShoppingBag" },
  blog: { tag: "Etiket", title: "Yazı başlığı", text: "Kısa özet", read: "5 dk okuma" },
  faq: { q: "Yeni soru", a: "Cevap" },
  footer: { group: "Platform", label: "Yeni bağlantı", href: "#" },
};

export const SECTION_KINDS = [
  { value: "nav", label: "Üst menü" },
  { value: "megamenu", label: "Mega menü" },
  { value: "hero", label: "Kahraman alanı" },
  { value: "showcase", label: "Vitrin kartları" },
  { value: "references", label: "Referanslar" },
  { value: "cards", label: "Kart listesi" },
  { value: "integrations", label: "Entegrasyonlar" },
  { value: "demos", label: "Panel demoları" },
  { value: "pricing", label: "Fiyatlandırma" },
  { value: "blog", label: "Blog" },
  { value: "faq", label: "SSS" },
  { value: "cta", label: "Kapanış çağrısı" },
  { value: "footer", label: "Alt bilgi" },
];

const def = (section: Partial<SiteSection> & { section_key: string; kind: string; sort_order: number }): SiteSection => ({
  eyebrow: null,
  title: null,
  subtitle: null,
  primary_label: null,
  primary_href: null,
  secondary_label: null,
  secondary_href: null,
  badge: null,
  items: [],
  is_enabled: true,
  ...section,
});

/** Veritabanı okunamadığında kullanılacak varsayılan ana sayfa içeriği. */
export const DEFAULT_SECTIONS: SiteSection[] = [
  def({
    section_key: "header",
    kind: "nav",
    title: "mefticaret",
    primary_label: "Kayıt Ol",
    primary_href: "/auth",
    secondary_label: "Giriş Yap",
    secondary_href: "/auth",
    sort_order: 10,
    items: [
      { label: "E-Ticaret", href: "#moduller" },
      { label: "Entegrasyonlar", href: "#entegrasyonlar" },
      { label: "Fiyatlandırma", href: "#paketler" },
      { label: "Blog", href: "#blog" },
      { label: "SSS", href: "#sss" },
    ],
  }),
  def({
    section_key: "hero",
    kind: "hero",
    eyebrow: "E-Ticaret Altyapınız Hazır",
    title: "Mağazanızı Kurun, Hemen Satışa Başlayın.",
    subtitle:
      "Ürünlerinizi listeleyin, siparişlerinizi yönetin, müşterilerinize kesintisiz alışveriş sunun.",
    primary_label: "Ücretsiz Başlayın",
    primary_href: "/auth",
    secondary_label: "Bizi Arayın",
    secondary_href: "#referanslar",
    sort_order: 20,
    items: [
      { label: "Hızlı Kurulum", icon: "Zap" },
      { label: "7/24 Destek", icon: "Headphones" },
      { label: "Güvenli Altyapı", icon: "ShieldCheck" },
    ],
  }),
  def({
    section_key: "showcase",
    kind: "showcase",
    title: "Vitrin kartları",
    sort_order: 30,
    items: [
      { title: "Profesyonel Aynasız Kamera", price: "64.999 TL" },
      { title: "Minimal Takı Seti", price: "6.799 TL" },
      { title: "Espresso Kahve Makinesi", price: "24.999 TL" },
      { title: "Modern Masa Lambası", price: "3.499 TL" },
      { title: "Deri Cüzdan", price: "2.999 TL" },
      { title: "Lilyum Buketi", price: "1.899 TL" },
    ],
  }),
  def({
    section_key: "references",
    kind: "references",
    eyebrow: "Referanslar",
    title: "Sıradaki başarı hikayesi sizinki olabilir",
    primary_label: "Referansları gör",
    primary_href: "/auth",
    sort_order: 40,
    items: [],
  }),
  def({
    section_key: "modules",
    kind: "cards",
    eyebrow: "Güçlü Araçlar, Kolay Yönetim",
    title: "İşinizi Büyütecek Her Şey Tek Platformda",
    subtitle: "E-ticaret operasyonunuzun her adımını kolaylaştıran araçlar hazır.",
    sort_order: 50,
    items: [
      { title: "Çoklu mağaza", text: "Tek hesap, sınırsız mağaza.", icon: "Store" },
      { title: "Tenant izolasyonu", text: "Veri erişimi veritabanı seviyesinde ayrılır.", icon: "ShieldCheck" },
      { title: "Rol bazlı ekip", text: "Sahip, yönetici, personel rolleri.", icon: "Users" },
      { title: "Domain yönetimi", text: "Alt alan adı, özel domain ve SSL.", icon: "Globe" },
    ],
  }),
  def({
    section_key: "integrations",
    kind: "integrations",
    eyebrow: "Entegrasyonlar",
    title: "Tüm Entegrasyonlar, Tek Merkez",
    subtitle: "Pazaryerinden kargoya kadar tüm araçlarınız tek panelde buluşsun.",
    badge: "50+",
    sort_order: 60,
    items: [
      { label: "PAZARYERLERİ", count: "12+", icon: "ShoppingBag" },
      { label: "KARGO", count: "9+", icon: "Truck" },
      { label: "ÖDEMELER", count: "8+", icon: "CreditCard" },
      { label: "DİJİTAL DÜNYA", count: "10+", icon: "BarChart3" },
      { label: "SMS PAZARLAMA", count: "6+", icon: "MessageSquare" },
      { label: "MUHASEBE", count: "5+", icon: "Calculator" },
    ],
  }),
  def({
    section_key: "demos",
    kind: "demos",
    eyebrow: "Panelde Neler Var?",
    title: "Deneyin: Panel Böyle Çalışıyor",
    subtitle: "Tema bloklarını sıralayın, araçları bağlayın, SEO skorunuzu izleyin.",
    sort_order: 70,
  }),
  def({
    section_key: "pricing",
    kind: "pricing",
    eyebrow: "Fiyatlandırma",
    title: "Büyüdükçe ölçeklenen paketler",
    subtitle: "Limitler kodda sabit değil; yönetici panelinden anlık güncellenir.",
    primary_label: "Başla",
    primary_href: "/auth",
    sort_order: 80,
  }),
  def({
    section_key: "blog",
    kind: "blog",
    eyebrow: "Blog",
    title: "E-Ticaret Dünyasından İlham Alın",
    subtitle: "E-ticaret rehberleri, sektör trendleri ve uzman ipuçları.",
    sort_order: 90,
    items: [],
  }),
  def({
    section_key: "faq",
    kind: "faq",
    eyebrow: "Sorular & Cevaplar",
    title: "Sıkça Sorulan Sorular",
    subtitle: "Mefticaret hakkında merak ettiğiniz her şey burada.",
    primary_label: "Ücretsiz Başlayın",
    primary_href: "/auth",
    sort_order: 100,
    items: [],
  }),
  def({
    section_key: "cta",
    kind: "cta",
    title: "Bugün kurun, bugün satmaya başlayın.",
    subtitle: "Kredi kartı gerekmez. Mağazanızı dakikalar içinde yayına alın.",
    primary_label: "Ücretsiz Başlayın",
    primary_href: "/auth",
    secondary_label: "Paketleri gör",
    secondary_href: "#paketler",
    sort_order: 110,
  }),
  def({
    section_key: "footer",
    kind: "footer",
    title: "mefticaret",
    subtitle: "Türkiye'nin çok kiracılı e-ticaret işletim sistemi.",
    primary_label: "Ücretsiz Başlayın",
    primary_href: "/auth",
    secondary_label: "Giriş Yap",
    secondary_href: "/auth",
    badge: "KVKK & GDPR uyumlu mimari",
    sort_order: 120,
    items: [],
  }),
];

function normalize(row: Record<string, unknown>): SiteSection {
  const items = Array.isArray(row["items"]) ? (row["items"] as SiteSectionItem[]) : [];
  return {
    id: row["id"] as string,
    section_key: row["section_key"] as string,
    kind: row["kind"] as string,
    eyebrow: (row["eyebrow"] as string | null) ?? null,
    title: (row["title"] as string | null) ?? null,
    subtitle: (row["subtitle"] as string | null) ?? null,
    primary_label: (row["primary_label"] as string | null) ?? null,
    primary_href: (row["primary_href"] as string | null) ?? null,
    secondary_label: (row["secondary_label"] as string | null) ?? null,
    secondary_href: (row["secondary_href"] as string | null) ?? null,
    badge: (row["badge"] as string | null) ?? null,
    items,
    sort_order: Number(row["sort_order"] ?? 0),
    is_enabled: row["is_enabled"] !== false,
  };
}

/** Ana sayfada kullanılan public okuma (yalnızca açık bölümler). */
export const siteSectionsQuery = () =>
  queryOptions({
    queryKey: ["site-sections"],
    staleTime: 60_000,
    queryFn: async (): Promise<SiteSection[]> => {
      const { data, error } = await supabase
        .from("site_sections" as never)
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      if (rows.length === 0) return DEFAULT_SECTIONS;
      return rows.map(normalize);
    },
  });

/** Bölüm anahtarına göre içerik getirir; yoksa varsayılana düşer. */
export function pickSection(sections: SiteSection[] | undefined, key: string): SiteSection | null {
  const found = sections?.find((section) => section.section_key === key);
  if (found) return found.is_enabled ? found : null;
  const fallback = DEFAULT_SECTIONS.find((section) => section.section_key === key);
  return sections && sections.length > 0 ? null : (fallback ?? null);
}
