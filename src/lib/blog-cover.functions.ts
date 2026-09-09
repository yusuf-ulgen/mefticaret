import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Blog kapak görseli yükleme. Görsel tarayıcıda 1200x630 (OG oranı) olarak
 * yeniden boyutlandırılıp JPEG'e çevrilir; burada yalnızca doğrulanmış
 * platform yöneticisinin yüklemesine izin verilir.
 */
export const uploadBlogCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const guard = await import("@/lib/platform-admin.server");
    await guard.assertPlatformAdmin(context.supabase, context.userId);

    const server = await import("@/lib/blog-cover.server");
    return server.storeBlogCover(server.blogCoverSchema.parse(data));
  });
