export function cartQuantity(requested: number, stock: number): number {
  if (!Number.isFinite(requested) || !Number.isFinite(stock)) return 0;
  return Math.max(0, Math.min(Math.floor(requested), Math.max(0, Math.floor(stock))));
}
