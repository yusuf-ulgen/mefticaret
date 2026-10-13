import { expect, it, vi } from "vitest";
import { retryableModule } from "./retryable-module";
it("shares concurrent startup and allows the next request after a failed module load", async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error("startup failed"))
    .mockResolvedValue({ ready: true });
  const get = retryableModule(load);
  const first = get();
  expect(get()).toBe(first);
  await expect(first).rejects.toThrow("startup failed");
  await expect(get()).resolves.toEqual({ ready: true });
  await get();
  expect(load).toHaveBeenCalledTimes(2);
});
