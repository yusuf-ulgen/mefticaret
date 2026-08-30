import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

/**
 * Vitrin müşteri hesabı iş mantığı (yalnızca sunucu).
 * Okuma/yazma işlemleri RLS altında oturum açmış kullanıcı olarak yapılır;
 * yalnızca "hesap sahiplenme" (checkout'ta misafir olarak açılmış müşteri
 * kaydının kullanıcıya bağlanması) servis anahtarı gerektirir ve e-posta
 * eşleşmesi doğrulanmadan asla bağlantı kurulmaz.
 */

type Client = SupabaseClient<Database>;
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type AddressRow = Database["public"]["Tables"]["customer_addresses"]["Row"];

export type MyCustomer = Pick<
  CustomerRow,
  "id" | "store_id" | "full_name" | "email" | "phone" | "accepts_marketing" | "total_spent" | "orders_count" | "created_at"
>;

export type MyOrder = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  | "id"
  | "order_number"
  | "status"
  | "payment_status"
  | "fulfillment_status"
  | "currency"
  | "grand_total"
  | "shipping_carrier"
  | "tracking_number"
  | "placed_at"
> & {
  order_items: Pick<
    Database["public"]["Tables"]["order_items"]["Row"],
    "id" | "title" | "variant_title" | "quantity" | "unit_price" | "line_total"
  >[];
};

export type MyAddress = Pick<
  AddressRow,
  "id" | "label" | "recipient" | "phone" | "country" | "city" | "district" | "line1" | "line2" | "postal_code" | "is_default"
>;

export const storeIdSchema = z.object({ storeId: z.string().uuid() });

export const saveAddressSchema = z.object({
  storeId: z.string().uuid(),
  id: z.string().uuid().optional(),
  label: z.string().trim().max(60).optional(),
  recipient: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional(),
  country: z.string().trim().min(2).max(60),
  city: z.string().trim().min(1).max(80),
  district: z.string().trim().max(80).optional(),
  line1: z.string().trim().min(5).max(240),
  line2: z.string().trim().max(240).optional(),
  postalCode: z.string().trim().max(20).optional(),
  isDefault: z.boolean().default(false),
});

export const deleteAddressSchema = z.object({
  storeId: z.string().uuid(),
  id: z.string().uuid(),
});

export const updateProfileSchema = z.object({
  storeId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional(),
  acceptsMarketing: z.boolean(),
});

const CUSTOMER_SELECT =
  "id, store_id, full_name, email, phone, accepts_marketing, total_spent, orders_count, created_at";

/** Oturum açmış kullanıcının bu mağazadaki müşteri kaydını döndürür (yoksa null). */
export async function findMyCustomer(supabase: Client, userId: string, storeId: string): Promise<MyCustomer | null> {
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT)
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Misafir checkout ile aynı e-postayla açılmış müşteri kaydını kullanıcıya bağlar;
 * kayıt yoksa yeni müşteri kaydı oluşturur. E-posta eşleşmesi zorunludur.
 */
export async function claimStoreAccount(supabase: Client, userId: string, storeId: string) {
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email?.trim().toLowerCase();
  if (!email) throw new Error("Hesabınızda e-posta adresi bulunamadı.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: store, error: storeError } = await supabaseAdmin
    .from("stores")
    .select("id, name, slug, status, published_at, is_demo")
    .eq("id", storeId)
    .maybeSingle();
  if (storeError) throw new Error(storeError.message);
  if (!store) throw new Error("Mağaza bulunamadı.");
  const published = store.status === "active" || Boolean(store.published_at) || store.is_demo;
  if (!published) throw new Error("Bu mağaza şu anda üyelik kabul etmiyor.");

  // Aynı mağazada zaten bağlı kayıt var mı?
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return { customerId: existing.id, linked: false };

  // E-posta eşleşen sahipsiz misafir kaydını sahiplen
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("customers")
    .update({ user_id: userId })
    .eq("store_id", storeId)
    .is("user_id", null)
    .ilike("email", email)
    .select("id");
  if (claimError) throw new Error(claimError.message);
  if (claimed && claimed.length > 0) return { customerId: claimed[0]!.id, linked: true };

  // Kayıt yoksa oluştur
  const fullName =
    (userData.user?.user_metadata?.["full_name"] as string | undefined) ??
    (userData.user?.user_metadata?.["name"] as string | undefined) ??
    email.split("@")[0]!;
  const { data: created, error: createError } = await supabaseAdmin
    .from("customers")
    .insert({ store_id: storeId, user_id: userId, full_name: fullName, email })
    .select("id")
    .single();
  if (createError) throw new Error(createError.message);
  return { customerId: created.id, linked: true };
}

export async function listMyOrders(
  supabase: Client,
  userId: string,
  storeId: string,
): Promise<{ customer: MyCustomer | null; orders: MyOrder[] }> {
  const customer = await findMyCustomer(supabase, userId, storeId);
  if (!customer) return { customer: null, orders: [] };
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, payment_status, fulfillment_status, currency, grand_total, shipping_carrier, tracking_number, placed_at, order_items(id, title, variant_title, quantity, unit_price, line_total)",
    )
    .eq("store_id", storeId)
    .eq("customer_id", customer.id)
    .order("placed_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return { customer, orders: (data ?? []) as MyOrder[] };
}

export async function listMyAddresses(
  supabase: Client,
  userId: string,
  storeId: string,
): Promise<{ customer: MyCustomer | null; addresses: MyAddress[] }> {
  const customer = await findMyCustomer(supabase, userId, storeId);
  if (!customer) return { customer: null, addresses: [] };
  const { data, error } = await supabase
    .from("customer_addresses")
    .select("id, label, recipient, phone, country, city, district, line1, line2, postal_code, is_default")
    .eq("customer_id", customer.id)
    .eq("store_id", storeId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { customer, addresses: data ?? [] };
}

export async function saveMyAddress(supabase: Client, userId: string, input: z.infer<typeof saveAddressSchema>) {
  const customer = await findMyCustomer(supabase, userId, input.storeId);
  if (!customer) throw new Error("Önce mağaza hesabınızı oluşturmalısınız.");

  if (input.isDefault) {
    await supabase.from("customer_addresses").update({ is_default: false }).eq("customer_id", customer.id);
  }

  const payload = {
    customer_id: customer.id,
    store_id: input.storeId,
    label: input.label ?? null,
    recipient: input.recipient,
    phone: input.phone ?? null,
    country: input.country,
    city: input.city,
    district: input.district ?? null,
    line1: input.line1,
    line2: input.line2 ?? null,
    postal_code: input.postalCode ?? null,
    is_default: input.isDefault,
  };

  if (input.id) {
    const { error } = await supabase
      .from("customer_addresses")
      .update(payload)
      .eq("id", input.id)
      .eq("customer_id", customer.id);
    if (error) throw new Error(error.message);
    return { id: input.id };
  }
  const { data, error } = await supabase.from("customer_addresses").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function deleteMyAddress(supabase: Client, userId: string, input: z.infer<typeof deleteAddressSchema>) {
  const customer = await findMyCustomer(supabase, userId, input.storeId);
  if (!customer) throw new Error("Müşteri kaydı bulunamadı.");
  const { error } = await supabase.from("customer_addresses").delete().eq("id", input.id).eq("customer_id", customer.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function updateMyProfile(supabase: Client, userId: string, input: z.infer<typeof updateProfileSchema>) {
  const { error } = await supabase
    .from("customers")
    .update({
      full_name: input.fullName,
      phone: input.phone ?? null,
      accepts_marketing: input.acceptsMarketing,
    })
    .eq("store_id", input.storeId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}
