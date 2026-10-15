import { createFileRoute } from "@tanstack/react-router";
import { handleLoadtestCheckout } from "@/lib/loadtest-checkout.server";

export const Route = createFileRoute("/api/public/loadtest/cart")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => handleLoadtestCheckout(request, "cart"),
      POST: ({ request }) => handleLoadtestCheckout(request, "cart"),
    },
  },
});
