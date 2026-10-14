export function supplierOwnsItem(
  supplierId: string,
  itemId: string,
  snapshots: Array<{ order_item_id: string; supplier_id: string }>,
) {
  return snapshots.some(
    (snapshot) => snapshot.order_item_id === itemId && snapshot.supplier_id === supplierId,
  );
}

/** A legacy commission is evidence only for the exact order and line it names. */
export function supplierOwnershipWithHistory(
  items: Array<{ id: string; order_id: string }>,
  snapshots: Array<{ order_item_id: string; supplier_id: string }>,
  commissions: Array<{ order_item_id: string | null; supplier_id: string; order_id: string }>,
) {
  const recovered = [...snapshots];
  for (const item of items) {
    if (snapshots.some((row) => row.order_item_id === item.id)) continue;
    const suppliers = [
      ...new Set(
        commissions
          .filter((row) => row.order_item_id === item.id && row.order_id === item.order_id)
          .map((row) => row.supplier_id),
      ),
    ];
    if (suppliers.length === 1)
      recovered.push({ order_item_id: item.id, supplier_id: suppliers[0]! });
  }
  return recovered;
}
