import { createFileRoute } from "@tanstack/react-router";

/** QNBpay iade webhook'u; hash_key doğrulanmadan hiçbir kayıt güncellenmez. */

async function readFields(request: Request): Promise<Record<string, string>> {
  const fields: Record<string, string> = {};
  const url = new URL(request.url);
  url.searchParams.forEach((value, key) => {
    fields[key] = value;
  });
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      for (const [key, value] of Object.entries(body)) {
        if (value != null && typeof value !== "object") fields[key] = String(value);
      }
    } else {
      const form = await request.formData();
      form.forEach((value, key) => {
        if (typeof value === "string") fields[key] = value;
      });
    }
  } catch {
    /* gövde yoksa query parametreleri kullanılır */
  }
  return fields;
}

export const Route = createFileRoute("/api/public/qnbpay/refund-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const fields = await readFields(request);
        const mod = await import("@/lib/qnbpay-admin.server");
        try {
          const result = await mod.handleRefundWebhook(fields);
          return Response.json(result, { status: result.ok ? 200 : 400 });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "hata" },
            { status: 500 },
          );
        }
      },
    },
  },
});
