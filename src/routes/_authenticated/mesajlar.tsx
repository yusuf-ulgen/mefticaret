import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ChatApp } from "@/components/chat/chat-app";

export const Route = createFileRoute("/_authenticated/mesajlar")({
  validateSearch: z.object({ c: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Mesajlar — Mefticaret" },
      { name: "description", content: "Satıcılar, müşteriler ve Mefticaret destek ekibiyle anlık mesajlaşma." },
      { property: "og:title", content: "Mesajlar — Mefticaret" },
      { property: "og:description", content: "Satıcılar, müşteriler ve destek ekibiyle anlık mesajlaşma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { c } = Route.useSearch();
  return <ChatApp initialConversation={c} />;
}
