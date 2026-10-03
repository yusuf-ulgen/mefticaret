import { createFileRoute } from "@tanstack/react-router";

import { homeMakerHead } from "@/lib/home-maker-i18n";
import { HomeMakerAuthPage } from "@/components/home-maker-auth-page";

export const Route = createFileRoute("/fr/ev-hanimlari")({
  head: () => homeMakerHead("fr"),
  component: () => <HomeMakerAuthPage locale="fr" />,
});
