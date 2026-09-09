import { z } from "zod";

/** Platform iletişim formu — sunucu tarafı doğrulama ve kayıt. */

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional(),
  subject: z.string().trim().max(160).optional(),
  message: z.string().trim().min(5).max(4000),
  pageSlug: z.string().trim().max(160).optional(),
});

export const markReadSchema = z.object({
  messageId: z.string().uuid(),
  isRead: z.boolean().default(true),
});

export async function insertContactMessage(
  input: z.infer<typeof contactMessageSchema>,
  userAgent: string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("platform_contact_messages").insert({
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    subject: input.subject ?? null,
    message: input.message,
    page_slug: input.pageSlug ?? null,
    user_agent: userAgent ? userAgent.slice(0, 300) : null,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}
