import type { SectionProduct, SectionCollection } from "@/components/storefront-sections";

/**
 * Tema mağazası önizlemesi için demo içerik.
 * Mağazanın gerçek verisi yetersizse (yeni mağaza, görselsiz ürün) önizlemenin
 * boş görünmemesi için kullanılır. Gerçek vitrinde asla gösterilmez.
 */

export const DEMO_IMAGES = {
  heroTech: "/themes/wokiee/hero-tech.jpg",
  heroFashion: "/themes/wokiee/hero-fashion.jpg",
  heroHome: "/themes/wokiee/hero-home.jpg",
  headphones: "/themes/wokiee/p-headphones.jpg",
  sneaker: "/themes/wokiee/p-sneaker.jpg",
  watch: "/themes/wokiee/p-watch.jpg",
  sweater: "/themes/wokiee/p-sweater.jpg",
  lamp: "/themes/wokiee/p-lamp.jpg",
  bag: "/themes/wokiee/p-bag.jpg",
  coffee: "/themes/wokiee/p-coffee.jpg",
  earbuds: "/themes/wokiee/p-earbuds.jpg",
  sunglasses: "/themes/wokiee/p-sunglasses.jpg",
} as const;

/** Görselsiz gerçek ürünler için sırayla kullanılacak yedek kapak görselleri. */
export const DEMO_COVER_FALLBACKS: string[] = [
  DEMO_IMAGES.headphones,
  DEMO_IMAGES.sneaker,
  DEMO_IMAGES.watch,
  DEMO_IMAGES.sweater,
  DEMO_IMAGES.lamp,
  DEMO_IMAGES.bag,
  DEMO_IMAGES.coffee,
  DEMO_IMAGES.earbuds,
  DEMO_IMAGES.sunglasses,
];

type DemoSeed = {
  title: string;
  slug: string;
  description: string;
  price: number;
  compareAt?: number;
  type: string;
  tags: string[];
  cover: string;
};

const SEEDS: DemoSeed[] = [
  {
    title: "Aurora ANC Kablosuz Kulaklık",
    slug: "aurora-anc-kablosuz-kulaklik",
    description: "Aktif gürültü engelleme, 40 saat pil ömrü ve hızlı şarj.",
    price: 3490,
    compareAt: 4290,
    type: "Elektronik",
    tags: ["yeni", "çok satan", "teknoloji"],
    cover: DEMO_IMAGES.headphones,
  },
  {
    title: "Nova Pro Akıllı Saat",
    slug: "nova-pro-akilli-saat",
    description: "AMOLED ekran, nabız ve uyku takibi, 7 gün pil.",
    price: 2790,
    compareAt: 3290,
    type: "Elektronik",
    tags: ["indirim", "teknoloji"],
    cover: DEMO_IMAGES.watch,
  },
  {
    title: "Breeze TWS Bluetooth Kulaklık",
    slug: "breeze-tws-bluetooth-kulaklik",
    description: "Kompakt şarj kutusu, çift mikrofon, IPX5 suya dayanıklılık.",
    price: 1190,
    compareAt: 1590,
    type: "Elektronik",
    tags: ["yeni", "indirim"],
    cover: DEMO_IMAGES.earbuds,
  },
  {
    title: "Studio Minimal Deri Sneaker",
    slug: "studio-minimal-deri-sneaker",
    description: "Hakiki deri, ortopedik taban, günlük kullanım için hafif form.",
    price: 2190,
    type: "Ayakkabı",
    tags: ["çok satan", "moda"],
    cover: DEMO_IMAGES.sneaker,
  },
  {
    title: "Soft Oversize Triko Kazak",
    slug: "soft-oversize-triko-kazak",
    description: "Yumuşak örgü dokusu, salaş kesim, dört mevsim kullanım.",
    price: 899,
    compareAt: 1249,
    type: "Giyim",
    tags: ["indirim", "moda", "yeni"],
    cover: DEMO_IMAGES.sweater,
  },
  {
    title: "Milano Deri Çapraz Çanta",
    slug: "milano-deri-capraz-canta",
    description: "Ayarlanabilir askı, altın tokalar, günlük kullanıma uygun boy.",
    price: 1590,
    type: "Aksesuar",
    tags: ["moda", "çok satan"],
    cover: DEMO_IMAGES.bag,
  },
  {
    title: "Retro Round Güneş Gözlüğü",
    slug: "retro-round-gunes-gozlugu",
    description: "UV400 koruma, metal detaylı çerçeve, kılıf hediyeli.",
    price: 649,
    compareAt: 899,
    type: "Aksesuar",
    tags: ["indirim", "yeni"],
    cover: DEMO_IMAGES.sunglasses,
  },
  {
    title: "Rattan Dekoratif Masa Lambası",
    slug: "rattan-dekoratif-masa-lambasi",
    description: "El işi hasır abajur, sıcak ışık, ahşap tabanlı gövde.",
    price: 1290,
    type: "Ev & Yaşam",
    tags: ["ev", "yeni"],
    cover: DEMO_IMAGES.lamp,
  },
  {
    title: "Barista Çelik French Press",
    slug: "barista-celik-french-press",
    description: "Paslanmaz çelik gövde, 800 ml hacim, ısı yalıtımlı tasarım.",
    price: 749,
    compareAt: 999,
    type: "Ev & Yaşam",
    tags: ["indirim", "ev", "çok satan"],
    cover: DEMO_IMAGES.coffee,
  },
];

export const DEMO_PRODUCTS: SectionProduct[] = SEEDS.map((seed, index) => ({
  id: `demo-${index + 1}`,
  title: seed.title,
  slug: seed.slug,
  description: seed.description,
  base_price: seed.price,
  compare_at_price: seed.compareAt ?? null,
  currency: "TRY",
  product_type: seed.type,
  tags: seed.tags,
  coverUrl: seed.cover,
}));

export const DEMO_COLLECTIONS: SectionCollection[] = [
  { id: "demo-c1", title: "Elektronik", slug: "elektronik", description: "Kulaklık, saat ve aksesuar" },
  { id: "demo-c2", title: "Moda", slug: "moda", description: "Yeni sezon parçalar" },
  { id: "demo-c3", title: "Ayakkabı", slug: "ayakkabi", description: "Sneaker ve bot modelleri" },
  { id: "demo-c4", title: "Aksesuar", slug: "aksesuar", description: "Çanta, gözlük, takı" },
  { id: "demo-c5", title: "Ev & Yaşam", slug: "ev-yasam", description: "Dekorasyon ve mutfak" },
  { id: "demo-c6", title: "Kampanyalar", slug: "kampanyalar", description: "İndirimdeki ürünler" },
];

/** Önizleme için gerçek ürünlere görsel atar, sayı azsa demo ürünlerle tamamlar. */
export function withDemoProducts(products: SectionProduct[], minimum = 8): SectionProduct[] {
  const enriched = products.map((product, index) => ({
    ...product,
    coverUrl:
      product.coverUrl ?? DEMO_COVER_FALLBACKS[index % DEMO_COVER_FALLBACKS.length] ?? null,
  }));
  if (enriched.length >= minimum) return enriched;
  const fillers = DEMO_PRODUCTS.filter(
    (demo) => !enriched.some((product) => product.slug === demo.slug),
  ).slice(0, minimum - enriched.length);
  return [...enriched, ...fillers];
}

/** Önizleme için koleksiyonları demo koleksiyonlarla tamamlar. */
export function withDemoCollections(collections: SectionCollection[], minimum = 4): SectionCollection[] {
  if (collections.length >= minimum) return collections;
  const fillers = DEMO_COLLECTIONS.filter(
    (demo) => !collections.some((collection) => collection.slug === demo.slug),
  ).slice(0, minimum - collections.length);
  return [...collections, ...fillers];
}
