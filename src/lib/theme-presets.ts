/**
 * Tema hazır şablonları ve tipografi seçenekleri (izomorfik, DB-agnostik).
 */

export type ThemePreset = {
  code: string;
  name: string;
  description: string;
  primary: string;
  accent: string;
  background: string;
  fontPair: string;
  radius: number;
  layout: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    code: "ink-saffron",
    name: "Mürekkep & Safran",
    description: "Yüksek kontrast, premium editorial görünüm.",
    primary: "#1f2933",
    accent: "#e0a136",
    background: "#fbf9f5",
    fontPair: "sora-manrope",
    radius: 0.75,
    layout: "hero-grid",
  },
  {
    code: "midnight-neon",
    name: "Gece & Neon",
    description: "Koyu zemin, teknoloji ve elektronik için.",
    primary: "#0b1120",
    accent: "#38e0b0",
    background: "#0f172a",
    fontPair: "space-grotesk-dm-sans",
    radius: 1,
    layout: "split-screen",
  },
  {
    code: "rose-atelier",
    name: "Rose Atelier",
    description: "Zarif, kozmetik ve takı mağazaları için.",
    primary: "#3a2430",
    accent: "#d97e8f",
    background: "#fdf6f4",
    fontPair: "cormorant-karla",
    radius: 1.25,
    layout: "magazine",
  },
  {
    code: "market-fresh",
    name: "Market Fresh",
    description: "Canlı, gıda ve hızlı tüketim için.",
    primary: "#173d2b",
    accent: "#f0662d",
    background: "#f7fbf6",
    fontPair: "outfit-figtree",
    radius: 0.5,
    layout: "card-grid",
  },
];

export const FONT_PAIRS = [
  { value: "sora-manrope", label: "Sora + Manrope" },
  { value: "space-grotesk-dm-sans", label: "Space Grotesk + DM Sans" },
  { value: "cormorant-karla", label: "Cormorant + Karla" },
  { value: "outfit-figtree", label: "Outfit + Figtree" },
  { value: "archivo-hind", label: "Archivo + Hind" },
  { value: "tenor-sans-jost", label: "Tenor Sans + Jost" },
] as const;

export const THEME_LAYOUTS = [
  { value: "hero-grid", label: "Hero + ürün ızgarası" },
  { value: "split-screen", label: "Bölünmüş ekran" },
  { value: "magazine", label: "Dergi düzeni" },
  { value: "card-grid", label: "Kart ızgarası" },
] as const;

export const FONT_STACKS: Record<string, { heading: string; body: string }> = {
  "sora-manrope": { heading: "Sora, system-ui, sans-serif", body: "Manrope, system-ui, sans-serif" },
  "space-grotesk-dm-sans": {
    heading: "'Space Grotesk', system-ui, sans-serif",
    body: "'DM Sans', system-ui, sans-serif",
  },
  "cormorant-karla": {
    heading: "'Cormorant Garamond', Georgia, serif",
    body: "Karla, system-ui, sans-serif",
  },
  "outfit-figtree": { heading: "Outfit, system-ui, sans-serif", body: "Figtree, system-ui, sans-serif" },
  "archivo-hind": { heading: "Archivo, system-ui, sans-serif", body: "Hind, system-ui, sans-serif" },
  "tenor-sans-jost": {
    heading: "'Tenor Sans', 'Times New Roman', serif",
    body: "Jost, system-ui, sans-serif",
  },
};

export const fontStack = (pair: string) =>
  FONT_STACKS[pair] ?? { heading: "Sora, system-ui, sans-serif", body: "Manrope, system-ui, sans-serif" };
