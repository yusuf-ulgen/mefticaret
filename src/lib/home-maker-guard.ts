import { createMiddleware } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ev hanımı paneli sunucu fonksiyonları için kapı: oturum zorunlu ve kullanıcının
 * `home_maker` rolü olmalı. Rol kontrolü sunucuda, kullanıcının kendi yetkisiyle
 * (RLS altında) yapılır; tarayıcıdan gelen hiçbir bilgiye güvenilmez.
 */
export const requireHomeMaker = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "home_maker")
      .maybeSingle();
    if (error) throw new Error("Yetki kontrolü yapılamadı");
    if (!data) throw new Response("Forbidden", { status: 403 });
    return next();
  });
