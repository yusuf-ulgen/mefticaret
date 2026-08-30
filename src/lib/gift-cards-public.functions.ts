import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Vitrin: hediye kartı bakiye sorgulama (oturum gerektirmez). */
export const checkGiftCardBalance = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        slug: z.string().trim().min(1).max(80),
        code: z.string().trim().min(4).max(40),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { lookupGiftCardBalance } = await import("@/lib/gift-cards-balance.server");
    return lookupGiftCardBalance(data.slug, data.code);
  });
