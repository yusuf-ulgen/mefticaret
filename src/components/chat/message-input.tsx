import { useEffect, useRef, useState } from "react";
import { Camera, FileText, Image as ImageIcon, Mic, Paperclip, Send, Smile, Square, X } from "lucide-react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EMOJI_GRID, type ChatMessage } from "./chat-utils";

export type Outgoing =
  | { kind: "text"; body: string }
  | { kind: "image" | "file"; file: File; body?: string }
  | { kind: "audio"; file: File; durationMs: number };

const IMAGE_MAX = 10 * 1024 * 1024;
const FILE_MAX = 25 * 1024 * 1024;
const AUDIO_MAX_MS = 5 * 60 * 1000;

export function MessageInput({
  replyTo,
  replyName,
  onCancelReply,
  onSend,
  onTyping,
  disabled,
}: {
  replyTo: ChatMessage | null;
  replyName: string;
  onCancelReply: () => void;
  onSend: (o: Outgoing) => void;
  onTyping: () => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState<number | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rec = useRef<{ mr: MediaRecorder; chunks: Blob[]; started: number; cancel: boolean; timer: number } | null>(null);
  const lastTyping = useRef(0);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 5 * 24 + 16)}px`;
  }, [text]);

  useEffect(() => {
    if (replyTo) ta.current?.focus();
  }, [replyTo]);

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    if (body.length > 4000) return toast.error("Mesaj en fazla 4000 karakter olabilir.");
    onSend({ kind: "text", body });
    setText("");
  };

  const pick = (kind: "image" | "file") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isImage = kind === "image" && file.type.startsWith("image/");
    if (isImage && file.size > IMAGE_MAX) return toast.error("Fotoğraf en fazla 10 MB olabilir.");
    if (file.size > FILE_MAX) return toast.error("Dosya en fazla 25 MB olabilir.");
    onSend({ kind: isImage ? "image" : "file", file });
  };

  const startRec = async () => {
    if (rec.current || disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const state = { mr, chunks: [] as Blob[], started: Date.now(), cancel: false, timer: 0 };
      mr.ondataavailable = (e) => e.data.size && state.chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        window.clearInterval(state.timer);
        const ms = Date.now() - state.started;
        rec.current = null;
        setRecording(null);
        if (state.cancel || ms < 800) return;
        const type = mr.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        onSend({ kind: "audio", file: new File(state.chunks, `ses.${ext}`, { type }), durationMs: Math.min(ms, AUDIO_MAX_MS) });
      };
      state.timer = window.setInterval(() => {
        const ms = Date.now() - state.started;
        setRecording(ms);
        if (ms >= AUDIO_MAX_MS) mr.stop();
      }, 250);
      rec.current = state;
      setRecording(0);
      mr.start();
    } catch {
      toast.error("Mikrofon izni verilmedi.");
    }
  };
  const stopRec = (cancel = false) => {
    if (!rec.current) return;
    rec.current.cancel = cancel;
    rec.current.mr.stop();
  };

  return (
    <div className="border-t bg-background/95 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
      {replyTo ? (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-md border-l-4 border-chat-read bg-muted px-3 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-chat-read">{replyName}</p>
            <p className="truncate text-muted-foreground">
              {replyTo.kind === "text" ? replyTo.body : replyTo.kind === "image" ? "📷 Fotoğraf" : replyTo.kind === "audio" ? "🎤 Sesli mesaj" : replyTo.attachment_name}
            </p>
          </div>
          <button type="button" onClick={onCancelReply} aria-label="Yanıtı kapat" className="p-1">
            <X className="size-4" />
          </button>
        </div>
      ) : null}
      <div className="flex items-end gap-1.5 px-2">
        {recording !== null ? (
          <div className="flex min-h-11 flex-1 items-center gap-3 rounded-3xl bg-muted px-4 text-sm">
            <span className="size-2.5 animate-pulse rounded-full bg-destructive" />
            <span>
              {Math.floor(recording / 60000)}:{String(Math.floor((recording / 1000) % 60)).padStart(2, "0")}
            </span>
            <button type="button" className="ml-auto text-muted-foreground" onClick={() => stopRec(true)}>
              İptal
            </button>
          </div>
        ) : (
          <div className="flex min-h-11 flex-1 items-end rounded-3xl bg-muted px-1">
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" aria-label="Emoji" className="flex size-11 shrink-0 items-center justify-center text-muted-foreground">
                  <Smile className="size-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-72 p-2">
                <div className="grid grid-cols-8 gap-1">
                  {EMOJI_GRID.map((e) => (
                    <button key={e} type="button" className="rounded p-1 text-xl hover:bg-muted" onClick={() => setText((t) => t + e)}>
                      {e}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <textarea
              ref={ta}
              rows={1}
              value={text}
              maxLength={4000}
              disabled={disabled}
              onChange={(e) => {
                setText(e.target.value);
                if (Date.now() - lastTyping.current > 1000) {
                  lastTyping.current = Date.now();
                  onTyping();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(hover: hover)").matches) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Mesaj yazın"
              aria-label="Mesaj"
              className="max-h-[136px] flex-1 resize-none bg-transparent py-2.5 text-base leading-6 outline-none placeholder:text-muted-foreground"
            />
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" aria-label="Dosya ekle" className="flex size-11 shrink-0 items-center justify-center text-muted-foreground">
                  <Paperclip className="size-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-48 p-1">
                {[
                  { icon: ImageIcon, label: "Fotoğraf", ref: imageRef },
                  { icon: Camera, label: "Kamera", ref: cameraRef },
                  { icon: FileText, label: "Belge", ref: fileRef },
                ].map(({ icon: Icon, label, ref }) => (
                  <button key={label} type="button" onClick={() => ref.current?.click()} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-muted">
                    <Icon className="size-4" /> {label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        )}
        {text.trim() ? (
          <button
            type="button"
            onClick={submit}
            aria-label="Gönder"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-chat-header text-chat-header-foreground"
          >
            <Send className="size-5" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Basılı tutarak ses kaydet"
            onPointerDown={(e) => {
              e.preventDefault();
              void startRec();
            }}
            onPointerUp={() => stopRec(false)}
            onPointerLeave={() => recording !== null && stopRec(false)}
            onContextMenu={(e) => e.preventDefault()}
            className="flex size-11 shrink-0 touch-none items-center justify-center rounded-full bg-chat-header text-chat-header-foreground"
          >
            {recording !== null ? <Square className="size-4" /> : <Mic className="size-5" />}
          </button>
        )}
      </div>
      <input ref={imageRef} type="file" accept="image/*" hidden onChange={pick("image")} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick("image")} />
      <input ref={fileRef} type="file" hidden onChange={pick("file")} />
    </div>
  );
}
