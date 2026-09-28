import { AlertTriangle, Send } from "lucide-react";
import { forwardRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type TimelineEvent = { id: string; kind: string; message: string | null; created_at: string };

const FAIL_PATTERN = /(fail|error|hata|başarısız|yapılamadı|reddedildi)/i;

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Bugün";
  if (same(d, y)) return "Dün";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

/** Shopify tarzı sipariş zaman çizelgesi: tarihe göre gruplu olaylar + altta yorum kutusu. */
export const OrderTimeline = forwardRef<
  HTMLInputElement,
  {
    events: TimelineEvent[];
    comment: string;
    onCommentChange: (value: string) => void;
    onSubmit: () => void;
    pending: boolean;
  }
>(function OrderTimeline({ events, comment, onCommentChange, onSubmit, pending }, ref) {
  const groups: Array<{ label: string; items: TimelineEvent[] }> = [];
  for (const event of events) {
    const label = dayLabel(event.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(event);
    else groups.push({ label, items: [event] });
  }

  return (
    <section id="order-timeline" className="surface-card overflow-hidden">
      <h2 className="px-5 pt-5 text-lg font-semibold">Zaman çizelgesi</h2>
      <form
        className="flex items-center gap-2 border-b border-border px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (comment.trim()) onSubmit();
        }}
      >
        <Input
          ref={ref}
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Yorum bırakın…"
          maxLength={2000}
          className="h-11 rounded-full"
        />
        <Button type="submit" size="icon" className="size-11 shrink-0 rounded-full" disabled={pending || !comment.trim()} aria-label="Yorumu gönder">
          <Send className="size-4" />
        </Button>
      </form>
      <p className="px-5 pt-2 text-xs text-muted-foreground">Yorumları yalnızca siz ve personeliniz görebilir.</p>

      <div className="px-5 pb-5">
        {groups.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Henüz kayıt yok.</p>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <p className="pb-1 pt-5 text-sm font-medium text-muted-foreground">{group.label}</p>
              <ol className="relative ml-1.5 border-l border-border">
                {group.items.map((event) => {
                  const text = event.message ?? event.kind;
                  const failed = FAIL_PATTERN.test(event.kind) || FAIL_PATTERN.test(text);
                  const isNote = event.kind === "note";
                  return (
                    <li key={event.id} className="relative py-3 pl-6">
                      {failed ? (
                        <AlertTriangle className="absolute -left-2 top-3.5 size-4 bg-card text-destructive" />
                      ) : (
                        <span className={`absolute -left-[5px] top-4 size-2.5 rounded-full ${isNote ? "bg-primary" : "bg-muted-foreground"}`} />
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                        {isNote ? " · Yorum" : ""}
                      </p>
                      <p className={`text-sm ${isNote ? "rounded-lg bg-muted/50 px-3 py-2 mt-1" : ""}`}>{text}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))
        )}
      </div>
    </section>
  );
});
