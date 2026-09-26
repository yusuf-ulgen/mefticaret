import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Ban, Camera, Contact, MessageCircle, QrCode, Store } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  findChatUserByHandle,
  getChatUserCard,
  matchChatContacts,
  reportChatMessage,
  setChatBlock,
  startChatByHandle,
  type ChatUserCard,
} from "@/lib/chat-account.functions";
import { cn } from "@/lib/utils";
import { initials, ROLE_LABEL } from "./chat-utils";

/* ---------- Süreli sessize alma ---------- */
export const MUTE_OPTIONS = [
  { label: "8 saat", ms: 8 * 3600_000 },
  { label: "1 hafta", ms: 7 * 86400_000 },
  { label: "Süresiz", ms: 0 },
] as const;

export async function setMute(conversationId: string, me: string, ms: number | null) {
  const patch =
    ms === null
      ? { muted: false, mute_until: null }
      : ms === 0
        ? { muted: true, mute_until: null }
        : { muted: true, mute_until: new Date(Date.now() + ms).toISOString() };
  const { error } = await supabase.from("chat_participants").update(patch as never).eq("conversation_id", conversationId).eq("user_id", me);
  if (error) throw error;
}

export function MuteSheet({
  open,
  onOpenChange,
  conversationId,
  me,
  muted,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conversationId: string;
  me: string;
  muted: boolean;
  onDone: () => void;
}) {
  const run = async (ms: number | null) => {
    try {
      await setMute(conversationId, me, ms);
      onOpenChange(false);
      onDone();
      toast.success(ms === null ? "Bildirimler açıldı" : "Sessize alındı");
    } catch {
      toast.error("Kaydedilemedi.");
    }
  };
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-[max(env(safe-area-inset-bottom),1rem)]">
        <DrawerTitle className="px-4 pt-3 text-base">Bildirimleri sessize al</DrawerTitle>
        <div className="px-4 pt-2">
          {MUTE_OPTIONS.map((o) => (
            <button key={o.label} type="button" onClick={() => void run(o.ms)} className="flex min-h-12 w-full items-center rounded-md px-3 text-base hover:bg-muted">
              {o.label}
            </button>
          ))}
          {muted ? (
            <button type="button" onClick={() => void run(null)} className="flex min-h-12 w-full items-center rounded-md px-3 text-base font-medium text-chat-read hover:bg-muted">
              Sesi aç
            </button>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/* ---------- Profil kartı ---------- */
export function UserCardSheet({
  userId,
  preset,
  onClose,
  onOpenChat,
}: {
  userId: string | null;
  preset?: ChatUserCard | null;
  onClose: () => void;
  onOpenChat: (conversationId: string) => void;
}) {
  const getCard = useServerFn(getChatUserCard);
  const start = useServerFn(startChatByHandle);
  const block = useServerFn(setChatBlock);
  const qc = useQueryClient();
  const card = useQuery({
    queryKey: ["chat", "card", userId],
    enabled: Boolean(userId) && !preset,
    queryFn: () => getCard({ data: { userId: userId! } }),
  });
  const c = preset ?? card.data;
  const msg = useMutation({
    mutationFn: () => start({ data: { userId: userId! } }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["chat", "list"] });
      onOpenChat(r.id);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleBlock = useMutation({
    mutationFn: (blocked: boolean) => block({ data: { userId: userId!, blocked } }),
    onSuccess: async (_r, blocked) => {
      toast.success(blocked ? "Kişi engellendi" : "Engel kaldırıldı");
      await qc.invalidateQueries({ queryKey: ["chat"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Drawer open={Boolean(userId)} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="pb-[max(env(safe-area-inset-bottom),1rem)]">
        <DrawerTitle className="sr-only">Profil kartı</DrawerTitle>
        {!c ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{card.isError ? (card.error as Error).message : "Yükleniyor…"}</p>
        ) : (
          <div className="flex flex-col items-center gap-2 px-5 pt-4 text-center">
            <Avatar className="size-24">
              {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-2xl">{initials(c.name)}</AvatarFallback>
            </Avatar>
            <p className="text-xl font-semibold">{c.name}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium uppercase">{ROLE_LABEL[c.role] ?? c.role}</span>
              {c.handle ? <span>@{c.handle}</span> : null}
            </div>
            {c.storeName ? (
              <p className="flex items-center gap-1.5 text-sm">
                <Store className="size-4" />
                {c.storeUrl ? (
                  <a href={c.storeUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    {c.storeName}
                  </a>
                ) : (
                  c.storeName
                )}
              </p>
            ) : null}
            {c.bio ? <p className="max-w-sm text-sm text-muted-foreground">{c.bio}</p> : null}
            <div className="mt-3 grid w-full gap-2">
              {!c.blocked ? (
                <Button className="h-12" onClick={() => msg.mutate()} disabled={msg.isPending}>
                  <MessageCircle className="mr-2 size-4" /> Mesaj Gönder
                </Button>
              ) : null}
              <Button variant="outline" className="h-12 text-destructive" onClick={() => toggleBlock.mutate(!c.blocked)} disabled={toggleBlock.isPending}>
                <Ban className="mr-2 size-4" /> {c.blocked ? "Engeli kaldır" : "Engelle"}
              </Button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

/* ---------- Mesaj şikayeti ---------- */
const REASONS = [
  { value: "spam", label: "Spam / istenmeyen" },
  { value: "abuse", label: "Hakaret / taciz" },
  { value: "fraud", label: "Dolandırıcılık" },
  { value: "inappropriate", label: "Uygunsuz içerik" },
  { value: "other", label: "Diğer" },
] as const;

export function ReportSheet({ messageId, onClose }: { messageId: string | null; onClose: () => void }) {
  const report = useServerFn(reportChatMessage);
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("spam");
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: () => report({ data: { messageId: messageId!, reason, ...(note.trim() ? { note: note.trim() } : {}) } }),
    onSuccess: () => {
      toast.success("Şikayetiniz moderasyona iletildi");
      setNote("");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Drawer open={Boolean(messageId)} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="pb-[max(env(safe-area-inset-bottom),1rem)]">
        <DrawerTitle className="px-4 pt-3 text-base">Mesajı şikayet et</DrawerTitle>
        <DrawerDescription className="px-4 text-xs">Şikayetler Mefticaret moderasyon ekibine gönderilir.</DrawerDescription>
        <div className="space-y-2 px-4 pt-3">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReason(r.value)}
              className={cn("flex min-h-11 w-full items-center rounded-md border px-3 text-left text-sm", reason === r.value && "border-chat-unread bg-muted font-medium")}
            >
              {r.label}
            </button>
          ))}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Açıklama (isteğe bağlı)" />
          <Button className="h-12 w-full" onClick={() => m.mutate()} disabled={m.isPending}>
            Şikayet et
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/* ---------- QR kod: göster + tara ---------- */
export function QrSheet({
  open,
  onOpenChange,
  handle,
  onFound,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  handle: string | null;
  onFound: (card: ChatUserCard) => void;
}) {
  const [tab, setTab] = useState<"mine" | "scan">("mine");
  const [img, setImg] = useState<string | null>(null);
  const find = useServerFn(findChatUserByHandle);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!handle) return setImg(null);
    void QRCode.toDataURL(`https://mefticaret.com/mesajlar?u=${encodeURIComponent(handle)}`, { width: 480, margin: 1 }).then(setImg);
  }, [handle]);

  const lookup = async (raw: string) => {
    const m = raw.match(/[?&]u=([a-z0-9_.]{3,24})/i) ?? raw.match(/^@?([a-z0-9_.]{3,24})$/i);
    if (!m) return toast.error("Geçerli bir Mefticaret QR kodu değil.");
    try {
      const card = await find({ data: { handle: m[1]!.toLowerCase() } });
      onOpenChange(false);
      onFound(card);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  useEffect(() => {
    if (!open || tab !== "scan") return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    setScanErr(null);
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = videoRef.current;
        if (!v || stopped) return;
        v.srcObject = stream;
        await v.play();
        const { default: jsQR } = await import("jsqr");
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        const tick = () => {
          if (stopped) return;
          if (v.videoWidth) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            if (code?.data) {
              stopped = true;
              void lookup(code.data);
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setScanErr("Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin veya kullanıcı adını elle yazın.");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-[max(env(safe-area-inset-bottom),1rem)]">
        <DrawerTitle className="sr-only">QR kod</DrawerTitle>
        <div className="mx-4 mt-3 grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          {(["mine", "scan"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={cn("h-10 rounded text-sm font-medium", tab === t && "bg-background shadow-sm")}>
              {t === "mine" ? "Kodum" : "Tara"}
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center gap-3 p-4">
          {tab === "mine" ? (
            handle ? (
              <>
                {img ? <img src={img} alt="Profil QR kodum" className="size-64 rounded-lg bg-background" /> : null}
                <p className="font-medium">@{handle}</p>
                <p className="text-center text-xs text-muted-foreground">Bu kodu okutan kişi size doğrudan mesaj atabilir.</p>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">QR kodunuz için önce Profil'den bir kullanıcı adı (@) belirleyin.</p>
            )
          ) : (
            <>
              {scanErr ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{scanErr}</p>
              ) : (
                <video ref={videoRef} playsInline muted className="aspect-square w-full max-w-xs rounded-lg bg-muted object-cover" />
              )}
              <div className="flex w-full max-w-xs gap-2">
                <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="@kullaniciadi" aria-label="Kullanıcı adı" />
                <Button onClick={() => void lookup(manual.trim())} disabled={!manual.trim()}>
                  Bul
                </Button>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/* ---------- Rehberden bul (yalnız destekleyen tarayıcılar) ---------- */
type ContactsApi = { select: (props: string[], opts: { multiple: boolean }) => Promise<{ tel?: string[] }[]> };
export const contactsSupported = () => typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window;

export function ContactsButton({ onResults }: { onResults: (cards: ChatUserCard[]) => void }) {
  const match = useServerFn(matchChatContacts);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(contactsSupported()), []);
  if (!ok) return null;
  return (
    <Button
      variant="outline"
      className="h-11 w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const picked = await (navigator as unknown as { contacts: ContactsApi }).contacts.select(["tel"], { multiple: true });
          const phones = picked.flatMap((c) => c.tel ?? []).slice(0, 500);
          if (!phones.length) return;
          const cards = await match({ data: { phones } });
          onResults(cards);
          if (!cards.length) toast("Seçtiğiniz kişilerden Mefticaret'te kayıtlı olan yok.");
        } catch (e) {
          toast.error((e as Error).message || "Rehber okunamadı.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Contact className="mr-2 size-4" /> Rehberden bul
    </Button>
  );
}

export function QrButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" className="h-11 w-full" onClick={onClick}>
      <QrCode className="mr-2 size-4" /> QR kod ile ekle
      <Camera className="ml-2 size-4 opacity-60" />
    </Button>
  );
}

/* ---------- Bildirim sesi ---------- */
const TONES: Record<string, [number, number][]> = {
  pop: [[880, 0.08]],
  chime: [[660, 0.12], [990, 0.16]],
  ding: [[1320, 0.25]],
};
export function playTone(name: string) {
  const seq = TONES[name];
  if (!seq || typeof AudioContext === "undefined") return;
  try {
    const ac = new AudioContext();
    let t = ac.currentTime;
    for (const [f, d] of seq) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + d);
      t += d;
    }
    window.setTimeout(() => void ac.close(), 1000);
  } catch {
    /* ses çalınamadı */
  }
}
