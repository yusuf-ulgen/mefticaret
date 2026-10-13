export const CHECKOUT_POLICY_KEYS = ["privacy", "distance_selling", "refund"] as const;
export function samePolicyVersions(expected: string[], accepted: string[] | undefined) {
  return (
    expected.length === 3 &&
    accepted?.length === 3 &&
    new Set(accepted).size === 3 &&
    expected.every((id) => accepted.includes(id))
  );
}
