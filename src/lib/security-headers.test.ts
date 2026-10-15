import { expect, it } from "vitest";
import { contentSecurityPolicy } from "./security-headers";

it("G26: local Supabase HTTP/WebSocket works only in development CSP", () => {
  expect(contentSecurityPolicy(true)).toContain("http://127.0.0.1:*");
  expect(contentSecurityPolicy(true)).toContain("ws://localhost:*");
  expect(contentSecurityPolicy(false)).not.toContain("http:");
  expect(contentSecurityPolicy(false)).not.toContain("ws:");
});
