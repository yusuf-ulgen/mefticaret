import { createFileRoute } from "@tanstack/react-router";
import { handleLoadtestCheckout } from "@/lib/loadtest-checkout.server";

export const Route = createFileRoute("/api/public/loadtest/checkout")({
  server: {
    handlers: {
      POST: ({ request }) => handleLoadtestCheckout(request, "checkout"),
    },
  },
});
