import { slugify } from "@/lib/mefti";

export type BulkProductRow = {
  title: string;
  description?: string | undefined;
  sku?: string | undefined;
  vendor?: string | undefined;
  productType?: string | undefined;
  price: number;
  compareAtPrice?: number | undefined;
  stock: number;
  status: "draft" | "active" | "archived";
  tags: string[];
};

export type BulkImportResult = {
  created: number;
  updated: number;
  skipped: { row: number; reason: string }[];
};

type Client = {
  from: (table: string) => any;
};

/**
 * Ürünleri slug bazında eşleyerek toplu ekler veya güncelleyer.
 * Tenant izolasyonu RLS ile zorlanır; burada sadece iş kuralları uygulanır.
 */
export async function importProductRows(
  supabase: Client,
  storeId: string,
  currency: string,
  rows: BulkProductRow[],
  remainingQuota: number | null,
): Promise<BulkImportResult> {
  const result: BulkImportResult = { created: 0, updated: 0, skipped: [] };

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const slug = slugify(row.title) || `urun-${index + 1}`;

    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("store_id", storeId)
      .eq("slug", slug)
      .maybeSingle();

    const payload = {
      title: row.title,
      description: row.description ?? null,
      vendor: row.vendor ?? null,
      product_type: row.productType ?? null,
      base_price: row.price,
      compare_at_price: row.compareAtPrice ?? null,
      status: row.status,
      tags: row.tags,
    };

    if (existing?.id) {
      const { error } = await supabase.from("products").update(payload).eq("id", existing.id);
      if (error) {
        result.skipped.push({ row: index + 1, reason: error.message });
        continue;
      }
      const { data: variant } = await supabase
        .from("product_variants")
        .select("id")
        .eq("product_id", existing.id)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (variant?.id) {
        await supabase
          .from("product_variants")
          .update({ price: row.price, stock: row.stock, sku: row.sku ?? null })
          .eq("id", variant.id);
      }
      result.updated += 1;
      continue;
    }

    if (remainingQuota !== null && result.created >= remainingQuota) {
      result.skipped.push({ row: index + 1, reason: "Paket ürün limiti aşıldı" });
      continue;
    }

    const { data: product, error } = await supabase
      .from("products")
      .insert({ ...payload, store_id: storeId, slug, currency })
      .select("id")
      .maybeSingle();
    if (error || !product) {
      result.skipped.push({ row: index + 1, reason: error?.message ?? "Ürün eklenemedi" });
      continue;
    }

    await supabase.from("product_variants").insert({
      product_id: product.id,
      store_id: storeId,
      title: "Standart",
      sku: row.sku ?? null,
      price: row.price,
      stock: row.stock,
      position: 1,
    });
    result.created += 1;
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Toplu ürün işlemleri                                               */
/* ------------------------------------------------------------------ */

export type BulkOperation =
  | { kind: "status"; status: "draft" | "active" | "archived" }
  | {
      kind: "price";
      mode: "set" | "increase_percent" | "decrease_percent" | "increase_amount" | "decrease_amount";
      value: number;
      target: "base" | "compare_at" | "cost";
      applyToVariants: boolean;
      rounding: "none" | "integer" | "ends_99";
    }
  | { kind: "stock"; mode: "set" | "increase" | "decrease"; value: number }
  | { kind: "tags"; mode: "add" | "remove" | "replace"; tags: string[] }
  | { kind: "collections"; mode: "add" | "remove" | "replace"; collectionIds: string[] }
  | {
      kind: "fields";
      vendor?: string | undefined;
      productType?: string | undefined;
      taxRate?: number | undefined;
      currency?: string | undefined;
      trackInventory?: boolean | undefined;
    }
  | { kind: "delete" };

export type BulkOperationResult = { affected: number; errors: string[] };

function roundPrice(value: number, rounding: "none" | "integer" | "ends_99"): number {
  const safe = Math.max(0, value);
  if (rounding === "integer") return Math.round(safe);
  if (rounding === "ends_99") return Math.max(0, Math.round(safe) - 0.01 + (safe < 1 ? 0.01 : 0));
  return Math.round(safe * 100) / 100;
}

function nextPrice(
  current: number,
  op: Extract<BulkOperation, { kind: "price" }>,
): number {
  switch (op.mode) {
    case "set":
      return roundPrice(op.value, op.rounding);
    case "increase_percent":
      return roundPrice(current * (1 + op.value / 100), op.rounding);
    case "decrease_percent":
      return roundPrice(current * (1 - op.value / 100), op.rounding);
    case "increase_amount":
      return roundPrice(current + op.value, op.rounding);
    case "decrease_amount":
      return roundPrice(current - op.value, op.rounding);
    default:
      return current;
  }
}

/**
 * Seçili ürünlere toplu işlem uygular. Tenant izolasyonu RLS ile zorlanır,
 * ek olarak store_id filtresi ile ikinci bir sınır konur.
 */
export async function applyBulkOperation(
  supabase: Client,
  storeId: string,
  productIds: string[],
  op: BulkOperation,
): Promise<BulkOperationResult> {
  const errors: string[] = [];

  if (op.kind === "delete") {
    const { data, error } = await supabase
      .from("products")
      .delete()
      .eq("store_id", storeId)
      .in("id", productIds)
      .select("id");
    if (error) return { affected: 0, errors: [error.message] };
    return { affected: (data ?? []).length, errors };
  }

  if (op.kind === "status") {
    const { data, error } = await supabase
      .from("products")
      .update({ status: op.status })
      .eq("store_id", storeId)
      .in("id", productIds)
      .select("id");
    if (error) return { affected: 0, errors: [error.message] };
    return { affected: (data ?? []).length, errors };
  }

  if (op.kind === "fields") {
    const patch: Record<string, unknown> = {};
    if (op.vendor !== undefined) patch["vendor"] = op.vendor || null;
    if (op.productType !== undefined) patch["product_type"] = op.productType || null;
    if (op.taxRate !== undefined) patch["tax_rate"] = op.taxRate;
    if (op.currency !== undefined) patch["currency"] = op.currency;
    if (op.trackInventory !== undefined) patch["track_inventory"] = op.trackInventory;
    if (Object.keys(patch).length === 0) return { affected: 0, errors: ["Değişiklik yok"] };
    const { data, error } = await supabase
      .from("products")
      .update(patch)
      .eq("store_id", storeId)
      .in("id", productIds)
      .select("id");
    if (error) return { affected: 0, errors: [error.message] };
    return { affected: (data ?? []).length, errors };
  }

  if (op.kind === "tags") {
    const { data: rows, error } = await supabase
      .from("products")
      .select("id, tags")
      .eq("store_id", storeId)
      .in("id", productIds);
    if (error) return { affected: 0, errors: [error.message] };
    let affected = 0;
    for (const row of (rows ?? []) as { id: string; tags: string[] | null }[]) {
      const current = row.tags ?? [];
      let next: string[];
      if (op.mode === "add") next = Array.from(new Set([...current, ...op.tags]));
      else if (op.mode === "remove") next = current.filter((tag) => !op.tags.includes(tag));
      else next = Array.from(new Set(op.tags));
      const { error: updateError } = await supabase
        .from("products")
        .update({ tags: next.slice(0, 40) })
        .eq("id", row.id);
      if (updateError) errors.push(`${row.id.slice(0, 8)}: ${updateError.message}`);
      else affected += 1;
    }
    return { affected, errors };
  }

  if (op.kind === "collections") {
    let affected = 0;
    for (const productId of productIds) {
      if (op.mode === "replace" || op.mode === "remove") {
        let query = supabase.from("product_collections").delete().eq("product_id", productId);
        if (op.mode === "remove") query = query.in("collection_id", op.collectionIds);
        const { error } = await query;
        if (error) {
          errors.push(`${productId.slice(0, 8)}: ${error.message}`);
          continue;
        }
      }
      if (op.mode !== "remove" && op.collectionIds.length > 0) {
        const { error } = await supabase.from("product_collections").upsert(
          op.collectionIds.map((collectionId) => ({
            product_id: productId,
            collection_id: collectionId,
          })),
          { onConflict: "product_id,collection_id", ignoreDuplicates: true },
        );
        if (error) {
          errors.push(`${productId.slice(0, 8)}: ${error.message}`);
          continue;
        }
      }
      affected += 1;
    }
    return { affected, errors };
  }

  if (op.kind === "stock") {
    const { data: variants, error } = await supabase
      .from("product_variants")
      .select("id, stock, product_id")
      .eq("store_id", storeId)
      .in("product_id", productIds);
    if (error) return { affected: 0, errors: [error.message] };
    let affected = 0;
    for (const variant of (variants ?? []) as { id: string; stock: number }[]) {
      const current = variant.stock ?? 0;
      const next =
        op.mode === "set"
          ? op.value
          : op.mode === "increase"
            ? current + op.value
            : current - op.value;
      const safe = Math.max(0, Math.round(next));
      if (safe === current) continue;
      const { error: updateError } = await supabase
        .from("product_variants")
        .update({ stock: safe })
        .eq("id", variant.id);
      if (updateError) errors.push(updateError.message);
      else affected += 1;
    }
    return { affected, errors };
  }

  // price
  const column =
    op.target === "base" ? "base_price" : op.target === "compare_at" ? "compare_at_price" : "cost_price";
  const { data: rows, error } = await supabase
    .from("products")
    .select(`id, ${column}`)
    .eq("store_id", storeId)
    .in("id", productIds);
  if (error) return { affected: 0, errors: [error.message] };

  let affected = 0;
  for (const row of (rows ?? []) as Record<string, any>[]) {
    const current = Number(row[column] ?? 0);
    const next = nextPrice(current, op);
    const { error: updateError } = await supabase
      .from("products")
      .update({ [column]: next })
      .eq("id", row["id"]);
    if (updateError) {
      errors.push(`${String(row["id"]).slice(0, 8)}: ${updateError.message}`);
      continue;
    }
    affected += 1;

    if (op.applyToVariants) {
      const variantColumn =
        op.target === "base" ? "price" : op.target === "compare_at" ? "compare_at_price" : "cost_price";
      const { data: variants } = await supabase
        .from("product_variants")
        .select(`id, ${variantColumn}`)
        .eq("product_id", row["id"]);
      for (const variant of (variants ?? []) as Record<string, any>[]) {
        const variantNext = nextPrice(Number(variant[variantColumn] ?? current), op);
        await supabase
          .from("product_variants")
          .update({ [variantColumn]: variantNext })
          .eq("id", variant["id"]);
      }
    }
  }

  return { affected, errors };
}
