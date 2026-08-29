import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
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
import { CURRENCIES, INDUSTRIES, LOCALES, SUBDOMAIN_SUFFIX } from "@/lib/mefti";
import { storeQuery, storeSettingsQuery } from "@/lib/store-queries";
import { updateStore, updateStoreSettings } from "@/lib/stores.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/settings")({
  head: () => ({
    meta: [
      { title: "Mağaza Ayarları — Mefticaret" },
      { name: "description", content: "Mağaza kimliği, para birimi, dil, vergi ve iletişim ayarlarını yönet." },
      { property: "og:title", content: "Mağaza Ayarları — Mefticaret" },
      { property: "og:description", content: "Marka, yerelleştirme ve fatura bilgilerini güncelle." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: settings } = useQuery(storeSettingsQuery(storeId));
  const saveStore = useServerFn(updateStore);
  const saveSettings = useServerFn(updateStoreSettings);

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("moda");
  const [currency, setCurrency] = useState("TRY");
  const [locale, setLocale] = useState("tr");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [legalName, setLegalName] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [taxIncluded, setTaxIncluded] = useState(true);
  const [guestCheckout, setGuestCheckout] = useState(true);

  useEffect(() => {
    if (!store) return;
    setName(store.name);
    setIndustry(store.industry ?? "moda");
    setCurrency(store.currency);
    setLocale(store.locale);
  }, [store]);

  useEffect(() => {
    if (!settings) return;
    setContactEmail(settings.contact_email ?? "");
    setContactPhone(settings.contact_phone ?? "");
    setLegalName(settings.legal_name ?? "");
    setTaxNumber(settings.tax_number ?? "");
    setTaxIncluded(Boolean(settings.tax_included_prices));
    setGuestCheckout(Boolean(settings.guest_checkout));
  }, [settings]);

  const storeMutation = useMutation({
    mutationFn: () =>
      saveStore({
        data: {
          storeId,
          patch: {
            name: name.trim(),
            industry,
            currency: currency as "TRY",
            locale: locale as "tr",
          },
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["my-stores"] });
      toast.success("Mağaza bilgileri güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const settingsMutation = useMutation({
    mutationFn: () =>
      saveSettings({
        data: {
          storeId,
          patch: {
            contact_email: contactEmail.trim(),
            contact_phone: contactPhone.trim(),
            legal_name: legalName.trim(),
            tax_number: taxNumber.trim(),
            tax_included_prices: taxIncluded,
            guest_checkout: guestCheckout,
          },
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store-settings", storeId] });
      toast.success("Ayarlar kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      storeId={storeId}
      title="Ayarlar"
      description="Mağaza kimliği, yerelleştirme ve fatura bilgileri."
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <form
          className="surface-card space-y-5 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            storeMutation.mutate();
          }}
        >
          <h2 className="font-display text-lg font-semibold">Mağaza kimliği</h2>
          <div className="space-y-2">
            <Label htmlFor="settings-name">Mağaza adı</Label>
            <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} required />
            <p className="text-xs text-muted-foreground">
              Alt alan adı: {store?.slug}.{SUBDOMAIN_SUFFIX} (değiştirilemez)
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Sektör</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Para birimi</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((code) => (
                    <SelectItem key={code} value={code}>{code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dil</Label>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOCALES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={storeMutation.isPending}>
            {storeMutation.isPending ? "Kaydediliyor..." : "Değişiklikleri kaydet"}
          </Button>
        </form>

        <form
          className="surface-card space-y-5 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            settingsMutation.mutate();
          }}
        >
          <h2 className="font-display text-lg font-semibold">İletişim & fatura</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-email">İletişim e-postası</Label>
              <Input
                id="settings-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-phone">Telefon</Label>
              <Input
                id="settings-phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-legal">Ünvan</Label>
              <Input
                id="settings-legal"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-tax">Vergi no</Label>
              <Input
                id="settings-tax"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Fiyatlar vergi dahil</p>
              <p className="text-xs text-muted-foreground">Vitrindeki fiyatlar KDV dahil gösterilir.</p>
            </div>
            <Switch checked={taxIncluded} onCheckedChange={setTaxIncluded} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Üye olmadan alışveriş</p>
              <p className="text-xs text-muted-foreground">Misafir checkout akışını etkinleştir.</p>
            </div>
            <Switch checked={guestCheckout} onCheckedChange={setGuestCheckout} />
          </div>

          <Button type="submit" disabled={settingsMutation.isPending}>
            {settingsMutation.isPending ? "Kaydediliyor..." : "Ayarları kaydet"}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
