import { expect, it } from "vitest";
import { landingHref, translateLanding } from "./landing-i18n";

it("G07: legacy footer spelling uses the correct Turkish key in every locale", () => {
  expect(translateLanding("tr", "Hakımızda")).toBe("Hakkımızda");
  expect(translateLanding("en", "Hakımızda")).toBe("About Us");
  expect(translateLanding("de", "Hakımızda")).toBe("Über uns");
  expect(translateLanding("fr", "Hakımızda")).toBe("À propos");
  expect(translateLanding("ar", "Hakımızda")).toBe("من نحن");
});

it.each(["tr", "en", "de", "fr", "ar"] as const)(
  "%s preserves telephone destinations",
  (locale) => {
    expect(landingHref("tel:+905455294390", locale)).toBe("tel:+905455294390");
  },
);

it.each(["tr", "en", "de", "fr", "ar"] as const)(
  "%s preserves registration intent and selected plan",
  (locale) => {
    const href = landingHref("/auth?mode=register&plan=professional&interval=yearly", locale);
    const query = new URL(href, "https://example.test").searchParams;
    expect(query.get("mode")).toBe("register");
    expect(query.get("plan")).toBe("professional");
    expect(query.get("interval")).toBe("yearly");
    expect(query.get("locale")).toBe(locale);
  },
);
