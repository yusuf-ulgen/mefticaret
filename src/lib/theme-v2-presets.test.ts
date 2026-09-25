import { describe, expect, it } from "vitest";

import { V2_SECTIONS, V2_SECTION_TYPES, globalSettings, presetToPages, v2CssVars, v2ToLegacyTheme } from "@/lib/theme-v2";

describe("5 hazır tema altyapısı", () => {
  it("her bölüm türünün tanımı var", () => {
    for (const type of V2_SECTION_TYPES) expect(V2_SECTIONS[type]).toBeDefined();
  });

  it("yeni bölümler preset yapısından editör düğümüne çevrilir", () => {
    let i = 0;
    const out = presetToPages({ pages: { home: [{ type: "flash_sale", settings: { title: "X" } }, { type: "bilinmeyen" }] } }, () => `id${i++}`);
    expect(out.pages["home"]).toHaveLength(1);
    expect(out.pages["home"]![0]!.settings["title"]).toBe("X");
  });

  it("vurgu rengi, geçiş ve harf aralığı CSS değişkeni olur", () => {
    const css = v2CssVars(globalSettings({ color_accent: "#E8C547", gradient_from: "#2563EB", gradient_to: "#7C3AED", letter_spacing: 5 }));
    expect(css).toContain("--color-accent:#E8C547");
    expect(css).toContain("linear-gradient(135deg,#2563EB,#7C3AED)");
    expect(css).toContain("--letter-spacing:0.05em");
  });

  it("v2 teması eski vitrin sayfalarına çevrilir", () => {
    const dark = v2ToLegacyTheme(globalSettings({ dark_mode: "on", dark_color_background: "#0A0A0A", color_primary: "#FF3B30", button_bg: "#FF3B30", font_heading: "Space Grotesk", font_body: "DM Sans" }));
    expect(dark.background_color).toBe("#0A0A0A");
    expect(dark.accent_color).toBe("#FF3B30");
    expect(dark.font_pair).toBe("v2:Space Grotesk|DM Sans");
    const light = v2ToLegacyTheme(globalSettings({ color_text: "#0F172A", color_primary: "#2563EB", button_radius: 999 }));
    expect(light.primary_color).toBe("#0F172A");
    expect(light.button_style).toBe("pill");
  });
});
