import type { ChatMember, ChatSummary } from "@/lib/chat.functions";

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: "text" | "image" | "file" | "audio";
  body: string | null;
  reply_to_id: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_mime: string | null;
  duration_ms: number | null;
  deleted_at: string | null;
  created_at: string;
  pending?: boolean;
};

export type Reaction = { message_id: string; user_id: string; emoji: string };

export const ROLE_LABEL: Record<string, string> = { admin: "Admin", seller: "Satıcı", customer: "Müşteri" };
export const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
export const EMOJI_GRID = (
  "😀 😁 😂 🤣 😊 😍 😘 😎 🤔 😅 😇 🙂 😉 😢 😭 😡 😱 🥳 😴 🤗 👍 👎 👏 🙏 💪 👌 ✌️ 🤝 👋 ❤️ 🧡 💛 💚 💙 💜 🔥 ⭐ ✨ 🎉 🎁 📦 🚚 💳 🛒 ✅ ❌ ⏰ 📷 📎"
).split(" ");

export function others(chat: ChatSummary, me: string): ChatMember[] {
  return chat.members.filter((m) => m.id !== me);
}

export function chatTitle(chat: ChatSummary, me: string) {
  if (chat.kind === "group") return chat.title || others(chat, me).map((m) => m.name).join(", ");
  return others(chat, me)[0]?.name ?? "Sohbet";
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase("tr") ?? "")
    .join("");
}

export function timeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Dün";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Bugün";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Dün";
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

export function lastSeen(member: ChatMember | undefined, online: boolean) {
  if (!member) return "";
  if (online) return "çevrimiçi";
  if (!member.lastSeenAt) return ROLE_LABEL[member.role] ?? "";
  const mins = Math.round((Date.now() - new Date(member.lastSeenAt).getTime()) / 60000);
  if (mins < 1) return "son görülme az önce";
  if (mins < 60) return `son görülme ${mins} dk önce`;
  if (mins < 1440) return `son görülme ${Math.round(mins / 60)} sa önce`;
  return `son görülme ${timeLabel(member.lastSeenAt)}`;
}

export function fileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const CACHE_PREFIX = "mefti-chat-cache:";
export function cacheMessages(convId: string, rows: ChatMessage[]) {
  try {
    localStorage.setItem(CACHE_PREFIX + convId, JSON.stringify(rows.filter((r) => !r.pending).slice(-50)));
  } catch {
    /* depolama dolu olabilir */
  }
}
export function cachedMessages(convId: string): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE_PREFIX + convId) ?? "[]");
  } catch {
    return [];
  }
}

export const URL_RE = /(https?:\/\/[^\s]+)/g;
export const isMultiChat = (kind: string) => kind === "group" || kind === "store_team" || kind === "store_inbox";
