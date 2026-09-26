import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BellOff, Bell, Copy, Flag, Reply, SmilePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { checkChatSendLimit, deleteChatMessage, type ChatSummary } from "@/lib/chat.functions";
import { useChat } from "./chat-context";
import { MuteSheet, ReportSheet, UserCardSheet } from "./chat-extras";
import {
  cacheMessages,
  cachedMessages,
  chatTitle,
  dayLabel,
  initials,
  lastSeen,
  others,
  QUICK_EMOJIS,
  type ChatMessage,
  type Reaction,
} from "./chat-utils";
import { MessageBubble } from "./message-bubble";
import { MessageInput, type Outgoing } from "./message-input";

const PAGE = 40;

export function ConversationView({ chat, onBack }: { chat: ChatSummary; onBack: () => void }) {
  const { me, online, offline, setActiveId } = useChat();
  const [muteOpen, setMuteOpen] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const qc = useQueryClient();
  const del = useServerFn(deleteChatMessage);
  const sendLimit = useServerFn(checkChatSendLimit);
  const scroller = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [menu, setMenu] = useState<ChatMessage | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [readMap, setReadMap] = useState<Record<string, string>>({});
  const [firstUnreadAt] = useState(() => chat.members.find((m) => m.id === me)?.lastReadAt ?? null);
  const [initialUnread] = useState(chat.unread);
  const stickBottom = useRef(true);
  const prevHeight = useRef<number | null>(null);

  const key = ["chat", "messages", chat.id];
  const q = useInfiniteQuery({
    queryKey: key,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let req = supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", chat.id)
        .order("created_at", { ascending: false })
        .limit(PAGE);
      if (pageParam) req = req.lt("created_at", pageParam);
      const { data, error } = await req;
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1]!.created_at : null),
    staleTime: 30_000,
  });

  const messages = useMemo(() => {
    const server = q.data ? q.data.pages.flat().slice().reverse() : offline ? cachedMessages(chat.id) : [];
    const ids = new Set(server.map((m) => m.id));
    return [...server, ...pending.filter((p) => !ids.has(p.id))];
  }, [q.data, pending, offline, chat.id]);

  useEffect(() => {
    if (q.data) cacheMessages(chat.id, q.data.pages.flat().slice().reverse());
  }, [q.data, chat.id]);

  const msgIds = messages.filter((m) => !m.pending).map((m) => m.id);
  const reactionsQ = useQuery({
    queryKey: ["chat", "reactions", chat.id, msgIds.length, msgIds[0]],
    enabled: msgIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("chat_reactions").select("message_id, user_id, emoji").in("message_id", msgIds.slice(-200));
      return (data ?? []) as Reaction[];
    },
  });
  const reactionsBy = useMemo(() => {
    const map = new Map<string, Reaction[]>();
    for (const r of reactionsQ.data ?? []) map.set(r.message_id, [...(map.get(r.message_id) ?? []), r]);
    return map;
  }, [reactionsQ.data]);

  const markRead = useCallback(async () => {
    await supabase
      .from("chat_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", chat.id)
      .eq("user_id", me);
    qc.setQueryData(["chat", "list"], (old: { me: string; chats: ChatSummary[] } | undefined) =>
      old ? { ...old, chats: old.chats.map((c) => (c.id === chat.id ? { ...c, unread: 0 } : c)) } : old,
    );
  }, [chat.id, me, qc]);

  useEffect(() => {
    void markRead();
  }, [markRead]);

  // Anlık: yeni/silinen mesaj, okundu, tepki, yazıyor.
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    const ch = supabase
      .channel(`chat:${chat.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${chat.id}` }, (p) => {
        const m = p.new as ChatMessage;
        qc.setQueryData(key, (old: { pages: ChatMessage[][]; pageParams: unknown[] } | undefined) => {
          if (!old) return old;
          if (old.pages.some((pg) => pg.some((x) => x.id === m.id))) return old;
          const pages = [...old.pages];
          pages[0] = [m, ...(pages[0] ?? [])];
          return { ...old, pages };
        });
        setPending((prev) => prev.filter((x) => x.id !== m.id));
        setTyping((t) => {
          const n = { ...t };
          delete n[m.sender_id];
          return n;
        });
        if (m.sender_id !== me && !document.hidden) void markRead();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${chat.id}` }, (p) => {
        const m = p.new as ChatMessage;
        qc.setQueryData(key, (old: { pages: ChatMessage[][]; pageParams: unknown[] } | undefined) =>
          old ? { ...old, pages: old.pages.map((pg) => pg.map((x) => (x.id === m.id ? m : x))) } : old,
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_participants", filter: `conversation_id=eq.${chat.id}` }, (p) => {
        const r = p.new as { user_id: string; last_read_at: string };
        setReadMap((prev) => ({ ...prev, [r.user_id]: r.last_read_at }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reactions" }, () =>
        qc.invalidateQueries({ queryKey: ["chat", "reactions", chat.id] }),
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const uid = (payload as { userId: string }).userId;
        if (uid === me) return;
        setTyping((t) => ({ ...t, [uid]: Date.now() }));
      })
      .subscribe();
    channelRef.current = ch;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id, me]);

  // Yazıyor göstergesini 3 sn sonra gizle
  useEffect(() => {
    const t = window.setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        const next = Object.fromEntries(Object.entries(prev).filter(([, v]) => now - v < 3000));
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  // Kaydırma: yeni mesajda en alta, eski yüklemede konumu koru
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current !== null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (stickBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, Object.keys(typing).length]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (el.scrollTop < 80 && q.hasNextPage && !q.isFetchingNextPage) {
      prevHeight.current = el.scrollHeight;
      void q.fetchNextPage();
    }
  };

  const otherMembers = others(chat, me);
  const peer = otherMembers[0];
  const peerOnline = otherMembers.some((m) => online.has(m.id));
  const nameOf = (id: string) => (id === me ? "Siz" : chat.members.find((m) => m.id === id)?.name ?? "Kullanıcı");
  const readAt = (id: string) => readMap[id] ?? chat.members.find((m) => m.id === id)?.lastReadAt ?? "";

  const statusOf = (m: ChatMessage): "pending" | "sent" | "delivered" | "read" => {
    if (m.pending) return "pending";
    if (otherMembers.length && otherMembers.every((o) => readAt(o.id) >= m.created_at)) return "read";
    if (otherMembers.some((o) => online.has(o.id) || readAt(o.id) >= m.created_at)) return "delivered";
    return "sent";
  };

  const send = async (o: Outgoing) => {
    if (offline) {
      toast.error("Çevrimdışısınız. Bağlantı gelince tekrar deneyin.");
      return;
    }
    const id = crypto.randomUUID();
    const base: ChatMessage = {
      id,
      conversation_id: chat.id,
      sender_id: me,
      kind: o.kind,
      body: o.kind === "text" ? o.body : null,
      reply_to_id: replyTo?.id ?? null,
      attachment_path: null,
      attachment_name: "file" in o ? o.file.name : null,
      attachment_size: "file" in o ? o.file.size : null,
      attachment_mime: "file" in o ? o.file.type : null,
      duration_ms: o.kind === "audio" ? o.durationMs : null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      pending: true,
    };
    stickBottom.current = true;
    setPending((p) => [...p, base]);
    setReplyTo(null);
    try {
      await sendLimit();
      let path: string | null = null;
      if ("file" in o) {
        const ext = (o.file.name.split(".").pop() ?? "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
        path = `${chat.id}/${id}.${ext}`;
        const up = await supabase.storage.from("chat-media").upload(path, o.file, o.file.type ? { contentType: o.file.type } : {});
        if (up.error) throw up.error;
      }
      const { pending: _p, created_at: _c, ...row } = base;
      const { error } = await supabase.from("chat_messages").insert({ ...row, attachment_path: path });
      if (error) throw error;
    } catch (e) {
      setPending((p) => p.filter((x) => x.id !== id));
      toast.error(e instanceof Error ? e.message : "Mesaj gönderilemedi.");
    }
  };

  const react = async (m: ChatMessage, emoji: string) => {
    setMenu(null);
    const mine = (reactionsBy.get(m.id) ?? []).find((r) => r.user_id === me);
    if (mine?.emoji === emoji) await supabase.from("chat_reactions").delete().eq("message_id", m.id).eq("user_id", me);
    else await supabase.from("chat_reactions").upsert({ message_id: m.id, user_id: me, emoji });
    qc.invalidateQueries({ queryKey: ["chat", "reactions", chat.id] });
  };


  const typingNames = Object.keys(typing).map(nameOf);
  const title = chatTitle(chat, me);
  const byId = new Map(messages.map((m) => [m.id, m]));
  const unreadIndex =
    initialUnread > 0 && firstUnreadAt ? messages.findIndex((m) => m.sender_id !== me && m.created_at > firstUnreadAt) : -1;

  return (
    <div className="flex h-full min-h-0 flex-col bg-chat-bg">
      <header className="flex items-center gap-2 bg-chat-header px-2 py-2 text-chat-header-foreground">
        <button type="button" onClick={onBack} aria-label="Geri" className="flex size-10 items-center justify-center md:hidden">
          <ArrowLeft className="size-5" />
        </button>
        <button type="button" aria-label="Profili göster" onClick={() => chat.kind !== "group" && peer && setCardId(peer.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <Avatar className="size-10">
          {chat.kind !== "group" && peer?.avatarUrl ? <AvatarImage src={peer.avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-chat-header-foreground/20 text-sm">{initials(title)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{title}</p>
          <p className="truncate text-xs opacity-80">
            {typingNames.length
              ? "yazıyor…"
              : chat.kind === "group"
                ? otherMembers.map((m) => m.name).join(", ")
                : lastSeen(peer, peerOnline)}
          </p>
        </div>
        </button>
        <button type="button" onClick={() => setMuteOpen(true)} aria-label={chat.muted ? "Sesi aç" : "Sessize al"} className="flex size-10 items-center justify-center">
          {chat.muted ? <BellOff className="size-5" /> : <Bell className="size-5" />}
        </button>
      </header>

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto py-2">
        {q.isFetchingNextPage ? <p className="py-2 text-center text-xs text-muted-foreground">Eski mesajlar yükleniyor…</p> : null}
        {q.isLoading && !messages.length ? <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p> : null}
        {!q.isLoading && !messages.length ? (
          <p className="mx-auto mt-10 w-fit rounded-lg bg-background/80 px-4 py-2 text-sm text-muted-foreground">İlk mesajı siz gönderin 👋</p>
        ) : null}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
          return (
            <Fragment key={m.id}>
              {newDay ? (
                <p className="mx-auto my-2 w-fit rounded-md bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow-sm">{dayLabel(m.created_at)}</p>
              ) : null}
              {i === unreadIndex ? (
                <p className="my-2 bg-background/60 py-1 text-center text-xs font-medium text-chat-unread">{initialUnread} okunmamış mesaj</p>
              ) : null}
              <MessageBubble
                m={m}
                mine={m.sender_id === me}
                senderName={nameOf(m.sender_id)}
                showSender={chat.kind === "group" && prev?.sender_id !== m.sender_id}
                replied={m.reply_to_id ? byId.get(m.reply_to_id) : undefined}
                reactions={reactionsBy.get(m.id) ?? []}
                status={statusOf(m)}
                onLongPress={() => !m.pending && !m.deleted_at && setMenu(m)}
                onOpenImage={setLightbox}
                onJump={(id) => document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
              />
            </Fragment>
          );
        })}
        {typingNames.length ? (
          <div className="px-3">
            <div className="flex w-fit items-center gap-1 rounded-lg rounded-tl-none bg-chat-in px-3 py-2.5 shadow-sm" aria-label="yazıyor">
              {[0, 1, 2].map((d) => (
                <span key={d} className="chat-dot size-2 rounded-full bg-muted-foreground" style={{ animationDelay: `${d * 0.15}s` }} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <MessageInput
        replyTo={replyTo}
        replyName={replyTo ? nameOf(replyTo.sender_id) : ""}
        onCancelReply={() => setReplyTo(null)}
        onSend={(o) => void send(o)}
        onTyping={() => void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: me } })}
        disabled={offline}
      />

      <Drawer open={Boolean(menu)} onOpenChange={(o) => !o && setMenu(null)}>
        <DrawerContent className="pb-[max(env(safe-area-inset-bottom),1rem)]">
          <DrawerTitle className="sr-only">Mesaj seçenekleri</DrawerTitle>
          {menu ? (
            <div className="px-4 pt-2">
              <div className="mb-3 flex justify-around">
                {QUICK_EMOJIS.map((e) => (
                  <button key={e} type="button" className="rounded-full p-2 text-2xl hover:bg-muted" onClick={() => void react(menu, e)} aria-label={`${e} tepkisi`}>
                    {e}
                  </button>
                ))}
              </div>
              {[
                { icon: Reply, label: "Yanıtla", run: () => setReplyTo(menu) },
                { icon: SmilePlus, label: "Tepki: 👍", run: () => void react(menu, "👍") },
                ...(menu.body
                  ? [{ icon: Copy, label: "Kopyala", run: () => void navigator.clipboard.writeText(menu.body ?? "").then(() => toast.success("Kopyalandı")) }]
                  : []),
                ...(menu.sender_id !== me ? [{ icon: Flag, label: "Şikayet et", run: () => setReportId(menu.id) }] : []),
                ...(menu.sender_id === me
                  ? [
                      {
                        icon: Trash2,
                        label: "Sil",
                        run: () =>
                          void del({ data: { id: menu.id } })
                            .then(() => toast.success("Mesaj silindi"))
                            .catch((e: Error) => toast.error(e.message)),
                      },
                    ]
                  : []),
              ].map(({ icon: Icon, label, run }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setMenu(null);
                    run();
                  }}
                  className="flex min-h-12 w-full items-center gap-4 rounded-md px-3 text-base hover:bg-muted"
                >
                  <Icon className="size-5" /> {label}
                </button>
              ))}
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>

      <MuteSheet open={muteOpen} onOpenChange={setMuteOpen} conversationId={chat.id} me={me} muted={chat.muted} onDone={() => void qc.invalidateQueries({ queryKey: ["chat", "list"] })} />
      <ReportSheet messageId={reportId} onClose={() => setReportId(null)} />
      <UserCardSheet userId={cardId} onClose={() => setCardId(null)} onOpenChat={(id) => setActiveId(id)} />

      <Dialog open={Boolean(lightbox)} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-[96vw] border-0 bg-background p-1">
          <DialogTitle className="sr-only">Fotoğraf</DialogTitle>
          {lightbox ? <img src={lightbox} alt="Fotoğraf" className="max-h-[85vh] w-full object-contain" /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
