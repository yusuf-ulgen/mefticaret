import { queryOptions } from "@tanstack/react-query";

import { getHomeMakerProfile } from "@/lib/home-maker.functions";

export const homeMakerProfileQuery = () =>
  queryOptions({
    queryKey: ["home-maker-profile"],
    queryFn: () => getHomeMakerProfile(),
    staleTime: 60_000,
  });
