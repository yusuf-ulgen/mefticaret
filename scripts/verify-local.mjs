import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const logs = await fs.mkdtemp(path.join(os.tmpdir(), "mefticaret-optimization-qa-"));
const steps = [];
async function run(name, script, args = []) {
  const started = Date.now();
  const output = [];
  const status = await new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: root, windowsHide: true, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (chunk) => output.push(chunk));
    child.stderr.on("data", (chunk) => output.push(chunk));
    child.once("error", (error) => { output.push(Buffer.from(error.message)); resolve(1); });
    child.once("close", (code) => resolve(code ?? 1));
  });
  const log = path.join(logs, `${name}.log`);
  const text = Buffer.concat(output).toString("utf8");
  await fs.writeFile(log, text);
  const result = { name, status: status === 0 ? "passed" : "failed", exitCode: status, durationMs: Date.now() - started, log };
  steps.push(result);
  console.log(`${name}: ${result.status} (${Math.round(result.durationMs / 1000)} s)`);
  if (status !== 0) console.error(text.split(/\r?\n/).slice(-12).join("\n"));
  return result;
}
await run("build", "node_modules/vite/bin/vite.js", ["build"]);
await run("types", "node_modules/typescript/bin/tsc", ["--noEmit", "--incremental", "--tsBuildInfoFile", path.join(logs, "types.tsbuildinfo")]);
const testReport = path.join(logs, "vitest.json");
await run("tests", "node_modules/vitest/vitest.mjs", ["run", "--config", "vitest.config.ts", "--reporter=json", `--outputFile=${testReport}`]);
await run("links", "scripts/check-public-links.mjs", ["--output", "docs/public-link-inventory.json"]);
const sqlFlag = process.argv.indexOf("--sql-runtime");
const sqlRuntime = sqlFlag >= 0 ? process.argv[sqlFlag + 1] : process.env["PGLITE_RUNTIME"];
if (sqlRuntime) {
  await run("bugfix-sql", "scripts/verify-bugfix-sql.mjs", [sqlRuntime]);
  await run("optimization-sql", "scripts/verify-optimization-sql.mjs", [sqlRuntime]);
} else steps.push({ name: "sql", status: "not_run", reason: "PGLite runtime path is not configured" });
let tests = null;
try { const report = JSON.parse(await fs.readFile(testReport, "utf8")); tests = { total: report.numTotalTests, passed: report.numPassedTests, failed: report.numFailedTests }; } catch { /* recorded step failure */ }
const report = { generatedAt: new Date().toISOString(), branch: "feat/development-optimization", localStatus: steps.some((s) => s.status === "failed") ? "failed" : steps.every((s) => s.status === "passed") ? "passed" : "incomplete", tests, steps, externalScenarios: ["authenticated role/RLS on real Supabase", "supplier XML and import with real feed", "360/375/768 px browser and keyboard interactions", "customer login/register/cart and digital/mixed delivery", "sandbox receipt/refund/callback/network-failure reconciliation", "old-tab deploy recovery", "same-scenario CWV/Lighthouse and CPU/RAM/DB load measurement"].map((scenario) => ({ scenario, status: "not_run", reason: "Separate configured test environment required" })) };
await fs.writeFile("docs/local-qa-results.json", JSON.stringify(report, null, 2) + "\n");
console.log(`Local QA: ${report.localStatus}; report: docs/local-qa-results.json`);
process.exitCode = report.localStatus === "passed" ? 0 : 1;
