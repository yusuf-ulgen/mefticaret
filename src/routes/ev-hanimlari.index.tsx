import { createFileRoute } from "@tanstack/react-router";

import { HomeMakerAuthPage } from "@/components/home-maker-auth-page";
import { homeMakerHead } from "@/lib/home-maker-i18n";

export const Route = createFileRoute("/ev-hanimlari/")({
  head: () => homeMakerHead("tr"),
  component: () => <HomeMakerAuthPage locale="tr" />,
});

