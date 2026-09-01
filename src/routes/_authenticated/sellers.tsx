import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { StoreIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SELLER_STATUS_LABELS, mySellerAccountsQuery } from "@/lib/marketplace-queries";
import { applyAsSeller } from "@/lib/marketplace.functions";

export const Route = createFileRoute("/_authenticated/sellers")({
  head: () => ({
    meta: [
      { title: "Satıcı Ol — Mefticaret Pazaryeri" },
      {
        name: "description",
        content:
          "Mefticaret pazaryerinde satıcı olarak başvurun; onay sonrası ürün, stok, sipariş ve kazanç panelinize erişin.",
      },
      { property: "og:title", content: "Satıcı Ol — Mefticaret Pazaryeri" },
      {
        property: "og:description",
        content: "Pazaryeri satıcı başvurusu ve satıcı panellerinize hızlı erişim.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SellerAccountsPage,
});

function SellerAccountsPage() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();
  const { data: accounts, isLoading } = useQuery(mySellerAccountsQuery(userId));

  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [iban, setIban] = useState("");
  const [about, setAbout] = useState("");

  const apply = useServerFn(applyAsSeller);

  const applyMutation = useMutation({
    mutationFn: async () => {
      const { data: store, error } = await supabase
        .from("stores")
        .select("id, name")
        .eq("slug", slug.trim().toLowerCase())
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!store) throw new Error("Bu adrese sahip bir pazaryeri bulunamadı.");

      return apply({
        data: {
          storeId: store.id,
          displayName,
          legalName: legalName || undefined,
          email: email || undefined,
          phone: phone || undefined,
          taxId: taxId || undefined,
          iban: iban || undefined,
          about: about || undefined,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-seller-accounts", userId] });
      setDisplayName("");
      setAbout("");
      toast.success("Başvurunuz alındı. Pazaryeri yöneticisi değerlendirecek.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Pazaryeri satıcılığı"
      description="Satıcı başvurusu yapın veya onaylı satıcı panellerinize geçin."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="font-display text-base font-semibold">Satıcı hesaplarım</h2>
          {isLoading ? <p className="text-sm text-muted-foreground">Yükleniyor…</p> : null}
          {!isLoading && !accounts?.length ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Henüz satıcı başvurunuz yok. Sağdaki formu doldurarak başvurabilirsiniz.
            </p>
          ) : null}
          {(accounts ?? []).map((account) => (
            <div key={account.id} className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{account.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {account.stores?.name ?? "Pazaryeri"} · Komisyon %
                    {(Number(account.commission_rate) * 100).toFixed(1)}
                  </p>
                </div>
                <Badge variant={account.status === "approved" ? "default" : "secondary"}>
                  {SELLER_STATUS_LABELS[account.status]}
                </Badge>
              </div>
              {account.rejection_reason ? (
                <p className="mt-2 text-sm text-destructive">{account.rejection_reason}</p>
              ) : null}
              <Button asChild size="sm" className="mt-3" disabled={account.status !== "approved"}>
                <Link to="/seller/$sellerId" params={{ sellerId: account.id }}>
                  Satıcı panelini aç
                </Link>
              </Button>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2">
            <StoreIcon className="size-4 text-muted-foreground" />
            <h2 className="font-display text-base font-semibold">Yeni satıcı başvurusu</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="slug">Pazaryeri adresi (mağaza kodu)</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="ornek-magaza"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Satıcı adı</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="legalName">Yasal unvan</Label>
              <Input
                id="legalName"
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="taxId">Vergi / TC no</Label>
              <Input id="taxId" value={taxId} onChange={(event) => setTaxId(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iban">IBAN</Label>
              <Input id="iban" value={iban} onChange={(event) => setIban(event.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="about">Kısa tanıtım</Label>
              <Textarea
                id="about"
                rows={3}
                value={about}
                onChange={(event) => setAbout(event.target.value)}
              />
            </div>
          </div>
          <Button
            className="mt-4"
            disabled={!slug.trim() || displayName.trim().length < 2 || applyMutation.isPending}
            onClick={() => applyMutation.mutate()}
          >
            Başvuruyu gönder
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
