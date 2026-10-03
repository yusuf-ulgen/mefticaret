import { createFileRoute } from "@tanstack/react-router";

import { homeMakerHead } from "@/lib/home-maker-i18n";
import { HomeMakerAuthPage } from "@/routes/ev-hanimlari.index";

export const Route = createFileRoute("/en/ev-hanimlari")({
  head: () => homeMakerHead("en"),
  component: () => <HomeMakerAuthPage locale="en" />,
});
