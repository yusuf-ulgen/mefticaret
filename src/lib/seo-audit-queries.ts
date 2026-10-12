import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** SEO denetim sonuçlarını okuyan istemci sorguları (RLS ile mağaza bazlı). */

export type SeoAuditRow = {
  id: string;
  store_id: string;
  score: number;
  technical_score: number;
  onpage_score: number;
  content_score: number;
  schema_score: number;
  performance_score: number;
  mobile_score: number;
  linking_score: number;
  pages_count: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  passed_count: number;
  source: string;
  summary: Record<string, unknown> | null;
  created_at: string;
};

export type SeoAuditPageRow = {
  id: string;
  url: string;
  entity_type: string;
  entity_id: string | null;
  title: string | null;
  score: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  indexable: boolean;
};

export type SeoIssueRow = {
  id: string;
  code: string;
  category: string;
  severity: "critical" | "warning" | "info";
  entity_type: string;
  entity_id: string | null;
  url: string | null;
  title: string | null;
  message: string;
  fix_hint: string | null;
  autofixable: boolean;
  status: "open" | "resolved" | "ignored";
  meta: Record<string, unknown> | null;
  detected_at: string;
};

export const latestSeoAuditQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["seo-audit-latest", storeId],
    queryFn: async (): Promise<SeoAuditRow | null> => {
      const { data, error } = await supabase
        .from("seo_audits")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as SeoAuditRow | null) ?? null;
    },
    staleTime: 15_000,
  });

export const seoAuditHistoryQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["seo-audit-history", storeId],
    queryFn: async (): Promise<SeoAuditRow[]> => {
      const { data, error } = await supabase
        .from("seo_audits")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as SeoAuditRow[];
    },
    staleTime: 30_000,
  });

export const seoAuditPagesQuery = (storeId: string, auditId: string | null) =>
  queryOptions({
    queryKey: ["seo-audit-pages", storeId, auditId],
    queryFn: async (): Promise<SeoAuditPageRow[]> => {
      if (!auditId) return [];
      const { data, error } = await supabase
        .from("seo_audit_pages")
        .select("id, url, entity_type, entity_id, title, score, critical_count, warning_count, info_count, indexable")
        .eq("store_id", storeId)
        .eq("audit_id", auditId)
        .order("score", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as SeoAuditPageRow[];
    },
    enabled: Boolean(auditId),
    staleTime: 30_000,
  });

export const seoIssuesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["seo-issues", storeId],
    queryFn: async (): Promise<SeoIssueRow[]> => {
      const { data, error } = await supabase
        .from("seo_issues")
        .select("*")
        .eq("store_id", storeId)
        .order("severity")
        .order("detected_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as SeoIssueRow[];
    },
    staleTime: 15_000,
  });
