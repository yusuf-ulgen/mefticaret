import { describe, expect, it } from "vitest";

import { parseAdaptiveXml } from "@/lib/adaptive-xml-parser";
import { parseTextFeed, parseWorkbook, suggestMapping } from "@/lib/supplier-import";
import * as XLSX from "@e965/xlsx";

describe("adaptive supplier feed parser", () => {
  it("detects a namespaced repeating product node and preserves nested media and variants", () => {
    const xml = `<?xml version="1.0"?>
      <ns:ArrayOfProduct xmlns:ns="urn:test"><ns:Product><StokKodu>RT-1</StokKodu><UrunAdi>Sütyen</UrunAdi><AlisFiyati>125,50</AlisFiyati><Stok>8</Stok><Resimler><Resim>https://cdn.test/ürün 1.jpg</Resim><Resim>//cdn.test/two.webp</Resim></Resimler><Varyantlar><Varyant><Beden>M</Beden><Stok>3</Stok></Varyant><Varyant><Beden>L</Beden><Stok>5</Stok></Varyant></Varyantlar></ns:Product><ns:Product><StokKodu>RT-2</StokKodu><UrunAdi>Atlet</UrunAdi><AlisFiyati>90</AlisFiyati><Stok>2</Stok></ns:Product></ns:ArrayOfProduct>`;
    const parsed = parseTextFeed(xml, "xml");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.selectedRoot).toContain("Product");
    expect(parsed.columns).toContain("Resimler.Resim");
    expect(parsed.columns).toContain("Varyantlar.Varyant");
    expect(parsed.columns).toContain("__detected_media");
    expect(suggestMapping(parsed.columns).sku).toBe("StokKodu");
    expect(suggestMapping(parsed.columns).images).toBe("Resimler.Resim");
  });

  it("uses a manually selected root candidate", () => {
    const parsed = parseAdaptiveXml("<root><items><item><sku>A</sku></item><item><sku>B</sku></item></items></root>", "root.items.item");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.selectedRoot).toBe("root.items.item");
  });

  it("rejects unsafe XML entities with a readable error", () => {
    expect(() => parseAdaptiveXml('<!DOCTYPE x [<!ENTITY y SYSTEM "file:///etc/passwd">]><x>&y;</x>')).toThrow("DTD");
  });

  it("rejects malformed XML instead of returning a partial tree", () => {
    expect(() => parseAdaptiveXml("<products><product><sku>A</product></products>")).toThrow("XML çözümlenemedi");
  });

  it("auto-detects TSV columns with PapaParse", () => {
    const parsed = parseTextFeed("StokKodu\tUrunAdi\tFiyat\nA-1\tÜrün\t125,50", "csv");
    expect(parsed.rows[0]?.["StokKodu"]).toBe("A-1");
    expect(parsed.columns).toContain("UrunAdi");
  });

  it("reads an Excel workbook", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ SKU: "X-1", Urun_Adi: "Test", Stok: 4 }]), "Urunler");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const parsed = parseWorkbook(bytes);
    expect(parsed.rows[0]?.["SKU"]).toBe("X-1");
    expect(parsed.columns).toContain("Urun_Adi");
  });
});