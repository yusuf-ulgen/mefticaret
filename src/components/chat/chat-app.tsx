import { isMultiChat } from "./chat-utils";
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
import { PushToggle } from "./push-toggle";
import { startChatByHandle } from "@/lib/chat-account.functions";
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
        <PersonAvatar name={title} url={isMultiChat(chat.kind) ? null : peer?.avatarUrl ?? null} online={!isMultiChat(chat.kind) && peer ? online.has(peer.id) : false} />
        <div className="min-w-0 flex-1 border-b pb-3">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{title}</p>
            {!isMultiChat(chat.kind) && peer ? <RoleBadge role={peer.role} /> : <RoleBadge role={chat.kind === "group" ? "Grup" : "Mağaza"} />}
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
  const startByUser = useServerFn(startChatByHandle);
  const { online, setActiveId, refresh } = useChat();
  const startDirect = useMutation({
    mutationFn: (userId: string) => startByUser({ data: { userId } }),
    onSuccess: async (r) => {
      await refresh();
      setActiveId(r.id);
      onBack();
    },
    onError: (e: Error) => toast.error(e.message),
  });
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
          <li key={`r-${c.id}`} className="flex items-center gap-2 pr-3">
            <button type="button" onClick={() => setCard(c)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left">
              <PersonAvatar name={c.name} url={c.avatarUrl} size="size-11" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.handle ? `@${c.handle}` : ROLE_LABEL[c.role]}</p>
              </div>
            </button>
            <Button
              size="sm"
              className="h-9 shrink-0 rounded-full"
              disabled={c.blocked || startDirect.isPending}
              onClick={() => startDirect.mutate(c.id)}
            >
              Mesaj Gönder
            </Button>
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

const PRIVACY_OPTIONS = [
  { value: "everyone", label: "Herkes" },
  { value: "contacts", label: "Kişilerim" },
  { value: "nobody", label: "Kimse" },
] as const;

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn("min-h-11 rounded-md border px-1 text-sm", value === o.value && "border-chat-unread bg-muted font-medium")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Profile({
  onBack,
  status,
  setStatus,
  settings,
}: {
  onBack: () => void;
  status: string;
  setStatus: (s: string) => void;
  settings: ChatSettings | undefined;
}) {
  const { me } = useChat();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const save = useServerFn(saveChatSettings);
  const exportData = useServerFn(exportMyChatData);
  const deleteAccount = useServerFn(deleteMyChatAccount);
  const blocksFn = useServerFn(listChatBlocks);
  const unblock = useServerFn(setChatBlock);
  const profile = useQuery({
    queryKey: ["chat", "me", me],
    enabled: Boolean(me),
    queryFn: async () => (await supabase.from("profiles").select("full_name, email, avatar_url").eq("id", me).maybeSingle()).data,
  });
  const blocks = useQuery({ queryKey: ["chat", "blocks"], queryFn: () => blocksFn() });
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState("");
  useEffect(() => {
    setHandle(settings?.handle ?? "");
    setBio(settings?.bio ?? "");
    setStoreUrl(settings?.store_url ?? "");
  }, [settings?.handle, settings?.bio, settings?.store_url]);
  const [notifPerm, setNotifPerm] = useState(typeof Notification !== "undefined" && Notification.permission === "granted");
  const name = profile.data?.full_name || profile.data?.email || "Kullanıcı";

  const patch = useMutation({
    mutationFn: (d: Record<string, unknown>) => save({ data: d as never }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["chat", "settings"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex items-center gap-2 bg-chat-header px-2 py-3 text-chat-header-foreground">
        <button type="button" onClick={onBack} aria-label="Geri" className="flex size-10 items-center justify-center">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="flex-1 text-lg font-semibold">Profil</h1>
        <button type="button" aria-label="QR kodum" onClick={() => setQrOpen(true)} className="flex size-10 items-center justify-center">
          <QrCode className="size-5" />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto p-5 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="flex flex-col items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Profil fotoğrafını değiştir">
            <PersonAvatar name={name} url={profile.data?.avatar_url ?? null} size="size-28" />
          </button>
          <button type="button" className="text-sm text-chat-read" onClick={() => fileRef.current?.click()}>
            Fotoğrafı değiştir (kamera veya galeri)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const url = await toAvatarDataUrl(f);
                const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", me);
                if (error) throw error;
                qc.invalidateQueries({ queryKey: ["chat"] });
                toast.success("Profil fotoğrafı güncellendi");
              } catch {
                toast.error("Fotoğraf kaydedilemedi.");
              }
            }}
          />
          <p className="text-lg font-semibold">{name}</p>
          <p className="text-sm text-muted-foreground">{profile.data?.email}</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Hesap bilgileri</h2>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="chat-handle">Kullanıcı adı</label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">@</span>
              <Input id="chat-handle" value={handle} maxLength={24} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))} placeholder="kullaniciadi" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="chat-bio">Biyografi ({bio.length}/140)</label>
            <Textarea id="chat-bio" value={bio} maxLength={140} onChange={(e) => setBio(e.target.value)} rows={2} />
          </div>
          {settings?.user_type === "seller" ? (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="chat-store">Mağaza linki</label>
              <Input id="chat-store" value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} placeholder="https://mefticaret.com/s/magazam" inputMode="url" />
            </div>
          ) : null}
          <Button
            className="h-11 w-full"
            disabled={patch.isPending}
            onClick={() =>
              patch.mutate(
                { handle: handle || null, bio: bio || null, ...(settings?.user_type === "seller" ? { store_url: storeUrl || null } : {}) },
                { onSuccess: () => toast.success("Profil kaydedildi") },
              )
            }
          >
            Kaydet
          </Button>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Durum</h2>
          <Segmented
            value={status as "online"}
            options={STATUS_OPTIONS as unknown as { value: "online"; label: string }[]}
            onChange={(v) => {
              setStatus(v);
              localStorage.setItem("mefti-chat-status", v);
            }}
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Gizlilik</h2>
          {(
            [
              ["last_seen_privacy", "Son görülme"],
              ["photo_privacy", "Profil fotoğrafı"],
              ["online_privacy", "Çevrimiçi durumu"],
            ] as const
          ).map(([k, label]) => (
            <div key={k} className="space-y-1.5">
              <p className="text-sm">{label}</p>
              <Segmented value={settings?.[k] ?? "everyone"} options={PRIVACY_OPTIONS} onChange={(v) => patch.mutate({ [k]: v })} />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">"Kişilerim": sizinle sohbeti olan kişiler.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Bildirimler</h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Genel bildirimler</p>
              <p className="text-xs text-muted-foreground">Yeni mesajlarda bildirim göster.</p>
            </div>
            <Switch checked={settings?.notifications_enabled ?? true} onCheckedChange={(v) => patch.mutate({ notifications_enabled: v })} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Arka plan bildirimi</p>
              <p className="text-xs text-muted-foreground">Uygulama arka plandayken tarayıcı bildirimi.</p>
            </div>
            <Switch
              checked={notifPerm}
              onCheckedChange={async (v) => {
                if (!v) return setNotifPerm(false);
                if (!("Notification" in window)) return toast.error("Tarayıcınız bildirimleri desteklemiyor.");
                const p = await Notification.requestPermission();
                setNotifPerm(p === "granted");
                if (p !== "granted") toast.error("Bildirim izni verilmedi.");
              }}
            />
          </div>
          <PushToggle />
          <div className="space-y-1.5">
            <p className="text-sm">Bildirim sesi</p>
            <Segmented
              value={settings?.sound ?? "pop"}
              options={[
                { value: "pop", label: "Pop" },
                { value: "chime", label: "Zil" },
                { value: "ding", label: "Ding" },
                { value: "none", label: "Sessiz" },
              ] as const}
              onChange={(v) => {
                if (v !== "none") void import("./chat-extras").then((m) => m.playTone(v));
                patch.mutate({ sound: v });
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="font-medium">Titreşim</p>
            <Switch checked={settings?.vibrate ?? true} onCheckedChange={(v) => patch.mutate({ vibrate: v })} />
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Engellenenler</h2>
          {!blocks.data?.length ? <p className="text-sm text-muted-foreground">Engellediğiniz kimse yok.</p> : null}
          {blocks.data?.map((b) => (
            <div key={b.id} className="flex items-center gap-3">
              <PersonAvatar name={b.name} url={b.avatarUrl} size="size-9" />
              <p className="flex-1 truncate text-sm">{b.name}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await unblock({ data: { userId: b.id, blocked: false } });
                  toast.success("Engel kaldırıldı");
                  qc.invalidateQueries({ queryKey: ["chat"] });
                }}
              >
                Kaldır
              </Button>
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">KVKK ve verilerim</h2>
          <Button
            variant="outline"
            className="h-11 w-full"
            onClick={async () => {
              try {
                const data = await exportData();
                const blob = new Blob([data], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `mefticaret-mesajlar-verilerim-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
                toast.success("Verileriniz indirildi");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Download className="mr-2 size-4" /> Verilerimi indir
          </Button>
          <Button variant="outline" className="h-11 w-full text-destructive" onClick={() => setDelOpen(true)}>
            <Trash2 className="mr-2 size-4" /> Hesabımı ve mesajlarımı sil
          </Button>
          <p className="text-xs text-muted-foreground">
            <a href="/mesajlar-gizlilik" className="underline">Gizlilik Politikası</a> · <a href="/mesajlar-kosullar" className="underline">Kullanım Koşulları</a>
          </p>
        </section>

        <Button
          variant="outline"
          className="h-12 w-full"
          onClick={async () => {
            await qc.cancelQueries();
            qc.clear();
            await supabase.auth.signOut();
            navigate({ to: "/mesajlar-giris", replace: true });
          }}
        >
          <LogOut className="mr-2 size-4" /> Çıkış yap
        </Button>
      </div>

      <QrSheet open={qrOpen} onOpenChange={setQrOpen} handle={settings?.handle ?? null} onFound={() => setQrOpen(false)} />
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogTitle>Hesabı kalıcı olarak sil</DialogTitle>
          <DialogDescription>
            Hesabınız, gönderdiğiniz tüm mesajlar ve dosyalar kalıcı olarak silinir. Bu işlem geri alınamaz. Onaylamak için SİL yazın.
          </DialogDescription>
          <Input value={delText} onChange={(e) => setDelText(e.target.value)} placeholder="SİL" aria-label="Onay" />
          <Button
            variant="destructive"
            className="h-11"
            disabled={delText !== "SİL"}
            onClick={async () => {
              try {
                await deleteAccount({ data: { confirm: "SİL" } });
                qc.clear();
                await supabase.auth.signOut();
                toast.success("Hesabınız silindi");
                navigate({ to: "/mesajlar-giris", replace: true });
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Kalıcı olarak sil
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConsentDialog({ open, onAccept }: { open: boolean; onAccept: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <Dialog open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto [&>button]:hidden">
        <DialogTitle>Açık Rıza Metni</DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-2 text-sm">
            <p>
              Mefticaret Mesajlar'ı kullanabilmeniz için adınız, e-posta ve telefonunuz, profil fotoğrafınız, gönderdiğiniz mesajlar ve dosyalar ile
              çevrimiçi durumunuz, hizmetin sunulması amacıyla 6698 sayılı KVKK kapsamında işlenir ve Türkiye'deki/AB'deki sunucularda saklanır.
            </p>
            <p>
              Rehberinizi paylaşırsanız numaralar cihazınızdan yalnızca eşleştirme için gönderilir, özetlenmiş biçimde karşılaştırılır ve saklanmaz.
              Verilerinizi dilediğiniz an Profil → KVKK bölümünden indirebilir veya silebilirsiniz.
            </p>
            <p>
              Ayrıntılar: <a href="/mesajlar-gizlilik" className="underline">Gizlilik Politikası</a>.
            </p>
          </div>
        </DialogDescription>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 size-4" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          Okudum, kişisel verilerimin bu kapsamda işlenmesine açık rıza veriyorum.
        </label>
        <div>
          <Button className="h-11 w-full" disabled={!ok} onClick={onAccept}>
            Devam et
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Shell({ status, setStatus, settings }: { status: string; setStatus: (s: string) => void; settings: ChatSettings | undefined }) {
  const { chats, activeId, setActiveId, offline } = useChat();
  const [view, setView] = useState<View>("list");
  const active = chats.find((c) => c.id === activeId) ?? null;

  const left =
    view === "new" ? (
      <NewConversation onBack={() => setView("list")} handle={settings?.handle ?? null} />
    ) : view === "profile" ? (
      <Profile onBack={() => setView("list")} status={status} setStatus={setStatus} settings={settings} />
    ) : (
      <ChatList onNew={() => setView("new")} onProfile={() => setView("profile")} />
    );

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {offline ? (
        <div className="flex items-center justify-center gap-2 bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground">
          <WifiOff className="size-3.5" /> Çevrimdışı — kayıtlı mesajlar gösteriliyor
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        <aside className={cn("min-h-0 w-full border-r md:w-[360px] lg:w-[400px]", active ? "hidden md:block" : "block")}>{left}</aside>
        <main className={cn("min-h-0 flex-1", active ? "block" : "hidden md:block")}>
          {active ? (
            <ConversationView key={active.id} chat={active} onBack={() => setActiveId(null)} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-chat-bg p-8 text-center">
              <p className="text-xl font-semibold">Mefticaret Mesajlar</p>
              <p className="max-w-sm text-sm text-muted-foreground">Soldan bir sohbet seçin veya yeni bir sohbet başlatın.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export function ChatApp({ initialConversation, initialHandle }: { initialConversation?: string | undefined; initialHandle?: string | undefined }) {
  const [status, setStatus] = useState("online");
  const getSettings = useServerFn(getChatSettings);
  const save = useServerFn(saveChatSettings);
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["chat", "settings"], queryFn: () => getSettings(), staleTime: 60_000 });
  useEffect(() => {
    const s = localStorage.getItem("mefti-chat-status");
    if (s) setStatus(s);
  }, []);
  const st = settings.data;
  return (
    <ChatProvider
      myStatus={status}
      prefs={{
        hideOnline: st?.online_privacy === "nobody",
        notifications: st?.notifications_enabled ?? true,
        sound: st?.sound ?? "pop",
        vibrate: st?.vibrate ?? true,
      }}
    >
      <InitialOpen id={initialConversation} handle={initialHandle} />
      <Shell status={status} setStatus={setStatus} settings={st} />
      <ConsentDialog
        open={Boolean(st) && !st?.consent_at}
        onAccept={async () => {
          try {
            await save({ data: { consent: true } });
            await qc.invalidateQueries({ queryKey: ["chat", "settings"] });
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </ChatProvider>
  );
}

function InitialOpen({ id, handle }: { id?: string | undefined; handle?: string | undefined }) {
  const { setActiveId } = useChat();
  const find = useServerFn(findChatUserByHandle);
  const [card, setCard] = useState<ChatUserCard | null>(null);
  useEffect(() => {
    if (id) setActiveId(id);
  }, [id, setActiveId]);
  useEffect(() => {
    if (!handle) return;
    void find({ data: { handle } })
      .then(setCard)
      .catch((e: Error) => toast.error(e.message));
  }, [handle, find]);
  return <UserCardSheet userId={card?.id ?? null} preset={card} onClose={() => setCard(null)} onOpenChat={setActiveId} />;
}
