import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const directory = path.resolve(".output/public/assets");
const files = await fs.readdir(directory);
const entry = files.find((name) => /^supplier\.panel-.*\.js$/.test(name));
if (!entry) throw new Error("Supplier client build is missing");
const seen = new Set();
const assets = [];
async function visit(name) {
  if (seen.has(name)) return;
  seen.add(name);
  const text = await fs.readFile(path.join(directory, name), "utf8");
  assets.push({ name, bytes: Buffer.byteLength(text), gzipBytes: gzipSync(text).length });
  for (const match of text.matchAll(/\b(?:from\s*|import\s*)["']\.\/([^"']+\.js)["']/g)) await visit(match[1]);
}
await visit(entry);
const label = process.argv[2] ?? "after";
let report = { scope: "Static import graph of the supplier route; summed gzip sizes. Excludes dynamic imports, CSS, cache effects, browser timings and DB/provider requests. Not CWV/Lighthouse or capacity evidence.", before: null, after: null };
try { report = JSON.parse(await fs.readFile("docs/bundle-comparison.json", "utf8")); } catch { /* first measurement */ }
report[label] = { measuredAt: new Date().toISOString(), entry, modules: assets.length, bytes: assets.reduce((sum, a) => sum + a.bytes, 0), gzipBytes: assets.reduce((sum, a) => sum + a.gzipBytes, 0), assets };
if (report.before && report.after) report.change = { gzipBytes: report.after.gzipBytes - report.before.gzipBytes, modules: report.after.modules - report.before.modules };
await fs.writeFile("docs/bundle-comparison.json", JSON.stringify(report, null, 2) + "\n");
console.log(`${label}: ${report[label].modules} static modules; ${report[label].gzipBytes} gzip bytes`);
