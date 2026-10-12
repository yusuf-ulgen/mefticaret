import { TR_PROVINCES, maskTrPhone } from "@/lib/tr-provinces";
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { StoreBoosters } from "@/components/homemaker/store-boosters";
import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { markCartRecovered, syncAbandonedCart } from "@/lib/abandoned.functions";
import { useCart } from "@/lib/cart";
import { getCartPrefs } from "@/lib/cart-prefs";
import { getCartToken } from "@/lib/cart-token";
import { trackEvent } from "@/lib/track";
import { myAddressesQuery } from "@/lib/account-queries";
import { useAuth } from "@/lib/auth-context";
import { getCheckoutQuote, placeMemberOrder, placeOrder, previewCheckoutDiscount } from "@/lib/checkout.functions";
import { startOrderPayment } from "@/lib/order-payment.functions";
import { checkGiftCardBalance } from "@/lib/gift-cards-public.functions";
import { GeorgiaCustomsNotice, formatMoney, useDisplayCurrency, useExportLang } from "@/lib/display-currency";
import {
  CUSTOMS_ID_PATTERN,
  DOMESTIC_ONLY_PAYMENT_CODES,
  EXPORT_INVOICE_LABEL,
  GE_CITIES,
  INTERNATIONAL_POS_CODES,
  SHIP_COUNTRIES,
  exportT,
  isGeorgia,
} from "@/lib/export-ge";
import { fetchStorefrontPickupLocations } from "@/lib/retail-ops.functions";
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
  const savedAddressesQuery = useQuery(myAddressesQuery(data?.store.id ?? "", Boolean(user && data?.store.id)));
  const savedAddresses = savedAddressesQuery.data?.addresses ?? [];
  const profileFilled = useRef(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const display = useDisplayCurrency();
  const lang = useExportLang();
  const [country, setCountryState] = useState("Türkiye");
  const [customsId, setCustomsId] = useState("");
  // Header'daki teslimat ülkesi ile kasadaki ülke aynı kalır.
  const setCountry = (next: string) => {
    setCountryState(next);
    if (SHIP_COUNTRIES.some((row) => row.value === next)) display.setShipCountry(next);
  };
  const shipSynced = useRef(false);
  useEffect(() => {
    if (shipSynced.current || display.shipCountry === "Türkiye") return;
    shipSynced.current = true;
    setCountryState(display.shipCountry);
  }, [display.shipCountry]);
  const exportOrder = isGeorgia(country);
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [line1, setLine1] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [note, setNote] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [policyError, setPolicyError] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [gift, setGift] = useState({ wrap: false, message: "" });
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
  const [pickupLocationId, setPickupLocationId] = useState<string>("");
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

  // Analitik: kasa adımına ulaşan oturumları dönüşüm hunisi için kaydet.
  useEffect(() => {
    if (lines.length === 0) return;
    trackEvent(slug, "checkout", {
      value: subtotal,
      quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    });
  }, [slug, lines.length, subtotal]);


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

  // Mağazadan teslim (Click & Collect) noktaları
  const pickupQuery = useQuery({
    queryKey: ["storefront", slug, "pickup-locations"],
    queryFn: () => fetchStorefrontPickupLocations({ data: { storeSlug: slug } }),
    staleTime: 5 * 60 * 1000,
  });
  const pickupLocations = pickupQuery.data ?? [];
  const selectedPickup = pickupLocations.find((location) => location.id === pickupLocationId) ?? null;

  const rates = options.data?.shippingRates ?? [];
  const allMethods = options.data?.paymentMethods ?? [];
  const methodCode = (method: (typeof allMethods)[number]) =>
    (method as { connectors?: { code?: string } | null }).connectors?.code ?? "";
  // Yurt dışı siparişte yalnız Türkiye'de geçerli yöntemler (havale, kapıda ödeme) gizlenir.
  const methods = exportOrder
    ? allMethods.filter((method) => !(DOMESTIC_ONLY_PAYMENT_CODES as readonly string[]).includes(methodCode(method)))
    : allMethods;
  const selectedRate = useMemo(() => rates.find((rate) => rate.id === shippingRateId) ?? null, [rates, shippingRateId]);

  // Kargo seçilmeden sipariş verilmesini engelle: ilk uygun yöntemi ön seç.
  useEffect(() => {
    if (rates.length === 0 || pickupLocationId) return;
    if (shippingRateId && rates.some((rate) => rate.id === shippingRateId)) return;
    const first = rates[0];
    if (first) setShippingRateId(first.id);
  }, [rates, shippingRateId, pickupLocationId]);

  // Ödeme yöntemi de ön seçilir; kullanıcı isterse değiştirir.
  useEffect(() => {
    if (methods.length === 0) return;
    if (paymentMethodId && methods.some((method) => method.id === paymentMethodId)) return;
    const first = methods[0];
    if (first) setPaymentMethodId(first.id);
  }, [methods, paymentMethodId]);
  const discountTotal = appliedDiscount?.discountTotal ?? 0;
  const baseShipping = pickupLocationId
    ? 0
    : selectedRate
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
    const list = savedAddresses;
    if (!list.length || addressFilled.current) return;
    addressFilled.current = true;
    const chosen = list.find((address) => address.is_default) ?? list[0];
    if (!chosen) return;
    applySavedAddress(chosen);
  }, [savedAddresses]);

  function applySavedAddress(address: {
    recipient: string | null;
    phone: string | null;
    country: string | null;
    city: string | null;
    district: string | null;
    line1: string | null;
    postal_code: string | null;
  }) {
    if (address.recipient) setFullName((current) => current || address.recipient!);
    if (address.phone) setPhone((current) => current || address.phone!);
    if (address.country) setCountry(address.country);
    setCity(address.city ?? "");
    setDistrict(address.district ?? "");
    setLine1(address.line1 ?? "");
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
      gift.wrap,
      exportOrder,
    ],
    enabled: lines.length > 0,
    staleTime: 5_000,
    queryFn: () =>
      getCheckoutQuote({
        data: {
          slug,
          items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
          shippingRateId: pickupLocationId ? undefined : shippingRateId || undefined,
          paymentMethodId: paymentMethodId || undefined,
          discountCode: appliedDiscount?.code || undefined,
          giftCardCode: appliedGiftCard?.code || undefined,
          giftWrap: gift.wrap || undefined,
          country: country || undefined,
        },
      }),
  });
  const q = quote.data?.ok ? quote.data : null;
  // Sunucu fiyatlamasına göre: sepet yalnız dijital ürünse adres/kargo gizlenir.
  const digitalOnly = q?.digitalOnly === true;

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
    // Sunucu doğrulaması ham hata metni döndürmesin: eksik alanları önce burada anlaşılır dille bildiriyoruz.
    const digits = phone.replace(/\D/g, "");
    if (fullName.trim().length < 2) {
      toast.error("Lütfen ad soyad yazın.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      toast.error("Lütfen geçerli bir e-posta adresi yazın.");
      return;
    }
    if (digits.length < 10) {
      toast.error("Lütfen telefon numaranızı yazın (örnek: 0555 111 22 33).");
      return;
    }
    if (!digitalOnly) {
      if (country.trim().length < 2) {
        toast.error("Lütfen ülke yazın.");
        return;
      }
      if (city.trim().length < 1) {
        toast.error("Lütfen şehir yazın.");
        return;
      }
      if (exportOrder && !CUSTOMS_ID_PATTERN.test(customsId.trim())) {
        toast.error(exportT(lang, "customsIdError"));
        return;
      }
      if (line1.trim().length < 5) {
        toast.error("Lütfen açık adresinizi yazın (en az 5 karakter).");
        return;
      }
      if (!billingSame && (billingCountry.trim().length < 2 || billingCity.trim().length < 1 || billingLine1.trim().length < 5)) {
        toast.error("Fatura adresini eksiksiz doldurun.");
        return;
      }
    }
    if (!policyAccepted) {
      setPolicyError(true);
      toast.error("Siparişi tamamlamak için sözleşmeleri onaylamanız gerekir.");
      document.getElementById("policy-consent")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        policyAccepted: true,
        slug,
        items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        customer: { fullName, email, phone, acceptsMarketing: newsletter },
        address: digitalOnly
          ? undefined
          : {
              country,
              city,
              district: district || undefined,
              line1,
              postalCode: postalCode || undefined,
              customsId: exportOrder ? customsId.trim() : undefined,
            },
        billingAddress: billingSame || digitalOnly
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
        shippingRateId: pickupLocationId || digitalOnly ? undefined : shippingRateId || undefined,
        paymentMethodId: paymentMethodId || undefined,
        discountCode: appliedDiscount?.code ?? (discountCode.trim() ? discountCode.trim() : undefined),
        giftCardCode: appliedGiftCard?.code ?? (giftCardCode.trim() ? giftCardCode.trim() : undefined),
        giftWrap: gift.wrap || undefined,
        giftMessage: gift.wrap && gift.message.trim() ? gift.message.trim() : undefined,
        note: [
          selectedPickup
            ? `Mağazadan teslim: ${selectedPickup.name} — ${selectedPickup.addressLine}, ${selectedPickup.city}`
            : null,
          note.trim() || null,
        ]
          .filter(Boolean)
          .join("\n") || undefined,
      };
      const result = memberMode ? await placeMemberOrder({ data: payload }) : await placeOrder({ data: payload });
      void markCartRecovered({
        data: { slug, cartToken: getCartToken(slug), orderNumber: result.orderNumber },
      }).catch(() => {});
      trackEvent(slug, "purchase", {
        value: lines.reduce((sum, line) => sum + line.price * line.quantity, 0),
        quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
        currency: store.currency,
      });
      cart.clear(slug);
      toast.success(
        result.giftCardApplied > 0
          ? `Sipariş alındı: ${result.orderNumber} · Hediye kartı: ${formatMoney(result.giftCardApplied, store.currency)}`
          : `Sipariş alındı: ${result.orderNumber}`,
      );
      // Kartla ödeme açıksa doğrudan güvenli ödeme sayfasına yönlendir.
      try {
        const payment = await startOrderPayment({
          data: { slug, orderNumber: result.orderNumber, email },
        });
        if (payment?.link) {
          window.location.href = payment.link;
          return;
        }
      } catch {
        // Kart ödemesi kullanılamıyorsa sipariş durumu sayfasına devam edilir.
      }
      navigate({
        to: "/s/$slug/order",
        params: { slug },
        search: { no: result.orderNumber, email },
      });
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      // Teknik doğrulama çıktısı müşteriye gösterilmez.
      const friendly = !raw || raw.trim().startsWith("[") || raw.trim().startsWith("{")
        ? "Bilgilerde eksik var. Lütfen ad soyad, e-posta, telefon ve adresi kontrol edin."
        : raw;
      toast.error(friendly);
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
        <>
        <ol aria-label="Ödeme adımları" style={{ display: "flex", gap: 8, listStyle: "none", padding: 0, margin: "0 0 18px", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}>
          {[{ n: 1, l: "Sepet", done: true }, { n: 2, l: "Bilgiler", done: Boolean(fullName && email && phone) }, { n: 3, l: digitalOnly ? "Ödeme" : "Teslimat ve ödeme", done: false }].map((s, i) => (
            <li key={s.n} aria-current={i === 1 ? "step" : undefined} style={{ flex: 1, display: "grid", gap: 6, color: i <= 1 ? "inherit" : muted }}>
              <span style={{ height: 3, borderRadius: 3, background: i <= 1 || s.done ? t.primary_color : border }} />
              <span>{s.done && i < 2 ? "✓ " : `${s.n}. `}{s.l}</span>
            </li>
          ))}
        </ol>
        <div className="sf-cart-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(280px,.9fr)", gap: 24, paddingBottom: 8 }}>
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
                    to="/s/$slug/login"
                    params={{ slug }}
                    search={{ return: "checkout" }}
                    style={{ color: t.accent_color, fontWeight: 600 }}
                  >
                    Giriş yap / Üye ol
                  </Link>
                ) : null}
              </div>
              {memberMode && savedAddresses.length > 0 ? (
                <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, color: muted }}>Kayıtlı adreslerim</span>
                  {savedAddresses.map((address) => (
                    <Option
                      key={address.id}
                      active={Boolean(address.line1) && line1 === address.line1 && city === (address.city ?? "")}
                      onClick={() => applySavedAddress(address)}
                      border={border}
                      radius={radius}
                      accent={t.accent_color}
                      title={address.label || address.recipient || "Adres"}
                      subtitle={[address.line1, address.district, address.city].filter(Boolean).join(", ")}
                      muted={muted}
                    />
                  ))}
                </div>
              ) : null}
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <Field label="Ad soyad *" muted={muted}>
                  <input style={inputStyle} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </Field>
                <Field label="E-posta *" muted={muted}>
                  <input style={inputStyle} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label="Telefon *" muted={muted}>
                  <input style={inputStyle} type="tel" inputMode="tel" autoComplete="tel" placeholder={/^(tr|türkiye|turkiye|turkey)$/i.test(country.trim()) || !country.trim() ? "0 5XX XXX XX XX" : "+49 151 23456789"} value={phone} onChange={(e) => { const v = e.target.value; const isTr = (/^(tr|türkiye|turkiye|turkey)$/i.test(country.trim()) || !country.trim()) && !/^\s*(\+|00)(?!90)/.test(v); setPhone(isTr ? maskTrPhone(v) : v.replace(/[^\d+\s()-]/g, "").slice(0, 20)); }} />
                </Field>
                {digitalOnly ? null : (
                  <>
                    <Field label={`${exportT(lang, "country")} *`} muted={muted}>
                      <select style={inputStyle} autoComplete="country-name" value={country} onChange={(e) => { setCountry(e.target.value); setCity(""); }}>
                        {SHIP_COUNTRIES.map((row) => <option key={row.code} value={row.value}>{row.value}</option>)}
                        {!SHIP_COUNTRIES.some((row) => row.value === country) && !isGeorgia(country) ? <option value={country}>{country}</option> : null}
                      </select>
                    </Field>
                    <Field label="Şehir *" muted={muted}>
                      {exportOrder ? (
                        <select style={inputStyle} autoComplete="address-level1" value={city} onChange={(e) => setCity(e.target.value)}>
                          <option value="">{exportT(lang, "selectCity")}</option>
                          {city && !(GE_CITIES as readonly string[]).includes(city) ? <option value={city}>{city}</option> : null}
                          {GE_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : /^(tr|türkiye|turkiye|turkey)$/i.test(country.trim()) || !country.trim() ? (
                        <select style={inputStyle} autoComplete="address-level1" value={city} onChange={(e) => setCity(e.target.value)}>
                          <option value="">İl seçin</option>
                          {city && !(TR_PROVINCES as readonly string[]).includes(city) ? <option value={city}>{city}</option> : null}
                          {TR_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      ) : (
                        <input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} />
                      )}
                    </Field>
                    <Field label="İlçe" muted={muted}>
                      <input style={inputStyle} autoComplete="address-level2" placeholder="İlçe" value={district} onChange={(e) => setDistrict(e.target.value)} />
                    </Field>
                    <Field label="Posta kodu" muted={muted}>
                      <input style={inputStyle} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                    </Field>
                    {exportOrder ? (
                      <Field label={`${exportT(lang, "customsId")} *`} muted={muted}>
                        <input
                          style={inputStyle}
                          required
                          aria-required="true"
                          autoComplete="off"
                          maxLength={20}
                          value={customsId}
                          onChange={(e) => setCustomsId(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())}
                        />
                        <span style={{ display: "block", marginTop: 4, fontSize: 11 }}>{exportT(lang, "customsIdHint")}</span>
                      </Field>
                    ) : null}
                  </>
                )}
              </div>
              {digitalOnly ? null : (
                <div style={{ marginTop: 12 }}>
                  <Field label="Adres *" muted={muted}>
                    <textarea
                      style={{ ...inputStyle, minHeight: 76, resize: "vertical" }}
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                    />
                  </Field>
                </div>
              )}
            </section>

            {digitalOnly ? (
              <section style={{ border: `1px solid ${border}`, borderRadius: radius, background: cardBg, padding: 20 }}>
                <h2 style={{ fontFamily: fonts.heading, fontSize: 16, margin: "0 0 8px" }}>
                  Dijital teslimat — kargo gerekmez
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: muted, lineHeight: 1.6 }}>
                  Sepetinizdeki ürünler dijital. Ödeme onaylanınca indirme bağlantısı sipariş sayfanızda
                  açılır ve telefonunuza WhatsApp ile gönderebilirsiniz. Adres bilgisi istenmez.
                </p>
              </section>
            ) : (
            <>
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
                    <Field label="Şehir *" muted={muted}>
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
            </>
            )}

            {!digitalOnly && pickupLocations.length > 0 ? (
              <section style={{ border: `1px solid ${border}`, borderRadius: radius, background: cardBg, padding: 20 }}>
                <h2 style={{ fontFamily: fonts.heading, fontSize: 16, margin: "0 0 6px" }}>Mağazadan teslim al</h2>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: muted }}>
                  Kargo yerine mağazadan teslim alırsanız kargo ücreti alınmaz.
                </p>
                <div style={{ display: "grid", gap: 8 }}>
                  <Option
                    active={pickupLocationId === ""}
                    onClick={() => setPickupLocationId("")}
                    border={border}
                    radius={radius}
                    accent={t.accent_color}
                    title="Adresime kargo ile gelsin"
                    subtitle="Seçili kargo tarifesi uygulanır"
                    muted={muted}
                  />
                  {pickupLocations.map((location) => (
                    <Option
                      key={location.id}
                      active={pickupLocationId === location.id}
                      onClick={() => setPickupLocationId(location.id)}
                      border={border}
                      radius={radius}
                      accent={t.accent_color}
                      title={location.name}
                      subtitle={[location.addressLine, location.city, location.openingHours]
                        .filter(Boolean)
                        .join(" · ")}
                      right="Ücretsiz"
                      muted={muted}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section style={{ border: `1px solid ${border}`, borderRadius: radius, background: cardBg, padding: 20 }}>
              <h2 style={{ fontFamily: fonts.heading, fontSize: 16, margin: "0 0 14px" }}>Ödeme yöntemi</h2>
              {display.active !== store.currency || exportOrder ? (
                <div style={{ border: `1px dashed ${border}`, borderRadius: radius, padding: "10px 12px", marginBottom: 10, fontSize: 12.5, lineHeight: 1.5 }}>
                  <strong style={{ display: "block", marginBottom: 2 }}>{exportT(lang, "posTitle")} · {display.active}</strong>
                  {methods.some((m) => (INTERNATIONAL_POS_CODES as readonly string[]).includes(methodCode(m)))
                    ? exportT(lang, "posNote", {
                        base: store.currency,
                        display: display.active,
                        amount: formatMoney(q?.grandTotal ?? estimatedTotal, store.currency),
                      })
                    : exportT(lang, "noPos")}
                </div>
              ) : null}
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
                      subtitle={
                        (display.active !== store.currency || exportOrder) &&
                        (INTERNATIONAL_POS_CODES as readonly string[]).includes(methodCode(method))
                          ? exportT(lang, "posForeign")
                          : method.instructions ?? (method.installments_enabled ? "Taksit imkanı" : "")
                      }
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
            <div style={{ marginBottom: 12 }}>
              <StoreBoosters slug={slug} cartTotal={subtotal} currency={store.currency} gift={gift} onGiftChange={setGift} />
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
            {!digitalOnly ? (
              <div style={{ marginTop: 12 }}>
                <GeorgiaCustomsNotice amount={q?.grandTotal ?? estimatedTotal} currency={store.currency} country={country} />
              </div>
            ) : null}
            {q?.exportInvoice ? (
              <div style={{ marginTop: 10 }}>
                <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {EXPORT_INVOICE_LABEL}
                </span>
              </div>
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
              {q?.exportInvoice ? (
                <SummaryRow label={exportT(lang, "vatZero")} value={formatMoney(0, store.currency)} muted={muted} />
              ) : q && !q.taxIncluded ? (
                <SummaryRow
                  label={`Vergi${q.taxRate ? ` (%${q.taxRate})` : ""}`}
                  value={formatMoney(q.taxTotal, store.currency)}
                  muted={muted}
                />
              ) : q?.taxIncluded ? (
                <SummaryRow label="Vergi" value="Fiyatlara dahil" muted={muted} />
              ) : null}
              {q && q.giftWrapFee > 0 ? (
                <SummaryRow label="Hediye paketi" value={formatMoney(q.giftWrapFee, store.currency)} muted={muted} />
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
            <div id="policy-consent" style={{ marginTop: 16, display: "grid", gap: 10, fontSize: 13, lineHeight: 1.5 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: policyError && !policyAccepted ? "#d93b3b" : "inherit" }}>
                <input
                  type="checkbox"
                  checked={policyAccepted}
                  onChange={(e) => { setPolicyAccepted(e.target.checked); if (e.target.checked) setPolicyError(false); }}
                  style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }}
                  aria-required="true"
                />
                <span>
                  <a href={`/s/${slug}/politika/gizlilik`} target="_blank" rel="noopener" style={{ textDecoration: "underline", color: "inherit" }}>Gizlilik Politikası</a>
                  {"'nı, "}
                  <a href={`/s/${slug}/politika/iade-degisim`} target="_blank" rel="noopener" style={{ textDecoration: "underline", color: "inherit" }}>İade Politikası</a>
                  {"'nı ve "}
                  <a href={`/s/${slug}/politika/mesafeli-satis-sozlesmesi`} target="_blank" rel="noopener" style={{ textDecoration: "underline", color: "inherit" }}>Mesafeli Satış Sözleşmesi</a>
                  {"'ni okudum, kabul ediyorum. *"}
                </span>
              </label>
              {policyError && !policyAccepted ? (
                <p role="alert" style={{ margin: 0, color: "#d93b3b", fontSize: 12 }}>Bu onay olmadan sipariş tamamlanamaz.</p>
              ) : null}
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: muted }}>
                <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }} />
                <span>E-posta ile kampanya ve bülten almak istiyorum. (İsteğe bağlı)</span>
              </label>
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

          {/* Mobil: ödenecek tutar + tamamla butonu her zaman erişilebilir kalsın */}
          <div
            className="sf-cart-bar"
            style={{
              position: "fixed",
              left: 12,
              right: 12,
              bottom: 12,
              zIndex: 65,
              display: "none",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 12px",
              background: cardBg,
              border: `1px solid ${border}`,
              borderRadius: radius,
              boxShadow: "0 10px 30px rgba(0,0,0,.18)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: muted }}>{q ? "Ödenecek tutar" : "Tahmini toplam"}</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>
                {formatMoney(q?.grandTotal ?? estimatedTotal, store.currency)}
              </div>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || (!memberMode && !guestAllowed) || quote.data?.ok === false}
              style={{
                background: t.accent_color,
                color: "#12181f",
                border: "none",
                borderRadius: radius,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 700,
                whiteSpace: "nowrap",
                cursor: submitting ? "wait" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Gönderiliyor…" : "Siparişi tamamla"}
            </button>
          </div>
        </div>
        </>
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
