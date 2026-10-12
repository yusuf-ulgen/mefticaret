export function supplierOwnsItem(
  supplierId: string,
  itemId: string,
  snapshots: Array<{ order_item_id: string; supplier_id: string }>,
) {
  return snapshots.some(
    (snapshot) => snapshot.order_item_id === itemId && snapshot.supplier_id === supplierId,
  );
}
