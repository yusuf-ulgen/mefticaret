import { expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (data: unknown) => unknown = (data) => data;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: typeof validate) => {
        validate = fn;
        return builder;
      },
      handler: (fn: (args: unknown) => unknown) => (args: { data: unknown; context: unknown }) =>
        fn({ ...args, data: validate(args.data) }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({ insert: vi.fn().mockResolvedValue({ data: null, error: null }) }),
  },
}));
vi.mock("@/lib/audit.server", () => ({ insertAuditRow: vi.fn().mockResolvedValue(undefined) }));
import { createStore } from "./stores.functions";

function database() {
  return {
    from: (table: string) => {
      let code = "";
      let payload: Record<string, unknown> = {};
      const query = {
        select: () => query,
        eq: (key: string, value: string) => {
          if (key === "code") code = value;
          return query;
        },
        maybeSingle: async () => ({
          data:
            table === "plans"
              ? { id: code === "free" ? "free-plan" : "requested-paid-plan" }
              : null,
          error: null,
        }),
        insert: (value: typeof payload) => {
          payload = value;
          return query;
        },
        single: async () => ({ data: { id: "store-a", ...payload }, error: null }),
      };
      return query;
    },
  };
}
const execute = createStore as unknown as (args: {
  data: Record<string, unknown>;
  context: { userId: string; supabase: ReturnType<typeof database> };
}) => Promise<Record<string, unknown>>;

it.each(["monthly", "yearly"])(
  "A01: %s selection is saved while the new store remains on the free plan",
  async (billingInterval) => {
    const store = await execute({
      data: { name: "QA shop", industry: "moda", planCode: "enterprise", billingInterval },
      context: { userId: "owner-a", supabase: database() },
    });
    expect(store).toMatchObject({
      owner_id: "owner-a",
      plan_id: "free-plan",
      requested_plan_id: "requested-paid-plan",
      requested_billing_interval: billingInterval,
    });
  },
);
