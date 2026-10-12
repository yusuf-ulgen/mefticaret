import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { insertAuditRow } from "./audit.server";

const storeId = z.guid();
const path = z.string().trim().min(1).max(500).refine((value) => value.startsWith("/"), "Yol / ile başlamalı");

const redirectInput = z.object({
  storeId,
  id: z.guid().optional(),
  sourcePath: path,
  targetPath: z.string().trim().min(1).max(1000).refine((value) => value.startsWith("/") || /^https?:\/\//i.test(value), "Hedef yol geçersiz"),
  statusCode: z.union([z.literal(301), z.literal(302)]),
  isActive: z.boolean().default(true),
});

export const upsertSeoRedirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => redirectInput.parse(data))
  .handler(async ({ data, context }) => {
    const payload = {
      store_id: data.storeId,
      source_path: data.sourcePath,
      target_path: data.targetPath,
      status_code: data.statusCode,
      is_active: data.isActive,
    };
    const query = data.id
      ? context.supabase.from("store_seo_redirects").update(payload).eq("id", data.id).eq("store_id", data.storeId)
      : context.supabase.from("store_seo_redirects").upsert(payload, { onConflict: "store_id,source_path" });
    const { data: row, error } = await query.select("*").single();
    if (error) throw new Error(error.message);
    await insertAuditRow(context.supabase, {
      store_id: data.storeId,
      actor_id: context.userId,
      action: data.id ? "seo.redirect_updated" : "seo.redirect_created",
      entity: "store_seo_redirects",
      entity_id: row.id,
      new_value: payload as unknown as Json,
    });
    return row;
  });

export const deleteSeoRedirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("store_seo_redirects").delete().eq("id", data.id).eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    await insertAuditRow(context.supabase, {
      store_id: data.storeId,
      actor_id: context.userId,
      action: "seo.redirect_deleted",
      entity: "store_seo_redirects",
      entity_id: data.id,
    });
    return { ok: true as const };
  });

export const createRedirectFrom404 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid(), targetPath: z.string().trim().min(1).max(1000) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: missing, error: missingError } = await context.supabase
      .from("store_seo_404s")
      .select("path")
      .eq("id", data.id)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (missingError) throw new Error(missingError.message);
    if (!missing) throw new Error("404 kaydı bulunamadı");
    return upsertSeoRedirect({
      data: {
        storeId: data.storeId,
        sourcePath: missing.path,
        targetPath: data.targetPath,
        statusCode: 301,
        isActive: true,
      },
    });
  });
