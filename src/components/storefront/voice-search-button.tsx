import { useRef, useState } from "react";
import { Mic } from "lucide-react";
import { toast } from "sonner";

import { parseVoiceQuery } from "@/lib/innovation";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

/** Sesle arama: söylenen cümleden arama terimi ve fiyat filtresi çıkarılır. */
export function VoiceSearchButton({
  onResult,
  locale = "tr-TR",
}: {
  onResult: (result: { term: string; minPrice: number | null; maxPrice: number | null; color: string | null }) => void;
  locale?: string;
}) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const start = () => {
    const globalWindow = window as unknown as Record<string, unknown>;
    const Ctor = (globalWindow["SpeechRecognition"] ?? globalWindow["webkitSpeechRecognition"]) as
      | (new () => SpeechRecognitionLike)
      | undefined;
    if (!Ctor) {
      toast.error("Tarayıcınız sesli aramayı desteklemiyor.");
      return;
    }
    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = locale;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(parseVoiceQuery(transcript));
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error("Sesi anlayamadım, tekrar deneyin.");
    };
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  return (
    <button
      type="button"
      onClick={() => {
        if (listening) {
          recognitionRef.current?.stop();
          setListening(false);
          return;
        }
        start();
      }}
      aria-label="Sesle ara"
      className={`flex size-10 items-center justify-center rounded-full border transition ${
        listening ? "bg-primary text-primary-foreground" : "bg-background"
      }`}
    >
      <Mic className="size-4" />
    </button>
  );
}
