import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const contract = "test_store_pending_order";
const cartSchema = z.object({
  store: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(3),
  variantId: z.guid().optional(),
});
const tokenSchema = z.object({
  store: z.string(),
  storeId: z.guid(),
  variantId: z.guid(),
  quantity: z.number().int().min(1).max(3),
  shippingRateId: z.guid().optional(),
  policyVersionIds: z.array(z.guid()).length(3),
  expires: z.number(),
});
type Cart = z.infer<typeof tokenSchema>;
type Dependencies = {
  db: { from: (table: string) => any };
  options: (input: { slug: string }) => Promise<any>;
  quote: (input: any) => Promise<any>;
  place: (input: any, testStoreId: string) => Promise<any>;
};
const equal = (a: string, b: string) =>
  timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
const sign = (payload: string, key: string) =>
  createHmac("sha256", key).update(payload).digest("base64url");

/** Disabled by default. Authorization precedes database and checkout module loading. */
export async function handleLoadtestCheckout(
  request: Request,
  step: "cart" | "checkout",
  environment = process.env,
  dependencies?: Dependencies,
) {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  const key = environment["LOADTEST_SECRET"];
  if (
    environment["LOADTEST_ENABLED"] !== "true" ||
    environment["LOADTEST_ENVIRONMENT"] !== "staging" ||
    !key ||
    key.length < 32
  )
    return reply({ error: "Not found" }, 404);
  const bearer = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!bearer || !equal(bearer, key)) return reply({ error: "Unauthorized" }, 401);
  if (request.method === "OPTIONS") return reply({ contract, paymentProviderCalled: false });

  try {
    const raw = await request.text();
    if (raw.length > 8192) return reply({ error: "Request too large" }, 413);
    const body = JSON.parse(raw);
    const deps = dependencies ?? (await loadDependencies());
    let cart: Cart;
    if (step === "cart") {
      const input = cartSchema.parse(body);
      const store = await testStore(deps.db, input.store);
      if (!store) return reply({ error: "Test store not found" }, 404);
      let query = deps.db
        .from("product_variants")
        .select("id, products!inner(status)")
        .eq("store_id", store.id)
        .eq("products.status", "active")
        .gte("stock", input.quantity)
        .order("id")
        .limit(1);
      if (input.variantId) query = query.eq("id", input.variantId);
      const { data: variants, error } = await query;
      if (error) throw new Error(error.message);
      if (!variants?.length) return reply({ error: "insufficient_stock" }, 409);
      const options = await deps.options({ slug: input.store });
      if (!options?.policies.ready)
        return reply({ error: "Publish test-store policies first" }, 422);
      cart = tokenSchema.parse({
        store: input.store,
        storeId: store.id,
        variantId: variants[0].id,
        quantity: input.quantity,
        shippingRateId: options.shippingRates[0]?.id,
        policyVersionIds: options.policies.versions.map(
          (policy: { versionId: string }) => policy.versionId,
        ),
        expires: Date.now() + 300_000,
      });
      const quote = await deps.quote({
        slug: cart.store,
        items: [{ variantId: cart.variantId, quantity: cart.quantity }],
        shippingRateId: cart.shippingRateId,
      });
      if (!quote.ok)
        return reply({ error: quote.error }, /stok/i.test(quote.error ?? "") ? 409 : 422);
      const payload = Buffer.from(JSON.stringify(cart)).toString("base64url");
      return reply({ contract, cartToken: `${payload}.${sign(payload, key)}`, quote });
    }

    const input = z
      .object({ cartToken: z.string().max(6000), mode: z.literal("sandbox") })
      .parse(body);
    const [payload, signature, extra] = input.cartToken.split(".");
    if (!payload || !signature || extra || !equal(sign(payload, key), signature))
      return reply({ error: "Invalid cart token" }, 401);
    cart = tokenSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    if (cart.expires < Date.now()) return reply({ error: "Cart expired" }, 410);
    const store = await testStore(deps.db, cart.store);
    if (!store || store.id !== cart.storeId) return reply({ error: "Test store not found" }, 404);
    const result = await deps.place(
      {
        slug: cart.store,
        items: [{ variantId: cart.variantId, quantity: cart.quantity }],
        shippingRateId: cart.shippingRateId,
        policyAccepted: true,
        policyVersionIds: cart.policyVersionIds,
        customer: {
          fullName: "TEST Load",
          email: "loadtest@mefticaret.test",
          phone: "5000000000",
          acceptsMarketing: false,
        },
        address: { country: "TR", city: "İstanbul", line1: "TEST staging adresi" },
        note: "TEST k6: pending order, no payment provider",
      },
      cart.storeId,
    );
    return reply(
      { contract, ...result, paymentStatus: "pending", paymentProviderCalled: false },
      201,
    );
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return reply({ error: "Invalid request" }, 400);
    const message = error instanceof Error ? error.message : "Checkout failed";
    return reply({ error: message }, /stok|insufficient_stock/i.test(message) ? 409 : 500);
  }
}

async function testStore(db: Dependencies["db"], slug: string) {
  const { data, error } = await db
    .from("stores")
    .select("id")
    .eq("slug", slug)
    .eq("is_test", true)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function loadDependencies(): Promise<Dependencies> {
  const [{ supabaseAdmin }, checkout] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("@/lib/checkout.server"),
  ]);
  return {
    db: supabaseAdmin,
    options: checkout.loadCheckoutOptions,
    quote: checkout.quoteCheckout,
    place: (input, testStoreId) =>
      checkout.createStorefrontOrder(input, undefined, { testStoreId }),
  };
}
