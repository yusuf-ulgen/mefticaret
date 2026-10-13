import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/s/$slug/terms")({
  loader: ({ params }) => {
    throw redirect({
      to: "/s/$slug/politika/$policySlug",
      params: { slug: params.slug, policySlug: "kullanim-kosullari" },
      statusCode: 301,
    });
  },
});
