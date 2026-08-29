import { createServerFn } from "@tanstack/react-start";

import {
  checkoutOptionsSchema,
  createStorefrontOrder,
  loadCheckoutOptions,
  loadOrderStatus,
  orderStatusSchema,
  placeOrderSchema,
} from "@/lib/checkout.server";

export const getCheckoutOptions = createServerFn({ method: "GET" })
  .inputValidator((data) => checkoutOptionsSchema.parse(data))
  .handler(async ({ data }) => loadCheckoutOptions(data));

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => placeOrderSchema.parse(data))
  .handler(async ({ data }) => createStorefrontOrder(data));

export const getOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((data) => orderStatusSchema.parse(data))
  .handler(async ({ data }) => loadOrderStatus(data));
