import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";

import { storefrontCampaignsQuery, trackCampaignEvent } from "@/lib/storefront-campaign";

/** Vitrin üstünde yayına açılmış kampanya bandı. */
export function CampaignBanner({ slug }: { slug: string }) {
  const { data } = useQuery(storefrontCampaignsQuery(slug));
  const campaign = (data ?? [])[0];

  useEffect(() => {
    if (campaign) void trackCampaignEvent(campaign, "view");
  }, [campaign]);

  if (!campaign) return null;

  const headline = campaign.bannerHeadline || campaign.name;

  return (
    <Link
      to="/s/$slug/kampanya/$campaignSlug"
      params={{ slug, campaignSlug: campaign.slug }}
      onClick={() => void trackCampaignEvent(campaign, "click")}
      className="block bg-foreground px-4 py-2.5 text-center text-sm text-background transition-opacity hover:opacity-90"
    >
      <span className="font-semibold">{headline}</span>
      {campaign.bannerBody ? <span className="ml-2 opacity-80">{campaign.bannerBody}</span> : null}
      {campaign.discountCode ? (
        <span className="ml-2 rounded bg-background/15 px-2 py-0.5 font-mono text-xs uppercase">
          {campaign.discountCode}
        </span>
      ) : null}
      <span className="ml-2 underline">{campaign.bannerCtaLabel || "Kampanyayı gör"}</span>
    </Link>
  );
}
