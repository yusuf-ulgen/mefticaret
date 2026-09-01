import { queryOptions } from "@tanstack/react-query";

import { getOAuthClients, getOAuthTokens } from "@/lib/oauth.functions";

/** OAuth istemci ve belirteç sorguları. */

export const oauthClientsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "oauth-clients"],
    queryFn: () => getOAuthClients({ data: { storeId } }),
    staleTime: 30_000,
  });

export const oauthTokensQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "oauth-tokens"],
    queryFn: () => getOAuthTokens({ data: { storeId } }),
    staleTime: 15_000,
  });
