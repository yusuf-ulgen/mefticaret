/**
 * Merkezi sunucu tarafı yetkilendirme katmanı.
 *
 * Tek yetki kaynağı veritabanıdır: istemciden gelen `role`, `permissions`,
 * `platform_admin`, `is_super_admin` gibi alanlar hiçbir zaman dikkate alınmaz.
 * Platform yöneticiliği yalnızca `user_roles` tablosunda tutulur; mağaza
 * üyeliği yalnızca `stores.owner_id` ve `store_users` üzerinden okunur.
 *
 * Bu modül `.server.ts` olduğu için istemci paketine hiç girmez.
 */

import { logSecurityEvent, resolveCaller } from "./access-guard.server";

export type Caller = NonNullable<Awaited<ReturnType<typeof resolveCaller>>>;

/** Mağaza içi yönetim yetkisine sahip roller. */
const MANAGE_ROLES = new Set(["owner", "admin", "manager"]);

/** Rol → izin haritası. Mağaza dışına çıkan hiçbir izin tanımlanmaz. */
const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  owner: ["*"],
  admin: ["*"],
  manager: [
    "catalog.read",
    "catalog.write",
    "orders.read",
    "orders.write",
    "customers.read",
    "marketing.write",
    "seo.write",
    "pricing.write",
    "theme.write",
    "settings.read",
  ],
  staff: ["catalog.read", "orders.read", "orders.write", "customers.read"],
  marketing: ["catalog.read", "marketing.write", "seo.write", "customers.read"],
  marketing_manager: ["catalog.read", "marketing.write", "seo.write", "customers.read"],
  support: ["orders.read", "customers.read", "support.write"],
  seo_manager: ["catalog.read", "seo.write"],
  pricing_manager: ["catalog.read", "pricing.write"],
  translator: ["catalog.read", "translation.write"],
};

export class AuthzError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthzError";
    this.status = status;
  }
}

/** Oturum sahibini çözer; oturum yoksa 401 üretir. */
export async function requireCaller(): Promise<Caller> {
  const caller = await resolveCaller();
  if (!caller) throw new AuthzError("Oturum bulunamadı", 401);
  return caller;
}

/** Kullanıcının platform yöneticisi olup olmadığını veritabanından okur. */
export async function isPlatformAdmin(caller?: Caller | null): Promise<boolean> {
  const resolved = caller ?? (await resolveCaller());
  if (!resolved) return false;
  const { data, error } = await resolved.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", resolved.userId)
    .eq("role", "platform_admin")
    .maybeSingle();
  return !error && Boolean(data);
}

/** Platform yöneticisi zorunlu. Reddedilen denemeler denetim kaydına yazılır. */
export async function requirePlatformAdmin(route = ""): Promise<Caller> {
  const caller = await resolveCaller();
  if (!caller) {
    await logSecurityEvent({
      userId: null,
      kind: "unauthorized_api_request",
      severity: "warning",
      meta: { route },
    });
    throw new AuthzError("Oturum bulunamadı", 401);
  }
  if (!(await isPlatformAdmin(caller))) {
    await logSecurityEvent({
      userId: caller.userId,
      kind: "admin_access_denied",
      severity: "warning",
      meta: { route },
    });
    throw new AuthzError("Bu alana yalnızca platform yöneticisi erişebilir", 403);
  }
  return caller;
}

export type StoreAccess = {
  caller: Caller;
  storeId: string;
  role: string | null;
  isOwner: boolean;
  isPlatformAdmin: boolean;
  canManage: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mağaza üyeliği zorunlu. Başka mağaza kimliği yazan kullanıcı 403 alır. */
export async function requireStoreMember(storeId: string, route = ""): Promise<StoreAccess> {
  if (!UUID.test(storeId)) throw new AuthzError("Geçersiz mağaza kimliği", 403);
  const caller = await resolveCaller();
  if (!caller) throw new AuthzError("Oturum bulunamadı", 401);

  const [{ data: store }, { data: membership }] = await Promise.all([
    caller.supabase.from("stores").select("id, owner_id").eq("id", storeId).maybeSingle(),
    caller.supabase
      .from("store_users")
      .select("role")
      .eq("store_id", storeId)
      .eq("user_id", caller.userId)
      .maybeSingle(),
  ]);

  const platformAdmin = await isPlatformAdmin(caller);
  const isOwner = Boolean(store && store.owner_id === caller.userId);
  const role = isOwner ? "owner" : ((membership?.role as string | undefined) ?? null);

  if (!isOwner && !membership && !platformAdmin) {
    await logSecurityEvent({
      userId: caller.userId,
      storeId,
      kind: "cross_tenant_access_attempt",
      severity: "warning",
      meta: { route },
    });
    throw new AuthzError("Bu mağazaya erişim yetkiniz yok", 403);
  }

  return {
    caller,
    storeId,
    role,
    isOwner,
    isPlatformAdmin: platformAdmin,
    canManage: isOwner || platformAdmin || (role !== null && MANAGE_ROLES.has(role)),
  };
}

/** Belirli mağaza rollerinden biri zorunlu. */
export async function requireStoreRole(
  storeId: string,
  roles: readonly string[],
  route = "",
): Promise<StoreAccess> {
  const access = await requireStoreMember(storeId, route);
  if (access.isPlatformAdmin || access.isOwner) return access;
  if (!access.role || !roles.includes(access.role)) {
    await logSecurityEvent({
      userId: access.caller.userId,
      storeId,
      kind: "store_access_denied",
      severity: "warning",
      meta: { route, needed: roles, role: access.role },
    });
    throw new AuthzError("Bu işlem için yetkiniz yok", 403);
  }
  return access;
}

/** Rol tabanlı izin kontrolü. */
export async function requireStorePermission(
  storeId: string,
  permission: string,
  route = "",
): Promise<StoreAccess> {
  const access = await requireStoreMember(storeId, route);
  if (access.isPlatformAdmin || access.isOwner) return access;
  const granted = access.role ? (ROLE_PERMISSIONS[access.role] ?? []) : [];
  if (!granted.includes("*") && !granted.includes(permission)) {
    await logSecurityEvent({
      userId: access.caller.userId,
      storeId,
      kind: "store_access_denied",
      severity: "warning",
      meta: { route, permission, role: access.role },
    });
    throw new AuthzError("Bu işlem için yetkiniz yok", 403);
  }
  return access;
}

/**
 * IDOR koruması: bir kaydın gerçekten ilgili mağazaya ait olduğunu doğrular.
 * Servis rolü kullanan akışlarda dahi bu kontrol atlanmamalıdır.
 */
export async function assertRowBelongsToStore(
  table: string,
  id: string,
  storeId: string,
): Promise<void> {
  if (!UUID.test(storeId)) throw new AuthzError("Geçersiz mağaza kimliği", 403);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => {
          maybeSingle: () => Promise<{ data: { store_id: string } | null; error: unknown }>;
        };
      };
    };
  })
    .from(table)
    .select("store_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data || data.store_id !== storeId) {
    await logSecurityEvent({
      userId: null,
      storeId,
      kind: "cross_tenant_access_attempt",
      severity: "warning",
      meta: { table, id },
    });
    throw new AuthzError("Kayıt bu mağazaya ait değil", 403);
  }
}

/** İstemciden gelen yetki alanlarını gövdeden temizler ve denemeyi kaydeder. */
export async function stripPrivilegeFields<T extends Record<string, unknown>>(
  payload: T,
  context: { userId?: string | null; storeId?: string | null } = {},
): Promise<T> {
  const forbidden = [
    "platform_admin",
    "is_platform_admin",
    "is_super_admin",
    "super_admin",
    "role",
    "roles",
    "permissions",
  ];
  const clone = { ...payload } as Record<string, unknown>;
  const attempted = forbidden.filter((key) => key in clone);
  for (const key of attempted) delete clone[key];
  if (attempted.length > 0) {
    await logSecurityEvent({
      userId: context.userId ?? null,
      storeId: context.storeId ?? null,
      kind: "privilege_escalation_attempt",
      severity: "critical",
      meta: { fields: attempted },
    });
  }
  return clone as T;
}
