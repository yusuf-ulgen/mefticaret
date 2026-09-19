import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askStoreSupportAgent } from "@/lib/support-agent.functions";

type Message = { role: "user" | "assistant"; content: string };

const GREETING: Record<string, string> = {
  tr: "Merhaba! Kargo, ürün, gümrük veya iade hakkında sorabilirsiniz.",
  en: "Hi! Ask me about products, shipping, customs duties or returns.",
  de: "Hallo! Fragen Sie mich zu Produkten, Versand, Zoll oder Rückgaben.",
  fr: "Bonjour ! Posez vos questions sur les produits, la livraison ou les retours.",
  es: "¡Hola! Pregúntame por productos, envíos, aduanas o devoluciones.",
  it: "Ciao! Chiedimi di prodotti, spedizioni, dogana o resi.",
  nl: "Hallo! Vraag me over producten, verzending, douane of retouren.",
  ru: "Здравствуйте! Спросите о товарах, доставке, пошлинах или возврате.",
  ar: "مرحبًا! اسألني عن المنتجات والشحن والرسوم الجمركية والإرجاع.",
  pt: "Olá! Pergunte sobre produtos, envio, alfândega ou devoluções.",
};

/** Çok dilli AI müşteri destek balonu (vitrin). Sohbet kaydedilmez. */
export function StorefrontSupportChat({ slug, locale = "tr" }: { slug: string; locale?: string }) {
  const ask = useServerFn(askStoreSupportAgent);
  const lang = GREETING[locale] ? locale : "en";
  const rtl = lang === "ar";

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const send = async () => {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setBusy(true);
    try {
      const result = await ask({
        data: { slug, locale: lang, question, history: messages.slice(-6) } as never,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: result.answer }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            lang === "tr"
              ? "Şu an yanıt veremedim. Lütfen birkaç saniye sonra tekrar deneyin."
              : "I could not answer right now. Please try again in a few seconds.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={lang === "tr" ? "Destek sohbetini aç" : "Open support chat"}
        className="fixed bottom-4 right-4 z-50 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:opacity-90"
      >
        <MessageCircle className="size-5" />
      </button>
    );
  }

  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      className="fixed bottom-4 right-4 z-50 flex max-h-[70vh] w-[min(92vw,22rem)] flex-col rounded-xl border bg-background shadow-xl"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-semibold">{lang === "tr" ? "Destek" : "Support"}</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Kapat">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        <p className="text-muted-foreground">{GREETING[lang]}</p>
        {messages.map((message, index) => (
          <p
            key={index}
            className={
              message.role === "user"
                ? "ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground"
                : "w-fit max-w-[90%] rounded-lg bg-muted px-3 py-2"
            }
          >
            {message.content}
          </p>
        ))}
        {busy ? <p className="text-xs text-muted-foreground">…</p> : null}
      </div>
      <div className="flex items-center gap-2 border-t p-3">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void send();
          }}
          placeholder={lang === "tr" ? "Sorunuzu yazın" : "Type your question"}
          aria-label={lang === "tr" ? "Mesaj" : "Message"}
        />
        <Button size="icon" disabled={busy || input.trim().length < 2} onClick={() => void send()} aria-label="Gönder">
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
