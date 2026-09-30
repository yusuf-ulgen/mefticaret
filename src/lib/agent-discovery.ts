/** Yapay zekâ ajanları için keşif uçları (.well-known) ve yardımcılar. */
const BASE = "https://mefticaret.com";

const json = (body: unknown, type = "application/json") =>
  new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": `${type}; charset=utf-8`, "cache-control": "public, max-age=3600", "access-control-allow-origin": "*" },
  });

const tools = [
  { name: "list_stores", description: "Kullanıcının yetkili olduğu mağazaları listeler." },
  { name: "list_products", description: "Mağaza ürünlerini listeler." },
  { name: "list_orders", description: "Mağaza siparişlerini listeler." },
  { name: "store_summary", description: "Mağaza satış özetini döndürür." },
  { name: "update_product", description: "Ürün fiyatı veya yayın durumunu günceller." },
];

export function agentDiscoveryResponse(pathname: string): Response | null {
  switch (pathname) {
    case "/.well-known/api-catalog":
      return json(
        {
          linkset: [
            {
              anchor: `${BASE}/api/v2`,
              "service-doc": [{ href: `${BASE}/rehberler`, type: "text/html" }],
            },
            {
              anchor: `${BASE}/mcp`,
              "service-desc": [{ href: `${BASE}/.well-known/mcp/server-card.json`, type: "application/json" }],
            },
          ],
        },
        "application/linkset+json",
      );
    case "/.well-known/mcp/server-card.json":
    case "/.well-known/mcp.json":
      return json({
        name: "evo-commerce-suite",
        title: "Mefticaret MCP",
        version: "0.1.0",
        description: "Mefticaret mağaza yönetimi araçları (OAuth korumalı).",
        transport: { type: "streamable-http", url: `${BASE}/mcp` },
        authentication: { type: "oauth2", metadata: `${BASE}/.well-known/oauth-protected-resource` },
        tools,
      });
    case "/.well-known/agent-card.json":
    case "/.well-known/agent.json":
      return json({
        name: "Mefticaret",
        description: "Çok kiracılı e-ticaret altyapısı; mağaza, ürün ve sipariş yönetimi.",
        url: `${BASE}/mcp`,
        version: "0.1.0",
        provider: { organization: "Mefticaret", url: BASE },
        capabilities: { streaming: true },
        defaultInputModes: ["application/json", "text/plain"],
        defaultOutputModes: ["application/json", "text/plain"],
        securitySchemes: { oauth: { type: "oauth2", url: `${BASE}/.well-known/oauth-protected-resource` } },
        skills: tools.map((t) => ({ id: t.name, name: t.name, description: t.description, tags: ["ecommerce"] })),
      });
    case "/.well-known/agent-skills/index.json":
      return json({
        skills: tools.map((t) => ({ name: t.name, description: t.description, endpoint: `${BASE}/mcp` })),
      });
    default:
      return null;
  }
}

export const DISCOVERY_LINK_HEADER = [
  `</.well-known/api-catalog>; rel="api-catalog"`,
  `</.well-known/agent-card.json>; rel="describedby"; type="application/json"`,
  `</sitemap-index.xml>; rel="sitemap"`,
  `</llms.txt>; rel="alternate"; type="text/markdown"`,
].join(", ");

/** HTML'i sade Markdown'a çevirir (ajanlar için). */
export function htmlToMarkdown(html: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  let body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  body = body
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, "")
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${"#".repeat(Number(n))} ${t}\n\n`)
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, h, t) => `[${t}](${h})`)
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<(br|\/p|\/div|\/section|\/li|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\[\s*\]\([^)]*\)/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
  return `${title ? `# ${title}\n\n` : ""}${body}\n`;
}
