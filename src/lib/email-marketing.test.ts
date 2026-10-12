import { describe, expect, it } from "vitest";
import {
  buildTemplateLibrary,
  filterAudience,
  filterTemplates,
  type AudienceCustomer,
  type LibraryTemplate,
} from "./email-marketing";

describe("legacy marketing records", () => {
  it("searches valid records even if a legacy record has no name or subject", () => {
    const templates = buildTemplateLibrary();
    const incomplete = {
      ...templates[0],
      name: undefined,
      subject: undefined,
    } as unknown as LibraryTemplate;
    expect(
      filterTemplates([incomplete, ...templates], { search: templates[0]!.name }),
    ).toHaveLength(1);
  });
  it("does not crash or select malformed audience tags", () => {
    const customer = {
      email: "test@example.test",
      marketingOptIn: true,
      tags: [undefined],
      categories: undefined,
    } as unknown as AudienceCustomer;
    expect(filterAudience([customer], { tag: "VIP" })).toEqual([]);
    expect(filterAudience([customer], { categoryInterest: "Giyim" })).toEqual([]);
    expect(filterAudience([{ ...customer, marketingOptIn: false }], {})).toEqual([]);
  });
});
