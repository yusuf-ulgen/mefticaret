import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Panel erişim kapıları.
 *
 * Yetki her zaman sunucuda, oturum token'ından çözülen kullanıcı kimliği ile
 * veritabanından okunur. İstemciden gelen rol/`platform_admin` gibi değerler
 * hiçbir zaman dikkate alınmaz. Reddedilen denemeler denetim kaydına yazılır.
 */

const MANAGER_ROLES = new Set(["owner", "admin"]);

/** Süper admin (platform) erişimi. */
export const checkPlatformAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ route: z.string().trim().max(300).default("/admin") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "platform_admin")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const allowed = Boolean(row);

    const { logSecurityEvent } = await import("./access-guard.server");
    await logSecurityEvent({
      userId: context.userId,
      kind: allowed ? "platform_admin_access" : "platform_admin_access_denied",
      severity: allowed ? "info" : "warning",
      meta: { route: data.route },
    });

    return { allowed };
  });

/** Mağaza paneli erişimi: üyelik veya platform yöneticiliği zorunlu. */
export const checkStoreAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ storeId: z.string().uuid(), route: z.string().trim().max(300).default("") })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ data: store }, { data: membership }, { data: platformRole }] = await Promise.all([
      context.supabase.from("stores").select("id, owner_id").eq("id", data.storeId).maybeSingle(),
      context.supabase
        .from("store_users")
        .select("role")
        .eq("store_id", data.storeId)
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("role", "platform_admin")
        .maybeSingle(),
    ]);

    const isOwner = Boolean(store && store.owner_id === context.userId);
    const isPlatformAdmin = Boolean(platformRole);
    const role = isOwner ? "owner" : (membership?.role ?? null);
    const allowed = isOwner || Boolean(membership) || isPlatformAdmin;

    const { logSecurityEvent } = await import("./access-guard.server");
    if (!allowed) {
      await logSecurityEvent({
        userId: context.userId,
        storeId: data.storeId,
        kind: "store_access_denied",
        severity: "warning",
        meta: { route: data.route },
      });
    }

    return {
      allowed,
      role,
      isPlatformAdmin,
      canManage: isOwner || (role !== null && MANAGER_ROLES.has(role)) || isPlatformAdmin,
    };
  });
