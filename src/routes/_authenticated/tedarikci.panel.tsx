import { createFileRoute } from "@tanstack/react-router";

import { guardPortal } from "@/lib/portal-guard";

export const Route = createFileRoute("/_authenticated/tedarikci/panel")({
  head: () => ({ meta: [{ title: "Tedarikçi Paneli — Mefticaret" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => guardPortal("supplier"),
});
