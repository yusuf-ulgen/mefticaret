import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, HelpCircle, MessageSquare, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/mefti";
import { storeQuestionsQuery, type QuestionStatus } from "@/lib/questions-queries";
import { deleteQuestion, moderateQuestion } from "@/lib/questions.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/questions")({
  head: () => ({
    meta: [
      { title: "Soru & Cevap — Mefticaret" },
      {
        name: "description",
        content: "Müşteri sorularını yanıtla, yayınla ve vitrindeki soru-cevap bölümünü yönet.",
      },
      { property: "og:title", content: "Soru & Cevap — Mefticaret" },
      {
        property: "og:description",
        content: "Mefticaret ürün soru-cevap moderasyonu ve mağaza yanıtları.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuestionsPage,
});

const STATUS_LABELS: Record<QuestionStatus, string> = {
  pending: "Yanıt bekliyor",
  published: "Yayında",
  rejected: "Reddedildi",
};

const FILTERS: { value: QuestionStatus | "all"; label: string }[] = [
  { value: "pending", label: "Yanıt bekleyen" },
  { value: "published", label: "Yayında" },
  { value: "rejected", label: "Reddedilen" },
  { value: "all", label: "Tümü" },
];

function QuestionsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<QuestionStatus | "all">("pending");
  const [answerFor, setAnswerFor] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");

  const { data: questions, isLoading } = useQuery(storeQuestionsQuery(storeId, filter));
  const moderate = useServerFn(moderateQuestion);
  const remove = useServerFn(deleteQuestion);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["questions", storeId] });
  }

  const moderation = useMutation({
    mutationFn: (input: { questionId: string; status?: QuestionStatus; answer?: string }) =>
      moderate({ data: input }),
    onSuccess: async () => {
      await refresh();
      setAnswerFor(null);
      setAnswerText("");
      toast.success("Soru güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deletion = useMutation({
    mutationFn: (questionId: string) => remove({ data: { questionId } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Soru silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const list = questions ?? [];
  const answered = list.filter((item) => item.answer).length;

  return (
    <AppShell
      storeId={storeId}
      title="Soru & Cevap"
      description="Müşteri sorularını yanıtla, yayınla ve vitrindeki soru-cevap bölümünü yönet."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-card p-5">
          <p className="text-sm text-muted-foreground">Listelenen soru</p>
          <p className="mt-1 text-2xl font-semibold">{list.length}</p>
        </div>
        <div className="surface-card p-5">
          <p className="text-sm text-muted-foreground">Yanıtlanan</p>
          <p className="mt-1 text-2xl font-semibold">{answered}</p>
        </div>
        <div className="surface-card p-5">
          <p className="text-sm text-muted-foreground">Yanıt oranı</p>
          <p className="mt-1 text-2xl font-semibold">
            {list.length ? `%${Math.round((answered / list.length) * 100)}` : "—"}
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
            <HelpCircle className="mx-auto mb-3 size-6 text-muted-foreground" />
            <p className="font-medium">Bu filtrede soru yok</p>
            <p className="text-sm text-muted-foreground">
              Vitrinden gelen yeni sorular burada yanıt bekler.
            </p>
          </div>
        ) : (
          list.map((item) => (
            <article key={item.id} className="surface-card space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-semibold">{item.author_name}</span>
                  <p className="text-xs text-muted-foreground">
                    {(item.products as { title?: string } | null)?.title ?? "Ürün"} ·{" "}
                    {formatDateTime(item.created_at)}
                  </p>
                </div>
                <Badge
                  variant={
                    item.status === "published"
                      ? "default"
                      : item.status === "rejected"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {STATUS_LABELS[item.status as QuestionStatus]}
                </Badge>
              </div>

              <p className="text-sm font-medium whitespace-pre-line">{item.question}</p>
              {item.answer ? (
                <p className="border-l-2 border-primary pl-3 text-sm">
                  <span className="font-medium">Mağaza yanıtı:</span> {item.answer}
                </p>
              ) : null}

              {answerFor === item.id ? (
                <div className="space-y-2">
                  <Textarea
                    rows={3}
                    value={answerText}
                    onChange={(event) => setAnswerText(event.target.value)}
                    placeholder="Müşteriye yanıtını yaz (kaydedince soru yayınlanır)"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={moderation.isPending}
                      onClick={() =>
                        moderation.mutate({ questionId: item.id, answer: answerText.trim() })
                      }
                    >
                      Yanıtla ve yayınla
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAnswerFor(null)}>
                      Vazgeç
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {item.status !== "published" ? (
                    <Button
                      size="sm"
                      className="gap-2"
                      disabled={moderation.isPending}
                      onClick={() =>
                        moderation.mutate({ questionId: item.id, status: "published" })
                      }
                    >
                      <Check className="size-4" />
                      Yayınla
                    </Button>
                  ) : null}
                  {item.status !== "rejected" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      disabled={moderation.isPending}
                      onClick={() =>
                        moderation.mutate({ questionId: item.id, status: "rejected" })
                      }
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
                      setAnswerFor(item.id);
                      setAnswerText(item.answer ?? "");
                    }}
                  >
                    <MessageSquare className="size-4" />
                    {item.answer ? "Yanıtı düzenle" : "Yanıtla"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-2 text-destructive"
                    disabled={deletion.isPending}
                    onClick={() => deletion.mutate(item.id)}
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
