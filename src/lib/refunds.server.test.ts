import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const provider = vi.hoisted(() => ({ refund: vi.fn() }));
vi.mock("@/lib/qnbpay-admin.server", () => ({ refundTransaction: provider.refund }));
vi.mock("@/lib/audit.server", () => ({ recordAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/customer-notify.server", () => ({
  dispatchCustomerEvent: vi.fn().mockResolvedValue(undefined),
}));
import { processRefund } from "./refunds.server";
import { RefundOutcomeUnknownError } from "./refund-errors";

function fixture(failFinalize = false) {
  let claimed = false;
  let completed = false;
  let processed = false;
  let finalizeCalls = 0;
  const refund = {
    id: "refund-a",
    store_id: "store-a",
    order_id: "order-a",
    amount: 20,
    currency: "TRY",
    refund_number: "R-1",
    refund_method: "original_payment",
  };
  provider.refund.mockReset().mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    completed = true;
    return { refNo: "provider-1" };
  });
  const db = {
    from: (table: string) => {
      let inserted = false;
      const result = () => ({
        data:
          table === "refunds"
            ? { ...refund, status: processed ? "processed" : "pending" }
            : table === "qnbpay_transactions"
              ? { id: "transaction-a", amount: 100 }
              : table === "qnbpay_refunds"
                ? completed
                  ? { status: "completed", duplicate_of: null }
                  : null
                : inserted
                  ? { id: "attempt-a" }
                  : null,
        error: null,
      });
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: () => query,
        limit: () => query,
        insert: () => {
          inserted = true;
          return query;
        },
        update: () => query,
        maybeSingle: async () => result(),
        single: async () => result(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return query;
    },
    rpc: async (name: string) => {
      if (name === "claim_order_refund") {
        const acquired = !claimed;
        claimed = true;
        return {
          data: { claimed: acquired, status: processed ? "processed" : "processing" },
          error: null,
        };
      }
      finalizeCalls++;
      if (failFinalize && finalizeCalls === 1)
        return { data: null, error: { message: "DB connection lost after provider success" } };
      processed = true;
      return { data: null, error: null };
    },
  };
  return db as unknown as SupabaseClient<Database>;
}

it("N03: parallel requests issue one provider refund", async () => {
  const db = fixture();
  const results = await Promise.allSettled([
    processRefund(db, "refund-a", "actor"),
    processRefund(db, "refund-a", "actor"),
  ]);
  expect(provider.refund).toHaveBeenCalledTimes(1);
  expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
  expect(results.find((row) => row.status === "rejected")).toMatchObject({
    reason: expect.any(RefundOutcomeUnknownError),
  });
  await expect(processRefund(db, "refund-a", "actor")).resolves.toMatchObject({
    status: "processed",
  });
  expect(provider.refund).toHaveBeenCalledTimes(1);
});
it("N03: provider success followed by a DB failure recovers without a second refund", async () => {
  const db = fixture(true);
  await expect(processRefund(db, "refund-a", "actor")).rejects.toThrow("DB connection lost");
  await expect(processRefund(db, "refund-a", "actor")).resolves.toMatchObject({
    status: "processed",
  });
  expect(provider.refund).toHaveBeenCalledTimes(1);
});
