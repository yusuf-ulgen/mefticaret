export function customerReturnTarget(returnTo: unknown): "checkout" | "account" {
  return returnTo === "checkout" ? "checkout" : "account";
}
