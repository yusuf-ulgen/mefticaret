import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { RefreshCw, Trash2, Users } from "lucide-react";
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
import { GLOBAL_COUNTRIES, GLOBAL_CURRENCIES } from "@/lib/global-commerce";
import { affiliateTrackingLink, suggestAffiliateCode } from "@/lib/growth-export";
import { affiliateConversionsQuery, affiliatePartnersQuery } from "@/lib/growth-export-queries";
import {
  deleteAffiliatePartner,
  saveAffiliatePartner,
  syncAffiliateCommissions,
  updateAffiliateConversionStatus,
} from "@/lib/growth-export.functions";

type Props = { storeId: string; storeSlug: string };

const STATUS_LABEL: Record<string, string> = {
  pending: "Beklemede",
  approved: "Onaylı",
  paid: "Ödendi",
  rejected: "Reddedildi",
};

/** Global influencer / affiliate merkezi: ortaklar, takip linkleri ve komisyonlar. */
export function AffiliateHubPanel({ storeId, storeSlug }: Props) {
  const queryClient = useQueryClient();
  const { data: partners } = useQuery(affiliatePartnersQuery(storeId));
  const { data: conversions } = useQuery(affiliateConversionsQuery(storeId));
  const savePartner = useServerFn(saveAffiliatePartner);
  const removePartner = useServerFn(deleteAffiliatePartner);
  const syncFn = useServerFn(syncAffiliateCommissions);
  const updateStatus = useServerFn(updateAffiliateConversionStatus);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("DE");
  const [code, setCode] = useState("");
  const [commission, setCommission] = useState("10");
  const [payoutCurrency, setPayoutCurrency] = useState("EUR");
  const [promoCode, setPromoCode] = useState("");
  const [isActive, setIsActive] = useState(true);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["affiliate-partners", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["affiliate-conversions", storeId] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      savePartner({
        data: {
          storeId,
          name,
          email: email || null,
          countryCode: country,
          code: code || suggestAffiliateCode(name),
          commissionPercent: Number(commission.replace(",", ".")),
          payoutCurrency,
          promoCode: promoCode || null,
          isActive,
        } as never,
      }),
    onSuccess: () => {
      toast.success("Ortak kaydedildi");
      setName("");
      setEmail("");
      setCode("");
      setPromoCode("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncFn({ data: { storeId, days: 90 } as never }),
    onSuccess: (result: { matched?: number; created?: number }) => {
      toast.success(
        `Komisyonlar güncellendi: ${result?.created ?? 0} yeni kayıt, ${result?.matched ?? 0} eşleşme`,
      );
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      updateStatus({ data: { storeId, id: input.id, status: input.status } as never }),
    onSuccess: () => {
      toast.success("Komisyon durumu güncellendi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removePartner({ data: { storeId, id } as never }),
    onSuccess: () => {
      toast.success("Ortak kaldırıldı");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Users className="size-4" /> Yeni influencer / ortak
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Her ortağa özel takip linki ve promo kodu verin; komisyonlar kendi para biriminde hesaplanır.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="aff-name">Ad</Label>
            <Input id="aff-name" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="aff-email">E-posta</Label>
            <Input id="aff-email" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Ülke</Label>
            <Select value={country} onValueChange={setCountry}>
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
            <Label htmlFor="aff-code">Takip kodu</Label>
            <Input
              id="aff-code"
              className="mt-1"
              placeholder={name ? suggestAffiliateCode(name) : "otomatik"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="aff-promo">Promo kodu (sipariş eşleştirme)</Label>
            <Input
              id="aff-promo"
              className="mt-1"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="aff-commission">Komisyon %</Label>
            <Input
              id="aff-commission"
              className="mt-1"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
            />
          </div>
          <div>
            <Label>Ödeme para birimi</Label>
            <Select value={payoutCurrency} onValueChange={setPayoutCurrency}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLOBAL_CURRENCIES.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch id="aff-active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="aff-active">Aktif</Label>
          </div>
        </div>
        <Button className="mt-4" disabled={name.length < 2 || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          Ortağı kaydet
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Ortaklar ve takip linkleri</h3>
          <Button size="sm" variant="outline" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
            <RefreshCw className="mr-2 size-4" /> Komisyonları eşleştir
          </Button>
        </div>
        {(partners ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Henüz ortak eklenmedi.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {(partners ?? []).map((partner) => (
              <li key={partner.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {partner.name} <span className="text-muted-foreground">· {partner.country_code}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {affiliateTrackingLink(`https://mefticaret.com/s/${storeSlug}`, partner.code)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {partner.commission_percent}% · {partner.payout_currency}
                  </Badge>
                  {partner.promo_code ? <Badge variant="outline">{partner.promo_code}</Badge> : null}
                  {!partner.is_active ? <Badge variant="outline">Pasif</Badge> : null}
                  <Button size="sm" variant="ghost" aria-label="Ortağı sil" onClick={() => deleteMutation.mutate(partner.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">Komisyon hareketleri</h3>
        {(conversions ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Henüz komisyon yok. Ödenmiş siparişlerde ortağın promo kodu kullanıldığında burada görünür.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2">Ortak</th>
                  <th className="py-2">Sipariş</th>
                  <th className="py-2">Komisyon</th>
                  <th className="py-2">Durum</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {(conversions ?? []).map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-2">{row.affiliate_partners?.name ?? "—"}</td>
                    <td className="py-2">
                      {row.order_total.toFixed(2)} {row.order_currency}
                    </td>
                    <td className="py-2">
                      {row.commission_amount.toFixed(2)} {row.commission_currency}
                    </td>
                    <td className="py-2">{STATUS_LABEL[row.status] ?? row.status}</td>
                    <td className="py-2">
                      <Select
                        value={row.status}
                        onValueChange={(status) => statusMutation.mutate({ id: row.id, status })}
                      >
                        <SelectTrigger className="h-8 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABEL).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
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
        )}
      </div>
    </div>
  );
}
