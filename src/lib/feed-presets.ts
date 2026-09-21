/**
 * Universal XML/Excel Integrator v2.0 — hazır tedarikçi besleme şablonları.
 * Bacio İç Giyim, RealToptan ve ModaYakamoz beslemelerinin düğüm adları
 * doğrudan Mefticaret alanlarına eşlenir; kullanıcı Mapping Studio'da
 * şablonu seçtiğinde eşleştirme tek tıkla dolar.
 */

import type { FieldMapping } from "@/lib/supplier-import";

export type FeedPreset = {
  id: string;
  label: string;
  hint: string;
  itemPath: string;
  mapping: FieldMapping;
};

export const FEED_PRESETS: FeedPreset[] = [
  {
    id: "bacio",
    label: "Bacio İç Giyim",
    hint: "<Products><Product> · <variants><variant> yapısı",
    itemPath: "Product",
    mapping: {
      sku: "productCode",
      barcode: "barcode",
      title: "name",
      description: "description",
      short_description: "shortDescription",
      cost_price: "priceWithoutTax",
      retail_price: "listPrice",
      discount_price: "salePrice",
      tax_rate: "tax",
      currency: "currency",
      stock: "stockAmount",
      category: "category",
      category_path: "categoryPath",
      brand: "brand",
      images: "images.image",
      videos: "videoUrl",
      color: "color",
      size: "size",
      fabric: "fabric",
      variants: "variants.variant",
      variant_name: "size",
      variant_barcode: "barcode",
      variant_stock: "stock",
      variant_price: "price",
    },
  },
  {
    id: "realtoptan",
    label: "RealToptan",
    hint: "<Urunler><Urun> · Türkçe düğüm adları",
    itemPath: "Urun",
    mapping: {
      sku: "StokKodu",
      barcode: "Barkod",
      title: "UrunAdi",
      description: "Aciklama",
      cost_price: "AlisFiyati",
      retail_price: "SatisFiyati",
      discount_price: "IndirimliFiyat",
      tax_rate: "Kdv",
      currency: "ParaBirimi",
      stock: "Stok",
      category: "Kategori",
      category_path: "KategoriYolu",
      brand: "Marka",
      images: "Resimler.Resim",
      videos: "Video",
      color: "Renk",
      size: "Beden",
      fabric: "Kumas",
      hs_code: "GTIP",
      weight: "Desi",
      variants: "Varyantlar.Varyant",
      variant_name: "Beden",
      variant_barcode: "Barkod",
      variant_stock: "Stok",
      variant_price: "Fiyat",
    },
  },
  {
    id: "modayakamoz",
    label: "ModaYakamoz",
    hint: "<urunler><urun> · <secenekler><secenek> yapısı",
    itemPath: "urun",
    mapping: {
      sku: "urun_kodu",
      barcode: "barkod",
      title: "urun_adi",
      description: "detay",
      short_description: "kisa_detay",
      cost_price: "bayi_fiyat",
      retail_price: "psf",
      discount_price: "indirimli_fiyat",
      tax_rate: "kdv_orani",
      currency: "para_birimi",
      stock: "stok_adet",
      category: "kategori",
      category_path: "kategori_agaci",
      brand: "marka",
      images: "resimler.resim",
      videos: "video_link",
      color: "renk",
      size: "beden",
      fabric: "kumas_tipi",
      model_size: "manken_olculeri",
      weight: "agirlik",
      variants: "secenekler.secenek",
      variant_name: "beden",
      variant_barcode: "barkod",
      variant_stock: "adet",
      variant_price: "fiyat",
      variant_image: "resim",
    },
  },
];

/** Okunan sütun adlarına bakarak en olası şablonu tahmin eder. */
export function detectPreset(columns: string[]): FeedPreset | null {
  const normalized = new Set(columns.map((column) => column.toLowerCase()));
  let best: { preset: FeedPreset; score: number } | null = null;
  for (const preset of FEED_PRESETS) {
    const targets = Object.values(preset.mapping).filter(Boolean) as string[];
    const score = targets.filter((target) => normalized.has(target.toLowerCase())).length;
    if (score >= 3 && (!best || score > best.score)) best = { preset, score };
  }
  return best?.preset ?? null;
}
