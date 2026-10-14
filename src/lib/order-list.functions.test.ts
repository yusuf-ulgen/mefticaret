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

import { exportStoreOrders, listStoreOrders } from "./order-list.functions";

const storeId = "10000000-0000-4000-8000-000000000001";
const otherStore = "10000000-0000-4000-8000-000000000002";
const rows = Array.from({ length: 250 }, (_, index) => ({
  id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  store_id: storeId,
  order_number: `ORDER-${String(index + 1).padStart(4, "0")}`,
  status: "pending",
  placed_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
}));

function database(fail = false) {
  return {
    from: () => {
      let data = [...rows, { ...rows[0]!, store_id: otherStore }];
      let from = 0;
      let to = Infinity;
      const query = {
        select: () => query,
        eq: (key: string, value: string) => {
          data = data.filter((row) => row[key as keyof typeof row] === value);
          return query;
        },
        order: (key: string, options?: { ascending?: boolean }) => {
          if (key === "placed_at")
            data.sort((a, b) =>
              options?.ascending === false
                ? b.placed_at.localeCompare(a.placed_at)
                : a.placed_at.localeCompare(b.placed_at),
            );
          return query;
        },
        or: (filter: string) => {
          const term = filter.split(".ilike.%")[1]!.split("%")[0]!.toLowerCase();
          data = data.filter((row) => row.order_number.toLowerCase().includes(term));
          return query;
        },
        in: (_key: string, ids: string[]) => {
          data = data.filter((row) => ids.includes(row.id));
          return query;
        },
        range: (start: number, end: number) => {
          from = start;
          to = end;
          return query;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: fail ? null : data.slice(from, to + 1),
            count: data.length,
            error: fail ? { message: "database unavailable" } : null,
          }).then(resolve),
      };
      return query;
    },
  };
}
type Execute = (args: {
  data: Record<string, unknown>;
  context: { supabase: ReturnType<typeof database> };
}) => Promise<{ rows: typeof rows; total: number } | typeof rows>;
const list = listStoreOrders as unknown as Execute;
const exportAll = exportStoreOrders as unknown as Execute;

it("N06: finds the oldest order beyond 200 and exports all 250 with store scope", async () => {
  const context = { supabase: database() };
  expect(await list({ data: { storeId, search: "ORDER-0001" }, context })).toMatchObject({
    total: 1,
    rows: [rows[0]],
  });
  const pages = [];
  for (let page = 0; page < 5; page++) {
    const result = (await list({ data: { storeId, page }, context })) as {
      rows: typeof rows;
      total: number;
    };
    expect(result.total).toBe(250);
    expect(result.rows).toHaveLength(50);
    pages.push(...result.rows);
  }
  expect(new Set(pages.map((row) => row.id)).size).toBe(250);
  expect(pages.at(-1)?.order_number).toBe("ORDER-0001");
  expect(await exportAll({ data: { storeId }, context })).toHaveLength(250);
  expect(await exportAll({ data: { storeId, selectedIds: [rows[0]!.id] }, context })).toEqual([
    rows[0],
  ]);
});
it("N06: query failures do not become a successful empty list or CSV", async () => {
  const context = { supabase: database(true) };
  await expect(list({ data: { storeId }, context })).rejects.toThrow("database unavailable");
  await expect(exportAll({ data: { storeId }, context })).rejects.toThrow("database unavailable");
});
