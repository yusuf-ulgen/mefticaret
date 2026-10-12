import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tarayıcının konuşma tanıma ve okuma yeteneklerini sarar.
 * Destek yoksa arayüz düğmeleri gizlenir; sahte bir davranış üretilmez.
 */

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechToText(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const ref = useRef<RecognitionLike | null>(null);
  const handler = useRef(onText);
  handler.current = onText;

  useEffect(() => {
    setSupported(Boolean(recognitionCtor()));
    return () => {
      ref.current?.stop();
      ref.current = null;
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "tr-TR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const alt = event.results[i]?.[0];
        if (alt) text += `${alt.transcript} `;
      }
      const clean = text.trim();
      if (clean) handler.current(clean);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    ref.current = recognition;
    setListening(true);
    recognition.start();
  }, []);

  const stop = useCallback(() => {
    ref.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, start, stop };
}

/** Kısa bir bildirim sesi çalar ve metni Türkçe sesle okur. */
export function speakTurkish(text: string) {
  if (typeof window === "undefined") return;
  try {
    const AudioCtor =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ?? null;
    if (AudioCtor) {
      const ctx = new AudioCtor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    }
  } catch {
    /* ses açılamadıysa sessiz geç */
  }
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "tr-TR";
    window.speechSynthesis.speak(utterance);
  }
}
