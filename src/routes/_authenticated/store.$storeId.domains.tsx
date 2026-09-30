import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  BadgeCheck,
  Copy,
  CornerUpRight,
  Globe,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { storeDomainsQuery } from "@/lib/store-queries";
import {
  DOMAIN_STATUS_LABELS,
  DOMAIN_TXT_PREFIX,
  PLATFORM_DNS_A,
  PLATFORM_DNS_CNAME,
  SSL_STATUS_LABELS,
  SUBDOMAIN_SUFFIX,
} from "@/lib/mefti";
import {
  addStoreDomain,
  addStoreSubdomain,
  provisionDomainSsl,
  removeStoreDomain,
  setDomainRedirect,
  setPrimaryDomain,
  verifyStoreDomain,
} from "@/lib/stores.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/domains")({
  head: () => ({
    meta: [
      { title: "Domain Yönetimi — Mefticaret" },
      {
        name: "description",
        content:
          "Ücretsiz mefticaret.com alt alan adını kullan veya kendi domainini DNS doğrulaması ve otomatik SSL ile bağla.",
      },
      { property: "og:title", content: "Domain Yönetimi — Mefticaret" },
      {
        property: "og:description",
        content: "Domain ekle, DNS doğrula, SSL durumunu izle, ana domain ve yönlendirme yönet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DomainsPage,
});

function copy(value: string) {
  void navigator.clipboard.writeText(value);
  toast.success("Kopyalandı");
}

function DomainsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: domains } = useQuery(storeDomainsQuery(storeId));
  const [hostname, setHostname] = useState("");
  const [includeWww, setIncludeWww] = useState(true);
  const [label, setLabel] = useState("");

  const addFn = useServerFn(addStoreDomain);
  const addSubFn = useServerFn(addStoreSubdomain);
  const verifyFn = useServerFn(verifyStoreDomain);
  const sslFn = useServerFn(provisionDomainSsl);
  const redirectFn = useServerFn(setDomainRedirect);
  const primaryFn = useServerFn(setPrimaryDomain);
  const removeFn = useServerFn(removeStoreDomain);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["store-domains", storeId] });
  const list = domains ?? [];
  const verified = list.filter((domain) => domain.status === "verified");

  const add = useMutation({
    mutationFn: () => addFn({ data: { storeId, hostname, includeWww } }),
    onSuccess: async () => {
      setHostname("");
      await refresh();
      toast.success("Domain eklendi — DNS kayıtlarını ekleyip doğrula.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addSub = useMutation({
    mutationFn: () => addSubFn({ data: { storeId, label: label.trim().toLowerCase() } }),
    onSuccess: async () => {
      setLabel("");
      await refresh();
      toast.success("Alt alan adı hazır — SSL otomatik aktif.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const verify = useMutation({
    mutationFn: (domainId: string) => verifyFn({ data: { domainId } }),
    onSuccess: async (result) => {
      await refresh();
      if (result.verified) toast.success("Domain doğrulandı, SSL etkinleştirildi.");
      else toast.error(result.errors.join(" · ") || "DNS yayılması 5-30 dakika sürebilir.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ssl = useMutation({
    mutationFn: (domainId: string) => sslFn({ data: { domainId } }),
    onSuccess: async () => {
      await refresh();
      toast.success("SSL sertifikası yenilendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const redirect = useMutation({
    mutationFn: (input: { domainId: string; redirectTo: string | null }) =>
      redirectFn({ data: input }),
    onSuccess: async () => {
      await refresh();
      toast.success("Yönlendirme güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const makePrimary = useMutation({
    mutationFn: (domainId: string) => primaryFn({ data: { storeId, domainId } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Ana domain güncellendi — diğerleri buraya yönlendirilir.");
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
      description={`Her mağaza otomatik olarak *.${SUBDOMAIN_SUFFIX} alt alan adı alır. Kendi domainini DNS doğrulaması ve otomatik SSL ile bağla.`}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <form
          className="surface-card space-y-4 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate();
          }}
        >
          <div>
            <h2 className="font-medium">Özel domain ekle</h2>
            <p className="text-xs text-muted-foreground">
              Kök domain (magazam.com) ve www kaydı birlikte bağlanabilir.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hostname">Domain</Label>
            <Input
              id="hostname"
              placeholder="magazam.com"
              value={hostname}
              onChange={(event) => setHostname(event.target.value)}
              required
            />
          </div>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={includeWww} onCheckedChange={setIncludeWww} />
            www.{hostname || "magazam.com"} kaydını da ekle
          </label>
          <Button type="submit" disabled={add.isPending}>
            <Plus className="mr-2 size-4" /> {add.isPending ? "Ekleniyor..." : "Domain ekle"}
          </Button>
        </form>

        <form
          className="surface-card space-y-4 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            addSub.mutate();
          }}
        >
          <div>
            <h2 className="font-medium">Platform alt alan adı</h2>
            <p className="text-xs text-muted-foreground">
              Anında yayında, wildcard sertifika ile SSL otomatik aktiftir.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="label">Alt alan adı</Label>
            <div className="flex items-center gap-2">
              <Input
                id="label"
                placeholder="magazaadi"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                required
              />
              <span className="whitespace-nowrap text-sm text-muted-foreground">
                .{SUBDOMAIN_SUFFIX}
              </span>
            </div>
          </div>
          <Button type="submit" variant="outline" disabled={addSub.isPending}>
            <Globe className="mr-2 size-4" /> {addSub.isPending ? "Ekleniyor..." : "Alt alan adı ekle"}
          </Button>
        </form>
      </div>

      <div className="space-y-3">
        {list.map((domain) => {
          const checking = verify.isPending && verify.variables === domain.id;
          const checkError =
            verify.isError && verify.variables === domain.id ? verify.error.message : null;
          return (
            <DomainStatusCard
              key={domain.id}
              domain={domain}
              checking={checking}
              checkError={checkError}
              onRecheck={domain.type === "custom" ? () => verify.mutate(domain.id) : null}
              actions={
                <>
                {null}
                {domain.status === "verified" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => ssl.mutate(domain.id)}
                    disabled={ssl.isPending}
                  >
                    <ShieldCheck className="mr-2 size-4" /> SSL yenile
                  </Button>
                ) : null}
                {!domain.is_primary && domain.status === "verified" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => makePrimary.mutate(domain.id)}
                    disabled={makePrimary.isPending}
                  >
                    <Star className="mr-2 size-4" /> Ana domain yap
                  </Button>
                ) : null}

                {!domain.is_primary && domain.status === "verified" ? (
                  <div className="flex items-center gap-2">
                    <CornerUpRight className="size-4 text-muted-foreground" />
                    <Select
                      value={domain.redirect_to_hostname ?? "none"}
                      onValueChange={(value) =>
                        redirect.mutate({
                          domainId: domain.id,
                          redirectTo: value === "none" ? null : value,
                        })
                      }
                    >
                      <SelectTrigger className="h-9 w-[15rem]">
                        <SelectValue placeholder="Yönlendirme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Yönlendirme yok</SelectItem>
                        {verified
                          .filter((item) => item.id !== domain.id)
                          .map((item) => (
                            <SelectItem key={item.id} value={item.hostname}>
                              → {item.hostname}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {!domain.is_primary ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => remove.mutate(domain.id)}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="mr-2 size-4" /> Kaldır
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
        {list.length === 0 ? (
          <p className="surface-card p-6 text-sm text-muted-foreground">
            Henüz domain yok. Yukarıdan bir alt alan adı veya özel domain ekle.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}

function DnsRow({ type, name, value }: { type: string; name: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-background/60 px-3 py-2">
      <Badge variant="outline" className="font-mono">
        {type}
      </Badge>
      <span className="text-muted-foreground">{name}</span>
      <span className="break-all">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="ml-auto size-7"
        onClick={() => copy(value)}
      >
        <Copy className="size-3.5" />
      </Button>
    </div>
  );
}
