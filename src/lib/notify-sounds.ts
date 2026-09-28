import chaChing from "@/assets/sounds/cha-ching.m4a.asset.json";
import hola from "@/assets/sounds/hola.m4a.asset.json";
import tips from "@/assets/sounds/tips.m4a.asset.json";

/** Bildirim sesleri: cha-ching = yeni sipariş, hola = yeni mesaj, tips = diğer bildirimler. */
const SOUNDS = { order: chaChing.url, message: hola.url, info: tips.url } as const;
export type NotifySound = keyof typeof SOUNDS;

export function playNotifySound(kind: NotifySound) {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio(SOUNDS[kind]);
    audio.volume = 0.8;
    void audio.play().catch(() => undefined);
  } catch {
    /* tarayıcı sesi engelledi */
  }
}
