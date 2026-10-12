import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ChatApp } from "@/components/chat/chat-app";

export const Route = createFileRoute("/_authenticated/mesajlar")({
  validateSearch: z.object({
    c: z.string().uuid().optional(),
    u: z
      .string()
      .regex(/^[a-z0-9_.]{3,24}$/i)
      .optional(),
  }),
  head: () => ({
    meta: [
      { title: "Mesajlar — Mefticaret" },
      { name: "description", content: "Mefticaret satıcıları, müşterileri ve destek ekibi için anlık mesajlaşma." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Mesajlar — Mefticaret" },
      { property: "og:description", content: "Mefticaret kullanıcıları için anlık mesajlaşma uygulaması." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MesajlarPage,
});

function MesajlarPage() {
  const { c, u } = Route.useSearch();
  return <ChatApp initialConversation={c} initialHandle={u?.toLowerCase()} />;
}
