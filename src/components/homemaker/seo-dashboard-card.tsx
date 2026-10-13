import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, Loader2, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BigButton, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import {
  getStoreSearchPerformance,
  listProductSeoScores,
  runProductPageSpeed,
  saveProductMeta,
  suggestProductMeta,
  type ProductSeoRow,
} from "@/lib/kolay-seo-dashboard.functions";

function tone(score: number) {
  if (score >= 90) return "bg-accent text-accent-foreground";
  if (score >= 50) return "bg-secondary text-secondary-foreground";
  return "bg-destructive/15 text-destructive";
}

function Pill({ label, score }: { label: string; score: number | null }) {
  return (
    <span
      className={`inline-flex min-w-[76px] flex-col items-center rounded-xl px-2 py-1 text-xs ${score === null ? "bg-muted text-muted-foreground" : tone(score)}`}
    >
      <span className="text-[11px] opacity-80">{label}</span>
      <strong className="text-base">{score === null ? "—" : score}</strong>
    </span>
  );
}

/** Kolay Panel SEO paneli: ürün başına puanlar + Google arama performansı. */
export function SeoDashboardCard({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listProductSeoScores);
  const perf = useServerFn(getStoreSearchPerformance);
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["kolay-seo-dash", storeId, page, catalogSearch],
    queryFn: () => list({ data: { storeId, page, search: catalogSearch } }),
  });
  const { data: search } = useQuery({
    queryKey: ["kolay-seo-gsc", storeId],
    queryFn: () => perf({ data: { storeId } }),
    staleTime: 10 * 60_000,
  });

  const rows = data?.rows ?? [];
  const avg = (pick: (r: ProductSeoRow) => number) =>
    rows.length ? Math.round(rows.reduce((s, r) => s + pick(r), 0) / rows.length) : 0;

  return (
    <SoftCard>
      <div className="flex items-center gap-2">
        <Gauge className="h-5 w-5 text-primary" aria-hidden />
        <h3 className="text-lg font-semibold">SEO Paneli</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Ürün sayfalarınızın Google'a ne kadar hazır olduğunu gösterir. Yeşil 90-100, sarı 50-89,
        kırmızı 50'nin altı.
      </p>

      <div className="mt-3 rounded-2xl bg-muted/60 p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Search className="h-4 w-4" aria-hidden /> Google'da son 28 gün
        </div>
        {search?.status === "ok" ? (
          <div className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="text-2xl font-semibold">{search.totals?.impressions ?? 0}</div>
              <div className="text-xs text-muted-foreground">görünme</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{search.totals?.clicks ?? 0}</div>
              <div className="text-xs text-muted-foreground">tıklama</div>
            </div>
            {search.rows.length === 0 && (
              <p className="col-span-2 text-xs text-muted-foreground">
                Google henüz bu mağaza için arama verisi göstermiyor. Yeni sayfalarda bu birkaç
                hafta sürebilir.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {search ? "Google arama verisi şu an alınamadı." : "Yükleniyor…"}
          </p>
        )}
      </div>

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setCatalogSearch(searchTerm);
          setPage(0);
        }}
      >
        <input
          className={`${inputClass} min-w-0 flex-1`}
          aria-label="Tüm SEO ürünlerinde ara"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Ürün veya adres ara"
        />
        <BigButton type="submit" disabled={isFetching}>
          Ara
        </BigButton>
      </form>
      {error ? (
        <div role="alert" className="mt-4">
          <p>{error.message}</p>
          <BigButton onClick={() => void refetch()}>Tekrar dene</BigButton>
        </div>
      ) : null}
      {isLoading ? (
        <div className="mt-4 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : error ? null : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Henüz ürün yok.</p>
      ) : (
        <>
          <p className="mt-3 text-xs text-muted-foreground">
            {data?.total} ürün · Puan ortalamaları bu sayfadaki ürünleri kapsar.
          </p>
          <div className="mt-4 flex gap-2">
            <Pill label="Meta" score={avg((r) => r.metaScore)} />
            <Pill label="Paylaşım" score={avg((r) => r.ogScore)} />
          </div>
          <ul className="mt-4 space-y-3">
            {rows.map((row) => (
              <ProductRow
                key={row.id}
                storeId={storeId}
                row={row}
                speedReady={data?.pagespeedReady ?? false}
                onChanged={() => qc.invalidateQueries({ queryKey: ["kolay-seo-dash", storeId] })}
              />
            ))}
          </ul>
        </>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <BigButton disabled={page === 0 || isFetching} onClick={() => setPage((p) => p - 1)}>
          ?nceki
        </BigButton>
        <span className="text-sm">
          Sayfa {page + 1} / {Math.max(1, Math.ceil((data?.total ?? 0) / 25))}
        </span>
        <BigButton
          disabled={isFetching || !data || (page + 1) * data.pageSize >= data.total}
          onClick={() => setPage((p) => p + 1)}
        >
          Sonraki
        </BigButton>
      </div>
    </SoftCard>
  );
}

function ProductRow({
  storeId,
  row,
  speedReady,
  onChanged,
}: {
  storeId: string;
  row: ProductSeoRow;
  speedReady: boolean;
  onChanged: () => void;
}) {
  const suggest = useServerFn(suggestProductMeta);
  const save = useServerFn(saveProductMeta);
  const speed = useServerFn(runProductPageSpeed);
  const [busy, setBusy] = useState<"ai" | "save" | "speed" | null>(null);
  const [draft, setDraft] = useState<{ title: string; description: string } | null>(null);
  const low = row.metaScore < 90 || row.ogScore < 90;

  const run = async <T,>(kind: "ai" | "save" | "speed", fn: () => Promise<T>) => {
    setBusy(kind);
    try {
      return await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem başarısız");
      return null;
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="rounded-2xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a
          href={row.url}
          target="_blank"
          rel="noreferrer"
          className="font-medium underline-offset-2 hover:underline"
        >
          {row.title}
        </a>
        {!row.published && <span className="text-xs text-muted-foreground">Yayında değil</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Pill label="Hız" score={row.speed?.score ?? null} />
        <Pill label="Meta" score={row.metaScore} />
        <Pill label="Paylaşım" score={row.ogScore} />
      </div>
      {row.speed && (
        <p className="mt-1 text-xs text-muted-foreground">
          Yüklenme {(row.speed.lcp / 1000).toFixed(1)} sn · Kayma {row.speed.cls} · Takılma{" "}
          {row.speed.tbt} ms
        </p>
      )}
      {row.issues.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{row.issues.join(" · ")}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {low && (
          <BigButton
            onClick={() =>
              run("ai", async () =>
                setDraft(await suggest({ data: { storeId, productId: row.id } })),
              )
            }
            disabled={busy !== null}
          >
            {busy === "ai" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}{" "}
            Otomatik öneri
          </BigButton>
        )}
        <BigButton
          tone="ghost"
          disabled={busy !== null || !speedReady || !row.published}
          onClick={() =>
            run("speed", async () => {
              await speed({ data: { storeId, productId: row.id } });
              toast.success("Hız ölçüldü");
              onChanged();
            })
          }
        >
          {busy === "speed" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Gauge className="h-4 w-4" />
          )}{" "}
          Hızı ölç
        </BigButton>
      </div>
      {!speedReady && (
        <p className="mt-1 text-xs text-muted-foreground">Hız ölçümü yakında açılacak.</p>
      )}

      {draft && (
        <div className="mt-3 space-y-2">
          <input
            className={inputClass}
            value={draft.title}
            maxLength={70}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            aria-label="Meta başlık"
          />
          <textarea
            className={inputClass}
            rows={3}
            value={draft.description}
            maxLength={170}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            aria-label="Meta açıklama"
          />
          <BigButton
            disabled={busy !== null}
            onClick={() =>
              run("save", async () => {
                await save({ data: { storeId, productId: row.id, ...draft } });
                toast.success("Kaydedildi");
                setDraft(null);
                onChanged();
              })
            }
          >
            {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />} Kaydet
          </BigButton>
        </div>
      )}
    </li>
  );
}
