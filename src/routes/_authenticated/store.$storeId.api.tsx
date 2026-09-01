import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, KeyRound, Plus, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/mefti";
import {
  API_RESOURCES,
  API_SCOPES,
  API_SCOPE_LABELS,
  API_VERSIONS,
  type ApiScope,
  type ApiVersion,
} from "@/lib/api-keys";
import { storeApiKeysQuery, storeApiLogsQuery } from "@/lib/api-keys-queries";
import {
  createStoreApiKey,
  deleteStoreApiKey,
  revokeStoreApiKey,
} from "@/lib/api-keys.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/api")({
  head: () => ({
    meta: [
      { title: "API Anahtarları — Mefticaret" },
      {
        name: "description",
        content:
          "Mefticaret REST API anahtarlarını oluştur, scope izinlerini belirle ve istek kayıtlarını izle.",
      },
      { property: "og:title", content: "API Anahtarları — Mefticaret" },
      {
        property: "og:description",
        content: "Sürümlü REST API, scope tabanlı izinler ve istek logları.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApiPage,
});

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  api_version: string;
  scopes: string[] | null;
  last_used_at: string | null;
  request_count: number | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type ApiLogRow = {
  id: string;
  api_key_id: string | null;
  api_version: string;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
};

function ApiPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: keys, isLoading } = useQuery(storeApiKeysQuery(storeId));
  const { data: logs } = useQuery(storeApiLogsQuery(storeId));

  const [name, setName] = useState("");
  const [version, setVersion] = useState<ApiVersion>("v1");
  const [scopes, setScopes] = useState<ApiScope[]>(["read_products", "read_orders"]);
  const [expiresInDays, setExpiresInDays] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const createFn = useServerFn(createStoreApiKey);
  const revokeFn = useServerFn(revokeStoreApiKey);
  const deleteFn = useServerFn(deleteStoreApiKey);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["store", storeId, "api-keys"] });
    void queryClient.invalidateQueries({ queryKey: ["store", storeId, "api-logs"] });
  }

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          storeId,
          name: name.trim(),
          apiVersion: version,
          scopes,
          ...(expiresInDays ? { expiresInDays: Number(expiresInDays) } : {}),
        },
      }),
    onSuccess: (result) => {
      const raw = (result as { key?: string }).key ?? null;
      setFreshKey(raw);
      setName("");
      setExpiresInDays("");
      toast.success("API anahtarı oluşturuldu");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { storeId, id } }),
    onSuccess: () => {
      toast.success("Anahtar iptal edildi");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { storeId, id } }),
    onSuccess: () => {
      toast.success("Anahtar silindi");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const keyRows = (keys ?? []) as unknown as ApiKeyRow[];
  const logRows = (logs ?? []) as unknown as ApiLogRow[];

  function toggleScope(scope: ApiScope) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((item) => item !== scope) : [...prev, scope],
    );
  }

  function keyState(row: ApiKeyRow) {
    if (row.revoked_at) return { label: "İptal", variant: "destructive" as const };
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return { label: "Süresi geçti", variant: "secondary" as const };
    }
    return { label: "Aktif", variant: "default" as const };
  }

  return (
    <AppShell
      storeId={storeId}
      title="API"
      description="Sürümlü REST API anahtarları, scope izinleri ve istek kayıtları."
    >
      <Tabs defaultValue="keys" className="space-y-6">
        <TabsList>
          <TabsTrigger value="keys">Anahtarlar</TabsTrigger>
          <TabsTrigger value="docs">Uç noktalar</TabsTrigger>
          <TabsTrigger value="logs">İstek kayıtları</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-6">
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-medium">
              <KeyRound className="size-4" aria-hidden /> Yeni anahtar
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="api-name">Anahtar adı</Label>
                <Input
                  id="api-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="ERP entegrasyonu"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-version">API sürümü</Label>
                <select
                  id="api-version"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={version}
                  onChange={(event) => setVersion(event.target.value as ApiVersion)}
                >
                  {API_VERSIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-expiry">Geçerlilik (gün, opsiyonel)</Label>
                <Input
                  id="api-expiry"
                  type="number"
                  min={1}
                  value={expiresInDays}
                  onChange={(event) => setExpiresInDays(event.target.value)}
                  placeholder="365"
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Scope izinleri</p>
              <div className="flex flex-wrap gap-2">
                {API_SCOPES.map((scope) => (
                  <Button
                    key={scope}
                    type="button"
                    size="sm"
                    variant={scopes.includes(scope) ? "default" : "outline"}
                    onClick={() => toggleScope(scope)}
                  >
                    {API_SCOPE_LABELS[scope]}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              className="mt-4"
              onClick={() => create.mutate()}
              disabled={create.isPending || name.trim().length < 2 || scopes.length === 0}
            >
              <Plus className="mr-1 size-4" aria-hidden /> Anahtar oluştur
            </Button>

            {freshKey ? (
              <div className="mt-4 space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-4">
                <p className="text-sm font-medium">
                  Anahtarı şimdi kopyala — bir daha gösterilmeyecek.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-background px-2 py-1 text-xs">{freshKey}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(freshKey);
                      toast.success("Kopyalandı");
                    }}
                  >
                    <Copy className="mr-1 size-4" aria-hidden /> Kopyala
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border bg-card shadow-sm">
            {isLoading ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : keyRows.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Henüz API anahtarı oluşturulmadı.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead>Önek</TableHead>
                    <TableHead>Sürüm</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>İstek</TableHead>
                    <TableHead>Son kullanım</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keyRows.map((row) => {
                    const state = keyState(row);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>
                          <code className="text-xs">{row.key_prefix}…</code>
                        </TableCell>
                        <TableCell>{row.api_version}</TableCell>
                        <TableCell className="max-w-[240px]">
                          <div className="flex flex-wrap gap-1">
                            {(row.scopes ?? []).map((scope) => (
                              <Badge key={scope} variant="outline" className="text-[11px]">
                                {API_SCOPE_LABELS[scope as ApiScope] ?? scope}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{row.request_count ?? 0}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.last_used_at ? formatDateTime(row.last_used_at) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={state.variant}>{state.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!row.revoked_at ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => revoke.mutate(row.id)}
                                disabled={revoke.isPending}
                              >
                                <ShieldOff className="size-4" aria-hidden />
                                <span className="sr-only">İptal et</span>
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => remove.mutate(row.id)}
                              disabled={remove.isPending}
                            >
                              <Trash2 className="size-4" aria-hidden />
                              <span className="sr-only">Sil</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </section>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-medium">Kimlik doğrulama</h2>
            <p className="text-sm text-muted-foreground">
              Anahtarı <code>Authorization: Bearer &lt;anahtar&gt;</code> veya{" "}
              <code>x-api-key</code> başlığıyla gönder. Tüm uç noktalar mağazana kilitlidir ve
              scope kontrolünden geçer.
            </p>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
{`curl https://<alan-adiniz>/api/v1/products?limit=20 \\
  -H "Authorization: Bearer mk_v1_..."`}
            </pre>
          </section>
          <section className="rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Uç nokta</TableHead>
                  <TableHead>Okuma scope</TableHead>
                  <TableHead>Yazma scope</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {API_RESOURCES.map((resource) => (
                  <TableRow key={resource.path}>
                    <TableCell className="font-medium">{resource.label}</TableCell>
                    <TableCell>
                      <code className="text-xs">/api/v1/{resource.path}</code>
                    </TableCell>
                    <TableCell className="text-xs">{resource.read}</TableCell>
                    <TableCell className="text-xs">{resource.write ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </TabsContent>

        <TabsContent value="logs">
          <section className="rounded-xl border bg-card shadow-sm">
            {logRows.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Henüz API isteği kaydedilmedi.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Metot</TableHead>
                    <TableHead>Yol</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Süre</TableHead>
                    <TableHead>Hata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(row.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.method}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate">
                        <code className="text-xs">{row.path}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.status_code < 400 ? "default" : "destructive"}>
                          {row.status_code}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{row.duration_ms ?? 0} ms</TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {row.error_message ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
