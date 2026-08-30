import { createServerFn } from "@tanstack/react-start";

import { stockAlertSchema, subscribeStockAlert } from "@/lib/stock-alerts.server";

export const createStockAlert = createServerFn({ method: "POST" })
  .inputValidator((data) => stockAlertSchema.parse(data))
  .handler(async ({ data }) => subscribeStockAlert(data));
