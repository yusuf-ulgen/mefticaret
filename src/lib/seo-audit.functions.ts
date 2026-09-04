import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { insertAuditRow } from "./audit.server";

/** SEO Audit Engine ve otomatik düzeltmeler için server fonksiyonları. */

const storeId = z.string().uuid();

export const runSeoAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId }).parse(data))
  .handler(async ({ data, context }) => {
    const { runStoreSeoAudit } = await import("@/lib/seo-audit.server");
    const result = await runStoreSeoAudit(context.supabase, data.storeId, {
      source: "manual",
      userId: context.userId,
    });
    await insertAuditRow(context.supabase, {
      store_id: data.storeId,
      actor_id: context.userId,
      action: "seo.audit_completed",
      entity: "seo_audits",
      entity_id: result.auditId,
      new_value: { score: result.score, issues: result.issues } as Json,
    });
    return result;
  });

export const fixSeoIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, issueId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { applySeoAutofix } = await import("@/lib/seo-autofix.server");
    const result = await applySeoAutofix(context.supabase, data.issueId, data.storeId);
    await context.supabase
      .from("seo_issues")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", data.issueId)
      .eq("store_id", data.storeId);
    await insertAuditRow(context.supabase, {
      store_id: data.storeId,
      actor_id: context.userId,
      action: "seo.issue_autofixed",
      entity: "seo_issues",
      entity_id: data.issueId,
      new_value: result as unknown as Json,
    });
    return result;
  });

export const fixSeoIssuesBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId, issueIds: z.array(z.string().uuid()).min(1).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { applySeoAutofix } = await import("@/lib/seo-autofix.server");
    let fixed = 0;
    const failures: string[] = [];
    for (const issueId of data.issueIds) {
      try {
        await applySeoAutofix(context.supabase, issueId, data.storeId);
        await context.supabase
          .from("seo_issues")
          .update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", issueId)
          .eq("store_id", data.storeId);
        fixed += 1;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : "Bilinmeyen hata");
      }
    }
    await insertAuditRow(context.supabase, {
      store_id: data.storeId,
      actor_id: context.userId,
      action: "seo.issues_autofixed",
      entity: "seo_issues",
      new_value: { fixed, failed: failures.length } as Json,
    });
    return { fixed, failed: failures.length, failures: failures.slice(0, 5) };
  });

export const updateSeoIssueStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        issueId: z.string().uuid(),
        status: z.enum(["open", "resolved", "ignored"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("seo_issues")
      .update({
        status: data.status,
        resolved_at: data.status === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", data.issueId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------------- Süper admin ---------------- */

export const fetchPlatformSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const server = await import("@/lib/platform-admin.server");
    await server.assertPlatformAdmin(context.supabase, context.userId);
    const { platformSeoOverview } = await import("@/lib/seo-platform.server");
    return platformSeoOverview();
  });

export const runPlatformStoreAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: storeId.optional(), all: z.boolean().default(false) }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const server = await import("@/lib/platform-admin.server");
    await server.assertPlatformAdmin(context.supabase, context.userId);
    const { auditStoresAsAdmin } = await import("@/lib/seo-platform.server");
    return auditStoresAsAdmin({ storeId: data.storeId ?? null, all: data.all, userId: context.userId });
  });
