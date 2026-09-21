import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Merkezî yapay zekâ uç noktası: /api/ai/execute
 *
 * Akış: JWT doğrulama → mağaza yöneticisi yetkisi → kredi bakiyesi kontrolü →
 * OpenAI çağrısı → başarılı yanıtta kredi düşümü. Bakiye yetersizse OpenAI'ye
 * hiçbir istek gönderilmez ve 402 ile ayrıntılı bildirim döner.
 */

const bodySchema = z.object({
  storeId: z.string().uuid(),
  task: z.string().trim().min(2).max(60),
  values: z.record(z.string(), z.string().max(6000)).default({}),
});

export const Route = createFileRoute("/api/ai/execute")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
        if (!token) return Response.json({ error: "Oturum gerekli" }, { status: 401 });

        let input: z.infer<typeof bodySchema>;
        try {
          input = bodySchema.parse(await request.json());
        } catch {
          return Response.json({ error: "Geçersiz istek" }, { status: 400 });
        }

        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return Response.json({ error: "Sunucu yapılandırılmamış" }, { status: 500 });

        const client = createClient(url, key, {
          auth: { persistSession: false },
          global: {
            fetch: (target, init) => {
              const headers = new Headers(init?.headers);
              headers.set("apikey", key);
              headers.set("Authorization", `Bearer ${token}`);
              return fetch(target, { ...init, headers });
            },
          },
        });

        const { data: auth } = await client.auth.getUser(token);
        if (!auth.user) return Response.json({ error: "Oturum geçersiz" }, { status: 401 });

        try {
          const { assertStoreManager } = await import("@/lib/store-access.server");
          await assertStoreManager(client as never, input.storeId, auth.user.id);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Yetkisiz" },
            { status: 403 },
          );
        }

        try {
          const { runAiTask } = await import("@/lib/ai.server");
          const result = await runAiTask({
            client: client as never,
            storeId: input.storeId,
            userId: auth.user.id,
            taskKey: input.task,
            values: input.values,
          });
          const { aiCreditBalance } = await import("@/lib/ai-credits.server");
          return Response.json({
            text: result.text,
            model: result.model,
            totalTokens: result.totalTokens,
            creditsUsed: result.creditsUsed,
            balance: await aiCreditBalance(input.storeId),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "AI isteği başarısız";
          const { INSUFFICIENT_CREDITS_CODE } = await import("@/lib/ai-credits");
          const insufficient =
            message.includes(INSUFFICIENT_CREDITS_CODE) || message.includes("krediniz yetersiz");
          if (insufficient) {
            const { aiCreditBalance } = await import("@/lib/ai-credits.server");
            return Response.json(
              {
                error: message,
                code: "INSUFFICIENT_AI_CREDITS",
                balance: await aiCreditBalance(input.storeId),
              },
              { status: 402 },
            );
          }
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
