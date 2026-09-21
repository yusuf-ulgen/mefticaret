import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

const inputSchema = z.object({
  supplierId: z.string().uuid(),
  url: z.string().url().max(2000),
  itemPath: z.string().trim().max(160).optional(),
});

const MAX_BYTES = 25_000_000;
const MAX_ROWS = 5000;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function readLimited(response: Response): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new Error("Dosya çok büyük (25 MB üstü)");
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("Dosya çok büyük (25 MB üstü)");
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function handler({ request }: { request: Request }) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token || token.split(".").length !== 3) return json({ error: "Oturum doğrulanamadı" }, 401);

    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return json({ error: "Sunucu bağlantısı hazır değil" }, 503);
    const supabase = createClient<Database>(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: claims, error: claimError } = await supabase.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (claimError || !userId) return json({ error: "Oturum doğrulanamadı" }, 401);

    const input = inputSchema.parse(await request.json());
    const { data: supplier } = await supabase.from("suppliers").select("id").eq("id", input.supplierId)
      .eq("portal_user_id", userId).eq("portal_enabled", true).maybeSingle();
    if (!supplier) return json({ error: "Bu tedarikçi kaynağına erişiminiz yok" }, 403);

    const { consumeRateLimit, RATE_LIMITS } = await import("@/lib/rate-limit.server");
    const limited = await consumeRateLimit(`xml_proxy:${userId}`, RATE_LIMITS.import_trigger);
    if (!limited.allowed) return json({ error: "Çok fazla okuma denemesi. Bir dakika sonra tekrar deneyin." }, 429);

    const { safeFetch } = await import("@/lib/safe-fetch.server");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
      response = await safeFetch(input.url, {
        signal: controller.signal,
        headers: { accept: "application/xml,text/xml,text/csv,text/tab-separated-values,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*", "user-agent": "Mefticaret-XML-Proxy/2.0" },
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) return json({ error: `Kaynak dosya ${response.status} yanıtı verdi`, code: "fetch_failed" }, 422);
    const bytes = await readLimited(response);
    if (!bytes.length) return json({ error: "Kaynak boş yanıt döndürdü", code: "empty_source" }, 422);

    const contentType = response.headers.get("content-type") ?? "";
    const lowerUrl = input.url.split("?")[0]?.toLowerCase() ?? "";
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    const isOle = bytes[0] === 0xd0 && bytes[1] === 0xcf;
    const isWorkbook = isZip || isOle || /spreadsheet|ms-excel/i.test(contentType) || /\.xlsx?$/.test(lowerUrl);
    const { parseWorkbook, parseTextFeed, suggestMapping } = await import("@/lib/supplier-import");
    let parsed;
    if (isWorkbook) {
      const workbookBytes = new Uint8Array(bytes.byteLength);
      workbookBytes.set(bytes);
      parsed = parseWorkbook(workbookBytes.buffer);
    } else {
      const text = new TextDecoder("utf-8").decode(bytes);
      const trimmed = text.trimStart();
      const format = /xml/i.test(contentType) || trimmed.startsWith("<") ? "xml" : /json/i.test(contentType) || /^[\[{]/.test(trimmed) ? "json" : "csv";
      parsed = parseTextFeed(text, format, input.itemPath);
    }
    if (!parsed.rows.length) {
      return json({
        error: input.itemPath ? `“${input.itemPath}” kökünde ürün bulunamadı` : "Tekrarlayan ürün düğümü bulunamadı",
        code: "no_rows",
        format: parsed.format,
        selectedRoot: parsed.selectedRoot ?? null,
        rootCandidates: parsed.rootCandidates ?? [],
      }, 422);
    }
    return json({
      format: parsed.format,
      columns: parsed.columns,
      rows: parsed.rows.slice(0, MAX_ROWS),
      totalRows: parsed.rows.length,
      mapping: suggestMapping(parsed.columns),
      selectedRoot: parsed.selectedRoot ?? null,
      rootCandidates: parsed.rootCandidates ?? [],
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "Kaynak 20 saniye içinde yanıt vermedi"
      : error instanceof z.ZodError
        ? "Besleme adresi veya kök düğüm geçersiz"
        : error instanceof Error ? error.message : "Kaynak çözümlenemedi";
    return json({ error: message, code: "parse_failed" }, 422);
  }
}

export const Route = createFileRoute("/api/xml-parser")({
  server: { handlers: { POST: handler } },
});