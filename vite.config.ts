// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { suppressClientAbort } from "./vite-plugins/suppress-client-abort";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

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
    prerender: { enabled: true, autoStaticPathsDiscovery: false },
  },
  vite: {
    plugins: [suppressClientAbort(), mcpPlugin()],
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(ROOT_DIR, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(ROOT_DIR, "node_modules/entities/lib/encode.js"),
        entities: path.resolve(ROOT_DIR, "node_modules/entities"),
      },
    },
  },
});
