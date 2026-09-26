import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getChatPushKey } from "@/lib/chat-push.functions";

const toBytes = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const b64u = (buf: ArrayBuffer | null) =>
  buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "";

type State = "unsupported" | "iframe" | "off" | "on" | "denied";

/** Uygulama kapalıyken bildirim almak için telefonu kaydeder. */
export function PushToggle() {
  const getKey = useServerFn(getChatPushKey);
  const [state, setState] = useState<State>("off");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
    if (window.top !== window.self) return setState("iframe");
    if (Notification.permission === "denied") return setState("denied");
    void navigator.serviceWorker.getRegistration("/").then(async (r) => {
      const sub = await r?.pushManager.getSubscription();
      if (sub && Notification.permission === "granted") setState("on");
    });
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState("denied");
      const { key } = await getKey();
      if (!key) throw new Error("Bildirim ayarı eksik.");
      const reg = await navigator.serviceWorker.register("/chat-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) }));
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Oturum bulunamadı.");
      await supabase.from("chat_push_subscriptions").delete().eq("endpoint", sub.endpoint);
      const { error } = await supabase.from("chat_push_subscriptions").insert({
        user_id: u.user.id,
        endpoint: sub.endpoint,
        p256dh: b64u(sub.getKey("p256dh")),
        auth: b64u(sub.getKey("auth")),
      });
      if (error) throw error;
      setState("on");
      toast.success("Bu cihaza bildirim gelecek.");
    } catch (e) {
      toast.error((e as Error).message || "Bildirim açılamadı.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.from("chat_push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  const note: Record<State, string> = {
    unsupported: "Bu tarayıcı kapalı uygulama bildirimlerini desteklemiyor. iPhone'da önce Ana Ekrana Ekle ile kurun.",
    iframe: "Bildirimi açmak için sayfayı ayrı sekmede veya yayındaki sitede açın.",
    denied: "Bildirim izni kapalı. Tarayıcı site ayarlarından izin verin.",
    off: "Uygulama kapalıyken yeni mesaj ve sesli mesajlar için bildirim alın.",
    on: "Bu cihaz kapalıyken de bildirim alıyor.",
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{note[state]}</p>
      {state === "off" || state === "on" ? (
        <Button variant={state === "on" ? "outline" : "default"} className="h-11 w-full" disabled={busy} onClick={state === "on" ? disable : enable}>
          <BellRing className="mr-2 size-4" /> {state === "on" ? "Cihaz bildirimlerini kapat" : "Cihaz bildirimlerini aç"}
        </Button>
      ) : null}
    </div>
  );
}
