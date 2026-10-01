/**
 * Tedarikçi kataloğu: tüm mağazalar platformdaki aktif tedarikçilerin
 * ürünlerini görür ve kendi mağazasına eksiksiz aktarır. Yalnız sunucuda
 * (service role) çalışır; çağıran mağaza yetkisi functions katmanında doğrulanır.
 */
type Client = { from: (table: string) => any };

export type ParsedVariant = {
  sku: string | null;
  barcode: string | null;
  price: number | null;
  stock: number;
  taxRate: number | null;
  desi: number | null;
  options: Record<string, string>;
};

const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Düz XML anahtarlarından (UrunSecenek.Secenek[i].X) varyantları çıkarır. */
export function parseVariants(raw: Record<string, unknown> | null): ParsedVariant[] {
  if (!raw) return [];
  const groups = new Map<string, Record<string, unknown>>();
  for (const [key, value] of Object.entries(raw)) {
    const m = key.match(/^(.*?(?:Secenek|Variant|Varyant)\w*)\[(\d+)\]\.(.+)$/i);
    if (!m) continue;
    const id = m[2]!;
    if (!groups.has(id)) groups.set(id, {});
    groups.get(id)![m[3]!] = value;
  }
  const out: ParsedVariant[] = [];
  for (const [, g] of [...groups.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const options: Record<string, string> = {};
    const optIdx = new Set<string>();
    for (const k of Object.keys(g)) {
      const om = k.match(/Ozellik\[(\d+)\]\.@Tanim$/i);
      if (om) optIdx.add(om[1]!);
    }
    for (const i of optIdx) {
      const name = String(g[`EkSecenekOzellik.Ozellik[${i}].@Tanim`] ?? "").trim();
      const val = String(g[`EkSecenekOzellik.Ozellik[${i}].@Deger`] ?? g[`EkSecenekOzellik.Ozellik[${i}].#text`] ?? "").trim();
      if (name && val) options[name] = val;
    }
    if (!Object.keys(options).length) {
      for (const [k, label] of [["beden", "Beden"], ["renk", "Renk"], ["size", "Beden"], ["color", "Renk"]] as const) {
        const v = String(g[k] ?? "").trim();
        if (v && v.toUpperCase() !== "YOK") options[label] = v;
      }
    }
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const hit = Object.keys(g).find((x) => x.toLowerCase() === k.toLowerCase());
        if (hit && String(g[hit] ?? "").trim()) return String(g[hit]).trim();
      }
      return null;
    };
    out.push({
      sku: pick("StokKodu", "sku"),
      barcode: pick("Barkod", "barcode", "ykmzBarkod"),
      price: num(pick("BayiFiyati", "price", "Fiyat")),
      stock: Math.max(0, Math.round(num(pick("StokAdedi", "stock", "Stok")) ?? 0)),
      taxRate: num(pick("KdvOrani", "vat", "kdv")),
      desi: num(pick("Desi")),
      options,
    });
  }
  return out;
}

export function descriptionOf(raw: Record<string, unknown> | null): string {
  if (!raw) return "";
  const direct = raw["description"] ?? raw["Aciklama.#cdata"] ?? raw["Aciklama"];
  if (direct) return String(direct).trim();
  const key = Object.keys(raw).find((k) => /^(aciklama|açıklama|description)/i.test(k) && !/_[a-z]{2}$/i.test(k));
  return key ? String(raw[key] ?? "").trim() : "";
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function salePriceOf(sp: { supplier_price: number | null; computed_price: number | null }, markup: number, variantPrice?: number | null) {
  const purchase = Number(variantPrice ?? sp.supplier_price ?? 0) || 0;
  if (markup > 0) return round2(purchase * (1 + markup / 100));
  const listed = Number(sp.computed_price ?? 0);
  if (listed > 0 && (variantPrice == null || variantPrice === sp.supplier_price)) return round2(listed);
  return round2(purchase);
}

const slugify = (s: string) =>
  s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 80) || "urun";

async function ensureCategory(db: Client, storeId: string, name: string | null, cache: Map<string, string | null>) {
  const label = (name ?? "").split(/[>/]/).pop()?.trim();
  if (!label) return null;
  if (cache.has(label)) return cache.get(label)!;
  const { data } = await db.from("categories").select("id").eq("store_id", storeId).ilike("name", label).limit(1);
  let id: string | null = data?.[0]?.id ?? null;
  if (!id) {
    const { data: created } = await db
      .from("categories")
      .insert({ store_id: storeId, name: label, slug: `${slugify(label)}-${crypto.randomUUID().slice(0, 4)}`, is_active: true })
      .select("id")
      .single();
    id = created?.id ?? null;
  }
  cache.set(label, id);
  return id;
}

const SP_COLUMNS = "id, supplier_id, sku, barcode, title, brand, category, supplier_price, computed_price, currency, stock, images, raw";

/** Seçili tedarikçi ürünlerini mağazaya tüm bilgileriyle aktarır. */
export async function importToStore(db: Client, storeId: string, ids: string[], markup: number) {
  const { data: existing } = await db
    .from("store_supplier_imports")
    .select("supplier_product_id")
    .eq("store_id", storeId)
    .in("supplier_product_id", ids);
  const done = new Set(((existing ?? []) as any[]).map((r) => r.supplier_product_id));
  const todo = ids.filter((id) => !done.has(id));
  const { data: rows, error } = await db.from("supplier_products").select(SP_COLUMNS).in("id", todo);
  if (error) throw new Error(error.message);
  const { data: sups } = await db.from("suppliers").select("id").eq("is_active", true).eq("is_public_catalog", true);
  const allowed = new Set(((sups ?? []) as any[]).map((s) => s.id));
  const catCache = new Map<string, string | null>();
  let imported = 0;
  const failed: string[] = [];

  for (const sp of (rows ?? []) as any[]) {
    if (!allowed.has(sp.supplier_id)) continue;
    try {
      const variants = parseVariants(sp.raw);
      const taxRate = variants.find((v) => v.taxRate != null)?.taxRate ?? null;
      const desi = variants.find((v) => v.desi != null)?.desi ?? null;
      const price = salePriceOf(sp, markup);
      const categoryId = await ensureCategory(db, storeId, sp.category, catCache);
      const optionNames = [...new Set(variants.flatMap((v) => Object.keys(v.options)))].slice(0, 3);
      const variantOptions = optionNames.map((name) => ({
        name,
        values: [...new Set(variants.map((v) => v.options[name]).filter(Boolean))],
      }));
      const { data: product, error: pErr } = await db
        .from("products")
        .insert({
          store_id: storeId,
          title: sp.title,
          slug: `${slugify(sp.title)}-${crypto.randomUUID().slice(0, 6)}`,
          description: descriptionOf(sp.raw).slice(0, 200_000) || null,
          status: "active",
          published_at: new Date().toISOString(),
          vendor: sp.brand,
          product_type: sp.category,
          base_price: price,
          cost_price: Number(sp.supplier_price ?? 0) || null,
          currency: sp.currency || "TRY",
          track_inventory: true,
          sku: sp.sku,
          barcode: sp.barcode,
          tax_rate: taxRate,
          weight_grams: desi ? Math.round(desi * 1000) : null,
          category_id: categoryId,
          variant_options: variantOptions,
          tags: [sp.brand, sp.category].filter(Boolean),
        })
        .select("id")
        .single();
      if (pErr || !product) throw new Error(pErr?.message ?? "ürün oluşturulamadı");

      const images: string[] = Array.isArray(sp.images) ? sp.images.filter((u: unknown) => typeof u === "string") : [];
      if (images.length) {
        await db.from("product_images").insert(
          images.slice(0, 100).map((url, position) => ({ product_id: product.id, store_id: storeId, url, position, alt: sp.title })),
        );
      }

      const list: ParsedVariant[] = variants.length
        ? variants
        : [{ sku: sp.sku, barcode: sp.barcode, price: null, stock: Number(sp.stock ?? 0), taxRate, desi, options: {} }];
      await db.from("product_variants").insert(
        list.map((v, position) => {
          const opts = optionNames.map((n) => v.options[n] ?? null);
          return {
            product_id: product.id,
            store_id: storeId,
            title: opts.filter(Boolean).join(" / ") || "Varsayılan",
            sku: v.sku,
            barcode: v.barcode,
            options: v.options,
            option1: opts[0] ?? null,
            option2: opts[1] ?? null,
            option3: opts[2] ?? null,
            price: salePriceOf(sp, markup, v.price),
            cost_price: v.price ?? (Number(sp.supplier_price ?? 0) || null),
            stock: v.stock,
            weight_grams: v.desi ? Math.round(v.desi * 1000) : null,
            position,
            is_default: position === 0,
          };
        }),
      );

      await db.from("store_supplier_imports").insert({
        store_id: storeId,
        supplier_id: sp.supplier_id,
        supplier_product_id: sp.id,
        product_id: product.id,
        markup_percent: markup,
      });
      imported += 1;
    } catch (cause) {
      failed.push(`${sp.title}: ${cause instanceof Error ? cause.message : "hata"}`);
    }
  }
  return { imported, skipped: done.size, failed };
}

/** Tedarikçi ürünü değişince aktaran tüm mağazalarda fiyat ve stok günceller. */
export async function propagateToImporters(db: Client, supplierId: string) {
  const { data: links } = await db
    .from("store_supplier_imports")
    .select("id, product_id, supplier_product_id, markup_percent")
    .eq("supplier_id", supplierId);
  const list = (links ?? []) as any[];
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    const { data: sps } = await db.from("supplier_products").select(SP_COLUMNS).in("id", chunk.map((l) => l.supplier_product_id));
    const byId = new Map(((sps ?? []) as any[]).map((s) => [s.id, s]));
    for (const link of chunk) {
      const sp = byId.get(link.supplier_product_id);
      if (!sp) continue;
      const markup = Number(link.markup_percent ?? 0) || 0;
      await db.from("products").update({ base_price: salePriceOf(sp, markup), cost_price: Number(sp.supplier_price ?? 0) || null }).eq("id", link.product_id);
      const variants = parseVariants(sp.raw);
      const { data: pvs } = await db.from("product_variants").select("id, barcode, sku, position").eq("product_id", link.product_id);
      for (const pv of (pvs ?? []) as any[]) {
        const match =
          variants.find((v) => v.barcode && v.barcode === pv.barcode) ??
          (variants.length ? variants[pv.position ?? 0] : null);
        const stock = match ? match.stock : Number(sp.stock ?? 0);
        await db
          .from("product_variants")
          .update({ stock, price: salePriceOf(sp, markup, match?.price ?? null) })
          .eq("id", pv.id);
      }
      await db.from("store_supplier_imports").update({ last_synced_at: new Date().toISOString() }).eq("id", link.id);
    }
  }
  return list.length;
}
