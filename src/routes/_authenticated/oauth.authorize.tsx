import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { API_SCOPE_LABELS, type ApiScope } from "@/lib/api-keys";
import { approveOAuthAuthorization, describeOAuthApplication } from "@/lib/oauth.functions";

/** OAuth kullanıcı onay ekranı: istemci ve istenen scope'lar gösterilir. */

const searchSchema = z.object({
  client_id: z.string().trim().min(4),
  redirect_uri: z.string().trim().url(),
  scope: z.string().trim().min(1),
  state: z.string().trim().optional(),
  code_challenge: z.string().trim().optional(),
  code_challenge_method: z.enum(["S256", "plain"]).optional(),
});

export const Route = createFileRoute("/_authenticated/oauth/authorize")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Uygulama Yetkilendirme — Mefticaret" },
      {
        name: "description",
        content: "Üçüncü taraf uygulamaya vermek istediğin izinleri incele ve onayla.",
      },
      { property: "og:title", content: "Uygulama Yetkilendirme — Mefticaret" },
      {
        property: "og:description",
        content: "OAuth 2.0 onay ekranı; scope izinlerini görüntüle ve erişimi yetkilendir.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthorizePage,
});

function AuthorizePage() {
  const search = Route.useSearch();
  const describeFn = useServerFn(describeOAuthApplication);
  const approveFn = useServerFn(approveOAuthAuthorization);

  const scopes = search.scope.split(/\s+/).filter(Boolean);

  const client = useQuery({
    queryKey: ["oauth-client", search.client_id],
    queryFn: () => describeFn({ data: { clientId: search.client_id } }),
  });

  const approve = useMutation({
    mutationFn: () =>
      approveFn({
        data: {
          clientId: search.client_id,
          redirectUri: search.redirect_uri,
          scopes: scopes as ApiScope[],
          ...(search.state ? { state: search.state } : {}),
          ...(search.code_challenge ? { codeChallenge: search.code_challenge } : {}),
          ...(search.code_challenge_method
            ? { codeChallengeMethod: search.code_challenge_method }
            : {}),
        },
      }),
    onSuccess: (result) => {
      window.location.assign(result.redirectTo);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function deny() {
    const url = new URL(search.redirect_uri);
    url.searchParams.set("error", "access_denied");
    if (search.state) url.searchParams.set("state", search.state);
    window.location.assign(url.toString());
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-lg items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Erişim izni
          </CardTitle>
          <CardDescription>
            {client.isLoading
              ? "Uygulama bilgileri yükleniyor…"
              : client.data
                ? `${client.data.name} uygulaması hesabına erişmek istiyor.`
                : "Uygulama bulunamadı veya devre dışı."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {client.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">İstenen izinler</p>
                <div className="flex flex-wrap gap-1">
                  {scopes.map((scope) => (
                    <Badge key={scope} variant="outline">
                      {API_SCOPE_LABELS[scope as ApiScope] ?? scope}
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Yönlendirme adresi: {search.redirect_uri}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={deny}>
                  Reddet
                </Button>
                <Button
                  disabled={approve.isPending || !client.data}
                  onClick={() => approve.mutate()}
                >
                  {approve.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  İzin Ver
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
