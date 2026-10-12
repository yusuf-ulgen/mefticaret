/**
 * Blog düzenleyicisi için özel bloklar: bilgi kutusu, ürün/koleksiyon kartı
 * ve otomatik içindekiler. HTML çıktısı sunucu temizleyicisiyle uyumludur.
 */

import { mergeAttributes, Node } from "@tiptap/core";

export type CalloutTone = "info" | "warning" | "success";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blogCallout: { setCallout: (tone: CalloutTone) => ReturnType };
    blogEmbed: { insertEmbedCard: (attrs: EmbedAttrs) => ReturnType };
    blogToc: { insertToc: () => ReturnType };
  }
}

export const Callout = Node.create({
  name: "blogCallout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      tone: {
        default: "info",
        parseHTML: (el) => el.getAttribute("data-callout") ?? "info",
        renderHTML: (attrs) => ({ "data-callout": attrs["tone"] }),
      },
    };
  },
  parseHTML: () => [{ tag: "div[data-callout]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { class: "blog-callout" }), 0],
  addCommands() {
    return {
      setCallout:
        (tone) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { tone }),
    };
  },
});

export type EmbedAttrs = {
  kind: "product" | "collection";
  id: string;
  title: string;
  price: number | null;
  image: string | null;
  url: string;
  variant: "card" | "row" | "minimal";
};

const tl = (value: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(value);

export const EmbedCard = Node.create({
  name: "blogEmbed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    const data = (key: string, fallback: unknown = null) => ({
      default: fallback,
      parseHTML: (el: HTMLElement) => {
        const v = el.getAttribute(`data-${key}`);
        if (key === "price") return v ? Number(v) : null;
        return v ?? fallback;
      },
      renderHTML: () => ({}),
    });
    return {
      kind: data("kind", "product"),
      id: data("id", ""),
      title: data("title", ""),
      price: data("price"),
      image: data("image"),
      url: data("url", "#"),
      variant: data("variant", "card"),
    };
  },
  parseHTML: () => [{ tag: "div[data-embed-card]" }],
  renderHTML: ({ node }) => {
    const a = node.attrs as EmbedAttrs;
    const children: unknown[] = [];
    if (a.image && a.variant !== "minimal") children.push(["img", { src: a.image, alt: a.title }]);
    const text: unknown[] = ["span", { class: "blog-embed__body" }, ["strong", {}, a.title]];
    if (a.price !== null && a.price !== undefined) text.push(["span", { class: "blog-embed__price" }, tl(Number(a.price))]);
    text.push(["span", { class: "blog-embed__cta" }, a.kind === "product" ? "Ürünü incele · Sepete ekle" : "Koleksiyonu gör"]);
    children.push(text);
    return [
      "div",
      {
        "data-embed-card": "",
        "data-kind": a.kind,
        "data-id": a.id,
        "data-title": a.title,
        "data-price": a.price === null ? "" : String(a.price),
        "data-image": a.image ?? "",
        "data-url": a.url,
        "data-variant": a.variant,
        class: `blog-embed blog-embed--${a.variant}`,
      },
      ["a", { href: a.url }, ...children],
    ] as never;
  },
  addCommands() {
    return {
      insertEmbedCard:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

export const TocBlock = Node.create({
  name: "blogToc",
  group: "block",
  atom: true,
  parseHTML: () => [{ tag: "div[data-toc]" }],
  renderHTML: () => ["div", { "data-toc": "", class: "blog-toc" }, "İçindekiler"],
  addCommands() {
    return {
      insertToc:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});
