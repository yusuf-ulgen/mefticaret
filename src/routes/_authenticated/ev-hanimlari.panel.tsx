import { createFileRoute } from "@tanstack/react-router";

import { guardPortal } from "@/lib/portal-guard";

export const Route = createFileRoute("/_authenticated/ev-hanimlari/panel")({
  head: () => ({ meta: [{ title: "Ev Hanımları Paneli — Mefticaret" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => guardPortal("handmade"),
});
