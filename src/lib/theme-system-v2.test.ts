import { describe, expect, it } from "vitest";

import { sanitizeThemeCss, summarizeChange, themeManifestSchema, THEME_FORMAT } from "@/lib/theme-system-v2";
import { globalSettings, shadeHex, v2CssVars, v2RootCss } from "@/lib/theme-v2";

describe("theme system v2", () => {
  it("üretilen CSS tüm değişkenleri ve koyu modu içerir", () => {
    const css = v2RootCss(globalSettings({ color_primary: "#3b82f6", dark_mode: "auto" }));
    expect(css).toContain("--color-primary:#3b82f6");
    expect(css).toContain("--color-primary-hover:");
    expect(css).toContain("--btn-transition:150ms ease");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain("prefers-color-scheme:dark");
  });
  it("geçersiz renkleri reddeder", () => {
    expect(v2CssVars(globalSettings({ color_primary: "red;}body{x" }))).toContain("--color-primary:#111111");
  });
  it("shadeHex koyulaştırır", () => {
    expect(shadeHex("#ffffff", 50)).toBe("#808080");
  });
  it("css temizleyici @import ve javascript: kaldırır", () => {
    expect(sanitizeThemeCss("@import url(x);a{b:url(javascript:1)}")).toBe("a{b:url(1)}");
  });
  it("zip manifest şemasını doğrular", () => {
    expect(themeManifestSchema.safeParse({ format: THEME_FORMAT, name: "A", snapshot: { settings: {}, pages: { home: [] } } }).success).toBe(true);
    expect(themeManifestSchema.safeParse({ format: "x", name: "A", snapshot: { settings: {}, pages: {} } }).success).toBe(false);
    expect(themeManifestSchema.safeParse({ format: THEME_FORMAT, name: "A", snapshot: { settings: {}, pages: { "../etc": [] } } }).success).toBe(false);
  });
  it("değişiklik özeti üretir", () => {
    const a = { settings: { color_primary: "#000" }, pages: { home: [] } };
    const b = { settings: { color_primary: "#fff" }, pages: { home: [] } };
    expect(summarizeChange(a, b)).toContain("Ana renk");
  });
});
