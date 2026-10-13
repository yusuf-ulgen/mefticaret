import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/s/$slug/returns")({
  loader: ({ params }) => {
    throw redirect({
      to: "/s/$slug/politika/$policySlug",
      params: { slug: params.slug, policySlug: "iade-degisim" },
      statusCode: 301,
    });
  },
});
