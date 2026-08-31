/** Personel performansı: sipariş olayları ve denetim kayıtlarından üretkenlik analizi. */

export type TeamEventInput = {
  id: string;
  actorId: string | null;
  kind: string;
  createdAt: string;
  orderId: string;
};

export type TeamAuditInput = {
  id: string;
  actorId: string | null;
  action: string;
  entity: string | null;
  createdAt: string;
};

export type TeamMemberInput = {
  userId: string;
  role: string;
  invitedEmail: string | null;
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "Sahip",
  admin: "Yönetici",
  manager: "Müdür",
  staff: "Personel",
  support: "Destek",
  viewer: "İzleyici",
};

const FULFILLMENT_KINDS = new Set([
  "fulfilled",
  "shipped",
  "shipment_created",
  "delivered",
  "packed",
]);

const RESOLUTION_KINDS = new Set(["refunded", "cancelled", "return_resolved", "note"]);

export type TeamMemberStat = {
  actorId: string;
  label: string;
  role: string;
  roleLabel: string;
  orderEvents: number;
  auditActions: number;
  totalActions: number;
  fulfillmentActions: number;
  resolutionActions: number;
  ordersTouched: number;
  activeDays: number;
  actionsPerActiveDay: number;
  lastActiveAt: string | null;
  share: number;
};

export type TeamDayPoint = { day: string; orderEvents: number; auditActions: number };

export type TeamActionRow = { action: string; count: number; share: number };

export type TeamAnalysis = {
  members: TeamMemberStat[];
  byDay: TeamDayPoint[];
  topActions: TeamActionRow[];
  summary: {
    activeMembers: number;
    idleMembers: number;
    totalActions: number;
    fulfillmentActions: number;
    ordersTouched: number;
    avgActionsPerMember: number;
  };
};

const dayKey = (iso: string) => iso.slice(0, 10);

const shortId = (id: string) => `${id.slice(0, 8)}…`;

export function analyzeTeamPerformance(
  events: TeamEventInput[],
  audits: TeamAuditInput[],
  members: TeamMemberInput[],
): TeamAnalysis {
  const byActor = new Map<
    string,
    {
      orderEvents: number;
      auditActions: number;
      fulfillmentActions: number;
      resolutionActions: number;
      orders: Set<string>;
      days: Set<string>;
      lastActiveAt: string | null;
    }
  >();

  const ensure = (actorId: string) => {
    let entry = byActor.get(actorId);
    if (!entry) {
      entry = {
        orderEvents: 0,
        auditActions: 0,
        fulfillmentActions: 0,
        resolutionActions: 0,
        orders: new Set<string>(),
        days: new Set<string>(),
        lastActiveAt: null,
      };
      byActor.set(actorId, entry);
    }
    return entry;
  };

  const touch = (entry: ReturnType<typeof ensure>, createdAt: string) => {
    entry.days.add(dayKey(createdAt));
    if (!entry.lastActiveAt || createdAt > entry.lastActiveAt) entry.lastActiveAt = createdAt;
  };

  const dayMap = new Map<string, TeamDayPoint>();
  const ensureDay = (day: string) => {
    let point = dayMap.get(day);
    if (!point) {
      point = { day, orderEvents: 0, auditActions: 0 };
      dayMap.set(day, point);
    }
    return point;
  };

  const actionMap = new Map<string, number>();

  for (const event of events) {
    ensureDay(dayKey(event.createdAt)).orderEvents += 1;
    actionMap.set(event.kind, (actionMap.get(event.kind) ?? 0) + 1);
    if (!event.actorId) continue;
    const entry = ensure(event.actorId);
    entry.orderEvents += 1;
    entry.orders.add(event.orderId);
    if (FULFILLMENT_KINDS.has(event.kind)) entry.fulfillmentActions += 1;
    if (RESOLUTION_KINDS.has(event.kind)) entry.resolutionActions += 1;
    touch(entry, event.createdAt);
  }

  for (const audit of audits) {
    ensureDay(dayKey(audit.createdAt)).auditActions += 1;
    actionMap.set(audit.action, (actionMap.get(audit.action) ?? 0) + 1);
    if (!audit.actorId) continue;
    const entry = ensure(audit.actorId);
    entry.auditActions += 1;
    touch(entry, audit.createdAt);
  }

  const roleOf = new Map(members.map((member) => [member.userId, member]));

  const rawMembers: TeamMemberStat[] = [];
  const actorIds = new Set<string>([...byActor.keys(), ...members.map((m) => m.userId)]);

  for (const actorId of actorIds) {
    const stat = byActor.get(actorId);
    const member = roleOf.get(actorId);
    const orderEvents = stat?.orderEvents ?? 0;
    const auditActions = stat?.auditActions ?? 0;
    const activeDays = stat?.days.size ?? 0;
    const totalActions = orderEvents + auditActions;
    const role = member?.role ?? "unknown";
    rawMembers.push({
      actorId,
      label: member?.invitedEmail ?? shortId(actorId),
      role,
      roleLabel: ROLE_LABELS[role] ?? "Bilinmiyor",
      orderEvents,
      auditActions,
      totalActions,
      fulfillmentActions: stat?.fulfillmentActions ?? 0,
      resolutionActions: stat?.resolutionActions ?? 0,
      ordersTouched: stat?.orders.size ?? 0,
      activeDays,
      actionsPerActiveDay: activeDays ? totalActions / activeDays : 0,
      lastActiveAt: stat?.lastActiveAt ?? null,
      share: 0,
    });
  }

  const totalActions = rawMembers.reduce((sum, member) => sum + member.totalActions, 0);
  for (const member of rawMembers) {
    member.share = totalActions ? member.totalActions / totalActions : 0;
  }
  rawMembers.sort((a, b) => b.totalActions - a.totalActions || a.label.localeCompare(b.label));

  const totalActionEvents = [...actionMap.values()].reduce((sum, value) => sum + value, 0);
  const topActions = [...actionMap.entries()]
    .map(([action, count]) => ({
      action,
      count,
      share: totalActionEvents ? count / totalActionEvents : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const activeMembers = rawMembers.filter((member) => member.totalActions > 0).length;

  return {
    members: rawMembers,
    byDay: [...dayMap.values()].sort((a, b) => a.day.localeCompare(b.day)),
    topActions,
    summary: {
      activeMembers,
      idleMembers: rawMembers.length - activeMembers,
      totalActions,
      fulfillmentActions: rawMembers.reduce((sum, member) => sum + member.fulfillmentActions, 0),
      ordersTouched: new Set(
        events.filter((event) => event.actorId).map((event) => event.orderId),
      ).size,
      avgActionsPerMember: activeMembers ? totalActions / activeMembers : 0,
    },
  };
}
