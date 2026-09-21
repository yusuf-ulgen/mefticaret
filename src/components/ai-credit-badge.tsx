import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { aiCreditPackagesQuery, aiCreditWalletQuery } from "@/lib/ai-credits-queries";
import { startAiCreditPayment } from "@/lib/ai-credits.functions";
import { formatCurrency } from "@/lib/money";

/**
 * Satıcı üst çubuğundaki canlı AI kredi sayacı ve tek tıkla kredi yükleme penceresi.
 * Bakiye ve paket fiyatları yalnızca sunucudan okunur.
 */
export function AiCreditBadge({ storeId }: { storeId: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const wallet = useQuery({ ...aiCreditWalletQuery(storeId), refetchInterval: 60_000 });
  const packages = useQuery({ ...aiCreditPackagesQuery(), enabled: open });

  const purchase = useMutation({
    mutationFn: (packageId: string) => startAiCreditPayment({ data: { storeId, packageId } }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["ai-credit-wallet", storeId] });
      window.location.href = result.link;
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const balance = wallet.data?.balance ?? 0;
  const low = balance <= 5;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={low ? "destructive" : "secondary"}
          size="sm"
          className="h-8 gap-1.5 rounded-full px-2.5 text-xs font-semibold"
          aria-label="Yapay zekâ kredi bakiyesi"
        >
          <Sparkles className="size-3.5" aria-hidden />
          <span className="tabular-nums">{balance}</span>
          <span className="hidden sm:inline">kredi</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Yapay zekâ kredisi yükle</DialogTitle>
          <DialogDescription>
            Mevcut bakiyeniz <strong className="tabular-nums">{balance}</strong> kredi. Ürün
            açıklaması ve SEO metni 1 kredi; görsel üretimi, kampanya taslağı ve CoPilot işlemi 2
            kredidir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {packages.isLoading ? (
            <p className="text-sm text-muted-foreground">Paketler yükleniyor…</p>
          ) : null}
          {(packages.data ?? []).map((pack) => (
            <div
              key={pack.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{pack.name}</p>
                <p className="text-xs text-muted-foreground">
                  {pack.credits} kredi · {formatCurrency(pack.price, pack.currency as never)}
                </p>
              </div>
              <Button
                size="sm"
                className="rounded-full"
                disabled={purchase.isPending}
                onClick={() => purchase.mutate(pack.id)}
              >
                {purchase.isPending ? "Yönlendiriliyor…" : "Satın al"}
              </Button>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Ödeme güvenli kart sayfasında tamamlanır; onaydan sonra krediler otomatik yüklenir.
        </p>
      </DialogContent>
    </Dialog>
  );
}
