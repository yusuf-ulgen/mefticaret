import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

/** /register → paylaşılan kimlik doğrulama ekranının kayıt sekmesi. */
export const Route = createFileRoute("/register")({
  validateSearch: z.object({ next: z.string().optional() }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/auth",
      search: { mode: "register" as const, ...(search.next ? { next: search.next } : {}) },
      replace: true,
    });
  },
});
