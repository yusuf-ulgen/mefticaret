import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Archive, ArrowLeft, BellOff, Download, LogOut, MessageSquarePlus, QrCode, Search, Trash2, User, WifiOff, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { searchChatContacts, startChatConversation, type ChatSummary } from "@/lib/chat.functions";
import { cn } from "@/lib/utils";
import { ChatProvider, useChat } from "./chat-context";
import { ContactsButton, MuteSheet, QrButton, QrSheet, UserCardSheet } from "./chat-extras";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteMyChatAccount,
  exportMyChatData,
  findChatUserByHandle,
  getChatSettings,
  listChatBlocks,
  saveChatSettings,
  setChatBlock,
  type ChatSettings,
  type ChatUserCard,
} from "@/lib/chat-account.functions";
import { chatTitle, initials, others, ROLE_LABEL, timeLabel } from "./chat-utils";
import { ConversationView } from "./conversation-view";

type View = "list" | "new" | "profile";

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

function PersonAvatar({ name, url, online, size = "size-12" }: { name: string; url: string | null; online?: boolean; size?: string }) {
  return (
    <div className="relative shrink-0">
      <Avatar className={size}>
        {url ? <AvatarImage src={url} alt="" /> : null}
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      {online ? <span className="absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-background bg-chat-online" aria-label="çevrimiçi" /> : null}
    </div>
  );
}

function ConversationItem({ chat, active, onOpen }: { chat: ChatSummary; active: boolean; onOpen: () => void }) {
  const { me, online } = useChat();
  const qc = useQueryClient();
  const [dx, setDx] = useState(0);
  const [muteOpen, setMuteOpen] = useState(false);
  const start = useRef<number | null>(null);
  const peer = others(chat, me)[0];
  const title = chatTitle(chat, me);
  const update = async (patch: { archived?: boolean }) => {
    setDx(0);
    await supabase.from("chat_participants").update(patch).eq("conversation_id", chat.id).eq("user_id", me);
    qc.invalidateQueries({ queryKey: ["chat", "list"] });
    toast.success("Sohbet arşivlendi");
  };
  return (
    <li className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex">
        <button type="button" onClick={() => { setDx(0); setMuteOpen(true); }} className="w-20 bg-muted text-xs font-medium">
          {chat.muted ? "Sesi aç" : "Sessize al"}
        </button>
        <button type="button" onClick={() => void update({ archived: true })} className="w-20 bg-destructive text-xs font-medium text-destructive-foreground">
          Arşivle
        </button>
      </div>
      <button
        type="button"
        onClick={() => (dx ? setDx(0) : onOpen())}
        onTouchStart={(e) => (start.current = e.touches[0]!.clientX)}
        onTouchMove={(e) => {
          if (start.current === null) return;
          const d = e.touches[0]!.clientX - start.current;
          setDx(Math.max(-160, Math.min(0, d)));
        }}
        onTouchEnd={() => {
          start.current = null;
          setDx((d) => (d < -70 ? -160 : 0));
        }}
        style={{ transform: `translateX(${dx}px)` }}
        className={cn("relative flex w-full items-center gap-3 bg-background px-4 py-3 text-left transition-transform", active && "bg-muted")}
      >
        <PersonAvatar name={title} url={chat.kind === "group" ? null : peer?.avatarUrl ?? null} online={chat.kind !== "group" && peer ? online.has(peer.id) : false} />
        <div className="min-w-0 flex-1 border-b pb-3">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{title}</p>
            {chat.kind !== "group" && peer ? <RoleBadge role={peer.role} /> : <RoleBadge role="Grup" />}
            <span className={cn("ml-auto shrink-0 text-xs", chat.unread ? "font-semibold text-chat-unread" : "text-muted-foreground")}>
              {timeLabel(chat.lastMessageAt)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="truncate text-sm text-muted-foreground">{chat.preview ?? "Yeni sohbet"}</p>
            <span className="ml-auto flex shrink-0 items-center gap-1">
              {chat.muted ? <BellOff className="size-3.5 text-muted-foreground" aria-label="Sessiz" /> : null}
              {chat.unread ? (
                <span className="min-w-5 rounded-full bg-chat-unread px-1.5 text-center text-xs font-semibold leading-5 text-primary-foreground">
                  {chat.unread > 99 ? "99+" : chat.unread}
                </span>
              ) : null}
            </span>
          </div>
        </div>
      </button>
      <MuteSheet open={muteOpen} onOpenChange={setMuteOpen} conversationId={chat.id} me={me} muted={chat.muted} onDone={() => void qc.invalidateQueries({ queryKey: ["chat", "list"] })} />
    </li>
  );
}

function ChatList({ onNew, onProfile }: { onNew: () => void; onProfile: () => void }) {
  const { chats, loading, activeId, setActiveId, refresh } = useChat();
  const [search, setSearch] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [pull, setPull] = useState(0);
  const pullStart = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { me } = useChat();
  const term = (search ?? "").toLocaleLowerCase("tr");
  const visible = chats
    .filter((c) => c.archived === showArchived)
    .filter((c) => !term || chatTitle(c, me).toLocaleLowerCase("tr").includes(term) || (c.preview ?? "").toLocaleLowerCase("tr").includes(term));
  const archivedCount = chats.filter((c) => c.archived).length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="bg-chat-header px-4 pb-3 pt-3 text-chat-header-foreground">
        {search === null ? (
          <div className="flex items-center gap-1">
            <h1 className="flex-1 text-xl font-semibold">Mesajlar</h1>
            <button type="button" aria-label="Ara" onClick={() => setSearch("")} className="flex size-10 items-center justify-center">
              <Search className="size-5" />
            </button>
            <button type="button" aria-label="Yeni sohbet" onClick={onNew} className="flex size-10 items-center justify-center">
              <MessageSquarePlus className="size-5" />
            </button>
            <button type="button" aria-label="Profil" onClick={onProfile} className="flex size-10 items-center justify-center">
              <User className="size-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Aramayı kapat" onClick={() => setSearch(null)} className="flex size-10 items-center justify-center">
              <ArrowLeft className="size-5" />
            </button>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sohbetlerde ara"
              className="h-10 flex-1 rounded-full bg-chat-header-foreground/15 px-4 text-base text-chat-header-foreground outline-none placeholder:text-chat-header-foreground/70"
            />
          </div>
        )}
      </header>
      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto"
        onTouchStart={(e) => {
          if ((listRef.current?.scrollTop ?? 1) === 0) pullStart.current = e.touches[0]!.clientY;
        }}
        onTouchMove={(e) => {
          if (pullStart.current !== null) setPull(Math.max(0, Math.min(80, e.touches[0]!.clientY - pullStart.current)));
        }}
        onTouchEnd={() => {
          if (pull > 60) void refresh().then(() => toast.success("Güncellendi"));
          pullStart.current = null;
          setPull(0);
        }}
      >
        {pull ? <p className="py-2 text-center text-xs text-muted-foreground" style={{ height: pull }}>{pull > 60 ? "Bırakınca yenilenir" : "Yenilemek için çekin"}</p> : null}
        {archivedCount && !showArchived ? (
          <button type="button" onClick={() => setShowArchived(true)} className="flex w-full items-center gap-4 px-6 py-3 text-sm font-medium">
            <Archive className="size-5 text-chat-unread" /> Arşivlenmiş ({archivedCount})
          </button>
        ) : null}
        {showArchived ? (
          <button type="button" onClick={() => setShowArchived(false)} className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium">
            <ArrowLeft className="size-4" /> Arşivden çık
          </button>
        ) : null}
        {loading ? <p className="p-6 text-center text-sm text-muted-foreground">Yükleniyor…</p> : null}
        {!loading && !visible.length ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">{term ? "Sonuç bulunamadı." : "Henüz sohbetiniz yok."}</p>
            {!term ? (
              <Button className="mt-4" onClick={onNew}>
                Yeni sohbet başlat
              </Button>
            ) : null}
          </div>
        ) : null}
        <ul>
          {visible.map((c) => (
            <ConversationItem key={c.id} chat={c} active={c.id === activeId} onOpen={() => setActiveId(c.id)} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function NewConversation({ onBack, handle }: { onBack: () => void; handle: string | null }) {
  const [qrOpen, setQrOpen] = useState(false);
  const [card, setCardState] = useState<{ c: ChatUserCard; full: boolean } | null>(null);
  const setCard = (c: ChatUserCard | null, full = true) => setCardState(c ? { c, full } : null);
  const [fromContacts, setFromContacts] = useState<ChatUserCard[]>([]);
  const search = useServerFn(searchChatContacts);
  const start = useServerFn(startChatConversation);
  const { online, setActiveId, refresh } = useChat();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [picked, setPicked] = useState<{ id: string; name: string }[]>([]);
  const [title, setTitle] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDq(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  const results = useQuery({ queryKey: ["chat", "contacts", dq], queryFn: () => search({ data: { q: dq } }) });
  const create = useMutation({
    mutationFn: () => start({ data: { userIds: picked.map((p) => p.id), ...(picked.length > 1 && title.trim() ? { title: title.trim() } : {}) } }),
    onSuccess: async (r) => {
      await refresh();
      setActiveId(r.id);
      onBack();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = (c: { id: string; name: string }) =>
    setPicked((p) => (p.some((x) => x.id === c.id) ? p.filter((x) => x.id !== c.id) : [...p, { id: c.id, name: c.name }]));

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex items-center gap-2 bg-chat-header px-2 py-3 text-chat-header-foreground">
        <button type="button" onClick={onBack} aria-label="Geri" className="flex size-10 items-center justify-center">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-lg font-semibold">Yeni sohbet</h1>
      </header>
      <div className="space-y-3 border-b p-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim veya e-posta ile ara" aria-label="Kişi ara" />
        {picked.length ? (
          <div className="flex flex-wrap gap-1.5">
            {picked.map((p) => (
              <button key={p.id} type="button" onClick={() => toggle(p)} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                {p.name} <X className="size-3.5" />
              </button>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <QrButton onClick={() => setQrOpen(true)} />
          <ContactsButton onResults={setFromContacts} />
        </div>
        {picked.length > 1 ? <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Grup adı" aria-label="Grup adı" /> : null}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {fromContacts.length ? <li className="px-4 pb-1 pt-3 text-xs font-medium uppercase text-muted-foreground">Rehberdekiler</li> : null}
        {fromContacts.map((c) => (
          <li key={`r-${c.id}`}>
            <button type="button" onClick={() => setCard(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <PersonAvatar name={c.name} url={c.avatarUrl} size="size-11" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.handle ? `@${c.handle}` : ROLE_LABEL[c.role]}</p>
              </div>
            </button>
          </li>
        ))}
        {fromContacts.length ? <li className="px-4 pb-1 pt-3 text-xs font-medium uppercase text-muted-foreground">Kişileriniz</li> : null}
        {results.isLoading ? <p className="p-6 text-center text-sm text-muted-foreground">Aranıyor…</p> : null}
        {results.data && !results.data.length ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Konuşabileceğiniz kişi bulunamadı.</p>
        ) : null}
        {results.data?.map((c) => {
          const sel = picked.some((p) => p.id === c.id);
          return (
            <li key={c.id}>
              <div className={cn("flex w-full items-center gap-3 px-4 py-3 text-left", sel && "bg-muted")}>
                <button type="button" aria-label={`${c.name} profilini aç`} onClick={() => setCard({ id: c.id, name: c.name, avatarUrl: c.avatarUrl, role: c.role, handle: null, bio: null, storeName: c.storeName, storeUrl: null, blocked: false }, false)}>
                  <PersonAvatar name={c.name} url={c.avatarUrl} online={online.has(c.id)} size="size-11" />
                </button>
                <button type="button" onClick={() => toggle(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{c.name}</p>
                    <RoleBadge role={c.role} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.storeName ?? ""} {online.has(c.id) ? "· çevrimiçi" : ""}
                  </p>
                </div>
                <span className={cn("size-5 rounded-full border-2", sel ? "border-chat-unread bg-chat-unread" : "border-muted-foreground/40")} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="border-t p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <Button className="h-12 w-full" disabled={!picked.length || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? "Başlatılıyor…" : picked.length > 1 ? `Grup başlat (${picked.length})` : "Sohbet Başlat"}
        </Button>
      </div>
      <QrSheet open={qrOpen} onOpenChange={setQrOpen} handle={handle} onFound={(c) => setCard(c)} />
      <UserCardSheet
        userId={card?.c.id ?? null}
        preset={card?.full ? card.c : null}
        onClose={() => setCard(null)}
        onOpenChat={(id) => {
          setActiveId(id);
          onBack();
        }}
      />
    </div>
  );
}

async function toAvatarDataUrl(file: File) {
  const img = await createImageBitmap(file);
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const s = Math.min(img.width, img.height);
  c.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL("image/webp", 0.8);
}

const STATUS_OPTIONS = [
  { value: "online", label: "Çevrimiçi" },
  { value: "dnd", label: "Rahatsız Etme" },
  { value: "invisible", label: "Görünmez" },
];

