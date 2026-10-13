import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

// Source-only pre-publication check. No network calls or database writes.
const root = process.cwd();
const tree = await fs.readFile(path.join(root, "src/routeTree.gen.ts"), "utf8");
const definitions = tree.split("export interface FileRoutesByFullPath {")[1]?.split("export interface FileRoutesByTo")[0] ?? "";
const routes = [...definitions.matchAll(/^\s+'([^']+)':/gm)].map((match) => match[1]);
if (!routes.length) throw new Error("Generated route inventory is missing");
const matchers = routes.map((route) => new RegExp(`^${route.replace(/\/$/, "").split("/").map((part) => part.startsWith("$") ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("/")}/?$`));
const files = [];
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== "_authenticated" && entry.name !== "api") await walk(target);
    else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) files.push(target);
  }
}
await walk(path.join(root, "src/routes"));
for (const name of ["platform-home.tsx", "home-maker-auth-page.tsx", "public-footer.tsx", "public-header.tsx"]) {
  const file = path.join(root, "src/components", name);
  try { await fs.access(file); files.push(file); } catch { /* optional surface */ }
}
const entries = [];
for (const file of files) {
  const content = await fs.readFile(file, "utf8");
  const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const anchors = new Set();
  const links = [];
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText(ast);
      const value = node.initializer.text;
      if (name === "id") anchors.add(value);
      if (name === "href" || name === "to") links.push({ value, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const link of links) {
    if ((!link.value.startsWith("/") && !link.value.startsWith("#")) || link.value.startsWith("//") || link.value === "#") continue;
    const pathname = link.value.split(/[?#]/)[0];
    const localAnchor = link.value.startsWith("#");
    const valid = localAnchor ? anchors.has(link.value.slice(1)) : matchers.some((matcher) => matcher.test(pathname));
    const dynamic = !localAnchor && routes.some((route, i) => route.includes("$") && matchers[i].test(pathname));
    entries.push({ source: path.relative(root, file).replaceAll("\\", "/"), line: link.line, target: link.value, status: valid ? dynamic ? "content_check_required" : "route_found" : localAnchor ? "anchor_check_required" : "route_missing" });
  }
}
const failures = entries.filter((entry) => entry.status === "route_missing");
const report = { generatedAt: new Date().toISOString(), scope: "static public JSX links; dynamic expressions and database slugs require runtime verification", routes: routes.length, links: entries.length, failures: failures.length, entries };
const output = process.argv.indexOf("--output");
if (output >= 0 && process.argv[output + 1]) await fs.writeFile(path.resolve(process.argv[output + 1]), JSON.stringify(report, null, 2) + "\n");
console.log(`${report.links} public links checked; ${report.failures} missing routes; ${entries.filter((e) => e.status.endsWith("check_required")).length} require content/anchor verification.`);
for (const failure of failures) console.error(`${failure.source}:${failure.line} ${failure.target}`);
process.exitCode = failures.length ? 1 : 0;
