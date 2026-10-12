/**
 * Tema Stüdyosu veri modeli.
 *
 * Editör, sunucudan gelen bölüm satırlarını yerel bir "taslak" (draft) olarak
 * tutar: sıralama + bölüm bazlı ayar/aktiflik. Kaydetme sırasında yalnızca
 * değişen bölümler sunucuya gönderilir; yetki ve tenant izolasyonu RLS ile
 * zorlanır.
 */

import type { ResolvedSection, SectionField, SectionSettings } from "@/lib/theme-sections";

export type StudioDraftItem = { settings: SectionSettings; isEnabled: boolean };

export type StudioDraft = {
  order: string[];
  items: Record<string, StudioDraftItem>;
};

export type StudioItem = {
  id: string;
  isEnabled: boolean;
  settings: SectionSettings;
  section: ResolvedSection;
};

export type StudioGroup = "header" | "body" | "footer";

export const GROUP_LABELS: Record<StudioGroup, string> = {
  header: "Üst alan",
  body: "Şablon gövdesi",
  footer: "Alt alan",
};

export const EMPTY_DRAFT: StudioDraft = { order: [], items: {} };

export function draftFromSections(sections: ResolvedSection[]): StudioDraft {
  return {
    order: sections.map((section) => section.id),
    items: Object.fromEntries(
      sections.map((section) => [
        section.id,
        { settings: { ...section.settings }, isEnabled: section.isEnabled } satisfies StudioDraftItem,
      ]),
    ),
  };
}

export function sameDraft(a: StudioDraft, b: StudioDraft) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function groupOf(section: ResolvedSection): StudioGroup {
  if (section.definition.slot !== "chrome") return "body";
  return section.type === "footer" ? "footer" : "header";
}

/** Sağ paneldeki sekme dağılımı: içerik / tasarım / yerleşim. */
export type InspectorTab = "content" | "design" | "layout";

export const INSPECTOR_TABS: { value: InspectorTab; label: string }[] = [
  { value: "content", label: "İçerik" },
  { value: "design", label: "Tasarım" },
  { value: "layout", label: "Yerleşim" },
];

const LAYOUT_HINTS = ["column", "align", "position", "width", "height", "padding", "gap", "limit", "size"];
const DESIGN_HINTS = ["color", "tone", "style", "font", "radius", "shadow", "overlay", "background"];

export function tabOfField(field: SectionField): InspectorTab {
  const key = field.key.toLowerCase();
  if (DESIGN_HINTS.some((hint) => key.includes(hint))) return "design";
  if (LAYOUT_HINTS.some((hint) => key.includes(hint))) return "layout";
  if (field.kind === "number") return "layout";
  return "content";
}

/** Cihaz görünürlüğü ile ilgili alanlar ayrı bir bölümde gösterilir. */
export const DEVICE_FIELD_KEYS = ["showOnDesktop", "showOnTablet", "showOnMobile", "columnsTablet", "columnsMobile"];
