import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  SUPPORT_ALLOWED_MIME,
  SUPPORT_CATEGORIES,
  SUPPORT_CHANNELS,
  SUPPORT_MAX_FILE_BYTES,
  SUPPORT_PRIORITIES,
  STORE_ASSIGNABLE_STATUSES,
  type SupportAttachment,
  type SupportMessageRow,
  type SupportTicketRow,
} from "@/lib/support-tickets";

/** Destek talebi sunucu mantığı: oluşturma, yazışma, durum ve dosya doğrulama. */

type Client = SupabaseClient<Database>;

const attachmentSchema = z.object({
  path: z.string().trim().min(3).max(400),
  name: z.string().trim().min(1).max(200),
  size: z.number().int().min(0).max(SUPPORT_MAX_FILE_BYTES),
  mimeType: z.string().trim().min(3).max(120).refine((value) => SUPPORT_ALLOWED_MIME.includes(value), {
    message: "Desteklenmeyen dosya türü",
  }),
});

export const storeScopeSchema = z.object({ storeId: z.guid() });

export const listTicketsSchema = z.object({
  storeId: z.guid(),
  status: z.string().trim().max(20).optional(),
});

export const ticketScopeSchema = z.object({
  storeId: z.guid(),
  ticketId: z.guid(),
});

export const createTicketSchema = z.object({
  storeId: z.guid(),
  subject: z.string().trim().min(4).max(200),
  department: z.string().trim().min(2).max(60),
  category: z.enum(SUPPORT_CATEGORIES).default("other"),
  priority: z.enum(SUPPORT_PRIORITIES).default("normal"),
  channel: z.enum(SUPPORT_CHANNELS).default("ticket"),
  body: z.string().trim().min(5).max(10_000),
  attachments: z.array(attachmentSchema).max(10).default([]),
});

export const replySchema = z.object({
  storeId: z.guid(),
  ticketId: z.guid(),
  body: z.string().trim().min(1).max(10_000),
  attachments: z.array(attachmentSchema).max(10).default([]),
});

export const updateTicketSchema = z.object({
  storeId: z.guid(),
  ticketId: z.guid(),
  status: z.enum(STORE_ASSIGNABLE_STATUSES).optional(),
  priority: z.enum(SUPPORT_PRIORITIES).optional(),
  department: z.string().trim().min(2).max(60).optional(),
});

const TICKET_SELECT =
  "id, store_id, subject, department, category, priority, status, channel, requester_id, requester_email, assigned_to, attachments, first_response_at, last_reply_at, resolved_at, closed_at, created_at, updated_at";

const MESSAGE_SELECT =
  "id, ticket_id, author_id, author_name, author_role, body, is_internal, attachments, read_at, created_at";

/** Dosya yolunun ilgili mağaza/ticket klasöründe olduğunu doğrular. */
function assertAttachmentScope(
  attachments: SupportAttachment[],
  storeId: string,
  ticketId?: string,
) {
  for (const file of attachments) {
    const segments = file.path.split("/").filter(Boolean);
    if (segments[0] !== storeId) throw new Error("Dosya yolu bu mağazaya ait değil");
    if (ticketId && segments[1] && segments[1] !== ticketId) {
      throw new Error("Dosya yolu bu talebe ait değil");
    }
  }
}

async function assertStoreMember(supabase: Client, storeId: string, userId: string) {
  const { data, error } = await supabase
    .from("store_users")
    .select("id")
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const { data: owned } = await supabase
      .from("stores")
      .select("id")
      .eq("id", storeId)
      .maybeSingle();
    if (!owned) throw new Error("Bu mağaza için yetkiniz yok");
  }
  return true;
}

export async function listDepartments(supabase: Client) {
  const { data, error } = await supabase
    .from("support_departments")
    .select("id, code, label, description, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listStoreTickets(
  supabase: Client,
  input: z.infer<typeof listTicketsSchema>,
) {
  let query = supabase
    .from("support_tickets")
    .select(TICKET_SELECT)
    .eq("store_id", input.storeId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status as SupportTicketRow["status"]);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SupportTicketRow[];
}

export async function listTicketMessages(
  supabase: Client,
  input: z.infer<typeof ticketScopeSchema>,
) {
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select(MESSAGE_SELECT)
    .eq("ticket_id", input.ticketId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SupportMessageRow[];
}

export async function createTicket(
  supabase: Client,
  userId: string,
  email: string | null,
  input: z.infer<typeof createTicketSchema>,
) {
  await assertStoreMember(supabase, input.storeId, userId);
  assertAttachmentScope(input.attachments, input.storeId);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      store_id: input.storeId,
      subject: input.subject,
      department: input.department,
      category: input.category,
      priority: input.priority,
      channel: input.channel,
      status: "open",
      requester_id: userId,
      requester_email: email,
      attachments: input.attachments,
      last_reply_at: now,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: messageError } = await supabase.from("support_ticket_messages").insert({
    ticket_id: data.id,
    author_id: userId,
    author_name: email,
    author_role: "store",
    body: input.body,
    is_internal: false,
    attachments: input.attachments,
  });
  if (messageError) throw new Error(messageError.message);

  return { id: data.id };
}

export async function replyToTicket(
  supabase: Client,
  userId: string,
  email: string | null,
  input: z.infer<typeof replySchema>,
) {
  assertAttachmentScope(input.attachments, input.storeId, input.ticketId);

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id, status")
    .eq("id", input.ticketId)
    .eq("store_id", input.storeId)
    .maybeSingle();
  if (ticketError) throw new Error(ticketError.message);
  if (!ticket) throw new Error("Talep bulunamadı");

  const { error } = await supabase.from("support_ticket_messages").insert({
    ticket_id: input.ticketId,
    author_id: userId,
    author_name: email,
    author_role: "store",
    body: input.body,
    is_internal: false,
    attachments: input.attachments,
  });
  if (error) throw new Error(error.message);

  const patch: Database["public"]["Tables"]["support_tickets"]["Update"] = {
    last_reply_at: new Date().toISOString(),
  };
  if (ticket.status === "closed" || ticket.status === "resolved") patch.status = "open";
  else if (ticket.status === "answered") patch.status = "pending";

  const { error: updateError } = await supabase
    .from("support_tickets")
    .update(patch)
    .eq("id", input.ticketId);
  if (updateError) throw new Error(updateError.message);

  return { ok: true as const };
}

export async function updateTicket(
  supabase: Client,
  input: z.infer<typeof updateTicketSchema>,
) {
  const patch: Database["public"]["Tables"]["support_tickets"]["Update"] = {};
  if (input.status) {
    patch.status = input.status;
    patch.closed_at = input.status === "closed" ? new Date().toISOString() : null;
  }
  if (input.priority) patch.priority = input.priority;
  if (input.department) patch.department = input.department;
  if (Object.keys(patch).length === 0) return { ok: true as const };

  const { error } = await supabase
    .from("support_tickets")
    .update(patch)
    .eq("id", input.ticketId)
    .eq("store_id", input.storeId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/** İmzalı indirme bağlantısı (özel bucket; süreli erişim). */
export async function signAttachment(supabase: Client, path: string, storeId: string) {
  if (path.split("/")[0] !== storeId) throw new Error("Dosya bu mağazaya ait değil");
  const { data, error } = await supabase.storage
    .from("support-attachments")
    .createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return { url: data.signedUrl };
}
