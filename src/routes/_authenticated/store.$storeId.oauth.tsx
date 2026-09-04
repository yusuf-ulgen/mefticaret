import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, KeyRound, Loader2, Plus, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/mefti";
import { API_SCOPE_LABELS, API_SCOPES, type ApiScope } from "@/lib/api-keys";
import {
  OAUTH_ENDPOINTS,
  OAUTH_GRANT_LABELS,
  OAUTH_GRANT_TYPES,
  type OAuthGrantType,
} from "@/lib/oauth";
import { oauthClientsQuery, oauthTokensQuery } from "@/lib/oauth-queries";
import {
  createOAuthApplication,
  deleteOAuthApplication,
  revokeOAuthAccessToken,
  toggleOAuthApplication,
} from "@/lib/oauth.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/oauth")({
  head: () => ({
    meta: [
      { title: "OAuth Uygulamaları — Mefticaret" },
      {
        name: "description",
        content:
          "OAuth 2.0 istemcileri oluştur, scope ve grant tiplerini yönet, erişim belirteçlerini iptal et.",
      },
      { property: "og:title", content: "OAuth Uygulamaları — Mefticaret" },
      {
        property: "og:description",
        content: "Authorization code, PKCE, client credentials ve refresh token akışları.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OAuthPage,
});

function OAuthPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const clients = useQuery(oauthClientsQuery(storeId));
  const tokens = useQuery(oauthTokensQuery(storeId));
  const [formOpen, setFormOpen] = useState(false);
  const [secret, setSecret] = useState<{ clientId: string; clientSecret: string } | null>(null);

  const toggleFn = useServerFn(toggleOAuthApplication);
  const deleteFn = useServerFn(deleteOAuthApplication);
  const revokeFn = useServerFn(revokeOAuthAccessToken);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["store", storeId, "oauth-clients"] });
    void queryClient.invalidateQueries({ queryKey: ["store", storeId, "oauth-tokens"] });
  }

  const toggle = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      toggleFn({ data: { storeId, ...input } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { storeId, id } }),
    onSuccess: () => {
      toast.success("Uygulama silindi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { storeId, id } }),
    onSuccess: () => {
      toast.success("Belirteç iptal edildi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      storeId={storeId}
      title="OAuth Uygulamaları"
      description="OAuth 2.0 istemcileri, scope izinleri ve erişim belirteçleri."
      actions={
        <Button size="sm" onClick={() => setFormOpen((open) => !open)}>
          <Plus className="mr-2 h-4 w-4" /> Yeni Uygulama
        </Button>
      }
    >
      <Tabs defaultValue="clients" className="space-y-6">
        <TabsList>
          <TabsTrigger value="clients">Uygulamalar</TabsTrigger>
          <TabsTrigger value="tokens">Belirteçler</TabsTrigger>
          <TabsTrigger value="docs">Uç Noktalar</TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="space-y-4">
          {secret ? (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="text-base">Client bilgileri</CardTitle>
                <CardDescription>
                  Client secret yalnızca bir kez gösterilir; güvenli bir yerde sakla.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <SecretRow label="client_id" value={secret.clientId} />
                <SecretRow label="client_secret" value={secret.clientSecret} />
                <Button variant="outline" size="sm" onClick={() => setSecret(null)}>
                  Kapat
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {formOpen ? (
            <ClientForm
              storeId={storeId}
              onCreated={(result) => {
                setSecret(result);
                setFormOpen(false);
                invalidate();
              }}
            />
          ) : null}

          {clients.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (clients.data ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Henüz OAuth uygulaması yok.
            </p>
          ) : (
            <div className="space-y-3">
              {(clients.data ?? []).map((client) => (
                <Card key={client.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <KeyRound className="h-4 w-4" /> {client.name}
                        {client.is_active ? null : <Badge variant="outline">Devre dışı</Badge>}
                      </CardTitle>
                      <CardDescription>
                        {client.description ?? "Açıklama yok"} · {formatDateTime(client.created_at)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={client.is_active}
                        onCheckedChange={(value) =>
                          toggle.mutate({ id: client.id, isActive: value })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove.mutate(client.id)}
                        aria-label="Uygulamayı sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="font-mono text-xs">{client.client_id}</p>
                    <div className="flex flex-wrap gap-1">
                      {(client.grant_types ?? []).map((grant) => (
                        <Badge key={grant} variant="secondary">
                          {OAUTH_GRANT_LABELS[grant as OAuthGrantType] ?? grant}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(client.allowed_scopes ?? []).map((scope) => (
                        <Badge key={scope} variant="outline">
                          {API_SCOPE_LABELS[scope as ApiScope] ?? scope}
                        </Badge>
                      ))}
                    </div>
                    {(client.redirect_uris ?? []).length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Yönlendirme: {(client.redirect_uris ?? []).join(", ")}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tokens" className="space-y-3">
          {tokens.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (tokens.data ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Aktif erişim belirteci yok.
            </p>
          ) : (
            (tokens.data ?? []).map((token) => (
              <div
                key={token.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {token.grant_type} · {token.api_version}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Son kullanım: {token.last_used_at ? formatDateTime(token.last_used_at) : "—"} ·{" "}
                    {token.request_count ?? 0} istek · Bitiş: {formatDateTime(token.expires_at)}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(token.scopes ?? []).map((scope) => (
                      <Badge key={scope} variant="outline">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
                {token.revoked_at ? (
                  <Badge variant="outline">İptal edildi</Badge>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => revoke.mutate(token.id)}>
                    <ShieldOff className="mr-2 h-4 w-4" /> İptal et
                  </Button>
                )}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="docs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">OAuth 2.0 uç noktaları</CardTitle>
              <CardDescription>
                Erişim belirteçleri REST API&apos;de <code>Authorization: Bearer mat_…</code> ile
                kullanılır ve scope kontrolüne tabidir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <SecretRow label="Authorize" value={OAUTH_ENDPOINTS.authorize} />
              <SecretRow label="Token" value={OAUTH_ENDPOINTS.token} />
              <SecretRow label="Revoke" value={OAUTH_ENDPOINTS.revoke} />
              <SecretRow label="API" value="/api/v1/{resource}" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function SecretRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 p-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-xs">{value}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`${label} kopyala`}
        onClick={() => {
          void navigator.clipboard.writeText(value);
          toast.success("Kopyalandı");
        }}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ClientForm({
  storeId,
  onCreated,
}: {
  storeId: string;
  onCreated: (result: { clientId: string; clientSecret: string }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [redirectUris, setRedirectUris] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>(["read_products"]);
  const [grantTypes, setGrantTypes] = useState<OAuthGrantType[]>(["authorization_code"]);
  const createFn = useServerFn(createOAuthApplication);

  const mutation = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          storeId,
          name: name.trim(),
          description: description.trim() || undefined,
          redirectUris: redirectUris
            .split(/\s|,/)
            .map((uri) => uri.trim())
            .filter(Boolean),
          scopes,
          grantTypes,
          apiVersion: "v1",
        },
      }),
    onSuccess: (result) => {
      toast.success("OAuth uygulaması oluşturuldu");
      setName("");
      setDescription("");
      setRedirectUris("");
      onCreated({ clientId: result.clientId, clientSecret: result.clientSecret });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Yeni OAuth uygulaması</CardTitle>
        <CardDescription>
          Grant tipini ve scope&apos;ları en az yetki ilkesine göre seç.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="oauth-name">Uygulama adı</Label>
            <Input
              id="oauth-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="oauth-desc">Açıklama</Label>
            <Input
              id="oauth-desc"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="oauth-redirects">Yönlendirme adresleri (satır veya virgülle)</Label>
            <Textarea
              id="oauth-redirects"
              rows={2}
              value={redirectUris}
              onChange={(event) => setRedirectUris(event.target.value)}
              placeholder="https://app.ornek.com/oauth/callback"
            />
          </div>

          <div className="space-y-2">
            <Label>Grant tipleri</Label>
            <div className="space-y-2">
              {OAUTH_GRANT_TYPES.map((grant) => (
                <label key={grant} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={grantTypes.includes(grant)}
                    onChange={(event) =>
                      setGrantTypes((current) =>
                        event.target.checked
                          ? [...current, grant]
                          : current.filter((item) => item !== grant),
                      )
                    }
                  />
                  {OAUTH_GRANT_LABELS[grant]}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Scope izinleri</Label>
            <div className="grid max-h-40 gap-1 overflow-y-auto rounded-md border p-2">
              {API_SCOPES.map((scope) => (
                <label key={scope} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    onChange={(event) =>
                      setScopes((current) =>
                        event.target.checked
                          ? [...current, scope]
                          : current.filter((item) => item !== scope),
                      )
                    }
                  />
                  {API_SCOPE_LABELS[scope]}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-end justify-end md:col-span-2">
            <Button type="submit" disabled={mutation.isPending || scopes.length === 0}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Uygulamayı Oluştur
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
