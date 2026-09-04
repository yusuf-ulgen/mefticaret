/**
 * Tema tasarım sistemi (design tokens).
 *
 * Renk, tipografi, boşluk, buton/kart ve hareket ayarlarını tek bir şemada
 * toplar. Değerler `store_themes.design_tokens` JSONB alanında saklanır ve
 * vitrinde CSS değişkenleri + satır içi stiller olarak uygulanır.
 *
 * Her ölçek değeri cihaz kırılımlıdır: masaüstü / tablet / mobil.
 */

export type DeviceKey = "desktop" | "tablet" | "mobile";

export const DEVICE_KEYS: DeviceKey[] = ["desktop", "tablet", "mobile"];

export const DEVICE_LABELS: Record<DeviceKey, string> = {
  desktop: "Masaüstü",
  tablet: "Tablet",
  mobile: "Mobil",
};

/** Cihaz başına sayısal değer. */
export type Responsive = { desktop: number; tablet: number; mobile: number };

export type DesignTokens = {
  colors: {
    secondary: string;
    surface: string;
    text: string;
    muted: string;
    border: string;
    success: string;
    danger: string;
    sale: string;
  };
  typography: {
    headingSize: Responsive;
    bodySize: Responsive;
    headingWeight: number;
    bodyWeight: number;
    lineHeight: number;
    letterSpacing: number;
    uppercaseHeadings: boolean;
  };
  spacing: {
    section: Responsive;
    gridGap: Responsive;
    containerPadding: Responsive;
  };
  buttons: {
    paddingY: number;
    paddingX: number;
    weight: number;
    uppercase: boolean;
    hover: "none" | "lift" | "fade" | "scale";
  };
  cards: {
    shadow: number;
    hover: "none" | "lift" | "zoom" | "border";
    imageRatio: "1x1" | "4x5" | "3x4" | "16x9";
  };
  motion: {
    effect: "none" | "fade" | "slide" | "zoom";
    duration: number;
    respectReducedMotion: boolean;
  };
};

export const DEFAULT_DESIGN_TOKENS: DesignTokens = {
  colors: {
    secondary: "#64748b",
    surface: "#ffffff",
    text: "#1f2933",
    muted: "#6b7280",
    border: "#e5e7eb",
    success: "#16a34a",
    danger: "#dc2626",
    sale: "#e11d48",
  },
  typography: {
    headingSize: { desktop: 34, tablet: 28, mobile: 24 },
    bodySize: { desktop: 16, tablet: 15, mobile: 15 },
    headingWeight: 700,
    bodyWeight: 400,
    lineHeight: 1.6,
    letterSpacing: 0,
    uppercaseHeadings: false,
  },
  spacing: {
    section: { desktop: 48, tablet: 36, mobile: 28 },
    gridGap: { desktop: 18, tablet: 16, mobile: 12 },
    containerPadding: { desktop: 24, tablet: 20, mobile: 16 },
  },
  buttons: { paddingY: 12, paddingX: 22, weight: 600, uppercase: false, hover: "lift" },
  cards: { shadow: 1, hover: "lift", imageRatio: "1x1" },
  motion: { effect: "fade", duration: 420, respectReducedMotion: true },
};

/** Hazır tasarım sistemi setleri. */
export const DESIGN_PRESETS: { code: string; name: string; description: string; tokens: DesignTokens }[] = [
  {
    code: "minimal",
    name: "Minimal",
    description: "Ferah boşluklar, ince çizgiler, sakin hareket.",
    tokens: DEFAULT_DESIGN_TOKENS,
  },
  {
    code: "bold",
    name: "Cesur",
    description: "Kalın başlıklar, büyük kapsül butonlar, belirgin gölgeler.",
    tokens: {
      ...DEFAULT_DESIGN_TOKENS,
      typography: {
        ...DEFAULT_DESIGN_TOKENS.typography,
        headingSize: { desktop: 42, tablet: 34, mobile: 28 },
        headingWeight: 800,
        uppercaseHeadings: true,
        letterSpacing: 0.4,
      },
      buttons: { paddingY: 15, paddingX: 30, weight: 700, uppercase: true, hover: "scale" },
      cards: { shadow: 3, hover: "zoom", imageRatio: "4x5" },
      motion: { effect: "slide", duration: 520, respectReducedMotion: true },
    },
  },
  {
    code: "editorial",
    name: "Editoryal",
    description: "Dergi hissi, geniş satır aralığı, çerçeveli kartlar.",
    tokens: {
      ...DEFAULT_DESIGN_TOKENS,
      colors: { ...DEFAULT_DESIGN_TOKENS.colors, border: "#111827", muted: "#4b5563" },
      typography: {
        ...DEFAULT_DESIGN_TOKENS.typography,
        headingSize: { desktop: 38, tablet: 30, mobile: 26 },
        lineHeight: 1.8,
      },
      spacing: {
        section: { desktop: 72, tablet: 52, mobile: 36 },
        gridGap: { desktop: 26, tablet: 20, mobile: 14 },
        containerPadding: { desktop: 32, tablet: 24, mobile: 18 },
      },
      cards: { shadow: 0, hover: "border", imageRatio: "3x4" },
      motion: { effect: "fade", duration: 360, respectReducedMotion: true },
    },
  },
  {
    code: "compact",
    name: "Kompakt",
    description: "Yoğun ızgara, küçük boşluklar; çok ürünlü mağazalar için.",
    tokens: {
      ...DEFAULT_DESIGN_TOKENS,
      typography: {
        ...DEFAULT_DESIGN_TOKENS.typography,
        headingSize: { desktop: 28, tablet: 24, mobile: 21 },
        bodySize: { desktop: 15, tablet: 14, mobile: 14 },
        lineHeight: 1.45,
      },
      spacing: {
        section: { desktop: 32, tablet: 26, mobile: 20 },
        gridGap: { desktop: 12, tablet: 10, mobile: 8 },
        containerPadding: { desktop: 18, tablet: 16, mobile: 12 },
      },
      buttons: { paddingY: 10, paddingX: 18, weight: 600, uppercase: false, hover: "fade" },
      cards: { shadow: 1, hover: "lift", imageRatio: "1x1" },
      motion: { effect: "none", duration: 240, respectReducedMotion: true },
    },
  },
];

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
};

const hex = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : fallback;

const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

function responsive(raw: unknown, fallback: Responsive, min: number, max: number): Responsive {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    desktop: clamp(source.desktop, min, max, fallback.desktop),
    tablet: clamp(source.tablet, min, max, fallback.tablet),
    mobile: clamp(source.mobile, min, max, fallback.mobile),
  };
}

/** Ham JSON değerini güvenli, tam dolu token nesnesine çevirir. */
export function resolveDesignTokens(raw: unknown): DesignTokens {
  const d = DEFAULT_DESIGN_TOKENS;
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const colors = (source.colors ?? {}) as Record<string, unknown>;
  const typography = (source.typography ?? {}) as Record<string, unknown>;
  const spacing = (source.spacing ?? {}) as Record<string, unknown>;
  const buttons = (source.buttons ?? {}) as Record<string, unknown>;
  const cards = (source.cards ?? {}) as Record<string, unknown>;
  const motion = (source.motion ?? {}) as Record<string, unknown>;

  return {
    colors: {
      secondary: hex(colors.secondary, d.colors.secondary),
      surface: hex(colors.surface, d.colors.surface),
      text: hex(colors.text, d.colors.text),
      muted: hex(colors.muted, d.colors.muted),
      border: hex(colors.border, d.colors.border),
      success: hex(colors.success, d.colors.success),
      danger: hex(colors.danger, d.colors.danger),
      sale: hex(colors.sale, d.colors.sale),
    },
    typography: {
      headingSize: responsive(typography.headingSize, d.typography.headingSize, 14, 96),
      bodySize: responsive(typography.bodySize, d.typography.bodySize, 11, 26),
      headingWeight: clamp(typography.headingWeight, 300, 900, d.typography.headingWeight),
      bodyWeight: clamp(typography.bodyWeight, 300, 700, d.typography.bodyWeight),
      lineHeight: clamp(typography.lineHeight, 1, 2.4, d.typography.lineHeight),
      letterSpacing: clamp(typography.letterSpacing, -2, 4, d.typography.letterSpacing),
      uppercaseHeadings: Boolean(typography.uppercaseHeadings ?? d.typography.uppercaseHeadings),
    },
    spacing: {
      section: responsive(spacing.section, d.spacing.section, 0, 200),
      gridGap: responsive(spacing.gridGap, d.spacing.gridGap, 0, 64),
      containerPadding: responsive(spacing.containerPadding, d.spacing.containerPadding, 0, 80),
    },
    buttons: {
      paddingY: clamp(buttons.paddingY, 6, 28, d.buttons.paddingY),
      paddingX: clamp(buttons.paddingX, 8, 56, d.buttons.paddingX),
      weight: clamp(buttons.weight, 400, 900, d.buttons.weight),
      uppercase: Boolean(buttons.uppercase ?? d.buttons.uppercase),
      hover: pick(buttons.hover, ["none", "lift", "fade", "scale"] as const, d.buttons.hover),
    },
    cards: {
      shadow: clamp(cards.shadow, 0, 3, d.cards.shadow),
      hover: pick(cards.hover, ["none", "lift", "zoom", "border"] as const, d.cards.hover),
      imageRatio: pick(cards.imageRatio, ["1x1", "4x5", "3x4", "16x9"] as const, d.cards.imageRatio),
    },
    motion: {
      effect: pick(motion.effect, ["none", "fade", "slide", "zoom"] as const, d.motion.effect),
      duration: clamp(motion.duration, 0, 1200, d.motion.duration),
      respectReducedMotion: Boolean(motion.respectReducedMotion ?? d.motion.respectReducedMotion),
    },
  };
}

export const RATIO_VALUES: Record<DesignTokens["cards"]["imageRatio"], string> = {
  "1x1": "1 / 1",
  "4x5": "4 / 5",
  "3x4": "3 / 4",
  "16x9": "16 / 9",
};

const SHADOWS = [
  "none",
  "0 1px 2px rgba(15,23,42,.06)",
  "0 10px 24px -14px rgba(15,23,42,.28)",
  "0 22px 48px -24px rgba(15,23,42,.45)",
];

export const shadowValue = (level: number) => SHADOWS[Math.min(3, Math.max(0, Math.round(level)))] ?? "none";

/**
 * Tokenları vitrin köküne uygulanacak CSS'e çevirir.
 * `scope` genellikle `.sf-root` sınıfıdır; panel önizlemesi de aynı CSS'i kullanır.
 */
export function designCss(tokens: DesignTokens, scope = ".sf-root"): string {
  const t = tokens;
  const vars = (device: DeviceKey) => `
    --sf-heading-size: ${t.typography.headingSize[device]}px;
    --sf-body-size: ${t.typography.bodySize[device]}px;
    --sf-section-space: ${t.spacing.section[device]}px;
    --sf-grid-gap: ${t.spacing.gridGap[device]}px;
    --sf-container-padding: ${t.spacing.containerPadding[device]}px;
  `;

  return `
${scope} {
  ${vars("desktop")}
  --sf-color-secondary: ${t.colors.secondary};
  --sf-color-surface: ${t.colors.surface};
  --sf-color-text: ${t.colors.text};
  --sf-color-muted: ${t.colors.muted};
  --sf-color-border: ${t.colors.border};
  --sf-color-success: ${t.colors.success};
  --sf-color-danger: ${t.colors.danger};
  --sf-color-sale: ${t.colors.sale};
  --sf-card-shadow: ${shadowValue(t.cards.shadow)};
  --sf-image-ratio: ${RATIO_VALUES[t.cards.imageRatio]};
  --sf-motion-duration: ${t.motion.duration}ms;
  font-size: var(--sf-body-size);
  font-weight: ${t.typography.bodyWeight};
  line-height: ${t.typography.lineHeight};
  letter-spacing: ${t.typography.letterSpacing}px;
}
@media (max-width: 1024px) { ${scope} { ${vars("tablet")} } }
@media (max-width: 640px) { ${scope} { ${vars("mobile")} } }

${scope} h1, ${scope} h2, ${scope} h3 {
  font-weight: ${t.typography.headingWeight};
  line-height: 1.18;
  ${t.typography.uppercaseHeadings ? "text-transform: uppercase;" : ""}
}
${scope} h1 { font-size: calc(var(--sf-heading-size) * 1.22); }
${scope} h2 { font-size: var(--sf-heading-size); }
${scope} h3 { font-size: calc(var(--sf-heading-size) * 0.72); }

${scope} .sf-btn {
  padding: ${t.buttons.paddingY}px ${t.buttons.paddingX}px;
  font-weight: ${t.buttons.weight};
  ${t.buttons.uppercase ? "text-transform: uppercase; letter-spacing: .04em;" : ""}
  transition: transform var(--sf-motion-duration) ease, opacity var(--sf-motion-duration) ease;
}
${
  t.buttons.hover === "lift"
    ? `${scope} .sf-btn:hover { transform: translateY(-2px); }`
    : t.buttons.hover === "scale"
      ? `${scope} .sf-btn:hover { transform: scale(1.04); }`
      : t.buttons.hover === "fade"
        ? `${scope} .sf-btn:hover { opacity: .82; }`
        : ""
}

${scope} .sf-card {
  box-shadow: var(--sf-card-shadow);
  transition: transform var(--sf-motion-duration) ease, box-shadow var(--sf-motion-duration) ease,
    border-color var(--sf-motion-duration) ease;
}
${
  t.cards.hover === "lift"
    ? `${scope} .sf-card:hover { transform: translateY(-4px); }`
    : t.cards.hover === "zoom"
      ? `${scope} .sf-card:hover { transform: scale(1.02); }`
      : t.cards.hover === "border"
        ? `${scope} .sf-card:hover { border-color: var(--sf-color-text); }`
        : ""
}
${scope} .sf-grid { gap: var(--sf-grid-gap); }
${
  t.motion.effect === "none"
    ? ""
    : `@keyframes sfEnter {
  from { opacity: 0; transform: ${
    t.motion.effect === "slide" ? "translateY(18px)" : t.motion.effect === "zoom" ? "scale(.97)" : "none"
  }; }
  to { opacity: 1; transform: none; }
}
${scope} .sf-section { animation: sfEnter var(--sf-motion-duration) ease both; }`
}
${
  t.motion.respectReducedMotion
    ? `@media (prefers-reduced-motion: reduce) {
  ${scope} .sf-section, ${scope} .sf-card, ${scope} .sf-btn { animation: none !important; transition: none !important; transform: none !important; }
}`
    : ""
}
`.trim();
}
