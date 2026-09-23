import { createFileRoute, redirect } from "@tanstack/react-router";

/** Kısa mağaza adresi: /magaza/<slug> → mağaza vitrini (kalıcı yönlendirme). */
export const Route = createFileRoute("/magaza/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/s/$slug", params: { slug: params.slug }, statusCode: 301 });
  },
});
