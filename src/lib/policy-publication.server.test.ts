import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { publishPolicyVersion } from "./policy-publication.server";

const policy = {
  id: "policy-a",
  store_id: "store-a",
  title: "Reviewed policy",
  updated_at: "2026-10-14T00:00:00Z",
};
const input = {
  content: "<p>Reviewed text</p>",
  bump: "minor" as const,
  effectiveDate: "2026-10-14",
  changeSummary: "QA publication",
  requiresAcceptance: true,
};
type Row = Record<string, unknown>;
function fixture(fail?: "activate" | "pointer" | "cleanup", orphan = false) {
  const current: Row = { ...policy, current_version_id: "old" };
  const versions: Row[] = [{ id: "old", policy_id: policy.id, version: "1.0", is_active: true }];
  if (orphan)
    versions.push({ id: "orphan", policy_id: policy.id, version: "1.1", is_active: false });
  const events: string[] = [];
  const db = {
    rpc: vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find publish_policy_version in schema cache",
      },
    }),
    from: (table: string) => {
      let action = "read";
      let values: Row = {};
      const filters: Array<(row: Row) => boolean> = [];
      let offset = 0;
      let end = Infinity;
      let excludeId = false;
      function execute(single = false) {
        let rows = (table === "policies" ? [current] : versions).filter((row) =>
          filters.every((filter) => filter(row)),
        );
        if (action === "update") {
          const stage =
            table === "policies"
              ? "pointer"
              : values["is_active"]
                ? "activate"
                : excludeId
                  ? "cleanup"
                  : "rollback";
          if (stage === fail) return { data: null, error: { message: `${stage} failed` } };
          if (stage === "pointer")
            expect(versions.filter((row) => row["is_active"])).toHaveLength(2);
          events.push(stage);
          rows.forEach((row) => Object.assign(row, values));
        }
        if (action === "insert") {
          const created = { id: "new", ...values };
          versions.push(created);
          rows = [created];
        }
        rows = rows.slice(offset, end + 1);
        return { data: single ? (rows[0] ?? null) : rows, error: null };
      }
      const query = {
        select: () => query,
        order: () => query,
        range: (from: number, to: number) => {
          offset = from;
          end = to;
          return query;
        },
        eq: (key: string, value: unknown) => {
          filters.push((row) => row[key] === value);
          return query;
        },
        neq: (key: string, value: unknown) => {
          excludeId = true;
          filters.push((row) => row[key] !== value);
          return query;
        },
        insert: (value: Row) => {
          action = "insert";
          values = value;
          return query;
        },
        update: (value: Row) => {
          action = "update";
          values = value;
          return query;
        },
        single: async () => execute(true),
        maybeSingle: async () => execute(true),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(execute()).then(resolve),
      };
      return query;
    },
  };
  return { client: db as unknown as SupabaseClient<Database>, db, current, versions, events };
}

it("F03/F11: uses the atomic RPC when installed", async () => {
  const f = fixture();
  f.db.rpc.mockResolvedValueOnce({ data: { version: "2.0" }, error: null });
  expect(await publishPolicyVersion(f.client, policy, input, "actor")).toEqual({ version: "2.0" });
  expect(f.events).toEqual([]);
});
it("F03/F11: a code-first release preserves the old publication until its replacement is ready", async () => {
  const f = fixture();
  expect(await publishPolicyVersion(f.client, policy, input, "actor")).toEqual({ version: "1.1" });
  expect(f.events).toEqual(["activate", "pointer", "cleanup"]);
  expect(f.current["current_version_id"]).toBe("new");
  expect(f.versions.filter((row) => row["is_active"]).map((row) => row["id"])).toEqual(["new"]);
});
it.each(["activate", "pointer"] as const)(
  "F03/F11: %s failure keeps the previous public version",
  async (stage) => {
    const f = fixture(stage);
    await expect(publishPolicyVersion(f.client, policy, input, "actor")).rejects.toThrow(
      `${stage} failed`,
    );
    expect(f.current["current_version_id"]).toBe("old");
    expect(f.versions.filter((row) => row["is_active"]).map((row) => row["id"])).toEqual(["old"]);
  },
);
it("F03/F11: a previously orphaned version does not block a retry", async () => {
  const f = fixture(undefined, true);
  expect(await publishPolicyVersion(f.client, policy, input, "actor")).toEqual({ version: "1.2" });
});
it("F03/F11: a concurrently changed draft is not overwritten by compatible publication", async () => {
  const f = fixture();
  f.current["updated_at"] = "newer-draft";
  await expect(publishPolicyVersion(f.client, policy, input, "actor")).rejects.toThrow(
    "Taslak değişti",
  );
  expect(f.current["current_version_id"]).toBe("old");
  expect(f.versions.filter((row) => row["is_active"]).map((row) => row["id"])).toEqual(["old"]);
});
it("F03/F11: unknown RPC outcomes are not retried through another write path", async () => {
  const f = fixture();
  f.db.rpc.mockResolvedValueOnce({ data: null, error: { code: "57014", message: "timeout" } });
  await expect(publishPolicyVersion(f.client, policy, input, "actor")).rejects.toThrow("timeout");
  expect(f.versions).toHaveLength(1);
});
it("F03/F11: a cleanup failure reports the already-published state explicitly", async () => {
  const f = fixture("cleanup");
  await expect(publishPolicyVersion(f.client, policy, input, "actor")).rejects.toThrow(
    "Belge yayınlandı",
  );
  expect(f.current["current_version_id"]).toBe("new");
});
it("F03/F11: empty content cannot be published even before the migration", async () => {
  const f = fixture();
  await expect(
    publishPolicyVersion(f.client, policy, { ...input, content: "<p></p>" }, "actor"),
  ).rejects.toThrow("metni eksik");
  expect(f.db.rpc).not.toHaveBeenCalled();
});
