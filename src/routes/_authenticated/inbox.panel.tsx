import { createFileRoute } from "@tanstack/react-router";

import { guardPortal } from "@/lib/portal-guard";

export const Route = createFileRoute("/_authenticated/inbox/panel")({
  head: () => ({ meta: [{ title: "Mesaj Paneli — Mefticaret" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => guardPortal("inbox"),
});
