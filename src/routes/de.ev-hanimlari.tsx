import { createFileRoute } from "@tanstack/react-router";

import { homeMakerHead } from "@/lib/home-maker-i18n";
import { HomeMakerAuthPage } from "@/routes/ev-hanimlari.index";

export const Route = createFileRoute("/de/ev-hanimlari")({
  head: () => homeMakerHead("de"),
  component: () => <HomeMakerAuthPage locale="de" />,
});
