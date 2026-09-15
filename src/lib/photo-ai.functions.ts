import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ürün fotoğrafının arka planını yapay zekâ ile temizler.
 * Yetki: yalnızca mağaza yöneticileri; kötüye kullanımı önlemek için hız sınırlı.
 */
export const cleanProductPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        // data:image/...;base64,... — ~6 MB dosya sınırı
        dataUrl: z.string().min(64).max(11_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);

    const { consumeRateLimit } = await import("@/lib/rate-limit.server");
    const limit = await consumeRateLimit(`photo_ai:${data.storeId}:${context.userId}`, {
      limit: 20,
      windowSeconds: 600,
    });
    if (!limit.allowed) {
      throw new Error("Kısa sürede çok fotoğraf temizlediniz. Birkaç dakika sonra tekrar deneyin.");
    }

    const { cleanPhotoBackground } = await import("@/lib/photo-ai.server");
    return cleanPhotoBackground(data.dataUrl);
  });
