export function receiptReading(parsed: unknown, expected: number) {
  const data = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const amount =
    typeof data["amount"] === "number" && Number.isFinite(data["amount"]) && data["amount"] >= 0
      ? data["amount"]
      : null;
  const isReceipt = data["is_receipt"] === true && amount !== null;
  const matches = isReceipt && amount !== null && Math.abs(amount - expected) <= 0.5;
  return {
    amount,
    status: !isReceipt ? "unreadable" : matches ? "pending_review" : "mismatch",
    matches,
  };
}
