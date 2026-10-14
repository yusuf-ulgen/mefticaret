import { execFileSync } from "node:child_process";

export type BuildInfo = {
  commit: string | null;
  builtAt: string;
  dirty: boolean;
};

const COMMIT_KEYS = [
  "CF_PAGES_COMMIT_SHA",
  "GITHUB_SHA",
  "VERCEL_GIT_COMMIT_SHA",
  "CI_COMMIT_SHA",
  "COMMIT_SHA",
  "GIT_COMMIT_SHA",
  "GIT_COMMIT",
  "GIT_SHA",
  "COMMIT_REF",
  "RENDER_GIT_COMMIT",
  "CODEBUILD_RESOLVED_SOURCE_VERSION",
] as const;

const validCommit = (value: string | undefined) =>
  value && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : null;

/** Read the checked-out revision once at build time, never the remote's latest HEAD. */
export function resolveBuildInfo(
  env: Record<string, string | undefined>,
  git: (args: string[]) => string,
  builtAt = new Date().toISOString(),
): BuildInfo {
  try {
    const commit = validCommit(git(["rev-parse", "--verify", "HEAD"]));
    if (commit) {
      // Untracked source changes matter too; ignored build files and local credentials do not.
      const dirty = git(["status", "--porcelain", "--untracked-files=normal"]).trim().length > 0;
      return { commit, builtAt, dirty };
    }
  } catch {
    // Some hosting builds export the source tree without its .git directory.
  }
  for (const key of COMMIT_KEYS) {
    const commit = validCommit(env[key]);
    if (commit) return { commit, builtAt, dirty: false };
  }
  return { commit: null, builtAt, dirty: false };
}

export function readBuildInfo(root: string) {
  return resolveBuildInfo(process.env, (args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
}
