import { createFileRoute } from "@tanstack/react-router";

import { homeMakerHead } from "@/lib/home-maker-i18n";
import { HomeMakerAuthPage } from "@/components/home-maker-auth-page";

export const Route = createFileRoute("/ar/ev-hanimlari")({
  head: () => homeMakerHead("ar"),
  component: () => <HomeMakerAuthPage locale="ar" />,
});
