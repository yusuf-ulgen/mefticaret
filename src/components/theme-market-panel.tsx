/**
 * Tema kütüphanesi: katalogdan tema kurma, aktifleştirme, kaldırma ve
 * ücretli temalar için lisans satın alma.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, CreditCard, Download, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/data-skeleton";
import {
  activateTheme,
  installTheme,
  listThemeMarket,
  startThemePurchase,
  uninstallTheme,
} from "@/lib/theme-market.functions";

const money = (amount: number, currency: string) =>
  `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 0 })} ${currency === "TRY" ? "₺" : currency}`;

export function ThemeMarketPanel({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const list = useServerFn(listThemeMarket);
  const install = useServerFn(installTheme);
  const activate = useServerFn(activateTheme);
  const uninstall = useServerFn(uninstallTheme);
  const purchase = useServerFn(startThemePurchase);

  const query = useQuery({
    queryKey: ["theme-market", storeId],
    queryFn: () => list({ data: { storeId } }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["theme-market", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["store-theme", storeId] });
  };

  const installMutation = useMutation({
    mutationFn: (themeId: string) => install({ data: { storeId, themeId } }),
    onSuccess: (result) => {
      toast.success(result.message);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activateMutation = useMutation({
    mutationFn: (installId: string) => activate({ data: { storeId, installId } }),
    onSuccess: (result) => {
      toast.success(`${result.themeName} aktifleştirildi — ${result.sections} bölüm hazırlandı`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uninstallMutation = useMutation({
    mutationFn: (installId: string) => uninstall({ data: { storeId, installId } }),
    onSuccess: (result) => {
      toast.success(result.message);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const purchaseMutation = useMutation({
    mutationFn: (themeId: string) => purchase({ data: { storeId, themeId } }),
    onSuccess: (result) => {
      toast.success(`${result.themeName} için ödeme sayfası açılıyor — ${money(result.amount, result.currency)}`);
      window.open(result.link, "_blank", "noopener,noreferrer");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isLoading) return <CardSkeleton />;
  if (query.error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
        Tema kütüphanesi yüklenemedi: {(query.error as Error).message}
      </div>
    );
  }

  const themes = query.data?.themes ?? [];
  const busy =
    installMutation.isPending ||
    activateMutation.isPending ||
    uninstallMutation.isPending ||
    purchaseMutation.isPending;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Tema kütüphanesi</h2>
        <p className="text-sm text-muted-foreground">
          Temayı kurun, aktifleştirin ya da kaldırın. Aynı anda yalnızca bir tema aktif olur.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {themes.map((theme) => (
          <Card key={theme.id} className="flex flex-col">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {theme.name}
                    {theme.isActive ? <Badge>Aktif</Badge> : null}
                    {theme.isInstalled && !theme.isActive ? <Badge variant="secondary">Kurulu</Badge> : null}
                  </CardTitle>
                  <CardDescription>
                    {theme.tagline} · v{theme.version}
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {theme.isFeatured ? (
                    <Badge variant="outline" className="gap-1">
                      <Sparkles className="size-3" /> Öne çıkan
                    </Badge>
                  ) : null}
                  <Badge variant="outline">
                    {theme.price > 0 ? money(theme.price, theme.currency) : "Ücretsiz"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <p className="text-sm text-muted-foreground">{theme.description}</p>
              {theme.priceNote ? <p className="text-xs text-muted-foreground">{theme.priceNote}</p> : null}
              {theme.price > 0 && theme.purchasePending && !theme.hasLicense ? (
                <p className="text-xs text-amber-600">Ödeme bekleniyor — onaylandığında tema otomatik kurulur.</p>
              ) : null}

              <div className="mt-auto flex flex-wrap gap-2">
                {theme.price > 0 && !theme.hasLicense ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => purchaseMutation.mutate(theme.id)}
                  >
                    {purchaseMutation.isPending ? (
                      <Loader2 className="mr-1 size-4 animate-spin" />
                    ) : (
                      <CreditCard className="mr-1 size-4" />
                    )}
                    Lisans satın al
                  </Button>
                ) : null}

                {theme.hasLicense && !theme.isInstalled ? (
                  <Button size="sm" disabled={busy} onClick={() => installMutation.mutate(theme.id)}>
                    <Download className="mr-1 size-4" /> Kur
                  </Button>
                ) : null}

                {theme.isInstalled && !theme.isActive && theme.installId ? (
                  <>
                    <Button size="sm" disabled={busy} onClick={() => activateMutation.mutate(theme.installId!)}>
                      <Check className="mr-1 size-4" /> Aktifleştir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => uninstallMutation.mutate(theme.installId!)}
                    >
                      <Trash2 className="mr-1 size-4" /> Kaldır
                    </Button>
                  </>
                ) : null}

                {theme.isActive ? (
                  <span className="text-xs text-muted-foreground">
                    Bu tema mağazanızda yayında — aktif tema kaldırılamaz.
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
