import { getRequest } from "@tanstack/react-start/server";

import type { AuditAction } from "./audit";

type MinimalClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => Promise<{ error: unknown }>;
  };
};

export type AuditEntry = {
  action: AuditAction | string;
  storeId?: string | null;
  actorId?: string | null;
  entity?: string | null;
  entityId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
};

/** İstekten istemci IP'sini çıkarır (proxy başlıkları dahil). */
export function requestIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    null
  );
}

/**
 * Tek merkezden denetim kaydı yazar; kullanıcı, IP, user-agent, entity ve
 * eski/yeni değerleri birlikte saklar. Audit yazımı asıl işlemi bozmamalıdır,
 * bu yüzden hatalar yalnızca loglanır.
 */
export async function recordAudit(client: unknown, entry: AuditEntry): Promise<void> {
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const request = getRequest();
    ip = requestIp(request);
    userAgent = request.headers.get("user-agent");
  } catch {
    // İstek bağlamı yoksa (cron, worker) IP bilgisi olmadan yazmaya devam et.
  }

  try {
    const { error } = await (client as MinimalClient).from("audit_logs").insert({
      store_id: entry.storeId ?? null,
      actor_id: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity ?? null,
      entity_id: entry.entityId ?? null,
      old_value: entry.oldValue ?? null,
      new_value: entry.newValue ?? null,
      ip,
      user_agent: userAgent,
    });
    if (error) console.error("audit_logs insert failed", error);
  } catch (error) {
    console.error("audit_logs insert threw", error);
  }
}

/**
 * Ham audit_logs kolon payload'ını yazar ve her kayda istekten çıkarılan
 * IP + user-agent bilgisini ekler. Mevcut çağrı noktaları bu yolu kullanır.
 */
export async function insertAuditRow(
  client: unknown,
  row: Record<string, unknown>,
): Promise<void> {
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const request = getRequest();
    ip = requestIp(request);
    userAgent = request.headers.get("user-agent");
  } catch {
    // İstek bağlamı yok (cron/worker).
  }
  try {
    const { error } = await (client as MinimalClient)
      .from("audit_logs")
      .insert({ ip, user_agent: userAgent, ...row });
    if (error) console.error("audit_logs insert failed", error);
  } catch (error) {
    console.error("audit_logs insert threw", error);
  }
}

