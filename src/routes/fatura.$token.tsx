import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getInvoiceByToken } from "@/lib/invoice-pay.functions";
import { INVOICE_STATUS_LABELS } from "@/lib/subscription";

export const Route = createFileRoute("/fatura/$token")({
  head: () => ({
    meta: [
      { title: "Abonelik Faturası Ödeme — Mefticaret" },
      {
        name: "description",
        content:
          "Mefticaret abonelik faturanızın tutarını, vadesini ve ödeme durumunu görüntüleyin, ödemenizi tamamlayın.",
      },
      { property: "og:title", content: "Abonelik Faturası Ödeme — Mefticaret" },
      {
        property: "og:description",
        content: "Fatura tutarı, vade tarihi ve ödeme durumu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: InvoicePayPage,
});

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(new Date(value));
}

function InvoicePayPage() {
  const { token } = Route.useParams();
  const { data, isPending } = useQuery({
    queryKey: ["public-invoice", token],
    queryFn: () => getInvoiceByToken({ data: { token } }),
    retry: false,
  });

  const [payError, setPayError] = useState<string | null>(null);
  const payment = useMutation({
    mutationFn: () => startInvoiceCardPayment({ data: { token } }),
    onMutate: () => setPayError(null),
    onSuccess: (result) => {
      window.location.href = result.checkoutUrl;
    },
    onError: (cause: unknown) =>
      setPayError(cause instanceof Error ? cause.message : "Ödeme başlatılamadı."),
  });
  const startPayment = () => payment.mutate();
  const isPaying = payment.isPending;


  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 px-5 py-14">
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Mefticaret</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Abonelik faturası</h1>
      </div>

      {isPending ? (
        <div className="space-y-3 rounded-xl border bg-card p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : !data ? (
        <div className="space-y-3 rounded-xl border bg-card p-6 text-center">
          <AlertTriangle className="mx-auto size-6 text-destructive" />
          <p className="font-medium">Bu ödeme linki geçersiz veya süresi dolmuş.</p>
          <p className="text-sm text-muted-foreground">
            Faturanıza panelinizdeki Abonelik &amp; Limitler ekranından ulaşabilirsiniz.
          </p>
          <Button asChild variant="outline">
            <Link to="/login">Panele giriş yap</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-5 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="size-4" />
                {data.invoiceNumber}
              </p>
              <p className="mt-1 text-3xl font-semibold">
                {formatMoney(data.total, data.currency)}
              </p>
              <p className="text-sm text-muted-foreground">{data.storeName}</p>
            </div>
            <Badge variant={data.status === "paid" ? "secondary" : "destructive"}>
              {INVOICE_STATUS_LABELS[data.status] ?? data.status}
            </Badge>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Fatura tarihi</dt>
              <dd className="font-medium">{formatDate(data.issuedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Son ödeme tarihi</dt>
              <dd className="font-medium">{formatDate(data.dueAt)}</dd>
            </div>
          </dl>

          {data.status === "paid" ? (
            <p className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm">
              <CheckCircle2 className="size-4 text-primary" />
              Bu fatura {formatDate(data.paidAt)} tarihinde ödendi.
            </p>
          ) : (
            <>
              {data.storeStatus === "suspended" ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  Ödeme gecikmesi nedeniyle mağazanız dondurulmuş durumda. Ödeme tamamlandığında
                  mağaza otomatik olarak yeniden açılır.
                </p>
              ) : null}
              {data.cardPaymentEnabled ? (
                <>
                  <Button className="w-full" onClick={() => startPayment()} disabled={isPaying}>
                    {isPaying ? "Ödeme sayfası hazırlanıyor…" : "Kredi/banka kartı ile öde"}
                  </Button>
                  {payError ? (
                    <p className="text-center text-xs text-destructive">{payError}</p>
                  ) : (
                    <p className="text-center text-xs text-muted-foreground">
                      Ödeme, Ödeal güvenli 3D Secure sayfasında tamamlanır; kart bilgileriniz
                      Mefticaret sunucularına iletilmez.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <Button asChild className="w-full">
                    <Link to="/login">Ödemeyi panelden tamamla</Link>
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Panele giriş yaptıktan sonra Abonelik &amp; Limitler ekranındaki Faturalar
                    sekmesinden ödeme yapabilirsiniz.
                  </p>
                </>
              )}
            </>
          )}

        </div>
      )}
    </main>
  );
}
