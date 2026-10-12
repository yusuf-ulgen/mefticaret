// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { suppressClientAbort } from "./vite-plugins/suppress-client-abort";

/**
 * Edge worker'da import.meta.url tanımsız; sunucu paketleyicisinin CommonJS kütüphaneler
 * (papaparse, qrcode, pngjs) için eklediği createRequire(import.meta.url) modül yüklenirken
 * patlar ve tüm sayfalar 500 döner. Paket yazıldıktan sonra sabit bir dosya URL'sine düşülür.
 */
function workerImportMetaUrlFix() {
  const patch = () => {
    const dir = path.resolve(ROOT_DIR, "dist/server");
    if (!fs.existsSync(dir)) return;
    const walk = (d: string) => {
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, ent.name);
        if (ent.isDirectory()) walk(full);
        else if (/\.m?js$/.test(ent.name)) {
          const code = fs.readFileSync(full, "utf8");
          if (!/createRequire/.test(code) || !code.includes("(import.meta.url)")) continue;
          fs.writeFileSync(
            full,
            code.replaceAll("(import.meta.url)", '(import.meta.url ?? "file:///worker/index.mjs")'),
          );
        }
      }
    };
    walk(dir);
  };
  return {
    name: "mefti-worker-import-meta-url",
    apply: "build" as const,
    closeBundle: { order: "post" as const, handler: patch },
    buildApp: { order: "post" as const, handler: patch },
  };
}

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

// Vite uses slash-separated roots on Windows; MCP checks containment using native separators.
function mcpWithNativeRoot() {
  const plugin = mcpPlugin();
  const original = plugin.configResolved;
  if (typeof original === "function") {
    plugin.configResolved = function (config) {
      return original.call(this, { ...config, root: path.resolve(config.root) });
    };
  }
  return plugin;
}

const REFLECT_METADATA_BANNER = `if (typeof Reflect.getMetadata !== "function") {
  const __mefti_meta = new WeakMap();
  const __mefti_bag = (o) => { let m = __mefti_meta.get(o); if (!m) { m = new Map(); __mefti_meta.set(o, m); } return m; };
  Reflect.defineMetadata = (k, v, o) => { __mefti_bag(o).set(k, v); };
  Reflect.getMetadata = (k, o) => __mefti_bag(o).get(k);
  Reflect.getOwnMetadata = Reflect.getMetadata;
  Reflect.hasMetadata = (k, o) => __mefti_bag(o).has(k);
  Reflect.hasOwnMetadata = Reflect.hasMetadata;
  Reflect.deleteMetadata = (k, o) => __mefti_bag(o).delete(k);
  Reflect.getMetadataKeys = (o) => Array.from(__mefti_bag(o).keys());
  Reflect.getOwnMetadataKeys = Reflect.getMetadataKeys;
  Reflect.metadata = (k, v) => (o) => { __mefti_bag(o).set(k, v); };
}`;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Tamamen statik pazarlama/rehber sayfaları build sırasında HTML'e
    // dönüştürülür; her istekte sunucuda render edilmez.
    pages: [
      { path: "/en-iyi-e-ticaret-altyapisi" },
      { path: "/e-ticaret-sitesi-kurma" },
      { path: "/dropshipping-nasil-yapilir" },
    ],
    prerender: { enabled: true, autoStaticPathsDiscovery: false, crawlLinks: false },
  },
  vite: {
    // Excel okuyucu tarayıcıda gerektiğinde yüklenir. Önceden paketlenmiş
    // geliştirme önbelleği sürüm değişimlerinde eski parça adlarına bağlanıp
    // sayfayı boş bırakabildiği için doğrudan Vite üzerinden sunulur.
    optimizeDeps: {
      exclude: ["@e965/xlsx"],
    },
    // WebAuthn zinciri (@simplewebauthn/server → @peculiar/x509 → tsyringe) modül
    // yüklenirken Reflect.metadata arar; bu polyfill her sunucu parçasının başına
    // eklenir, aksi halde edge worker tüm sayfalarda 500 döner.
    environments: {
      ssr: {
        // Edge worker'da import.meta.url tanımsız; paket çalışma zamanı createRequire(import.meta.url)
        // çağırdığında tüm sayfalar 500 döner. Sabit bir dosya URL'si verilir.
        build: {
          rollupOptions: {
            output: {
              banner: REFLECT_METADATA_BANNER,
            },
          },
        },
      },
    },
    plugins: [suppressClientAbort(), mcpWithNativeRoot(), workerImportMetaUrlFix()],
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(ROOT_DIR, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(ROOT_DIR, "node_modules/entities/lib/encode.js"),
        entities: path.resolve(ROOT_DIR, "node_modules/entities"),
      },
    },
  },
});
