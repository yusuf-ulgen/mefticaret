import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, MessageSquare, Star, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/mefti";
import { storeReviewsQuery, type ReviewStatus } from "@/lib/reviews-queries";
import { deleteReview, moderateReview } from "@/lib/reviews.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/reviews")({
  head: () => ({
    meta: [
      { title: "Değerlendirmeler — Mefticaret" },
      {
        name: "description",
        content: "Ürün yorumlarını onayla, reddet, yanıtla ve vitrin itibarını yönet.",
      },
      { property: "og:title", content: "Değerlendirmeler — Mefticaret" },
      {
        property: "og:description",
        content: "Mefticaret ürün değerlendirme moderasyonu ve mağaza yanıtları.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewsPage,
});

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Onay bekliyor",
  published: "Yayında",
  rejected: "Reddedildi",
};

const FILTERS: { value: ReviewStatus | "all"; label: string }[] = [
  { value: "pending", label: "Onay bekleyen" },
  { value: "published", label: "Yayında" },
  { value: "rejected", label: "Reddedilen" },
  { value: "all", label: "Tümü" },
];

function Stars({ value }: { value: number }) {
  return (
    <span className="text-sm text-primary" aria-label={`${value} / 5 puan`}>
      {"★".repeat(value)}
      <span className="text-muted-foreground/40">{"★".repeat(5 - value)}</span>
    </span>
  );
}

function ReviewsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ReviewStatus | "all">("pending");
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: reviews, isLoading } = useQuery(storeReviewsQuery(storeId, filter));
  const moderate = useServerFn(moderateReview);
  const remove = useServerFn(deleteReview);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["reviews", storeId] });
  }

  const moderation = useMutation({
    mutationFn: (input: { reviewId: string; status?: ReviewStatus; reply?: string }) =>
      moderate({ data: input }),
    onSuccess: async () => {
      await refresh();
      setReplyFor(null);
      setReplyText("");
      toast.success("Yorum güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deletion = useMutation({
    mutationFn: (reviewId: string) => remove({ data: { reviewId } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Yorum silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const list = reviews ?? [];
  const average = list.length
    ? list.reduce((sum, review) => sum + review.rating, 0) / list.length
    : 0;

  return (
    <AppShell
      storeId={storeId}
      title="Değerlendirmeler"
      description="Müşteri yorumlarını onayla, yanıtla ve vitrindeki itibarını yönet."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-card p-5">
          <p className="text-sm text-muted-foreground">Listelenen yorum</p>
          <p className="mt-1 text-2xl font-semibold">{list.length}</p>
        </div>
        <div className="surface-card p-5">
          <p className="text-sm text-muted-foreground">Ortalama puan</p>
          <p className="mt-1 text-2xl font-semibold">{average ? average.toFixed(1) : "—"}</p>
        </div>
        <div className="surface-card p-5">
          <p className="text-sm text-muted-foreground">Doğrulanmış alışveriş</p>
          <p className="mt-1 text-2xl font-semibold">
            {list.filter((review) => review.is_verified_purchase).length}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Button
            key={item.value}
            size="sm"
            variant={filter === item.value ? "default" : "outline"}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {isLoading ? (
          <p className="text-muted-foreground">Yükleniyor…</p>
        ) : list.length === 0 ? (
          <div className="surface-card p-10 text-center">
            <Star className="mx-auto mb-3 size-6 text-muted-foreground" />
            <p className="font-medium">Bu filtrede yorum yok</p>
            <p className="text-sm text-muted-foreground">
              Vitrinden gelen yeni değerlendirmeler burada onay bekler.
            </p>
          </div>
        ) : (
          list.map((review) => (
            <article key={review.id} className="surface-card space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{review.author_name}</span>
                    <Stars value={review.rating} />
                    {review.is_verified_purchase ? (
                      <Badge variant="secondary">Doğrulanmış</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(review.products as { title?: string } | null)?.title ?? "Ürün"} ·{" "}
                    {formatDateTime(review.created_at)}
                  </p>
                </div>
                <Badge
                  variant={
                    review.status === "published"
                      ? "default"
                      : review.status === "rejected"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {STATUS_LABELS[review.status as ReviewStatus]}
                </Badge>
              </div>

              {review.title ? <p className="font-medium">{review.title}</p> : null}
              {review.body ? (
                <p className="text-sm text-muted-foreground whitespace-pre-line">{review.body}</p>
              ) : null}
              {review.reply ? (
                <p className="border-l-2 border-primary pl-3 text-sm">
                  <span className="font-medium">Mağaza yanıtı:</span> {review.reply}
                </p>
              ) : null}

              {replyFor === review.id ? (
                <div className="space-y-2">
                  <Textarea
                    rows={3}
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    placeholder="Müşteriye yanıtını yaz"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={moderation.isPending}
                      onClick={() =>
                        moderation.mutate({ reviewId: review.id, reply: replyText.trim() })
                      }
                    >
                      Yanıtı kaydet
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReplyFor(null)}>
                      Vazgeç
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {review.status !== "published" ? (
                    <Button
                      size="sm"
                      className="gap-2"
                      disabled={moderation.isPending}
                      onClick={() =>
                        moderation.mutate({ reviewId: review.id, status: "published" })
                      }
                    >
                      <Check className="size-4" />
                      Yayınla
                    </Button>
                  ) : null}
                  {review.status !== "rejected" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      disabled={moderation.isPending}
                      onClick={() => moderation.mutate({ reviewId: review.id, status: "rejected" })}
                    >
                      <X className="size-4" />
                      Reddet
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      setReplyFor(review.id);
                      setReplyText(review.reply ?? "");
                    }}
                  >
                    <MessageSquare className="size-4" />
                    {review.reply ? "Yanıtı düzenle" : "Yanıtla"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-2 text-destructive"
                    disabled={deletion.isPending}
                    onClick={() => deletion.mutate(review.id)}
                  >
                    <Trash2 className="size-4" />
                    Sil
                  </Button>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </AppShell>
  );
}
