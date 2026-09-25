/**
 * Dolandırıcılık risk motoru.
 * Sipariş oluşturulurken sinyalleri toplar, 0-100 risk skoru hesaplar ve
 * kararı (otomatik onay / inceleme / SMS doğrulama / ret) kaydeder.
 */

import { clientIp } from "@/lib/rate-limit.server";
import {
  fraudActionForScore,
  isDisposableEmail,
  isValidTrPhone,
  type FraudAction,
} from "@/lib/security-firewall";
import { getSecuritySettings, logAttack } from "@/lib/security-firewall.server";

export type FraudSignal = {
  type: string;
  label: string;
  value?: string;
  points: number;
  details?: Record<string, unknown>;
};

export type FraudAssessment = {
  enabled: boolean;
  score: number;
  action: FraudAction;
  signals: FraudSignal[];
  scoreId: string | null;
};

export type FraudInput = {
  storeId: string;
  orderId?: string | null;
  customerId?: string | null;
  email?: string | null;
  phone?: string | null;
  amount: number;
  isDigital?: boolean;
  shippingAddress?: unknown;
  billingAddress?: unknown;
  checkoutSeconds?: number | null;
  deviceFingerprint?: string | null;
  request?: Request;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function addressKey(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const a = value as Record<string, unknown>;
  return [a["address1"], a["city"], a["district"], a["province"], a["zip"]]
    .map((v) => String(v ?? "").trim().toLowerCase())
    .join("|");
}

/** Siparişi puanlar; kayıt oluşturur ve alınacak aksiyonu döner. */
export async function assessOrderRisk(input: FraudInput): Promise<FraudAssessment> {
  const settings = await getSecuritySettings();
  if (!settings.fraudDetectionEnabled) {
    return { enabled: false, score: 0, action: "auto_approve", signals: [], scoreId: null };
  }

  const ip = input.request ? clientIp(input.request) : "unknown";
  const signals: FraudSignal[] = [];

  try {
    const db = await admin();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1) Hız kontrolleri
    if (input.customerId) {
      const { count } = await db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", input.customerId)
        .gte("created_at", hourAgo);
      if ((count ?? 0) >= 5)
        signals.push({
          type: "velocity_customer",
          label: "Aynı müşteri son 1 saatte 5+ sipariş",
          value: String(count),
          points: 30,
        });
    }
    if (ip !== "unknown") {
      const { count } = await db
        .from("sec_fraud_scores")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", ip)
        .gte("created_at", dayAgo);
      if ((count ?? 0) >= 3)
        signals.push({
          type: "velocity_ip",
          label: "Aynı IP son 24 saatte 3+ ödeme denemesi",
          value: String(count),
          points: 40,
        });
    }
    if (input.deviceFingerprint) {
      const { data: devices } = await db
        .from("sec_trusted_devices")
        .select("user_id")
        .eq("device_fingerprint", input.deviceFingerprint);
      const distinct = new Set((devices ?? []).map((d) => d.user_id)).size;
      if (distinct >= 3)
        signals.push({
          type: "device_accounts",
          label: "Aynı cihazda 3+ farklı hesap",
          value: String(distinct),
          points: 50,
        });
    }

    // 2) Coğrafi anomali
    const reputation = ip === "unknown" ? null : await db
      .from("sec_ip_reputation")
      .select("is_vpn, is_tor, is_datacenter, country_code, reputation_score")
      .eq("ip_address", ip)
      .maybeSingle();
    const rep = reputation?.data;
    if (rep?.is_vpn || rep?.is_tor || rep?.is_datacenter)
      signals.push({
        type: "vpn_proxy",
        label: "VPN / proxy / veri merkezi IP'si",
        points: 25,
        details: { vpn: rep.is_vpn, tor: rep.is_tor, datacenter: rep.is_datacenter },
      });
    const headerCountry = (input.request?.headers.get("cf-ipcountry") ?? "").toUpperCase();
    const shipCountry = String(
      (input.shippingAddress as Record<string, unknown> | undefined)?.["country"] ?? "",
    ).toUpperCase();
    if (headerCountry && shipCountry && shipCountry.startsWith("TR") && headerCountry !== "TR")
      signals.push({
        type: "geo_mismatch",
        label: "Yurt dışı bağlantı, Türkiye teslimat adresi",
        value: headerCountry,
        points: 20,
      });

    // 3) Sipariş anomalisi
    if (input.customerId) {
      const { count: previous } = await db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", input.customerId);
      if ((previous ?? 0) === 0 && input.amount >= 5000)
        signals.push({
          type: "first_order_high",
          label: "İlk sipariş ve yüksek tutar",
          value: String(input.amount),
          points: 20,
        });
    } else if (input.amount >= 5000) {
      signals.push({
        type: "guest_high_amount",
        label: "Üyeliksiz sipariş ve yüksek tutar",
        value: String(input.amount),
        points: 15,
      });
    }
    const ship = addressKey(input.shippingAddress);
    const bill = addressKey(input.billingAddress);
    if (ship && bill && ship !== bill)
      signals.push({ type: "address_mismatch", label: "Kargo adresi faturadan farklı", points: 10 });
    if (input.isDigital && input.amount >= 2000)
      signals.push({ type: "digital_high", label: "Dijital ürün ve yüksek tutar", points: 15 });

    // 4) Cihaz & davranış
    if (typeof input.checkoutSeconds === "number" && input.checkoutSeconds > 0 && input.checkoutSeconds < 30)
      signals.push({
        type: "fast_checkout",
        label: "Ödeme 30 saniyeden kısa sürede tamamlandı",
        value: `${input.checkoutSeconds} sn`,
        points: 20,
      });
    if (input.deviceFingerprint && input.amount >= 3000) {
      const { count: known } = await db
        .from("sec_trusted_devices")
        .select("id", { count: "exact", head: true })
        .eq("device_fingerprint", input.deviceFingerprint);
      if ((known ?? 0) === 0)
        signals.push({ type: "new_device_high", label: "Yeni cihaz ve büyük sipariş", points: 15 });
    }

    // 5) E-posta / telefon
    if (input.email && isDisposableEmail(input.email))
      signals.push({
        type: "disposable_email",
        label: "Geçici e-posta servisi",
        value: input.email.split("@")[1] ?? "",
        points: 40,
      });
    if (input.phone && !isValidTrPhone(input.phone) && (shipCountry === "" || shipCountry.startsWith("TR")))
      signals.push({ type: "invalid_phone", label: "Geçersiz telefon numarası", points: 20 });
    if (input.customerId) {
      const { data: customer } = await db
        .from("customers")
        .select("created_at")
        .eq("id", input.customerId)
        .maybeSingle();
      if (customer?.created_at && Date.now() - new Date(customer.created_at).getTime() < 60 * 60 * 1000)
        signals.push({ type: "new_account_fast", label: "Yeni kayıt ve hızlı alışveriş", points: 15 });
    }

    const score = Math.min(100, signals.reduce((sum, s) => sum + s.points, 0));
    const action = fraudActionForScore(score);

    const { data: inserted } = await db
      .from("sec_fraud_scores")
      .insert({
        store_id: input.storeId,
        order_id: input.orderId ?? null,
        customer_id: input.customerId ?? null,
        ip_address: ip === "unknown" ? null : ip,
        total_risk_score: score,
        triggered_rules: signals.map((s) => ({ type: s.type, label: s.label, points: s.points })),
        action_taken: action,
        status: action === "auto_approve" ? "approved" : action === "auto_reject" ? "rejected" : "pending",
      })
      .select("id")
      .single();

    if (inserted && signals.length) {
      await db.from("sec_fraud_signals").insert(
        signals.map((s) => ({
          fraud_score_id: inserted.id,
          signal_type: s.type,
          signal_value: s.value ?? s.label,
          risk_contribution: s.points,
          details: (s.details ?? {}) as never,
        })),
      );
    }

    if (score > 60) {
      await logAttack({
        attackType: "fraud",
        ip,
        storeId: input.storeId,
        severity: score > 80 ? "critical" : "high",
        action: score > 80 ? "block" : "alert",
        payload: `Risk ${score}/100 · ${signals.map((s) => s.label).join(", ")}`,
        ...(input.request ? { request: input.request } : {}),
      });
    }

    return { enabled: true, score, action, signals, scoreId: inserted?.id ?? null };
  } catch {
    // Motor hata verirse sipariş akışı engellenmez.
    return { enabled: true, score: 0, action: "auto_approve", signals, scoreId: null };
  }
}
