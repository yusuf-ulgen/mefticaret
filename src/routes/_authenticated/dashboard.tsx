import { createFileRoute } from "@tanstack/react-router";

import { guardPortal } from "@/lib/portal-guard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Satıcı Paneli — Mefticaret" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => guardPortal("merchant"),
});
