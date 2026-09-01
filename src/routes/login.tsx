import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

/** /login → paylaşılan kimlik doğrulama ekranının giriş sekmesi. */
export const Route = createFileRoute("/login")({
  validateSearch: z.object({ next: z.string().optional() }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/auth",
      search: { mode: "login" as const, ...(search.next ? { next: search.next } : {}) },
      replace: true,
    });
  },
});
