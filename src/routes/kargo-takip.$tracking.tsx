import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, CheckCircle2, Circle, ExternalLink, Share2, Truck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SHIPMENT_STATUS_LABELS, carrierName, carrierTrackUrl } from "@/lib/carriers";
import { getPublicTracking } from "@/lib/tracking-public.functions";

const VALID = /^[A-Za-z0-9-_]{6,120}$/;

const trackingQuery = (tracking: string) =>
  queryOptions({
    queryKey: ["public-tracking", tracking],
    queryFn: () => (VALID.test(tracking) ? getPublicTracking({ data: { tracking } }) : Promise.resolve(null)),
    staleTime: 60_000,
  });


export const Route = createFileRoute("/kargo-takip/$tracking")({
  loader: async ({ context, params }) => {
    if (!VALID.test(params.tracking)) return { found: false };
    const data = await context.queryClient.ensureQueryData(trackingQuery(params.tracking));
    return { found: Boolean(data), storeName: data?.store.name ?? null };
  },
  head: ({ loaderData, params }) => {
    const title = loaderData?.storeName ? `Kargo Takibi ${params.tracking} — ${loaderData.storeName}` : "Kargo Takibi — Mefticaret";
    const description = "Gönderinizin güncel durumunu, kargo hareketlerini ve tahmini teslim tarihini görün.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  errorComponent: () => <Shell><p className="text-center text-muted-foreground">Takip bilgisi şu anda alınamıyor. Lütfen biraz sonra tekrar deneyin.</p></Shell>,
  notFoundComponent: () => <NotFound />,
  component: TrackingPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-background px-4 py-8 text-foreground"><div className="mx-auto w-full max-w-md space-y-5">{children}</div></main>;
}

function NotFound() {
  return (
    <Shell>
      <div className="surface-card p-6 text-center">
        <Truck className="mx-auto mb-3 size-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Gönderi bulunamadı</h1>
        <p className="mt-1 text-sm text-muted-foreground">Takip numarasını kontrol edin. Yeni verilen kargolar birkaç saat içinde görünür.</p>
      </div>
    </Shell>
  );
}

function TrackingPage() {
  const { tracking } = Route.useParams();
  const valid = VALID.test(tracking);
  const { data } = useSuspenseQuery(trackingQuery(tracking));
  if (!valid || !data) return <NotFound />;

  const brand = data.brandColor ?? undefined;
  const external = data.tracking_url || carrierTrackUrl(data.carrier_key, data.tracking_number);
  const delivered = data.status === "delivered";

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "Kargo takibi", url });
      else { await navigator.clipboard.writeText(url); toast.success("Bağlantı kopyalandı"); }
    } catch { /* kullanıcı vazgeçti */ }
  };

  return (
    <Shell>
      <header className="flex items-center justify-between gap-3">
        <Link to="/s/$slug" params={{ slug: data.store.slug }} className="flex min-h-11 items-center gap-2">
          {data.store.logo_url ? (
            <img src={data.store.logo_url} alt={data.store.name} width={120} height={40} className="h-10 w-auto object-contain" />
          ) : (
            <span className="text-lg font-semibold" style={brand ? { color: brand } : undefined}>{data.store.name}</span>
          )}
        </Link>
        <Button variant="outline" size="sm" className="h-11" onClick={share}><Share2 className="mr-1 size-4" /> Paylaş</Button>
      </header>

      <section className="surface-card space-y-3 p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Kargo Takibi</p>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-semibold">{carrierName(data.carrier_key, data.carrier)}</p>
            <p className="font-mono text-sm text-muted-foreground">{data.tracking_number}</p>
          </div>
          <Badge style={brand ? { backgroundColor: brand, color: "white" } : undefined}>{SHIPMENT_STATUS_LABELS[data.status] ?? data.status}</Badge>
        </div>
        {data.estimated_delivery_date && !delivered ? (
          <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm">
            <CalendarClock className="size-4" />
            Tahmini teslimat: <strong>{new Date(`${data.estimated_delivery_date}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</strong>
          </div>
        ) : null}
      </section>

      <section className="surface-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Kargo Geçmişi</h2>
        {data.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz hareket yok. Kargo firması gönderiyi işleme aldığında burada görünecek.</p>
        ) : (
          <ol className="relative space-y-5 border-l border-border pl-5">
            {data.events.map((e, i) => (
              <li key={`${e.status}-${e.event_at}`} className="relative">
                <span className="absolute -left-[1.85rem] top-0 bg-background">
                  {i === 0 ? <CheckCircle2 className="size-5" style={brand ? { color: brand } : undefined} /> : <Circle className="size-5 text-muted-foreground" />}
                </span>
                <p className={i === 0 ? "font-medium" : "text-sm"}>{e.description ?? SHIPMENT_STATUS_LABELS[e.status] ?? e.status}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.event_at).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {e.location ? ` · ${e.location}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {external ? (
        <Button asChild variant="outline" className="h-11 w-full">
          <a href={external} target="_blank" rel="noreferrer noopener"><ExternalLink className="mr-2 size-4" /> Kargo firmasının sayfasında aç</a>
        </Button>
      ) : null}
    </Shell>
  );
}
