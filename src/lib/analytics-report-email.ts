import { formatMoney, formatNumber } from "@/lib/mefti";

type Row = { label: string; value: string };

/** Rapor verisini e-posta satırlarına çevirir. */
export function reportEmailRows(data: Record<string, any>, currency: string): { rows: Row[]; sections: { title: string; rows: Row[] }[] } {
  const m = (n: number) => formatMoney(Number(n) || 0, currency);
  const rows: Row[] = [];
  const sections: { title: string; rows: Row[] }[] = [];
  const ov = data["overview"];
  if (ov) {
    const c = ov.current;
    rows.push(
      { label: "Satış", value: m(c.revenue) },
      { label: "Sipariş", value: formatNumber(c.orders) },
      { label: "Ortalama sipariş", value: m(c.aov) },
      { label: "Ziyaretçi", value: formatNumber(c.visitors) },
      { label: "Dönüşüm", value: `%${(c.conversion_rate * 100).toFixed(1)}` },
    );
  }
  const p = data["products"];
  if (p) sections.push({ title: "En çok satan ürünler", rows: p.top.slice(0, 5).map((x: any) => ({ label: x.title, value: `${x.quantity} adet · ${m(x.revenue)}` })) });
  const f = data["funnel"];
  if (f) sections.push({ title: "Dönüşüm hunisi", rows: [
    { label: "Ziyaretçi", value: formatNumber(f.visitors) }, { label: "Sepete ekleme", value: formatNumber(f.add_to_cart) },
    { label: "Ödemeye geçiş", value: formatNumber(f.checkout) }, { label: "Satın alma", value: formatNumber(f.purchase) },
  ] });
  const c = data["customers"];
  if (c) sections.push({ title: "Müşteriler", rows: [
    { label: "Yeni", value: formatNumber(c.new) }, { label: "Geri dönen", value: formatNumber(c.returning) }, { label: "Ortalama yaşam değeri", value: m(c.ltv) },
    ...c.top.slice(0, 5).map((x: any) => ({ label: x.name || x.email || "Müşteri", value: m(x.spent) })),
  ] });
  const t = data["traffic"];
  if (t) sections.push({ title: "Trafik kanalları", rows: t.channels.map((x: any) => ({ label: x.channel, value: `${x.sessions} oturum` })) });
  return { rows, sections };
}
