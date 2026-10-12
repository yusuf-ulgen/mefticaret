import { z } from "zod";

/** Blog kapak görsellerinin özel depolama kovasına yazılması. */

const MAX_BYTES = 3_000_000;

export const blogCoverSchema = z.object({
  /** data:image/jpeg;base64,... biçiminde, tarayıcıda yeniden boyutlandırılmış görsel. */
  dataUrl: z
    .string()
    .max(8_000_000)
    .refine((value) => /^data:image\/(jpeg|png|webp);base64,/.test(value), "Desteklenmeyen görsel"),
  fileName: z.string().trim().max(120).optional(),
});

export async function storeBlogCover(input: z.infer<typeof blogCoverSchema>) {
  const [header, base64] = input.dataUrl.split(",", 2);
  const contentType = header?.slice(5, header.indexOf(";")) ?? "image/jpeg";
  const bytes = Buffer.from(base64 ?? "", "base64");
  if (bytes.byteLength === 0) throw new Error("Görsel okunamadı");
  if (bytes.byteLength > MAX_BYTES) throw new Error("Görsel çok büyük (en fazla 3 MB)");

  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${extension}`;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.storage
    .from("blog-covers")
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(error.message);

  return { url: `/api/public/blog-cover/${path}`, path };
}
