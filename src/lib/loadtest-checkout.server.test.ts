import { expect, it, vi } from "vitest";
import { handleLoadtestCheckout } from "./loadtest-checkout.server";

const secret = "staging-only-secret-32-characters-minimum";
const environment = {
  LOADTEST_ENABLED: "true",
  LOADTEST_ENVIRONMENT: "staging",
  LOADTEST_SECRET: secret,
};
const id = "10000000-0000-4000-8000-000000000001";
const variantId = "20000000-0000-4000-8000-000000000001";
const versions = [1, 2, 3].map((n) => `30000000-0000-4000-8000-00000000000${n}`);
const request = (body: unknown, token = secret) =>
  new Request("http://local/api/public/loadtest/cart", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
function fixture(testStore = true) {
  const filters: Array<[string, unknown]> = [];
  const db = {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: (field: string, value: unknown) => {
          filters.push([field, value]);
          return query;
        },
        gte: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: testStore ? { id } : null, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: table === "product_variants" ? [{ id: variantId }] : [],
            error: null,
          }).then(resolve),
      };
      return query;
    },
  };
  const place = vi.fn().mockResolvedValue({ orderNumber: "TEST-1" });
  return {
    filters,
    db,
    place,
    quote: vi.fn().mockResolvedValue({ ok: true }),
    options: vi.fn().mockResolvedValue({
      policies: { ready: true, versions: versions.map((versionId) => ({ versionId })) },
      shippingRates: [],
    }),
  };
}

it("G23: disabled, missing key and wrong authorization never touch the DB", async () => {
  const deps = fixture();
  for (const env of [
    {},
    { ...environment, LOADTEST_ENVIRONMENT: "production" },
    { ...environment, LOADTEST_SECRET: "short" },
  ])
    expect((await handleLoadtestCheckout(request({}), "cart", env, deps)).status).toBe(404);
  expect(
    (await handleLoadtestCheckout(request({}, "wrong"), "cart", environment, deps)).status,
  ).toBe(401);
  expect(deps.filters).toEqual([]);
  expect(deps.place).not.toHaveBeenCalled();
});

it("G23: normal stores cannot enter either test step", async () => {
  const deps = fixture(false);
  expect(
    (
      await handleLoadtestCheckout(
        request({ store: "real-store", quantity: 1 }),
        "cart",
        environment,
        deps,
      )
    ).status,
  ).toBe(404);
  expect(deps.filters).toContainEqual(["is_test", true]);
  expect(deps.options).not.toHaveBeenCalled();
});

it("G23: signed cart preserves exact lines and policies; checkout rechecks the test flag", async () => {
  const deps = fixture();
  const cart = await handleLoadtestCheckout(
    request({ store: "test-store-1", quantity: 2 }),
    "cart",
    environment,
    deps,
  );
  expect(cart.status).toBe(200);
  const { cartToken } = await cart.json();
  const result = await handleLoadtestCheckout(
    request({ cartToken, mode: "sandbox" }),
    "checkout",
    environment,
    deps,
  );
  expect(result.status).toBe(201);
  expect(await result.json()).toMatchObject({
    paymentStatus: "pending",
    paymentProviderCalled: false,
  });
  expect(deps.place).toHaveBeenCalledWith(
    expect.objectContaining({
      slug: "test-store-1",
      items: [{ variantId, quantity: 2 }],
      policyAccepted: true,
      policyVersionIds: versions,
    }),
    id,
  );
  expect(
    (
      await handleLoadtestCheckout(
        request({ cartToken, mode: "sandbox" }),
        "checkout",
        environment,
        fixture(false),
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await handleLoadtestCheckout(
        request({ cartToken: cartToken + "x", mode: "sandbox" }),
        "checkout",
        environment,
        deps,
      )
    ).status,
  ).toBe(401);
});

it("G23: stock failures and unpublished policies cannot count as orders", async () => {
  const deps = fixture();
  deps.options.mockResolvedValueOnce({ policies: { ready: false } });
  expect(
    (
      await handleLoadtestCheckout(
        request({ store: "test", quantity: 1 }),
        "cart",
        environment,
        deps,
      )
    ).status,
  ).toBe(422);
  deps.quote.mockResolvedValueOnce({ ok: false, error: "Yeterli stok yok" });
  expect(
    (
      await handleLoadtestCheckout(
        request({ store: "test", quantity: 1 }),
        "cart",
        environment,
        deps,
      )
    ).status,
  ).toBe(409);
  expect(deps.place).not.toHaveBeenCalled();
});
