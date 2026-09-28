import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Dakikalık güvenlik duvarı görevi: trafik özeti, DDoS seviyesi, süresi dolan banlar. */
export const Route = createFileRoute("/api/public/cron/firewall")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        try {
          const { runFirewallTick } = await import("@/lib/ddos-firewall.server");
          return Response.json(await runFirewallTick());
        } catch (error) {
          console.error(error);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
