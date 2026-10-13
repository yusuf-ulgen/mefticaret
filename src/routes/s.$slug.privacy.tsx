import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/s/$slug/privacy")({
  loader: ({ params }) => {
    throw redirect({
      to: "/s/$slug/politika/$policySlug",
      params: { slug: params.slug, policySlug: "gizlilik" },
      statusCode: 301,
    });
  },
});
