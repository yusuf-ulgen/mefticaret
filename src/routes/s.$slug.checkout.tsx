import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { markCartRecovered, syncAbandonedCart } from "@/lib/abandoned.functions";
import { useCart } from "@/lib/cart";
import { getCartPrefs } from "@/lib/cart-prefs";
import { getCartToken } from "@/lib/cart-token";
import { myAddressesQuery } from "@/lib/account-queries";
import { useAuth } from "@/lib/auth-context";
import { getCheckoutQuote, placeMemberOrder, placeOrder, previewCheckoutDiscount } from "@/lib/checkout.functions";
import { checkGiftCardBalance } from "@/lib/gift-cards-public.functions";
import { formatMoney } from "@/lib/mefti";
import { checkoutOptionsQuery, storefrontQuery } from "@/lib/storefront-queries";

export const Route = createFileRoute("/s/$slug/checkout")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.store.name };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.name ?? "Mağaza";
    const title = `Kasa — ${name}`;
    const description = `${name} siparişini tamamla: teslimat bilgileri, kargo seçimi ve ödeme yöntemi tek ekranda.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: CheckoutPage,
});

function CheckoutPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const options = useQuery(checkoutOptionsQuery(slug));
  const cart = useCart();
  const { user, loading: authLoading } = useAuth();
  const memberMode = Boolean(user);
  const guestAllowed = options.data?.settings?.guest_checkout !== false;
  const savedAddresses = useQuery(myAddressesQuery(data?.store.id ?? "", Boolean(user && data?.store.id)));
  const profileFilled = useRef(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("Türkiye");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [line1, setLine1] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [note, setNote] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    label: string;
    discountTotal: number;
    freeShipping: boolean;
  } | null>(null);
  const [checkingDiscount, setCheckingDiscount] = useState(false);
  const [shippingRateId, setShippingRateId] = useState<string>("");
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [billingSame, setBillingSame] = useState(true);
  const [billingRecipient, setBillingRecipient] = useState("");
  const [billingCompany, setBillingCompany] = useState("");
  const [billingTaxId, setBillingTaxId] = useState("");
  const [billingCountry, setBillingCountry] = useState("Türkiye");
  const [billingCity, setBillingCity] = useState("");
  const [billingDistrict, setBillingDistrict] = useState("");
  const [billingLine1, setBillingLine1] = useState("");
  const [billingPostalCode, setBillingPostalCode] = useState("");
  const [appliedGiftCard, setAppliedGiftCard] = useState<{ code: string; balance: number } | null>(null);
  const [checkingGiftCard, setCheckingGiftCard] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const prefsLoaded = useRef(false);

  // Sepette seçilen kupon ve kargo yöntemini kasaya taşı.
  useEffect(() => {
    if (prefsLoaded.current) return;
    prefsLoaded.current = true;
    const prefs = getCartPrefs(slug);
    if (prefs.couponCode) setDiscountCode(prefs.couponCode);
    if (prefs.shippingRateId) setShippingRateId(prefs.shippingRateId);
  }, [slug]);

  const lines = cart.linesFor(slug);
  const subtotal = cart.subtotalFor(slug);


  // Kasada e-posta giren ziyaretçinin sepetini iletişim bilgisiyle eşle (terk edilmiş sepet takibi)
  useEffect(() => {
    if (!email.includes("@") || lines.length === 0) return;
    const timer = setTimeout(() => {
      void syncAbandonedCart({
        data: {
          slug,
          cartToken: getCartToken(slug),
          customerEmail: email,
          customerName: fullName.trim() || undefined,
          currency: lines[0]?.currency ?? "TRY",
          items: lines.map((l) => ({
            title: l.title,
            variantTitle: l.variantTitle,
            quantity: l.quantity,
            price: l.price,
          })),
        },
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [email, fullName, lines, slug]);

  const rates = options.data?.shippingRates ?? [];
  const methods = options.data?.paymentMethods ?? [];
  const selectedRate = useMemo(() => rates.find((rate) => rate.id === shippingRateId) ?? null, [rates, shippingRateId]);
  const discountTotal = appliedDiscount?.discountTotal ?? 0;
  const baseShipping = selectedRate
    ? selectedRate.free_over !== null && subtotal - discountTotal >= selectedRate.free_over
      ? 0
      : selectedRate.price
    : 0;
  const shippingTotal = appliedDiscount?.freeShipping ? 0 : baseShipping;
  const estimatedTotal = Math.max(0, subtotal - discountTotal) + shippingTotal;

  // Sepet değişirse kupon tutarı geçersiz kalmasın diye uygulanan kuponu temizle
  useEffect(() => {
    setAppliedDiscount(null);
  }, [subtotal]);

  async function applyDiscount() {
    const code = discountCode.trim();
    if (!code) {
      setAppliedDiscount(null);
      return;
    }
    setCheckingDiscount(true);
    try {
      const result = await previewCheckoutDiscount({ data: { slug, code, subtotal } });
      setAppliedDiscount({
        code: result.code,
        label: result.label,
        discountTotal: result.discountTotal,
        freeShipping: result.freeShipping,
      });
      toast.success(`Kupon uygulandı: ${result.label}`);
    } catch (error) {
      setAppliedDiscount(null);
      toast.error(error instanceof Error ? error.message : "Kupon doğrulanamadı");
    } finally {
      setCheckingDiscount(false);
    }
  }

  // Üye girişi varsa iletişim bilgilerini hesaptan doldur.
  useEffect(() => {
    if (!user || profileFilled.current) return;
    profileFilled.current = true;
    if (user.email) setEmail(user.email);
    const metaName = (user.user_metadata?.["full_name"] ?? user.user_metadata?.["name"]) as string | undefined;
    if (metaName) setFullName((current) => current || metaName);
  }, [user]);

  // Kayıtlı adresleri ilk yüklemede otomatik uygula.
  const addressFilled = useRef(false);
  useEffect(() => {
    const list = savedAddresses.data;
    if (!list?.length || addressFilled.current) return;
    addressFilled.current = true;
    const chosen = list.find((address) => address.is_default) ?? list[0];
    if (!chosen) return;
    applySavedAddress(chosen);
  }, [savedAddresses.data]);

  function applySavedAddress(address: {
    recipient: string;
    phone: string | null;
    country: string;
    city: string;
    district: string | null;
    line1: string;
    postal_code: string | null;
  }) {
    setFullName((current) => current || address.recipient);
    if (address.phone) setPhone((current) => current || address.phone!);
    setCountry(address.country);
    setCity(address.city);
    setDistrict(address.district ?? "");
    setLine1(address.line1);
    setPostalCode(address.postal_code ?? "");
  }

  // Sunucu tarafı fiyat teklifi: ara toplam, indirim, kargo, vergi, ödeme farkı ve
  // hediye kartı burada hesaplanır; ekranda gösterilen tutarlar buradan gelir.
  const itemsKey = lines.map((line) => `${line.variantId}:${line.quantity}`).join(",");
  const quote = useQuery({
    queryKey: [
      "storefront",
      slug,
      "checkout-quote",
      itemsKey,
      appliedDiscount?.code ?? "",
      appliedGiftCard?.code ?? "",
      shippingRateId,
      paymentMethodId,
    ],
    enabled: lines.length > 0,
    staleTime: 5_000,
    queryFn: () =>
      getCheckoutQuote({
        data: {
          slug,
          items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
          shippingRateId: shippingRateId || undefined,
          paymentMethodId: paymentMethodId || undefined,
          discountCode: appliedDiscount?.code || undefined,
          giftCardCode: appliedGiftCard?.code || undefined,
        },
      }),
  });
  const q = quote.data?.ok ? quote.data : null;

  async function applyGiftCard() {
    const code = giftCardCode.trim();
    if (!code) {
      setAppliedGiftCard(null);
      return;
    }
    setCheckingGiftCard(true);
    try {
      const result = await checkGiftCardBalance({ data: { slug, code } });
      if (!result.found || !result.usable) {
        setAppliedGiftCard(null);
        toast.error(result.reason ?? "Hediye kartı kullanılamıyor");
        return;
      }
      setAppliedGiftCard({ code, balance: result.balance ?? 0 });
      toast.success(`Hediye kartı eklendi · Bakiye: ${result.balance ?? 0}`);
    } catch (error) {
      setAppliedGiftCard(null);
      toast.error(error instanceof Error ? error.message : "Hediye kartı doğrulanamadı");
    } finally {
      setCheckingGiftCard(false);
    }
  }

  if (!data) return null;
  const { store, theme } = data;
  const { t, fonts, muted, cardBg, border, radius } = storefrontTokens(theme);

  const inputStyle = {
    width: "100%",
    background: "transparent",
    color: "inherit",
    border: `1px solid ${border}`,
    borderRadius: radius,
    padding: "10px 12px",
    fontSize: 14,
    fontFamily: "inherit",
  } as const;

  async function submit() {
    if (lines.length === 0) {
      toast.error("Sepetiniz boş");
      return;
    }
    if (!memberMode && !guestAllowed) {
      toast.error("Bu mağazada misafir ödeme kapalı. Lütfen giriş yapın.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        slug,
        items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        customer: { fullName, email, phone, acceptsMarketing: false },
        address: {
          country,
          city,
          district: district || undefined,
          line1,
          postalCode: postalCode || undefined,
        },
        billingAddress: billingSame
          ? undefined
          : {
              recipient: billingRecipient || undefined,
              company: billingCompany || undefined,
              taxId: billingTaxId || undefined,
              country: billingCountry,
              city: billingCity,
              district: billingDistrict || undefined,
              line1: billingLine1,
              postalCode: billingPostalCode || undefined,
            },
        shippingRateId: shippingRateId || undefined,
        paymentMethodId: paymentMethodId || undefined,
        discountCode: appliedDiscount?.code ?? (discountCode.trim() ? discountCode.trim() : undefined),
        giftCardCode: appliedGiftCard?.code ?? (giftCardCode.trim() ? giftCardCode.trim() : undefined),
        note: note.trim() ? note.trim() : undefined,
      };
      const result = memberMode ? await placeMemberOrder({ data: payload }) : await placeOrder({ data: payload });
      void markCartRecovered({
        data: { slug, cartToken: getCartToken(slug), orderNumber: result.orderNumber },
      }).catch(() => {});
      cart.clear(slug);
      toast.success(
        result.giftCardApplied > 0
          ? `Sipariş alındı: ${result.orderNumber} · Hediye kartı: ${formatMoney(result.giftCardApplied, store.currency)}`
          : `Sipariş alındı: ${result.orderNumber}`,
      );
      navigate({
        to: "/s/$slug/order",
        params: { slug },
        search: { no: result.orderNumber, email },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sipariş oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug}>
      <h1 style={{ fontFamily: fonts.heading, fontSize: 30, margin: "40px 0 20px", fontWeight: 700 }}>Kasa</h1>

      {lines.length === 0 ? (
        <div style={{ border: `1px solid ${border}`, borderRadius: radius, background: cardBg, padding: 32 }}>
          <p style={{ margin: 0, color: muted }}>Ödeme yapmak için sepetinize ürün ekleyin.</p>
          <Link to="/s/$slug" params={{ slug }} style={{ color: t.accent_color, fontSize: 14 }}>
            Vitrine dön
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(280px,.9fr)", gap: 24 }}>
          <div style={{ display: "grid", gap: 20 }}>
            <section style={{ border: `1px solid ${border}`, borderRadius: radius, background: cardBg, padding: 20 }}>
              <h2 style={{ fontFamily: fonts.heading, fontSize: 16, margin: "0 0 14px" }}>İletişim ve teslimat</h2>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  border: `1px solid ${border}`,
                  borderRadius: radius,
                  padding: "10px 12px",
                  marginBottom: 14,
                  fontSize: 13,
                }}
              >
                <span style={{ color: muted }}>
                  {authLoading
                    ? "Oturum kontrol ediliyor…"
                    : memberMode
                      ? `Üyelikle ödeme · ${user?.email ?? ""}`
                      : guestAllowed
                        ? "Misafir olarak ödeme yapıyorsunuz."
                        : "Bu mağazada sipariş vermek için üyelik gerekli."}
                </span>
                {!memberMode ? (
                  <Link
                    to="/auth"
                    search={{ redirect: `/s/${slug}/checkout` }}
                    style={{ color: t.accent_color, fontWeight: 600 }}
                  >
                    Giriş yap / Üye ol
                  </Link>
                ) : null}
              </div>
              {memberMode && (savedAddresses.data?.length ?? 0) > 0 ? (
                <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, color: muted }}>Kayıtlı adreslerim</span>
                  {(savedAddresses.data ?? []).map((address) => (
                    <Option
                      key={address.id}
                      active={line1 === address.line1 && city === address.city}
                      onClick={() => applySavedAddress(address)}
                      border={border}
                      radius={radius}
                      accent={t.accent_color}
                      title={address.label || address.recipient}
                      subtitle={[address.line1, address.district, address.city].filter(Boolean).join(", ")}
                      muted={muted}
                    />
                  ))}
                </div>
              ) : null}
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <Field label="Ad soyad" muted={muted}>
                  <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </Field>
                <Field label="E-posta" muted={muted}>
                  <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label="Telefon" muted={muted}>
                  <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <Field label="Ülke" muted={muted}>
                  <input style={inputStyle} value={country} onChange={(e) => setCountry(e.target.value)} />
                </Field>
                <Field label="Şehir" muted={muted}>
                  <input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} />
                </Field>
                <Field label="İlçe" muted={muted}>
                  <input style={inputStyle} value={district} onChange={(e) => setDistrict(e.target.value)} />
                </Field>
                <Field label="Posta kodu" muted={muted}>
                  <input style={inputStyle} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                </Field>
              </div>
              <div style={{ marginTop: 12 }}>
                <Field label="Adres" muted={muted}>
                  <textarea
                    style={{ ...inputStyle, minHeight: 76, resize: "vertical" }}
                    value={line1}
                    onChange={(e) => setLine1(e.target.value)}
                  />
                </Field>
              </div>
            </section>

            <section style={{ border: `1px solid ${border}`, borderRadius: radius, background: cardBg, padding: 20 }}>
              <h2 style={{ fontFamily: fonts.heading, fontSize: 16, margin: "0 0 14px" }}>Fatura adresi</h2>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: muted }}>
                <input type="checkbox" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} />
                Fatura adresim teslimat adresimle aynı
              </label>
              {!billingSame ? (
                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    <Field label="Fatura sahibi" muted={muted}>
                      <input style={inputStyle} value={billingRecipient} onChange={(e) => setBillingRecipient(e.target.value)} />
                    </Field>
                    <Field label="Firma (opsiyonel)" muted={muted}>
                      <input style={inputStyle} value={billingCompany} onChange={(e) => setBillingCompany(e.target.value)} />
                    </Field>
                    <Field label="Vergi / TC no (opsiyonel)" muted={muted}>
                      <input style={inputStyle} value={billingTaxId} onChange={(e) => setBillingTaxId(e.target.value)} />
                    </Field>
                    <Field label="Ülke" muted={muted}>
                      <input style={inputStyle} value={billingCountry} onChange={(e) => setBillingCountry(e.target.value)} />
                    </Field>
                    <Field label="Şehir" muted={muted}>
                      <input style={inputStyle} value={billingCity} onChange={(e) => setBillingCity(e.target.value)} />
                    </Field>
                    <Field label="İlçe" muted={muted}>
                      <input style={inputStyle} value={billingDistrict} onChange={(e) => setBillingDistrict(e.target.value)} />
                    </Field>
                    <Field label="Posta kodu" muted={muted}>
                      <input style={inputStyle} value={billingPostalCode} onChange={(e) => setBillingPostalCode(e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Fatura adresi" muted={muted}>
                    <textarea
                      style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                      value={billingLine1}
                      onChange={(e) => setBillingLine1(e.target.value)}
                    />
                  </Field>
                </div>
              ) : null}
            </section>

            <section style={{ border: `1px solid ${border}`, borderRadius: radius, background: cardBg, padding: 20 }}>
              <h2 style={{ fontFamily: fonts.heading, fontSize: 16, margin: "0 0 14px" }}>Kargo</h2>
              {rates.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: muted }}>
                  Bu mağaza için tanımlı kargo tarifesi yok; kargo ücretsiz uygulanır.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {rates.map((rate) => (
                    <Option
                      key={rate.id}
                      active={shippingRateId === rate.id}
                      onClick={() => setShippingRateId(rate.id)}
                      border={border}
                      radius={radius}
                      accent={t.accent_color}
                      title={rate.title}
                      subtitle={[rate.zone_name, rate.eta_days ? `${rate.eta_days} gün` : null]
                        .filter(Boolean)
                        .join(" · ")}
                      right={
                        rate.free_over !== null && subtotal >= rate.free_over
                          ? "Ücretsiz"
                          : formatMoney(rate.price, store.currency)
                      }
                      muted={muted}
                    />
                  ))}
                </div>
              )}
            </section>

            <section style={{ border: `1px solid ${border}`, borderRadius: radius, background: cardBg, padding: 20 }}>
              <h2 style={{ fontFamily: fonts.heading, fontSize: 16, margin: "0 0 14px" }}>Ödeme yöntemi</h2>
              {methods.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: muted }}>
                  Ödeme yöntemi tanımlı değil. Sipariş, ödeme beklemede olarak oluşturulur.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {methods.map((method) => (
                    <Option
                      key={method.id}
                      active={paymentMethodId === method.id}
                      onClick={() => setPaymentMethodId(method.id)}
                      border={border}
                      radius={radius}
                      accent={t.accent_color}
                      title={method.display_name}
                      subtitle={method.instructions ?? (method.installments_enabled ? "Taksit imkanı" : "")}
                      right={Number(method.extra_fee_rate) > 0 ? `+%${method.extra_fee_rate}` : ""}
                      muted={muted}
                    />
                  ))}
                </div>
              )}
              <div style={{ marginTop: 14 }}>
                <Field label="Sipariş notu" muted={muted}>
                  <textarea
                    style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
              </div>
            </section>
          </div>

          <aside
            style={{
              border: `1px solid ${border}`,
              borderRadius: radius,
              background: cardBg,
              padding: 20,
              height: "fit-content",
            }}
          >
            <h2 style={{ fontFamily: fonts.heading, fontSize: 16, margin: "0 0 12px" }}>Sipariş özeti</h2>
            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              {lines.map((line) => (
                <div key={line.variantId} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: muted }}>
                    {line.title} × {line.quantity}
                  </span>
                  <span>{formatMoney(line.price * line.quantity, line.currency)}</span>
                </div>
              ))}
            </div>
            <Field label="İndirim kodu" muted={muted}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={inputStyle}
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  placeholder="KUPON10"
                />
                <button
                  type="button"
                  onClick={() => void applyDiscount()}
                  disabled={checkingDiscount}
                  style={{
                    border: `1px solid ${t.accent_color}`,
                    background: "transparent",
                    color: t.accent_color,
                    borderRadius: radius,
                    padding: "0 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: checkingDiscount ? "wait" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {checkingDiscount ? "…" : appliedDiscount ? "Yenile" : "Uygula"}
                </button>
              </div>
            </Field>
            <div style={{ marginTop: 10 }}>
              <Field label="Hediye kartı kodu" muted={muted}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={inputStyle}
                    value={giftCardCode}
                    onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
                    placeholder="MEF-XXXX-XXXX-XXXX"
                  />
                  <button
                    type="button"
                    onClick={() => void applyGiftCard()}
                    disabled={checkingGiftCard}
                    style={{
                      border: `1px solid ${t.accent_color}`,
                      background: "transparent",
                      color: t.accent_color,
                      borderRadius: radius,
                      padding: "0 14px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: checkingGiftCard ? "wait" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {checkingGiftCard ? "…" : appliedGiftCard ? "Yenile" : "Uygula"}
                  </button>
                </div>
              </Field>
              <p style={{ fontSize: 12, color: muted, margin: "6px 0 0" }}>
                {appliedGiftCard
                  ? `Kart bakiyesi: ${formatMoney(appliedGiftCard.balance, store.currency)} · toplamdan sunucuda düşülür.`
                  : "Kart bakiyesi sipariş toplamından sunucuda düşülür."}
              </p>
            </div>
            {appliedDiscount ? (
              <p style={{ fontSize: 12, color: t.accent_color, margin: "6px 0 0" }}>
                {appliedDiscount.code} · {appliedDiscount.label}
                <button
                  type="button"
                  onClick={() => {
                    setAppliedDiscount(null);
                    setDiscountCode("");
                  }}
                  style={{
                    marginLeft: 8,
                    background: "none",
                    border: "none",
                    color: muted,
                    fontSize: 12,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  kaldır
                </button>
              </p>
            ) : null}
            <div style={{ marginTop: 12, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
              <SummaryRow
                label="Ara toplam"
                value={formatMoney(q?.subtotal ?? subtotal, q?.currency ?? store.currency)}
                muted={muted}
              />
              {(q?.discountTotal ?? discountTotal) > 0 || q?.freeShipping ? (
                <SummaryRow
                  label={`İndirim${q?.discountCode ? ` (${q.discountCode})` : ""}`}
                  value={
                    (q?.discountTotal ?? discountTotal) > 0
                      ? `-${formatMoney(q?.discountTotal ?? discountTotal, store.currency)}`
                      : "Ücretsiz kargo"
                  }
                  muted={muted}
                />
              ) : null}
              <SummaryRow
                label={q?.shippingTitle ? `Kargo · ${q.shippingTitle}` : "Kargo"}
                value={formatMoney(q?.shippingTotal ?? shippingTotal, store.currency)}
                muted={muted}
              />
              {q && !q.taxIncluded ? (
                <SummaryRow
                  label={`Vergi${q.taxRate ? ` (%${q.taxRate})` : ""}`}
                  value={formatMoney(q.taxTotal, store.currency)}
                  muted={muted}
                />
              ) : q?.taxIncluded ? (
                <SummaryRow label="Vergi" value="Fiyatlara dahil" muted={muted} />
              ) : null}
              {q && q.paymentFee > 0 ? (
                <SummaryRow label="Ödeme farkı" value={formatMoney(q.paymentFee, store.currency)} muted={muted} />
              ) : null}
              {q && q.giftCardApplied > 0 ? (
                <SummaryRow
                  label="Hediye kartı"
                  value={`-${formatMoney(q.giftCardApplied, store.currency)}`}
                  muted={muted}
                />
              ) : null}
              <SummaryRow
                label={q ? "Ödenecek tutar" : "Tahmini toplam"}
                value={formatMoney(q?.grandTotal ?? estimatedTotal, store.currency)}
                muted={muted}
              />
              {quote.data && !quote.data.ok ? (
                <p style={{ fontSize: 12, color: "#e0603a", margin: "8px 0 0" }}>{quote.data.error}</p>
              ) : (
                <p style={{ fontSize: 12, color: muted, margin: "8px 0 0" }}>
                  Fiyat, indirim, stok, vergi ve hediye kartı tutarları sunucuda doğrulanır.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || (!memberMode && !guestAllowed) || quote.data?.ok === false}
              style={{
                marginTop: 16,
                width: "100%",
                background: t.accent_color,
                color: "#12181f",
                border: "none",
                borderRadius: radius,
                padding: "13px 18px",
                fontSize: 15,
                fontWeight: 600,
                cursor: submitting ? "wait" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Sipariş oluşturuluyor…" : "Siparişi tamamla"}
            </button>
          </aside>
        </div>
      )}
    </StorefrontChrome>
  );
}

function Field({ label, muted, children }: { label: string; muted: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: 12, color: muted }}>
      <span style={{ display: "block", marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value, muted }: { label: string; value: string; muted: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "3px 0" }}>
      <span style={{ color: muted }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Option({
  active,
  onClick,
  border,
  radius,
  accent,
  title,
  subtitle,
  right,
  muted,
}: {
  active: boolean;
  onClick: () => void;
  border: string;
  radius: string;
  accent: string;
  title: string;
  subtitle?: string;
  right?: string;
  muted: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        width: "100%",
        textAlign: "left",
        border: `1px solid ${active ? accent : border}`,
        background: active ? `${accent}1f` : "transparent",
        color: "inherit",
        borderRadius: radius,
        padding: "11px 14px",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <span>
        <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{title}</span>
        {subtitle ? <span style={{ display: "block", fontSize: 12, color: muted }}>{subtitle}</span> : null}
      </span>
      {right ? <span style={{ fontSize: 13, fontWeight: 600 }}>{right}</span> : null}
    </button>
  );
}
