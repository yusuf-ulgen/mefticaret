/**
 * E-posta pazarlama motoru — saf fonksiyonlar (sunucu ve arayüz aynı sözlüğü kullanır).
 * Blok şeması, HTML üretimi, birleştirme etiketleri, 1.000+ şablon kütüphanesi,
 * otomasyon akış şablonları, hedef kitle filtreleri, A/B dağıtımı ve metrikler.
 */

/* ------------------------------------------------------------------ bloklar */

export const BLOCK_KINDS = [
  "header",
  "text",
  "button",
  "image",
  "product_carousel",
  "cart_items",
  "coupon",
  "countdown",
  "social",
  "divider",
  "footer",
] as const;

export type BlockKind = (typeof BLOCK_KINDS)[number];

export const BLOCK_LABELS: Record<BlockKind, string> = {
  header: "Başlık / Logo",
  text: "Metin",
  button: "Buton",
  image: "Görsel banner",
  product_carousel: "Ürün karuseli",
  cart_items: "Sepet ürünleri",
  coupon: "İndirim kutusu",
  countdown: "Geri sayım",
  social: "Sosyal ikonlar",
  divider: "Ayırıcı",
  footer: "Alt bilgi",
};

export type EmailBlock = {
  id: string;
  kind: BlockKind;
  /** Başlık, metin, buton yazısı. */
  text?: string;
  /** İkincil metin (alt başlık, açıklama). */
  subtext?: string;
  /** Buton / görsel bağlantısı. */
  href?: string;
  /** Görsel adresi. */
  imageUrl?: string;
  /** Hizalama. */
  align?: "left" | "center" | "right";
  /** İndirim kodu bloğu için kod ve oran. */
  code?: string;
  /** Geri sayım bitişi (ISO). */
  deadline?: string;
};

export type EmailDesign = {
  name: string;
  subject: string;
  previewText: string;
  accentColor: string;
  blocks: EmailBlock[];
};

export function blockId(prefix = "b") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Yeni blok için makul varsayılanlar. */
export function defaultBlock(kind: BlockKind): EmailBlock {
  const base: EmailBlock = { id: blockId(kind), kind, align: "center" };
  switch (kind) {
    case "header":
      return { ...base, text: "{{magaza_adi}}", subtext: "Yeni sezon burada" };
    case "text":
      return {
        ...base,
        align: "left",
        text: "Merhaba {{musteri_adi}}, senin için seçtiklerimize göz at.",
      };
    case "button":
      return { ...base, text: "Alışverişe başla", href: "{{magaza_linki}}" };
    case "image":
      return { ...base, imageUrl: "", href: "{{magaza_linki}}", text: "Kampanya görseli" };
    case "product_carousel":
      return { ...base, text: "Sana önerdiklerimiz", subtext: "{{product.recommended_carousel}}" };
    case "cart_items":
      return { ...base, text: "Sepetinde bekleyenler", subtext: "{{cart.items_grid}}" };
    case "coupon":
      return { ...base, text: "Sana özel %10 indirim", code: "{{discount.code}}" };
    case "countdown":
      return { ...base, text: "Kampanya bitiyor", deadline: "" };
    case "social":
      return { ...base, text: "Bizi takip et", href: "{{magaza_linki}}" };
    case "divider":
      return { ...base };
    case "footer":
      return {
        ...base,
        text: "{{magaza_adi}} · Bu e-postayı izniniz olduğu için aldınız.",
        subtext: "Aboneliği bırak",
        href: "{{unsubscribe_url}}",
      };
    default:
      return base;
  }
}

/* --------------------------------------------------- birleştirme etiketleri */

export const MERGE_TAGS = [
  { tag: "{{customer.first_name}}", label: "Müşteri adı" },
  { tag: "{{customer.email}}", label: "Müşteri e-postası" },
  { tag: "{{musteri_adi}}", label: "Müşteri adı (TR)" },
  { tag: "{{magaza_adi}}", label: "Mağaza adı" },
  { tag: "{{magaza_linki}}", label: "Mağaza bağlantısı" },
  { tag: "{{cart.items_grid}}", label: "Sepet ürün kartları" },
  { tag: "{{cart.total}}", label: "Sepet tutarı" },
  { tag: "{{discount.code}}", label: "İndirim kodu" },
  { tag: "{{product.recommended_carousel}}", label: "Önerilen ürünler" },
  { tag: "{{product.last_viewed}}", label: "Son incelenen ürün" },
  { tag: "{{order.number}}", label: "Sipariş numarası" },
  { tag: "{{order.tracking}}", label: "Kargo takip kodu" },
  { tag: "{{unsubscribe_url}}", label: "Abonelikten çık bağlantısı" },
] as const;

/** {{etiket}} yer tutucularını verilen değerlerle doldurur; bilinmeyen etiket boşa çıkar. */
export function mergeTags(input: string, vars: Record<string, string | number | null | undefined>) {
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const value = vars[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

/* ----------------------------------------------------------- HTML üretimi */

export type ProductCard = { title: string; price: string; imageUrl?: string | null; url: string };

export type RenderContext = {
  vars: Record<string, string | number | null | undefined>;
  products?: ProductCard[];
  cartItems?: ProductCard[];
  accentColor?: string;
  /** Tıklama takibi için bağlantı sarmalayıcı. */
  wrapLink?: (url: string) => string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cardsHtml(cards: ProductCard[], accent: string, wrap: (url: string) => string) {
  if (cards.length === 0) return "";
  const cells = cards
    .slice(0, 6)
    .map(
      (card) => `
      <td width="50%" style="padding:8px;vertical-align:top;font-family:Arial,Helvetica,sans-serif">
        <a href="${escapeHtml(wrap(card.url))}" style="text-decoration:none;color:#111111">
          ${
            card.imageUrl
              ? `<img src="${escapeHtml(card.imageUrl)}" width="240" alt="${escapeHtml(card.title)}" style="width:100%;max-width:240px;border-radius:12px;display:block" />`
              : ""
          }
          <div style="margin-top:8px;font-size:14px;font-weight:600">${escapeHtml(card.title)}</div>
          <div style="margin-top:4px;font-size:14px;color:${escapeHtml(accent)}">${escapeHtml(card.price)}</div>
        </a>
      </td>`,
    )
    .join("");
  const rows: string[] = [];
  const cellList = cells.match(/<td[\s\S]*?<\/td>/g) ?? [];
  for (let index = 0; index < cellList.length; index += 2) {
    rows.push(`<tr>${cellList[index]}${cellList[index + 1] ?? '<td width="50%"></td>'}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>`;
}

/** Tek bloğu e-posta istemcilerinde çalışan tablo tabanlı HTML'e çevirir. */
export function renderBlock(block: EmailBlock, context: RenderContext): string {
  const accent = context.accentColor ?? "#111111";
  const wrap = context.wrapLink ?? ((url: string) => url);
  const text = mergeTags(block.text ?? "", context.vars);
  const subtext = mergeTags(block.subtext ?? "", context.vars);
  const href = mergeTags(block.href ?? "", context.vars);
  const align = block.align ?? "center";
  const font = "font-family:Arial,Helvetica,sans-serif";

  switch (block.kind) {
    case "header":
      return `<tr><td style="padding:24px 24px 8px;text-align:${align};${font}">
        <div style="font-size:22px;font-weight:700;color:#111111">${escapeHtml(text)}</div>
        ${subtext ? `<div style="margin-top:6px;font-size:14px;color:#666666">${escapeHtml(subtext)}</div>` : ""}
      </td></tr>`;
    case "text":
      return `<tr><td style="padding:12px 24px;text-align:${align};${font};font-size:15px;line-height:1.6;color:#333333">${escapeHtml(text).replace(/\n/g, "<br />")}</td></tr>`;
    case "button":
      return `<tr><td style="padding:16px 24px;text-align:${align}">
        <a href="${escapeHtml(wrap(href || "#"))}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${escapeHtml(accent)};color:#ffffff;${font};font-size:15px;font-weight:600;text-decoration:none">${escapeHtml(text)}</a>
      </td></tr>`;
    case "image":
      return `<tr><td style="padding:12px 24px;text-align:center">
        ${
          block.imageUrl
            ? `<a href="${escapeHtml(wrap(href || "#"))}"><img src="${escapeHtml(block.imageUrl)}" alt="${escapeHtml(text)}" width="552" style="width:100%;max-width:552px;border-radius:16px;display:block" /></a>`
            : `<div style="padding:40px;border:1px dashed #cccccc;border-radius:16px;${font};color:#999999">${escapeHtml(text || "Görsel")}</div>`
        }
      </td></tr>`;
    case "product_carousel":
      return `<tr><td style="padding:12px 16px">
        ${text ? `<div style="padding:0 8px 8px;${font};font-size:16px;font-weight:700;color:#111111">${escapeHtml(text)}</div>` : ""}
        ${cardsHtml(context.products ?? [], accent, wrap)}
      </td></tr>`;
    case "cart_items":
      return `<tr><td style="padding:12px 16px">
        ${text ? `<div style="padding:0 8px 8px;${font};font-size:16px;font-weight:700;color:#111111">${escapeHtml(text)}</div>` : ""}
        ${cardsHtml(context.cartItems ?? [], accent, wrap)}
      </td></tr>`;
    case "coupon": {
      const code = mergeTags(block.code ?? "", context.vars);
      return `<tr><td style="padding:16px 24px;text-align:center">
        <div style="border:2px dashed ${escapeHtml(accent)};border-radius:16px;padding:20px;${font}">
          <div style="font-size:16px;font-weight:700;color:#111111">${escapeHtml(text)}</div>
          ${code ? `<div style="margin-top:10px;font-size:24px;letter-spacing:3px;font-weight:700;color:${escapeHtml(accent)}">${escapeHtml(code)}</div>` : ""}
        </div>
      </td></tr>`;
    }
    case "countdown": {
      const label = block.deadline
        ? new Date(block.deadline).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })
        : "";
      return `<tr><td style="padding:12px 24px;text-align:center;${font}">
        <div style="font-size:15px;font-weight:600;color:#111111">${escapeHtml(text)}</div>
        ${label ? `<div style="margin-top:4px;font-size:14px;color:${escapeHtml(accent)}">${escapeHtml(label)}</div>` : ""}
      </td></tr>`;
    }
    case "social":
      return `<tr><td style="padding:16px 24px;text-align:center;${font};font-size:14px;color:#666666">
        ${escapeHtml(text)} · <a href="${escapeHtml(wrap(href || "#"))}" style="color:${escapeHtml(accent)};text-decoration:none">Instagram</a> ·
        <a href="${escapeHtml(wrap(href || "#"))}" style="color:${escapeHtml(accent)};text-decoration:none">Facebook</a> ·
        <a href="${escapeHtml(wrap(href || "#"))}" style="color:${escapeHtml(accent)};text-decoration:none">TikTok</a>
      </td></tr>`;
    case "divider":
      return `<tr><td style="padding:8px 24px"><div style="height:1px;background:#eeeeee"></div></td></tr>`;
    case "footer":
      return `<tr><td style="padding:20px 24px 28px;text-align:center;${font};font-size:12px;color:#999999">
        <div>${escapeHtml(text)}</div>
        ${subtext ? `<div style="margin-top:8px"><a href="${escapeHtml(href || "#")}" style="color:#999999">${escapeHtml(subtext)}</a></div>` : ""}
      </td></tr>`;
    default:
      return "";
  }
}

/** Tüm blokları tek bir responsive e-posta HTML'ine dönüştürür. */
export function renderEmailHtml(
  design: Pick<EmailDesign, "blocks" | "accentColor" | "previewText">,
  context: RenderContext,
  extras?: { trackingPixelUrl?: string },
) {
  const body = design.blocks
    .map((block) => renderBlock(block, { ...context, accentColor: design.accentColor }))
    .join("");
  const preheader = mergeTags(design.previewText ?? "", context.vars);
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f5f5f5">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden">
      ${body}
    </table>
  </td></tr>
</table>
${extras?.trackingPixelUrl ? `<img src="${escapeHtml(extras.trackingPixelUrl)}" width="1" height="1" alt="" style="display:block" />` : ""}
</body></html>`;
}

/** E-postanın düz metin karşılığı (spam puanı ve erişilebilirlik için). */
export function renderEmailText(design: Pick<EmailDesign, "blocks">, vars: RenderContext["vars"]) {
  return design.blocks
    .map((block) => {
      const parts = [block.text, block.subtext, block.code, block.href]
        .filter(Boolean)
        .map((value) => mergeTags(String(value), vars));
      return parts.join(" ");
    })
    .filter((line) => line.trim().length > 0)
    .join("\n\n");
}

/* --------------------------------------------------- şablon kütüphanesi */

export type TemplateSector = { id: string; label: string; accent: string };
export type TemplateCampaign = { id: string; label: string; headline: string; cta: string };

export const TEMPLATE_SECTORS: TemplateSector[] = [
  { id: "moda", label: "Moda & Giyim", accent: "#111111" },
  { id: "kozmetik", label: "Kozmetik & Bakım", accent: "#c2185b" },
  { id: "elektronik", label: "Elektronik & Teknoloji", accent: "#1565c0" },
  { id: "ev", label: "Ev & Yaşam", accent: "#6d4c41" },
  { id: "taki", label: "Takı & Aksesuar", accent: "#b8860b" },
  { id: "spor", label: "Spor & Outdoor", accent: "#2e7d32" },
  { id: "bebek", label: "Anne & Bebek", accent: "#7e57c2" },
  { id: "gida", label: "Gıda & Yöresel", accent: "#ef6c00" },
  { id: "kitap", label: "Kitap & Hobi", accent: "#00695c" },
  { id: "b2b", label: "B2B Toptan", accent: "#37474f" },
];

export const TEMPLATE_CAMPAIGNS: TemplateCampaign[] = [
  { id: "black-friday", label: "Black Friday", headline: "Black Friday başladı", cta: "Fırsatları gör" },
  { id: "cyber-monday", label: "Cyber Monday", headline: "Cyber Monday'e özel", cta: "Hemen incele" },
  { id: "yilbasi", label: "Yılbaşı & Yeni Yıl", headline: "Yeni yıla hazır mısın?", cta: "Hediyelere bak" },
  { id: "sevgililer", label: "Sevgililer Günü", headline: "Sevgililer Günü seçkisi", cta: "Hediyeni seç" },
  { id: "anneler", label: "Anneler Günü", headline: "Anneler Günü için", cta: "Hediyeleri gör" },
  { id: "babalar", label: "Babalar Günü", headline: "Babalar Günü seçkisi", cta: "Hediyeleri gör" },
  { id: "okula-donus", label: "Okula Dönüş", headline: "Okula dönüş hazırlığı", cta: "Listeyi incele" },
  { id: "yaz-indirimi", label: "Yaz İndirimi", headline: "Yaz indirimi sürüyor", cta: "İndirimleri gör" },
  { id: "kis-indirimi", label: "Kış İndirimi", headline: "Kış indirimi başladı", cta: "İndirimleri gör" },
  { id: "flash-sale", label: "Flash Sale", headline: "24 saatlik flaş indirim", cta: "Kaçırmadan al" },
  { id: "dogum-gunu", label: "Doğum Günü", headline: "Doğum günün kutlu olsun", cta: "Hediyeni kullan" },
  { id: "yeni-koleksiyon", label: "Yeni Koleksiyon", headline: "Yeni koleksiyon yayında", cta: "Koleksiyonu gör" },
];

export const TEMPLATE_LAYOUTS = [
  { id: "hero-urun", label: "Hero + ürün ızgarası" },
  { id: "kupon-odakli", label: "Kupon odaklı" },
  { id: "tek-urun", label: "Tek ürün vitrini" },
  { id: "hikaye", label: "Marka hikâyesi" },
  { id: "geri-sayim", label: "Geri sayımlı" },
  { id: "sepet-hatirlatma", label: "Sepet hatırlatma" },
  { id: "minimal", label: "Minimal metin" },
  { id: "sosyal-kanit", label: "Sosyal kanıt" },
  { id: "cok-bolumlu", label: "Çok bölümlü dergi" },
] as const;

export type LibraryTemplate = {
  id: string;
  name: string;
  sector: string;
  sectorLabel: string;
  campaign: string;
  campaignLabel: string;
  layout: string;
  layoutLabel: string;
  accent: string;
  subject: string;
  previewText: string;
  blocks: EmailBlock[];
};

function layoutBlocks(
  layout: (typeof TEMPLATE_LAYOUTS)[number]["id"],
  sector: TemplateSector,
  campaign: TemplateCampaign,
): EmailBlock[] {
  const id = (suffix: string) => `${layout}-${suffix}`;
  const header: EmailBlock = {
    id: id("header"),
    kind: "header",
    text: "{{magaza_adi}}",
    subtext: campaign.headline,
    align: "center",
  };
  const cta: EmailBlock = {
    id: id("cta"),
    kind: "button",
    text: campaign.cta,
    href: "{{magaza_linki}}",
    align: "center",
  };
  const footer: EmailBlock = {
    id: id("footer"),
    kind: "footer",
    text: "{{magaza_adi}} · {{magaza_linki}}",
    subtext: "Aboneliği bırak",
    href: "{{unsubscribe_url}}",
    align: "center",
  };
  const intro: EmailBlock = {
    id: id("intro"),
    kind: "text",
    align: "left",
    text: `Merhaba {{musteri_adi}}, ${sector.label.toLowerCase()} seçkimizde ${campaign.label.toLowerCase()} fırsatları seni bekliyor.`,
  };
  const carousel: EmailBlock = {
    id: id("carousel"),
    kind: "product_carousel",
    text: "Senin için seçtiklerimiz",
    subtext: "{{product.recommended_carousel}}",
  };
  const coupon: EmailBlock = {
    id: id("coupon"),
    kind: "coupon",
    text: `${campaign.label} indirimi`,
    code: "{{discount.code}}",
  };

  switch (layout) {
    case "hero-urun":
      return [header, { id: id("img"), kind: "image", text: campaign.headline, href: "{{magaza_linki}}" }, intro, carousel, cta, footer];
    case "kupon-odakli":
      return [header, coupon, intro, cta, carousel, footer];
    case "tek-urun":
      return [
        header,
        { id: id("img"), kind: "image", text: campaign.headline, href: "{{magaza_linki}}" },
        { id: id("txt"), kind: "text", align: "center", text: "{{product.last_viewed}} yeniden stokta." },
        cta,
        footer,
      ];
    case "hikaye":
      return [
        header,
        { id: id("story"), kind: "text", align: "left", text: `${sector.label} dünyasında hikâyemiz: küçük atölyeden binlerce mutlu müşteriye.` },
        { id: id("divider"), kind: "divider" },
        carousel,
        cta,
        footer,
      ];
    case "geri-sayim":
      return [header, { id: id("count"), kind: "countdown", text: "Kampanya bitiyor" }, coupon, cta, carousel, footer];
    case "sepet-hatirlatma":
      return [
        header,
        { id: id("cart"), kind: "cart_items", text: "Sepetinde bekleyenler", subtext: "{{cart.items_grid}}" },
        { id: id("warn"), kind: "text", align: "center", text: "Stoklar tükeniyor, sepetin 24 saat daha saklanacak." },
        coupon,
        cta,
        footer,
      ];
    case "minimal":
      return [header, intro, cta, footer];
    case "sosyal-kanit":
      return [
        header,
        { id: id("quote"), kind: "text", align: "center", text: `"${sector.label} alışverişimi artık sadece buradan yapıyorum." — 5 yıldız` },
        carousel,
        cta,
        { id: id("social"), kind: "social", text: "Bizi takip et", href: "{{magaza_linki}}" },
        footer,
      ];
    case "cok-bolumlu":
      return [
        header,
        intro,
        carousel,
        { id: id("divider"), kind: "divider" },
        coupon,
        { id: id("second"), kind: "text", align: "left", text: "Ayrıca bu hafta ücretsiz kargo fırsatı devam ediyor." },
        cta,
        { id: id("social"), kind: "social", text: "Bizi takip et", href: "{{magaza_linki}}" },
        footer,
      ];
    default:
      return [header, intro, cta, footer];
  }
}

/** 10 sektör × 12 kampanya × 9 düzen = 1.080 hazır şablon. */
export function buildTemplateLibrary(): LibraryTemplate[] {
  const templates: LibraryTemplate[] = [];
  for (const sector of TEMPLATE_SECTORS) {
    for (const campaign of TEMPLATE_CAMPAIGNS) {
      for (const layout of TEMPLATE_LAYOUTS) {
        templates.push({
          id: `${sector.id}--${campaign.id}--${layout.id}`,
          name: `${sector.label} · ${campaign.label} · ${layout.label}`,
          sector: sector.id,
          sectorLabel: sector.label,
          campaign: campaign.id,
          campaignLabel: campaign.label,
          layout: layout.id,
          layoutLabel: layout.label,
          accent: sector.accent,
          subject: `${campaign.headline} — ${sector.label}`,
          previewText: `${campaign.label} fırsatları {{magaza_adi}} mağazasında.`,
          blocks: layoutBlocks(layout.id, sector, campaign),
        });
      }
    }
  }
  return templates;
}

export const TEMPLATE_LIBRARY_SIZE = TEMPLATE_SECTORS.length * TEMPLATE_CAMPAIGNS.length * TEMPLATE_LAYOUTS.length;

/** Kütüphanede arama + sektör/kampanya filtresi. */
export function filterTemplates(
  templates: LibraryTemplate[],
  filters: { search?: string; sector?: string; campaign?: string; layout?: string },
) {
  const search = (filters.search ?? "").trim().toLocaleLowerCase("tr");
  return templates.filter((template) => {
    if (filters.sector && filters.sector !== "all" && template.sector !== filters.sector) return false;
    if (filters.campaign && filters.campaign !== "all" && template.campaign !== filters.campaign) return false;
    if (filters.layout && filters.layout !== "all" && template.layout !== filters.layout) return false;
    if (!search) return true;
    return template.name.toLocaleLowerCase("tr").includes(search) ||
      template.subject.toLocaleLowerCase("tr").includes(search);
  });
}

/* ---------------------------------------------------- otomasyon akışları */

export type FlowStepPreset = {
  kind: "wait" | "email" | "condition" | "end";
  title: string;
  waitMinutes?: number;
  subject?: string;
  body?: string;
  condition?: "order_placed" | "order_paid" | "cart_still_active" | "ltv_above" | "order_count_above" | "spent_above" | "category_interest" | "email_opened" | "has_tag";
  onTrue?: "continue" | "end";
  onFalse?: "continue" | "end";
  config?: Record<string, string | number>;
};

export type FlowPreset = {
  id: string;
  name: string;
  description: string;
  trigger:
    | "cart_abandoned"
    | "browse_abandoned"
    | "customer_created"
    | "newsletter_subscribed"
    | "customer_inactive"
    | "ltv_threshold"
    | "order_delivered";
  steps: FlowStepPreset[];
};

export const FLOW_PRESETS: FlowPreset[] = [
  {
    id: "cart-abandonment",
    name: "Terk edilen sepet",
    description: "1. saatte hatırlatma, 24. saatte %10 indirim kuponu.",
    trigger: "cart_abandoned",
    steps: [
      { kind: "wait", title: "1 saat bekle", waitMinutes: 60 },
      {
        kind: "email",
        title: "Sepet hatırlatma",
        subject: "{{musteri_adi}}, sepetin seni bekliyor",
        body: "Sepetindeki ürünler hâlâ seni bekliyor. Alışverişi tamamla: {{sepet_linki}}",
      },
      { kind: "condition", title: "Sepet hâlâ dolu mu?", condition: "cart_still_active", onTrue: "continue", onFalse: "end" },
      { kind: "wait", title: "23 saat bekle", waitMinutes: 1380 },
      {
        kind: "email",
        title: "%10 indirim kuponu",
        subject: "Sana özel %10 indirim kodu",
        body: "Sepetini tamamlaman için %10 indirim: {{indirim_kodu}} — {{sepet_linki}}",
      },
      { kind: "end", title: "Bitir" },
    ],
  },
  {
    id: "browse-abandonment",
    name: "Göz atma terk etme",
    description: "Ürünü 2+ kez inceleyip sepete eklemeyen ziyaretçiye 3. saatte e-posta.",
    trigger: "browse_abandoned",
    steps: [
      { kind: "wait", title: "3 saat bekle", waitMinutes: 180 },
      {
        kind: "email",
        title: "İncelediğin ürün",
        subject: "İncelediğin ürün tükenmek üzere",
        body: "{{product.last_viewed}} ürününe göz attın. Stoklar tükeniyor: {{magaza_linki}}",
      },
      { kind: "end", title: "Bitir" },
    ],
  },
  {
    id: "welcome-series",
    name: "Hoş geldin serisi",
    description: "Kayıt anında hoş geldin indirimi, 3 gün sonra en çok satanlar.",
    trigger: "customer_created",
    steps: [
      {
        kind: "email",
        title: "Hoş geldin indirimi",
        subject: "Hoş geldin {{musteri_adi}} — ilk siparişine indirim",
        body: "Ailemize katıldığın için ilk siparişinde geçerli kodun: {{indirim_kodu}}",
      },
      { kind: "wait", title: "3 gün bekle", waitMinutes: 4320 },
      {
        kind: "email",
        title: "En çok satanlar",
        subject: "En çok satanlarımız ve hikâyemiz",
        body: "Müşterilerimizin en çok sevdiği ürünler: {{magaza_linki}}",
      },
      { kind: "end", title: "Bitir" },
    ],
  },
  {
    id: "win-back",
    name: "Yeniden etkileşim (Win-Back)",
    description: "60 gündür sipariş vermeyen müşteriye 60. ve 75. günde teklif.",
    trigger: "customer_inactive",
    steps: [
      {
        kind: "email",
        title: "Seni özledik",
        subject: "Seni özledik {{musteri_adi}}",
        body: "Sana özel indirim çekin hazır: {{indirim_kodu}} — {{magaza_linki}}",
      },
      { kind: "condition", title: "Sipariş verdi mi?", condition: "order_placed", onTrue: "end", onFalse: "continue" },
      { kind: "wait", title: "15 gün bekle", waitMinutes: 21600 },
      {
        kind: "email",
        title: "Son hatırlatma",
        subject: "İndirim çekin bugün bitiyor",
        body: "Çekini kullanmak için son gün: {{indirim_kodu}}",
      },
      { kind: "end", title: "Bitir" },
    ],
  },
  {
    id: "vip-reward",
    name: "VIP müşteri ödüllendirme",
    description: "Harcama eşiğini aşan müşteriye teslimden 1 gün sonra VIP kodu.",
    trigger: "ltv_threshold",
    steps: [
      { kind: "wait", title: "1 gün bekle", waitMinutes: 1440 },
      { kind: "condition", title: "Harcama eşiği aşıldı mı?", condition: "spent_above", onTrue: "continue", onFalse: "end", config: { amount: 5000 } },
      {
        kind: "email",
        title: "VIP teşekkür",
        subject: "VIP kulübüne hoş geldin {{musteri_adi}}",
        body: "Sana özel VIP kodun: {{indirim_kodu}} — yeni koleksiyona erken erişim: {{magaza_linki}}",
      },
      { kind: "end", title: "Bitir" },
    ],
  },
  {
    id: "post-purchase-cross-sell",
    name: "Satış sonrası çapraz satış",
    description: "Teslimden 3 gün sonra birlikte alınan ürünleri önerir.",
    trigger: "order_delivered",
    steps: [
      { kind: "wait", title: "3 gün bekle", waitMinutes: 4320 },
      {
        kind: "email",
        title: "Bunları da sevebilirsin",
        subject: "Siparişinle güzel giden ürünler",
        body: "{{siparis_no}} numaralı siparişinle uyumlu öneriler: {{magaza_linki}}",
      },
      { kind: "end", title: "Bitir" },
    ],
  },
];

/* ---------------------------------------------------------- hedef kitle */

export type AudienceFilters = {
  /** Yaşam boyu değer (toplam harcama) alt sınırı. */
  ltvMin?: number | undefined;
  /** Minimum sipariş sayısı. */
  ordersMin?: number | undefined;
  /** Son X gün içinde sipariş vermiş olma (0 = filtre yok). */
  activeWithinDays?: number | undefined;
  /** X günden uzun süre sipariş vermemiş olma. */
  inactiveOverDays?: number | undefined;
  /** Müşteri etiketi. */
  tag?: string | undefined;
  /** İlgi duyduğu kategori (satın aldığı ürün kategorisi). */
  categoryInterest?: string | undefined;
  /** E-bülten abonelerini de dahil et. */
  includeSubscribers?: boolean | undefined;
};

export type AudienceCustomer = {
  id: string;
  email: string | null;
  fullName: string | null;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  tags: string[];
  categories: string[];
  marketingOptIn: boolean;
};

/** Filtreleri uygulayıp gönderilecek müşteri listesini döndürür. */
export function filterAudience(
  customers: AudienceCustomer[],
  filters: AudienceFilters,
  now = new Date(),
): AudienceCustomer[] {
  const day = 86_400_000;
  return customers.filter((customer) => {
    if (!customer.email) return false;
    if (!customer.marketingOptIn) return false;
    if (filters.ltvMin && customer.totalSpent < filters.ltvMin) return false;
    if (filters.ordersMin && customer.ordersCount < filters.ordersMin) return false;
    if (filters.tag) {
      const tag = filters.tag.toLocaleLowerCase("tr");
      if (!customer.tags.some((value) => value.toLocaleLowerCase("tr") === tag)) return false;
    }
    if (filters.categoryInterest) {
      const category = filters.categoryInterest.toLocaleLowerCase("tr");
      if (!customer.categories.some((value) => value.toLocaleLowerCase("tr").includes(category))) return false;
    }
    if (filters.activeWithinDays && filters.activeWithinDays > 0) {
      if (!customer.lastOrderAt) return false;
      if (now.getTime() - new Date(customer.lastOrderAt).getTime() > filters.activeWithinDays * day) return false;
    }
    if (filters.inactiveOverDays && filters.inactiveOverDays > 0) {
      const reference = customer.lastOrderAt ? new Date(customer.lastOrderAt).getTime() : 0;
      if (reference === 0) return false;
      if (now.getTime() - reference < filters.inactiveOverDays * day) return false;
    }
    return true;
  });
}

/* ---------------------------------------------------------------- A/B testi */

export type Variant = { id: string; label: string; weight: number };

function hash(value: string) {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    total = (total * 31 + value.charCodeAt(index)) % 1_000_003;
  }
  return total;
}

/** Aynı alıcı her zaman aynı varyantı alır (deterministik ağırlıklı dağıtım). */
export function pickVariant<T extends Variant>(variants: T[], key: string): T | null {
  const usable = variants.filter((variant) => variant.weight > 0);
  if (usable.length === 0) return variants[0] ?? null;
  const total = usable.reduce((sum, variant) => sum + variant.weight, 0);
  let bucket = hash(key) % total;
  for (const variant of usable) {
    if (bucket < variant.weight) return variant;
    bucket -= variant.weight;
  }
  return usable[usable.length - 1] ?? null;
}

/* ---------------------------------------------------------------- metrikler */

export type SendRow = {
  status: string;
  openedAt: string | null;
  clickedAt: string | null;
  unsubscribedAt: string | null;
  revenue: number;
};

export type CampaignMetrics = {
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  unsubscribes: number;
  revenue: number;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
  unsubscribeRate: number;
  revenuePerRecipient: number;
};

const ratio = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 1000) / 10 : 0);

/** Gönderim kayıtlarından açılma, tıklama, ciro ve iptal oranlarını hesaplar. */
export function campaignMetrics(sends: SendRow[]): CampaignMetrics {
  const delivered = sends.filter((send) => send.status === "sent").length;
  const opens = sends.filter((send) => Boolean(send.openedAt)).length;
  const clicks = sends.filter((send) => Boolean(send.clickedAt)).length;
  const unsubscribes = sends.filter((send) => Boolean(send.unsubscribedAt)).length;
  const revenue = sends.reduce((sum, send) => sum + (Number(send.revenue) || 0), 0);
  return {
    sent: sends.length,
    delivered,
    opens,
    clicks,
    unsubscribes,
    revenue: Math.round(revenue * 100) / 100,
    openRate: ratio(opens, delivered),
    clickRate: ratio(clicks, delivered),
    clickToOpenRate: ratio(clicks, opens),
    unsubscribeRate: ratio(unsubscribes, delivered),
    revenuePerRecipient: delivered > 0 ? Math.round((revenue / delivered) * 100) / 100 : 0,
  };
}

/** İki varyant arasında kazananı belirler (dönüşüm önce ciro, sonra tıklama). */
export function abWinner(
  variants: { id: string; label: string; sent: number; opens: number; clicks: number; revenue: number }[],
) {
  const scored = variants
    .filter((variant) => variant.sent > 0)
    .map((variant) => ({
      ...variant,
      revenuePer: variant.revenue / variant.sent,
      clickRate: variant.clicks / variant.sent,
      openRate: variant.opens / variant.sent,
    }));
  if (scored.length < 2) return null;
  const sorted = [...scored].sort(
    (a, b) => b.revenuePer - a.revenuePer || b.clickRate - a.clickRate || b.openRate - a.openRate,
  );
  const [winner, runnerUp] = sorted;
  if (!winner || !runnerUp) return null;
  const lift =
    runnerUp.revenuePer > 0
      ? Math.round(((winner.revenuePer - runnerUp.revenuePer) / runnerUp.revenuePer) * 1000) / 10
      : runnerUp.clickRate > 0
        ? Math.round(((winner.clickRate - runnerUp.clickRate) / runnerUp.clickRate) * 1000) / 10
        : 0;
  return { winner, runnerUp, lift };
}
