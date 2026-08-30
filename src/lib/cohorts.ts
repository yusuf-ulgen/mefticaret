/**
 * Kohort analizi: müşterilerin ilk sipariş ayına göre gruplanıp
 * sonraki aylarda geri dönüş (retention) oranlarının hesaplanması.
 * Saf fonksiyonlardır; veri erişimi yapmaz.
 */

export type CohortOrder = {
  placed_at: string | null;
  created_at: string;
  grand_total: number | string;
  customer_id?: string | null;
  customer_email?: string | null;
};

export type CohortRow = {
  cohort: string;
  size: number;
  revenue: number;
  cells: { index: number; customers: number; rate: number; revenue: number }[];
};

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function monthDiff(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty ?? 0) * 12 + (tm ?? 0) - ((fy ?? 0) * 12 + (fm ?? 0));
}

/** Müşteri kimliği: customer_id yoksa e-posta ile eşleştirilir. */
function identity(order: CohortOrder) {
  const id = order.customer_id ? String(order.customer_id) : "";
  if (id) return `id:${id}`;
  const email = (order.customer_email ?? "").trim().toLocaleLowerCase("tr");
  return email ? `mail:${email}` : "";
}

/** Aylık kohort matrisi üretir. months = gösterilecek maksimum ay sütunu. */
export function buildCohorts(orders: CohortOrder[], months = 6): CohortRow[] {
  type Entry = { first: string; months: Map<string, number> };
  const customers = new Map<string, Entry>();

  for (const order of orders) {
    const key = identity(order);
    if (!key) continue;
    const month = monthKey(order.placed_at ?? order.created_at);
    const amount = Number(order.grand_total ?? 0);
    const entry = customers.get(key);
    if (!entry) {
      customers.set(key, { first: month, months: new Map([[month, amount]]) });
      continue;
    }
    if (month < entry.first) entry.first = month;
    entry.months.set(month, (entry.months.get(month) ?? 0) + amount);
  }

  const cohorts = new Map<string, { members: Entry[] }>();
  for (const entry of customers.values()) {
    const bucket = cohorts.get(entry.first) ?? { members: [] };
    bucket.members.push(entry);
    cohorts.set(entry.first, bucket);
  }

  return [...cohorts.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([cohort, bucket]) => {
      const size = bucket.members.length;
      const cells: CohortRow["cells"] = [];
      let revenue = 0;
      for (let index = 0; index < months; index += 1) {
        let active = 0;
        let cellRevenue = 0;
        for (const member of bucket.members) {
          for (const [month, amount] of member.months) {
            if (monthDiff(cohort, month) !== index) continue;
            active += 1;
            cellRevenue += amount;
            break;
          }
        }
        // Ciro için tüm siparişleri say (aynı ayda birden fazla sipariş dahil).
        cellRevenue = bucket.members.reduce((sum, member) => {
          let total = 0;
          for (const [month, amount] of member.months) {
            if (monthDiff(cohort, month) === index) total += amount;
          }
          return sum + total;
        }, 0);
        revenue += cellRevenue;
        cells.push({
          index,
          customers: active,
          rate: size > 0 ? active / size : 0,
          revenue: cellRevenue,
        });
      }
      return { cohort, size, revenue, cells };
    });
}

/** Kohort sütunlarının ortalama tutundurma oranı. */
export function averageRetention(rows: CohortRow[], months = 6) {
  const totals = new Array(months).fill(0) as number[];
  const counts = new Array(months).fill(0) as number[];
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.index >= months) continue;
      // Yalnızca o ay için verisi olabilecek (yeterince eski) kohortları say.
      totals[cell.index] = (totals[cell.index] ?? 0) + cell.rate;
      counts[cell.index] = (counts[cell.index] ?? 0) + 1;
    }
  }
  return totals.map((total, index) => (counts[index] ? total / (counts[index] as number) : 0));
}

/** Isı haritası için 0-1 oranını Tailwind opaklık sınıfına çevirir. */
export function heatClass(rate: number) {
  if (rate <= 0) return "bg-muted text-muted-foreground";
  if (rate < 0.1) return "bg-primary/10";
  if (rate < 0.2) return "bg-primary/20";
  if (rate < 0.35) return "bg-primary/40 text-primary-foreground";
  if (rate < 0.5) return "bg-primary/60 text-primary-foreground";
  return "bg-primary text-primary-foreground";
}
