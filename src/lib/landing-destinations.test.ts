import { expect, it } from "vitest";
import { landingHref } from "./landing-i18n";

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
