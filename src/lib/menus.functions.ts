import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Vitrin menü yönetimi (header / footer navigasyonu).
 * Tenant izolasyonu RLS ile zorlanır; burada doğrulama + audit kaydı yapılır.
 */

const kindSchema = z.enum(["home", "collection", "page", "product", "cart", "account", "url"]);

export const saveMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        itemId: z.string().uuid().optional(),
        location: z.enum(["header", "footer"]),
        label: z.string().trim().min(1).max(60),
        kind: kindSchema,
        target: z.string().trim().max(300).optional(),
        position: z.number().int().min(0).max(999).default(0),
        isVisible: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const needsTarget = ["collection", "page", "product", "url"].includes(data.kind);
    const target = data.target?.trim() ?? "";
    if (needsTarget && !target) throw new Error("Bu bağlantı türü için hedef gerekli");
    if (data.kind === "url" && !/^(https?:\/\/|\/)/.test(target)) {
      throw new Error("URL http(s):// veya / ile başlamalı");
    }

    const payload = {
      store_id: data.storeId,
      location: data.location,
      label: data.label,
      kind: data.kind,
      target: needsTarget ? target : null,
      position: data.position,
      is_visible: data.isVisible,
    };

    const query = data.itemId
      ? supabase
          .from("store_menu_items")
          .update(payload)
          .eq("id", data.itemId)
          .eq("store_id", data.storeId)
      : supabase.from("store_menu_items").insert(payload);

    const { data: row, error } = await query.select("*").single();
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      store_id: data.storeId,
      actor_id: userId,
      action: data.itemId ? "menu_item.updated" : "menu_item.created",
      entity: "store_menu_item",
      entity_id: row.id,
      new_value: { label: row.label, kind: row.kind, location: row.location },
    });

    return row;
  });

export const deleteMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), itemId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("store_menu_items")
      .delete()
      .eq("id", data.itemId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      store_id: data.storeId,
      actor_id: userId,
      action: "menu_item.deleted",
      entity: "store_menu_item",
      entity_id: data.itemId,
    });

    return { ok: true };
  });

export const reorderMenuItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        items: z
          .array(z.object({ id: z.string().uuid(), position: z.number().int().min(0).max(999) }))
          .min(1)
          .max(60),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    for (const item of data.items) {
      const { error } = await supabase
        .from("store_menu_items")
        .update({ position: item.position })
        .eq("id", item.id)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const seedDefaultMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const rows = [
      { location: "header", label: "Ürünler", kind: "home", target: null, position: 0 },
      { location: "header", label: "Hesabım", kind: "account", target: null, position: 1 },
      { location: "header", label: "Siparişim", kind: "url", target: "/order", position: 2 },
    ].map((row) => ({ ...row, store_id: data.storeId, is_visible: true }));

    const { error } = await supabase.from("store_menu_items").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
