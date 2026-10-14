import { expect, it } from "vitest";
import { resolveBuildInfo } from "../../vite-plugins/build-info";

const checkedOut = "1234567890abcdef1234567890abcdef12345678";
const otherCommit = "abcdef1234567890abcdef1234567890abcdef12";
const builtAt = "2026-10-14T20:00:00.000Z";

it("reports the actual checkout, even if a CI variable names a different revision", () => {
  expect(
    resolveBuildInfo(
      { GITHUB_SHA: otherCommit },
      (args) => (args[0] === "rev-parse" ? checkedOut : ""),
      builtAt,
    ),
  ).toEqual({ commit: checkedOut, builtAt, dirty: false });
});
it("marks local edits instead of claiming they are the exact committed release", () => {
  expect(
    resolveBuildInfo(
      {},
      (args) => (args[0] === "rev-parse" ? checkedOut : " M src/components/platform-home.tsx"),
      builtAt,
    ).dirty,
  ).toBe(true);
});
it("uses a validated CI commit when the hosting build has no git checkout", () => {
  expect(
    resolveBuildInfo(
      { CF_PAGES_COMMIT_SHA: checkedOut },
      () => {
        throw new Error("no .git");
      },
      builtAt,
    ),
  ).toEqual({ commit: checkedOut, builtAt, dirty: false });
});
it("never labels an arbitrary build ID, URL or branch as a commit", () => {
  expect(
    resolveBuildInfo(
      { BUILD_ID: "release-42", COMMIT_SHA: "main", GITHUB_SHA: "https://example.test" },
      () => {
        throw new Error("no git");
      },
      builtAt,
    ).commit,
  ).toBeNull();
});
