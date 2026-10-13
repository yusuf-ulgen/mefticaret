export type DeliveryItem = { id: string; title: string; quantity: number; is_digital: boolean };
export function physicalShipmentItems(
  items: DeliveryItem[],
  requested: Array<{ orderItemId: string; quantity: number }> = [],
) {
  const physical = items.filter((item) => !item.is_digital);
  if (!physical.length) throw new Error("Dijital sipariş için fiziksel sevkiyat oluşturulamaz");
  if (!requested.length)
    return physical.map((item) => ({ orderItemId: item.id, quantity: item.quantity }));
  const seen = new Set<string>();
  for (const line of requested) {
    const item = physical.find((row) => row.id === line.orderItemId);
    if (
      !item ||
      seen.has(line.orderItemId) ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > item.quantity
    )
      throw new Error("Sevkiyat kalemi veya adedi geçersiz");
    seen.add(line.orderItemId);
  }
  return requested;
}
