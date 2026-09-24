import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Zamanlanmış analitik rapor e-postaları. Her sabah 08:00 (İstanbul) çalışır:
 * günlük raporlar her gün, haftalık pazartesi, aylık ayın 1'inde gönderilir.
 */
export const Route = createFileRoute("/api/public/cron/analytics-reports")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { buildReport } = await import("@/lib/analytics-v2.server");
        const { REPORTS } = await import("@/lib/analytics-v2");
        const { reportEmailRows } = await import("@/lib/analytics-report-email");
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

        const now = new Date(Date.now() + 3 * 3_600_000);
        const due = new Set<string>(["daily"]);
        if (now.getUTCDay() === 1) due.add("weekly");
        if (now.getUTCDate() === 1) due.add("monthly");
        const today = now.toISOString().slice(0, 10);

        const { data: rows, error } = await supabaseAdmin
          .from("analytics_report_schedules")
          .select("id, store_id, report_key, frequency, recipients, stores(name, currency)")
          .eq("is_active", true)
          .in("frequency", [...due])
          .limit(1000);
        if (error) return Response.json({ error: "schedules_failed" }, { status: 500 });

        let sent = 0;
        let failed = 0;
        for (const row of rows ?? []) {
          const store = row.stores as { name: string; currency: string } | null;
          try {
            const key = row.report_key as keyof typeof REPORTS;
            const rep = await buildReport(supabaseAdmin, row.store_id, key, { period: REPORTS[key].period });
            const { rows: kpis, sections } = reportEmailRows(rep.data as Record<string, any>, store?.currency ?? "TRY");
            for (const to of row.recipients.slice(0, 10)) {
              await sendTemplateEmail("analytics-report", to, {
                idempotencyKey: `analytics-${row.id}-${today}-${to}`,
                templateData: {
                  storeName: store?.name ?? "",
                  reportLabel: rep.label,
                  rangeLabel: rep.range.fromDay === rep.range.toDay ? rep.range.fromDay : `${rep.range.fromDay} – ${rep.range.toDay}`,
                  rows: kpis,
                  sections,
                },
              });
            }
            await supabaseAdmin.from("analytics_report_schedules").update({ last_sent_at: new Date().toISOString(), last_error: null }).eq("id", row.id);
            sent++;
          } catch (e) {
            failed++;
            await supabaseAdmin.from("analytics_report_schedules")
              .update({ last_error: `Gönderilemedi: ${(e as Error).message}`.slice(0, 300) }).eq("id", row.id);
          }
        }
        return Response.json({ ok: true, sent, failed });
      },
    },
  },
});
