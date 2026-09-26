import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, CheckCheck, Clock, Download, FileText, Pause, Play } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { fileSize, URL_RE, type ChatMessage, type Reaction } from "./chat-utils";

export function useSignedUrl(path: string | null) {
  return useQuery({
    queryKey: ["chat", "media", path],
    enabled: Boolean(path),
    staleTime: 23 * 3600 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("chat-media").createSignedUrl(path!, 86400);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function AudioPlayer({ path, duration }: { path: string; duration: number | null }) {
  const url = useSignedUrl(path).data;
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const total = (duration ?? 0) / 1000;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return (
    <div className="flex min-w-48 items-center gap-2 py-1">
      <button
        type="button"
        aria-label={playing ? "Duraklat" : "Oynat"}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-chat-header text-chat-header-foreground"
        onClick={() => {
          const a = ref.current;
          if (!a) return;
          if (a.paused) void a.play();
          else a.pause();
        }}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <div className="h-1 flex-1 overflow-hidden rounded bg-foreground/15">
        <div className="h-full bg-chat-read" style={{ width: total ? `${Math.min(100, (pos / total) * 100)}%` : "0%" }} />
      </div>
      <span className="text-[11px] opacity-60">{fmt(playing || pos ? pos : total)}</span>
      {url ? (
        <audio
          ref={ref}
          src={url}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setPos(0);
          }}
          onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        />
      ) : null}
    </div>
  );
}

function ImageContent({ path, onOpen }: { path: string; onOpen: (url: string) => void }) {
  const url = useSignedUrl(path).data;
  if (!url) return <div className="h-48 w-56 animate-pulse rounded-md bg-foreground/10" />;
  return (
    <button type="button" onClick={() => onOpen(url)} className="block overflow-hidden rounded-md">
      <img src={url} alt="Gönderilen fotoğraf" loading="lazy" className="max-h-72 w-full max-w-64 object-cover" />
    </button>
  );
}

function FileContent({ m }: { m: ChatMessage }) {
  const url = useSignedUrl(m.attachment_path).data;
  return (
    <div className="flex min-w-52 items-center gap-3 rounded-md bg-foreground/5 p-2">
      <FileText className="size-8 shrink-0 opacity-70" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{m.attachment_name}</p>
        <p className="text-[11px] opacity-60">{fileSize(m.attachment_size)}</p>
      </div>
      {url ? (
        <a href={url} download={m.attachment_name ?? true} target="_blank" rel="noopener noreferrer" aria-label="İndir" className="p-2">
          <Download className="size-4" />
        </a>
      ) : null}
    </div>
  );
}

export function MessageBubble({
  m,
  mine,
  senderName,
  showSender,
  replied,
  reactions,
  status,
  onLongPress,
  onOpenImage,
  onJump,
}: {
  m: ChatMessage;
  mine: boolean;
  senderName: string;
  showSender: boolean;
  replied: ChatMessage | undefined;
  repliedName?: string;
  reactions: Reaction[];
  status: "pending" | "sent" | "delivered" | "read";
  onLongPress: () => void;
  onOpenImage: (url: string) => void;
  onJump: (id: string) => void;
}) {
  const timer = useRef<number | null>(null);
  const start = () => {
    timer.current = window.setTimeout(onLongPress, 450);
  };
  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
  };
  useEffect(() => stop, []);

  const grouped = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});
  const time = new Date(m.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div id={`msg-${m.id}`} className={cn("chat-enter flex px-3", mine ? "justify-end" : "justify-start", reactions.length ? "mb-4" : "mb-1")}>
      <div
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => {
          e.preventDefault();
          onLongPress();
        }}
        className={cn(
          "relative max-w-[82%] select-none rounded-lg px-2.5 pb-1 pt-1.5 text-base text-chat-bubble-foreground shadow-sm md:max-w-[65%]",
          mine ? "rounded-tr-none bg-chat-out" : "rounded-tl-none bg-chat-in",
        )}
      >
        {showSender && !mine ? <p className="text-xs font-semibold text-chat-read">{senderName}</p> : null}
        {replied ? (
          <button
            type="button"
            onClick={() => onJump(replied.id)}
            className="mb-1 block w-full rounded border-l-4 border-chat-read bg-foreground/5 px-2 py-1 text-left text-xs"
          >
            <span className="line-clamp-2 opacity-80">
              {replied.deleted_at ? "Bu mesaj silindi" : replied.kind === "text" ? replied.body : replied.kind === "image" ? "📷 Fotoğraf" : replied.kind === "audio" ? "🎤 Sesli mesaj" : `📎 ${replied.attachment_name ?? "Dosya"}`}
            </span>
          </button>
        ) : null}
        {m.deleted_at ? (
          <p className="italic opacity-60">Bu mesaj silindi</p>
        ) : m.kind === "image" && m.attachment_path ? (
          <ImageContent path={m.attachment_path} onOpen={onOpenImage} />
        ) : m.kind === "audio" && m.attachment_path ? (
          <AudioPlayer path={m.attachment_path} duration={m.duration_ms} />
        ) : m.kind === "file" ? (
          <FileContent m={m} />
        ) : null}
        {m.body && !m.deleted_at ? (
          <p className="whitespace-pre-wrap break-words">
            <Linkified text={m.body} />
          </p>
        ) : null}
        <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] opacity-60">
          <span>{time}</span>
          {mine ? (
            status === "pending" ? (
              <Clock className="size-3" />
            ) : status === "sent" ? (
              <Check className="size-3.5" />
            ) : (
              <CheckCheck className={cn("size-3.5 transition-colors duration-500", status === "read" && "text-chat-read opacity-100")} />
            )
          ) : null}
        </div>
        {Object.keys(grouped).length ? (
          <div className={cn("absolute -bottom-3.5 flex gap-0.5 rounded-full border bg-background px-1.5 py-0.5 text-xs shadow-sm", mine ? "right-2" : "left-2")}>
            {Object.entries(grouped).map(([e, n]) => (
              <span key={e}>
                {e}
                {n > 1 ? <span className="ml-0.5 text-muted-foreground">{n}</span> : null}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
