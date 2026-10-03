import { createFileRoute } from "@tanstack/react-router";

import { homeMakerHead } from "@/lib/home-maker-i18n";
import { HomeMakerAuthPage } from "@/routes/ev-hanimlari.index";

export const Route = createFileRoute("/ar/ev-hanimlari")({
  head: () => homeMakerHead("ar"),
  component: () => <HomeMakerAuthPage locale="ar" />,
});
