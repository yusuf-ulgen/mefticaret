import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Bot, Plus, Send, Sparkles, Trash2, User } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { copilotConversationsQuery, copilotMessagesQuery } from "@/lib/copilot-queries";
import { deleteCopilotConversation, getCopilotContext, sendCopilotMessage } from "@/lib/copilot.functions";
import { formatDateTime, formatNumber } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/copilot")({
  head: () => ({
    meta: [
      { title: "Mefticaret Copilot — Mağaza Asistanı" },
      {
        name: "description",
        content:
          "Mağazanızın gerçek sipariş, stok, müşteri ve pazarlama verisiyle konuşan operasyon asistanı; öneriler ve aksiyon planları alın.",
      },
      { property: "og:title", content: "Mefticaret Copilot — Mağaza Asistanı" },
      {
        property: "og:description",
        content: "Canlı mağaza verisiyle temellendirilmiş sohbet: ciro, stok, sipariş ve kampanya önerileri.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CopilotPage,
});

const SUGGESTIONS = [
  "Son 30 günün satış performansını özetle ve 3 aksiyon öner.",
  "Kritik stoktaki ürünler için sipariş planı çıkar.",
  "Terk edilen sepetleri geri kazanmak için kampanya kurgusu öner.",
  "Ortalama sepet tutarını artıracak fırsatları listele.",
];

function CopilotPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const store = useQuery(storeQuery(storeId));
  const conversations = useQuery(copilotConversationsQuery(storeId));
  const messages = useQuery(copilotMessagesQuery(conversationId));

  const contextFn = useServerFn(getCopilotContext);
  const context = useQuery({
    queryKey: ["copilot", "context", storeId],
    queryFn: () => contextFn({ data: { storeId } }),
  });

  const sendFn = useServerFn(sendCopilotMessage);
  const deleteFn = useServerFn(deleteCopilotConversation);

  const send = useMutation({
    mutationFn: (message: string) => sendFn({ data: { storeId, conversationId, message } }),
    onSuccess: async (result) => {
      setConversationId(result.conversationId);
      setInput("");
      await queryClient.invalidateQueries({ queryKey: ["copilot"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { conversationId: id } }),
    onSuccess: async (_data, id) => {
      if (id === conversationId) setConversationId(null);
      toast.success("Sohbet silindi");
      await queryClient.invalidateQueries({ queryKey: ["copilot"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data, send.isPending]);

  const summary = context.data;

  function submit() {
    const value = input.trim();
    if (value.length < 2) {
      toast.error("Lütfen sorunuzu yazın");
      return;
    }
    send.mutate(value);
  }

  return (
    <AppShell
      storeId={storeId}
      title="Mefticaret Copilot"
      description={`${store.data?.name ?? "Mağaza"} verileriyle temellendirilmiş operasyon asistanı.`}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setConversationId(null)}
          >
            <Plus className="size-4" /> Yeni sohbet
          </Button>

          {conversations.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (conversations.data ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 p-4 text-xs text-muted-foreground">
              Henüz sohbet yok. Aşağıdaki hazır sorulardan biriyle başlayabilirsiniz.
            </p>
          ) : (
            <ul className="space-y-1">
              {(conversations.data ?? []).map((row) => (
                <li key={row.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setConversationId(row.id)}
                    className={cn(
                      "flex-1 truncate rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                      conversationId === row.id && "bg-muted font-medium",
                    )}
                  >
                    {row.title}
                    <span className="block text-[0.7rem] text-muted-foreground">
                      {formatDateTime(row.last_message_at)}
                    </span>
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label="Sohbeti sil">
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Sohbet silinsin mi?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Bu işlem geri alınamaz; sohbetteki tüm mesajlar kaldırılır.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove.mutate(row.id)}>Sil</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="space-y-4">
          <div className="surface-card p-4">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Canlı mağaza bağlamı (30 gün)
            </p>
            {context.isLoading ? (
              <Skeleton className="mt-3 h-12 w-full" />
            ) : summary ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Ciro: {formatNumber(summary.ciro)} {summary.para_birimi}</Badge>
                <Badge variant="secondary">Sipariş: {formatNumber(summary.siparis)}</Badge>
                <Badge variant="secondary">Ort. sepet: {formatNumber(summary.ortalama_sepet)}</Badge>
                <Badge variant="secondary">Bekleyen: {formatNumber(summary.bekleyen_siparis)}</Badge>
                <Badge variant="secondary">Kritik stok: {summary.kritik_stok.length}</Badge>
                <Badge variant="secondary">Terk sepet: {formatNumber(summary.terk_edilen_sepet)}</Badge>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">Bağlam verisi yüklenemedi.</p>
            )}
          </div>

          <div className="surface-card flex min-h-[420px] flex-col p-4">
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {!conversationId ? (
                <div className="space-y-3 py-6 text-center">
                  <Sparkles className="mx-auto size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Copilot mağazanızın gerçek verisini okuyarak yanıt verir. Bir soruyla başlayın.
                  </p>
                  <div className="mx-auto flex max-w-xl flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((item) => (
                      <Button
                        key={item}
                        variant="outline"
                        size="sm"
                        onClick={() => send.mutate(item)}
                        disabled={send.isPending}
                      >
                        {item}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : messages.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                (messages.data ?? []).map((row) => (
                  <div key={row.id} className="flex gap-3">
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-lg",
                        row.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      {row.role === "assistant" ? <Bot className="size-4" /> : <User className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{row.content}</pre>
                      <p className="mt-1 text-[0.7rem] text-muted-foreground">
                        {formatDateTime(row.created_at)}
                        {row.total_tokens > 0 ? ` • ${formatNumber(row.total_tokens)} token` : ""}
                      </p>
                    </div>
                  </div>
                ))
              )}
              {send.isPending ? (
                <p className="text-sm text-muted-foreground">Copilot mağaza verisini inceliyor...</p>
              ) : null}
              <div ref={bottomRef} />
            </div>

            <div className="mt-4 flex items-end gap-2 border-t border-border/60 pt-4">
              <Textarea
                aria-label="Copilot mesajı"
                rows={2}
                value={input}
                placeholder="Örn. Bu hafta hangi ürünlere stok siparişi vermeliyim?"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                }}
              />
              <Button onClick={submit} disabled={send.isPending} className="gap-2">
                <Send className="size-4" /> Gönder
              </Button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
