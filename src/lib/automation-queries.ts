import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Workflow = Database["public"]["Tables"]["automation_workflows"]["Row"];
export type WorkflowStep = Database["public"]["Tables"]["automation_steps"]["Row"];
export type MessageTemplate = Database["public"]["Tables"]["message_templates"]["Row"];
export type AutomationRun = Database["public"]["Tables"]["automation_runs"]["Row"];
export type RunEvent = Database["public"]["Tables"]["automation_run_events"]["Row"];
export type MessageDelivery = Database["public"]["Tables"]["message_deliveries"]["Row"];

export const workflowsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["automation-workflows", storeId],
    queryFn: async () => {
      const [workflows, steps] = await Promise.all([
        supabase
          .from("automation_workflows")
          .select("*")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false }),
        supabase
          .from("automation_steps")
          .select("*")
          .eq("store_id", storeId)
          .order("position", { ascending: true }),
      ]);
      if (workflows.error) throw new Error(workflows.error.message);
      if (steps.error) throw new Error(steps.error.message);
      return {
        workflows: workflows.data ?? [],
        steps: steps.data ?? [],
      };
    },
  });

export const messageTemplatesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["message-templates", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .eq("store_id", storeId)
        .order("channel", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const automationRunsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["automation-runs", storeId],
    queryFn: async () => {
      const [runs, events] = await Promise.all([
        supabase
          .from("automation_runs")
          .select("*")
          .eq("store_id", storeId)
          .order("updated_at", { ascending: false })
          .limit(60),
        supabase
          .from("automation_run_events")
          .select("*")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false })
          .limit(120),
      ]);
      if (runs.error) throw new Error(runs.error.message);
      if (events.error) throw new Error(events.error.message);
      return { runs: runs.data ?? [], events: events.data ?? [] };
    },
  });

export const messageDeliveriesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["message-deliveries", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_deliveries")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
