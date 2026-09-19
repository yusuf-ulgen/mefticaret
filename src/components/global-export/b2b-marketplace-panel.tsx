import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Building2, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { productsQuery } from "@/lib/catalog-queries";
import { GLOBAL_COUNTRIES, GLOBAL_CURRENCIES } from "@/lib/global-commerce";
import { GLOBAL_MARKETPLACES, marketplaceLabel } from "@/lib/growth-export";
import { marketplaceChannelsQuery, rfqRequestsQuery, wholesaleTiersQuery } from "@/lib/growth-export-queries";
import {
  createRfqQuote,
  deleteWholesaleTier,
  prepareMarketplaceSync,
  saveB2bSettings,
  saveMarketplaceChannel,
  saveWholesaleTier,
  updateRfqStatus,
} from "@/lib/growth-export.functions";

type Props = { storeId: string; b2bEnabled: boolean; defaultMoq: number };

const RFQ_STATUS: Record<string, string> = {
  new: "Yeni",
  quoted: "Teklif verildi",
  won: "Kazanıldı",
  lost: "Kaybedildi",
};

/** Sınır ötesi B2B toptan portalı ve global pazaryeri aktarımı. */
export function B2bMarketplacePanel({ storeId, b2bEnabled, defaultMoq }: Props) {
  const queryClient = useQueryClient();
  const { data: products } = useQuery(productsQuery(storeId));
  const { data: tiers } = useQuery(wholesaleTiersQuery(storeId));
  const { data: rfqs } = useQuery(rfqRequestsQuery(storeId));
  const { data: channels } = useQuery(marketplaceChannelsQuery(storeId));

  const saveSettings = useServerFn(saveB2bSettings);
  const saveTier = useServerFn(saveWholesaleTier);
  const removeTier = useServerFn(deleteWholesaleTier);
  const createQuote = useServerFn(createRfqQuote);
  const updateStatus = useServerFn(updateRfqStatus);
  const saveChannel = useServerFn(saveMarketplaceChannel);
  const prepareSync = useServerFn(prepareMarketplaceSync);

  const [enabled, setEnabled] = useState(b2bEnabled);
  const [moq, setMoq] = useState(String(defaultMoq));

  const [tierProduct, setTierProduct] = useState("all");
  const [tierQty, setTierQty] = useState("50");
  const [tierDiscount, setTierDiscount] = useState("10");

  const [company, setCompany] = useState("");
  const [rfqEmail, setRfqEmail] = useState("");
  const [rfqCountry, setRfqCountry] = useState("DE");
  const [rfqCurrency, setRfqCurrency] = useState("EUR");
  const [rfqProduct, setRfqProduct] = useState("");
  const [rfqQty, setRfqQty] = useState("100");

  const [channel, setChannel] = useState<string>("amazon_eu");
  const [channelCurrency, setChannelCurrency] = useState("EUR");

  const invalidate = (key: string) => queryClient.invalidateQueries({ queryKey: [key, storeId] });

  const settingsMutation = useMutation({
    mutationFn: () =>
      saveSettings({ data: { storeId, b2bEnabled: enabled, defaultMoq: Number(moq) || 1 } as never }),
    onSuccess: () => toast.success("B2B ayarları kaydedildi"),
    onError: (error: Error) => toast.error(error.message),
  });

  const tierMutation = useMutation({
    mutationFn: () =>
      saveTier({
        data: {
          storeId,
          productId: tierProduct === "all" ? null : tierProduct,
          minQuantity: Number(tierQty) || 1,
          discountPercent: Number(tierDiscount.replace(",", ".")),
          isActive: true,
        } as never,
      }),
    onSuccess: () => {
      toast.success("Toptan kademesi kaydedildi");
      void invalidate("wholesale-tiers");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rfqMutation = useMutation({
    mutationFn: () =>
      createQuote({
        data: {
          storeId,
          companyName: company,
          email: rfqEmail || null,
          countryCode: rfqCountry,
          currency: rfqCurrency,
          items: [{ productId: rfqProduct, quantity: Number(rfqQty) || 1 }],
        } as never,
      }),
    onSuccess: (result: { reference?: string; quotedTotal?: number }) => {
      toast.success(`Teklif oluşturuldu: ${result?.reference ?? ""}`);
      setCompany("");
      setRfqEmail("");
      void invalidate("rfq-requests");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const syncMutation = useMutation({
    mutationFn: (target: string) => prepareSync({ data: { storeId, channel: target } as never }),
    onSuccess: (result: { credentialsReady?: boolean; products?: number; missingCustoms?: number; missingDescription?: number }) => {
      if (result?.credentialsReady) {
        toast.success(`${result?.products ?? 0} ürün aktarıma hazır`);
      } else {
        toast.info(
          `Paket hazırlandı (${result?.products ?? 0} ürün) ama hesap bilgisi bağlı değil; gerçek aktarım yapılmadı.`,
        );
      }
      void invalidate("global-marketplace-channels");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Building2 className="size-4" /> B2B toptan portalı
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Minimum sipariş adedi (MOQ), adede göre kademeli iskonto ve özel teklif (RFQ) üretimi.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-3">
            <Switch id="b2b-enabled" checked={enabled} onCheckedChange={setEnabled} />
            <Label htmlFor="b2b-enabled">Toptan satış açık</Label>
          </div>
          <div>
            <Label htmlFor="b2b-moq">Varsayılan MOQ</Label>
            <Input id="b2b-moq" className="mt-1 w-28" value={moq} onChange={(e) => setMoq(e.target.value)} />
          </div>
          <Button disabled={settingsMutation.isPending} onClick={() => settingsMutation.mutate()}>
            Kaydet
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Ürün</Label>
            <Select value={tierProduct} onValueChange={setTierProduct}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm ürünler</SelectItem>
                {(products ?? []).map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="tier-qty">Minimum adet</Label>
            <Input id="tier-qty" className="mt-1" value={tierQty} onChange={(e) => setTierQty(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tier-discount">İskonto %</Label>
            <Input
              id="tier-discount"
              className="mt-1"
              value={tierDiscount}
              onChange={(e) => setTierDiscount(e.target.value)}
            />
          </div>
        </div>
        <Button className="mt-4" disabled={tierMutation.isPending} onClick={() => tierMutation.mutate()}>
          Kademeyi kaydet
        </Button>

        {(tiers ?? []).length > 0 ? (
          <ul className="mt-4 space-y-2">
            {(tiers ?? []).map((tier) => (
              <li key={tier.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <span>
                  {tier.products?.title ?? "Tüm ürünler"} · {tier.min_quantity}+ adet
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">%{tier.discount_percent}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Kademeyi sil"
                    onClick={() =>
                      removeTier({ data: { storeId, id: tier.id } as never }).then(() => {
                        toast.success("Kademe kaldırıldı");
                        void invalidate("wholesale-tiers");
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">Teklif (RFQ) oluştur</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="rfq-company">Firma</Label>
            <Input id="rfq-company" className="mt-1" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="rfq-email">E-posta</Label>
            <Input id="rfq-email" className="mt-1" value={rfqEmail} onChange={(e) => setRfqEmail(e.target.value)} />
          </div>
          <div>
            <Label>Ülke</Label>
            <Select value={rfqCountry} onValueChange={setRfqCountry}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLOBAL_COUNTRIES.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code} · {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Para birimi</Label>
            <Select value={rfqCurrency} onValueChange={setRfqCurrency}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLOBAL_CURRENCIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ürün</Label>
            <Select value={rfqProduct} onValueChange={setRfqProduct}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Ürün seçin" />
              </SelectTrigger>
              <SelectContent>
                {(products ?? []).map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rfq-qty">Adet</Label>
            <Input id="rfq-qty" className="mt-1" value={rfqQty} onChange={(e) => setRfqQty(e.target.value)} />
          </div>
        </div>
        <Button
          className="mt-4"
          disabled={company.length < 2 || !rfqProduct || rfqMutation.isPending}
          onClick={() => rfqMutation.mutate()}
        >
          Teklif oluştur
        </Button>

        {(rfqs ?? []).length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2">Referans</th>
                  <th className="py-2">Firma</th>
                  <th className="py-2">Tutar</th>
                  <th className="py-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {(rfqs ?? []).map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-2">{row.reference}</td>
                    <td className="py-2">
                      {row.company_name} · {row.country_code}
                    </td>
                    <td className="py-2">
                      {(row.quoted_total ?? row.requested_total).toFixed(2)} {row.currency}
                    </td>
                    <td className="py-2">
                      <Select
                        value={row.status}
                        onValueChange={(status) =>
                          updateStatus({ data: { storeId, id: row.id, status } as never }).then(() => {
                            toast.success("Teklif durumu güncellendi");
                            void invalidate("rfq-requests");
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(RFQ_STATUS).map(([value, text]) => (
                            <SelectItem key={value} value={value}>
                              {text}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Store className="size-4" /> Global pazaryeri aktarımı
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Amazon (ABD/AB), Etsy, eBay, Walmart, Allegro ve Noon kanallarını hazırlayın. Hesap bilgileri
          bağlanmadan gerçek aktarım yapılmaz.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <Label>Kanal</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="mt-1 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLOBAL_MARKETPLACES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {marketplaceLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Hedef para birimi</Label>
            <Select value={channelCurrency} onValueChange={setChannelCurrency}>
              <SelectTrigger className="mt-1 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLOBAL_CURRENCIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() =>
              saveChannel({
                data: {
                  storeId,
                  channel,
                  isActive: true,
                  targetCurrency: channelCurrency,
                  credentialsReady: false,
                } as never,
              })
                .then(() => {
                  toast.success("Kanal kaydedildi");
                  void invalidate("global-marketplace-channels");
                })
                .catch((error: Error) => toast.error(error.message))
            }
          >
            Kanalı kaydet
          </Button>
          <Button variant="outline" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate(channel)}>
            Aktarımı hazırla
          </Button>
        </div>

        {(channels ?? []).length > 0 ? (
          <ul className="mt-4 space-y-2">
            {(channels ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <span>
                  {marketplaceLabel(row.channel as never)} · {row.target_currency}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={row.credentials_ready ? "secondary" : "outline"}>
                    {row.credentials_ready ? "Hesap bağlı" : "Hesap bekleniyor"}
                  </Badge>
                  {row.synced_products > 0 ? <Badge variant="outline">{row.synced_products} ürün</Badge> : null}
                  {row.last_status ? <span className="text-xs text-muted-foreground">{row.last_status}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
