import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Panel erişim kapıları.
 *
 * Yetki her zaman sunucuda, oturum token'ından çözülen kullanıcı kimliği ile
 * veritabanından okunur. İstemciden gelen rol/`platform_admin` gibi değerler
 * hiçbir zaman dikkate alınmaz. Reddedilen denemeler denetim kaydına yazılır.
 *
 * Oturum yoksa 500 üretmemek için kimlik burada çözülür ve erişim reddedilir.
 */

const MANAGER_ROLES = new Set(["owner", "admin"]);

/** Süper admin (platform) erişimi. */
export const checkPlatformAdminAccess = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ route: z.string().trim().max(300).default("/admin") }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, logSecurityEvent } = await import("./access-guard.server");
    const caller = await resolveCaller();
    if (!caller) return { allowed: false };

    const { data: row, error } = await caller.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.userId)
      .eq("role", "platform_admin")
      .maybeSingle();
    if (error) return { allowed: false };
    const allowed = Boolean(row);

    await logSecurityEvent({
      userId: caller.userId,
      kind: allowed ? "platform_admin_access" : "platform_admin_access_denied",
      severity: allowed ? "info" : "warning",
      meta: { route: data.route },
    });

    return { allowed };
  });

/** Mağaza paneli erişimi: üyelik veya platform yöneticiliği zorunlu. */
export const checkStoreAccess = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: z.string().trim().max(100),
        route: z.string().trim().max(300).default(""),
        expectedKind: z.enum(["corporate", "micro"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const denied = { allowed: false, role: null, isPlatformAdmin: false, canManage: false };
    // Geçersiz mağaza kimliği: hata fırlatmak yerine erişimi reddet (boş ekran olmasın).
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.storeId);
    if (!isUuid) return denied;

    const { resolveCaller, logSecurityEvent } = await import("./access-guard.server");
    const caller = await resolveCaller();
    if (!caller) return denied;

    const [{ data: store }, { data: membership }, { data: platformRole }] = await Promise.all([
      caller.supabase.from("stores").select("id, owner_id, store_kind").eq("id", data.storeId).maybeSingle(),
      caller.supabase
        .from("store_users")
        .select("role")
        .eq("store_id", data.storeId)
        .eq("user_id", caller.userId)
        .maybeSingle(),
      caller.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.userId)
        .eq("role", "platform_admin")
        .maybeSingle(),
    ]);

    const isOwner = Boolean(store && store.owner_id === caller.userId);
    const isPlatformAdmin = Boolean(platformRole);
    const role = isOwner ? "owner" : (membership?.role ?? null);
    const kindMatches = !data.expectedKind || store?.store_kind === data.expectedKind;
    const allowed = kindMatches && (isOwner || Boolean(membership) || isPlatformAdmin);

    if (!allowed) {
      await logSecurityEvent({
        userId: caller.userId,
        storeId: data.storeId,
        kind: "store_access_denied",
        severity: "warning",
        meta: { route: data.route, expectedKind: data.expectedKind, actualKind: store?.store_kind ?? null },
      });
    }

    return {
      allowed,
      role,
      isPlatformAdmin,
      canManage: allowed && (isOwner || (role !== null && MANAGER_ROLES.has(role)) || isPlatformAdmin),
      storeKind: store?.store_kind ?? null,
    };
  });
