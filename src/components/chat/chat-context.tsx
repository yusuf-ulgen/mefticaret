import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { listMyChats, type ChatSummary } from "@/lib/chat.functions";
import { chatTitle } from "./chat-utils";
import { playTone } from "./chat-extras";

export type ChatPrefs = { hideOnline: boolean; notifications: boolean; sound: string; vibrate: boolean };
const DEFAULT_PREFS: ChatPrefs = { hideOnline: false, notifications: true, sound: "pop", vibrate: true };

type Ctx = {
  me: string;
  chats: ChatSummary[];
  loading: boolean;
  online: Set<string>;
  offline: boolean;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  refresh: () => Promise<unknown>;
};

const ChatCtx = createContext<Ctx | null>(null);
export const useChat = () => {
  const c = useContext(ChatCtx);
  if (!c) throw new Error("ChatProvider eksik");
  return c;
};

export function ChatProvider({ children, myStatus, prefs = DEFAULT_PREFS }: { children: ReactNode; myStatus: string; prefs?: ChatPrefs }) {
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const list = useServerFn(listMyChats);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["chat", "list"], queryFn: () => list(), staleTime: 10_000 });
  const me = q.data?.me ?? "";
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [offline, setOffline] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const upd = () => setOffline(!navigator.onLine);
    upd();
    window.addEventListener("online", upd);
    window.addEventListener("offline", upd);
    return () => {
      window.removeEventListener("online", upd);
      window.removeEventListener("offline", upd);
    };
  }, []);

  // Çevrimiçi durum (presence) — görünmez modda yayın yapılmaz.
  useEffect(() => {
    if (!me) return;
    const ch = supabase.channel("chat-presence", { config: { presence: { key: me } } });
    ch.on("presence", { event: "sync" }, () => {
      setOnline(new Set(Object.keys(ch.presenceState())));
    }).subscribe(async (s) => {
      if (s === "SUBSCRIBED" && myStatus !== "invisible" && !prefs.hideOnline) await ch.track({ status: myStatus });
    });
    const beat = () =>
      supabase.from("chat_presence").upsert({ user_id: me, status: myStatus as never, last_seen_at: new Date().toISOString() });
    void beat();
    const t = window.setInterval(beat, 60_000);
    return () => {
      window.clearInterval(t);
      void beat();
      supabase.removeChannel(ch);
    };
  }, [me, myStatus, prefs.hideOnline]);

  // Yeni mesajlar — liste güncellenir, başka sohbetse bildirim gösterilir.
  const chatsRef = useRef<ChatSummary[]>([]);
  chatsRef.current = q.data?.chats ?? [];
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;
  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel(`chat-inbox:${me}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const m = payload.new as { conversation_id: string; sender_id: string; body: string | null; kind: string };
        qc.invalidateQueries({ queryKey: ["chat", "list"] });
        if (m.sender_id === me) return;
        const chat = chatsRef.current.find((c) => c.id === m.conversation_id);
        if (chat?.muted || myStatus === "dnd" || !prefsRef.current.notifications) return;
        if (prefsRef.current.sound !== "none") playTone(prefsRef.current.sound);
        if (prefsRef.current.vibrate && "vibrate" in navigator) navigator.vibrate?.(120);
        const title = chat ? chatTitle(chat, me) : "Yeni mesaj";
        const body = m.kind === "text" ? (m.body ?? "") : m.kind === "image" ? "📷 Fotoğraf" : m.kind === "audio" ? "🎤 Sesli mesaj" : "📎 Dosya";
        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          const n = new Notification(title, { body, tag: m.conversation_id });
          n.onclick = () => {
            window.focus();
            setActiveId(m.conversation_id);
          };
        } else if (m.conversation_id !== activeIdRef.current) {
          toast(title, { description: body.slice(0, 80), action: { label: "Aç", onClick: () => setActiveId(m.conversation_id) } });
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_participants" }, () =>
        qc.invalidateQueries({ queryKey: ["chat", "list"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, qc, myStatus]);


  // Sekme başlığında okunmamış sayısı
  const unread = (q.data?.chats ?? []).reduce((s, c) => s + (c.muted ? 0 : c.unread), 0);
  useEffect(() => {
    document.title = unread ? `(${unread}) Mesajlar — Mefticaret` : "Mesajlar — Mefticaret";
  }, [unread]);

  return (
    <ChatCtx.Provider
      value={{
        me,
        chats: q.data?.chats ?? [],
        loading: q.isLoading,
        online,
        offline,
        activeId,
        setActiveId,
        refresh: () => q.refetch(),
      }}
    >
      {children}
    </ChatCtx.Provider>
  );
}
