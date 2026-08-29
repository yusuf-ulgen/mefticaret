import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { BadgeCheck, Globe, Lock, Plus, RefreshCw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { storeDomainsQuery } from "@/lib/store-queries";
import {
  addStoreDomain,
  removeStoreDomain,
  setPrimaryDomain,
  verifyStoreDomain,
} from "@/lib/stores.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/domains")({
  head: () => ({
    meta: [
      { title: "Domain Yönetimi — Mefticaret" },
      { name: "description", content: "Ücretsiz alt alan adını kullan veya kendi domainini DNS doğrulaması ile bağla." },
      { property: "og:title", content: "Domain Yönetimi — Mefticaret" },
      { property: "og:description", content: "Özel domain ekle, TXT kaydı ile doğrula, SSL'i etkinleştir." },
    ],
  }),
  component: DomainsPage,
});

const STATUS_LABELS: Record<string, string> = {
  pending: "Doğrulama bekliyor",
  verified: "Doğrulandı",
  failed: "Doğrulanamadı",
};

function DomainsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: domains } = useQuery(storeDomainsQuery(storeId));
  const [hostname, setHostname] = useState("");

  const addFn = useServerFn(addStoreDomain);
  const verifyFn = useServerFn(verifyStoreDomain);
  const primaryFn = useServerFn(setPrimaryDomain);
  const removeFn = useServerFn(removeStoreDomain);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["store-domains", storeId] });

  const add = useMutation({
    mutationFn: () => addFn({ data: { storeId, hostname: hostname.trim().toLowerCase() } }),
    onSuccess: async () => {
      setHostname("");
      await refresh();
      toast.success("Domain eklendi — TXT kaydını ekleyip doğrula.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const verify = useMutation({
    mutationFn: (domainId: string) => verifyFn({ data: { domainId } }),
    onSuccess: async (result) => {
      await refresh();
      if (result.verified) toast.success("Domain doğrulandı, SSL etkinleştirildi.");
      else toast.error("TXT kaydı bulunamadı. DNS yayılması 5-30 dakika sürebilir.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const makePrimary = useMutation({
    mutationFn: (domainId: string) => primaryFn({ data: { storeId, domainId } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Birincil domain güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (domainId: string) => removeFn({ data: { domainId } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Domain kaldırıldı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      storeId={storeId}
      title="Domainler"
      description="Ücretsiz alt alan adın hazır. Kendi domainini bağlamak için DNS doğrulaması yap."
    >
      <form
        className="surface-card flex flex-wrap items-end gap-3 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <div className="min-w-[16rem] flex-1 space-y-2">
          <Label htmlFor="hostname">Özel domain</Label>
          <Input
            id="hostname"
            placeholder="magazam.com"
            value={hostname}
            onChange={(event) => setHostname(event.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={add.isPending}>
          <Plus className="mr-2 size-4" /> {add.isPending ? "Ekleniyor..." : "Domain ekle"}
        </Button>
      </form>

      <div className="space-y-3">
        {(domains ?? []).map((domain) => (
          <article key={domain.id} className="surface-card p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-foreground">
                <Globe className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{domain.hostname}</p>
                <p className="text-xs text-muted-foreground">
                  {domain.type === "subdomain" ? "Platform alt alan adı" : "Özel domain"}
                </p>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {domain.is_primary ? <Badge>Birincil</Badge> : null}
                {domain.ssl_active ? (
                  <Badge variant="secondary" className="gap-1">
                    <Lock className="size-3" /> SSL
                  </Badge>
                ) : null}
                <Badge variant={domain.status === "verified" ? "default" : "secondary"} className="gap-1">
                  {domain.status === "verified" ? <BadgeCheck className="size-3" /> : null}
                  {STATUS_LABELS[domain.status] ?? domain.status}
                </Badge>
              </div>
            </div>

            {domain.type === "custom" && domain.status !== "verified" ? (
              <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4 text-sm">
                <p className="font-medium">DNS TXT kaydı ekle</p>
                <dl className="mt-2 grid gap-1 font-mono text-xs">
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Ad:</dt>
                    <dd>_mefticaret.{domain.hostname}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Değer:</dt>
                    <dd className="break-all">{domain.verification_token}</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {domain.type === "custom" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => verify.mutate(domain.id)}
                  disabled={verify.isPending}
                >
                  <RefreshCw className="mr-2 size-4" /> Doğrula
                </Button>
              ) : null}
              {!domain.is_primary && (domain.status === "verified" || domain.type === "subdomain") ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => makePrimary.mutate(domain.id)}
                  disabled={makePrimary.isPending}
                >
                  <Star className="mr-2 size-4" /> Birincil yap
                </Button>
              ) : null}
              {domain.type === "custom" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate(domain.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="mr-2 size-4" /> Kaldır
                </Button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
