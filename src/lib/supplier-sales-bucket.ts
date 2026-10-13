export function supplierSalesBucket(value: string, period: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = `${part("year")}-${part("month")}-${part("day")}`;
  return period === "yearly"
    ? part("year")
    : period === "monthly"
      ? day.slice(0, 7)
      : period === "hourly"
        ? `${day} ${part("hour")}:00`
        : day;
}
