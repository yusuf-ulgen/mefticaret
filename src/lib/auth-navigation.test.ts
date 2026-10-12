import { expect, it } from "vitest";
import { authText, safeAuthNext, withLocale } from "./auth-i18n";
import { documentLocale } from "./document-locale";
import { samePolicyVersions } from "./checkout-policies";
it.each(["en", "de", "fr", "ar"] as const)("%s giriş ve rota dili korunur", (locale) => {
  expect(authText(locale, "Şifre")).not.toBe("Şifre");
  expect(documentLocale(`/${locale}/ev-hanimlari`)).toBe(locale);
  expect(documentLocale("/auth", `?locale=${locale}`)).toBe(locale);
  expect(withLocale("/auth?mode=register&next=%2Fonboarding", locale)).toContain(
    `locale=${locale}`,
  );
});
it("dönüş parametresi harici adres açamaz", () => {
  for (const next of ["//evil.test", "/\\evil.test", "https://evil.test"])
    expect(safeAuthNext(next)).toBe("/stores");
  expect(safeAuthNext("/store/own/kolay")).toBe("/store/own/kolay");
});
it("belge sürümü değişikliği ve mükerrer onay reddedilir", () => {
  expect(samePolicyVersions(["a", "b", "c"], ["c", "b", "a"])).toBe(true);
  expect(samePolicyVersions(["a", "b", "c"], ["a", "b", "new"])).toBe(false);
  expect(samePolicyVersions(["a", "b", "c"], ["a", "a", "b"])).toBe(false);
});
