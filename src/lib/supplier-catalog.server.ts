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

export function salePriceOf(sp: { supplier_price: number | null; computed_price: number | null; suggested_price?: number | null }, markup: number, variantPrice?: number | null) {
  const purchase = Number(variantPrice ?? sp.supplier_price ?? 0) || 0;
  if (markup > 0) return round2(purchase * (1 + markup / 100));
  const listed = Number(sp.computed_price ?? sp.suggested_price ?? 0);
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

const SP_COLUMNS = "id, supplier_id, catalog_visible, suggested_price, sku, barcode, title, brand, category, supplier_price, computed_price, currency, stock, images, raw";

/** Seçili tedarikçi ürünlerini mağazaya tüm bilgileriyle aktarır. */
export async function importToStore(db: Client, storeId: string, ids: string[], markup: number) {
  const { data: existing } = await db
    .from("store_supplier_imports")
    .select("supplier_product_id")
    .eq("store_id", storeId)
    .in("supplier_product_id", ids);
  const done = new Set(((existing ?? []) as any[]).map((r) => r.supplier_product_id));
  let todo = ids.filter((id) => !done.has(id));
  const quota = await kolayImportQuota(db, storeId);
  let overQuota = 0;
  if (quota) {
    const left = Math.max(0, quota.limit - quota.used);
    overQuota = Math.max(0, todo.length - left);
    todo = todo.slice(0, left);
    if (!todo.length) {
      return { imported: 0, skipped: done.size, failed: [`Tedarikçi ürün kotanız doldu (${quota.used}/${quota.limit}).`] };
    }
  }
  const { data: rows, error } = await db.from("supplier_products").select(SP_COLUMNS).in("id", todo);
  if (error) throw new Error(error.message);
  const { data: sups } = await db.from("suppliers").select("id").eq("is_active", true).eq("is_public_catalog", true);
  const allowed = new Set(((sups ?? []) as any[]).map((s) => s.id));
  const catCache = new Map<string, string | null>();
  const { data: maps } = await db
    .from("store_supplier_category_maps")
    .select("supplier_id, source_category, category_id, markup_percent")
    .eq("store_id", storeId);
  const mapOf = new Map(((maps ?? []) as any[]).map((m) => [`${m.supplier_id}|${m.source_category}`, m]));
  let imported = 0;
  const failed: string[] = [];

  for (const sp of (rows ?? []) as any[]) {
    if (!allowed.has(sp.supplier_id) || sp.catalog_visible === false) continue;
    try {
      const map = mapOf.get(`${sp.supplier_id}|${sp.category ?? ""}`);
      const effMarkup = markup > 0 ? markup : Number(map?.markup_percent ?? 0) || 0;
      const variants = parseVariants(sp.raw);
      const taxRate = variants.find((v) => v.taxRate != null)?.taxRate ?? null;
      const desi = variants.find((v) => v.desi != null)?.desi ?? null;
      const price = salePriceOf(sp, effMarkup);
      const categoryId = map?.category_id ?? (await ensureCategory(db, storeId, sp.category, catCache));
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
            price: salePriceOf(sp, effMarkup, v.price),
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
        markup_percent: effMarkup,
      });
      imported += 1;
    } catch (cause) {
      failed.push(`${sp.title}: ${cause instanceof Error ? cause.message : "hata"}`);
    }
  }
  if (overQuota) failed.push(`Kota sınırı: ${overQuota} ürün aktarılmadı (kota ${quota!.limit}).`);
  return { imported, skipped: done.size, failed };
}

export const KOLAY_QUOTA_KEY = "kolay_supplier_quota";
export const KOLAY_QUOTA_DEFAULT = 20;
export type KolayQuotaSetting = { default: number; stores: Record<string, number> };

export async function readKolayQuotaSetting(db: Client): Promise<KolayQuotaSetting> {
  const { data } = await db.from("platform_settings").select("value").eq("key", KOLAY_QUOTA_KEY).maybeSingle();
  const v = (data?.value ?? {}) as Partial<KolayQuotaSetting>;
  return {
    default: Number.isFinite(Number(v.default)) ? Math.max(0, Number(v.default)) : KOLAY_QUOTA_DEFAULT,
    stores: v.stores && typeof v.stores === "object" ? v.stores : {},
  };
}

/** Kolay Panel (micro) mağazaları için aktarım kotası; kurumsal mağazalarda null. */
export async function kolayImportQuota(db: Client, storeId: string): Promise<{ limit: number; used: number } | null> {
  const { data: store } = await db.from("stores").select("store_kind").eq("id", storeId).maybeSingle();
  if (store?.store_kind !== "micro") return null;
  const setting = await readKolayQuotaSetting(db);
  const own = setting.stores[storeId];
  const limit = own != null && Number.isFinite(Number(own)) ? Math.max(0, Number(own)) : setting.default;
  const { count } = await db.from("store_supplier_imports").select("id", { count: "exact", head: true }).eq("store_id", storeId);
  return { limit, used: count ?? 0 };
}

/** Tedarikçi ürünü değişince aktaran tüm mağazalarda fiyat ve stok günceller. */
export async function propagateToImporters(db: Client, supplierId: string) {
  const { data: links } = await db
    .from("store_supplier_imports")
    .select("id, product_id, supplier_product_id, markup_percent")
    .eq("supplier_id", supplierId)
    .eq("sync_enabled", true);
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

/** Tek bir aktarım bağlantısını hemen eşitler. */
export async function syncOneImport(db: Client, importId: string) {
  const { data: link } = await db.from("store_supplier_imports").select("supplier_id").eq("id", importId).maybeSingle();
  if (link) await propagateToImporters(db, link.supplier_id);
}

/** Otomatik aktarım açık mağazalara henüz eklenmemiş tedarikçi ürünlerini ekler (çağrı başına en çok 200). */
export async function runAutoImports(db: Client, filter: { supplierId?: string; storeId?: string }) {
  let q = db.from("store_supplier_auto_imports").select("id, store_id, supplier_id, markup_percent").eq("enabled", true);
  if (filter.supplierId) q = q.eq("supplier_id", filter.supplierId);
  if (filter.storeId) q = q.eq("store_id", filter.storeId);
  const { data: rules } = await q;
  const results: { storeId: string; supplierId: string; imported: number; remaining: number }[] = [];
  for (const rule of (rules ?? []) as any[]) {
    const { data: have } = await db.from("store_supplier_imports").select("supplier_product_id").eq("store_id", rule.store_id).eq("supplier_id", rule.supplier_id).limit(20000);
    const done = new Set(((have ?? []) as any[]).map((r) => r.supplier_product_id));
    const { data: all } = await db.from("supplier_products").select("id").eq("supplier_id", rule.supplier_id).eq("catalog_visible", true).limit(20000);
    const todo = ((all ?? []) as any[]).map((r) => r.id as string).filter((id) => !done.has(id));
    const batch = todo.slice(0, 200);
    const res = batch.length ? await importToStore(db, rule.store_id, batch, Number(rule.markup_percent ?? 0) || 0) : { imported: 0, skipped: 0, failed: [] };
    const remaining = todo.length - batch.length;
    await db.from("store_supplier_auto_imports").update({ last_run_at: new Date().toISOString(), last_result: { imported: res.imported, failed: res.failed.length, remaining } }).eq("id", rule.id);
    results.push({ storeId: rule.store_id, supplierId: rule.supplier_id, imported: res.imported, remaining });
  }
  return results;
}
