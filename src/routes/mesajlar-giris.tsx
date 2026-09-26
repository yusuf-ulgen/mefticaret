import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Paperclip, ShieldCheck, Store } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { matchMyStore, saveChatSettings } from "@/lib/chat-account.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mesajlar-giris")({
  head: () => ({
    meta: [
      { title: "Mefticaret Chat — Giriş ve Kayıt" },
      { name: "description", content: "Mefticaret kullanıcıları için anlık mesajlaşma uygulaması. Satıcı veya müşteri olarak ücretsiz kayıt olun." },
      { property: "og:title", content: "Mefticaret Chat — Anlık Mesajlaşma" },
      { property: "og:description", content: "Mefticaret satıcıları ve müşterileri için güvenli, hızlı mesajlaşma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatAuthPage,
});

/* ---- Basit çoklu dil (Türkçe varsayılan, İngilizce) ---- */
const T = {
  tr: {
    s1t: "Anlık Mesajlaşma", s1d: "Satıcılar, müşteriler ve Mefticaret destek ekibiyle gerçek zamanlı yazışın.",
    s2t: "Dosya & Medya Paylaşımı", s2d: "Fotoğraf, belge ve sesli mesajları saniyeler içinde gönderin.",
    s3t: "Güvenli & Hızlı", s3d: "Mesajlarınız yalnızca sohbet üyelerine açıktır; dosyalar özel depoda saklanır.",
    start: "Başla", next: "İleri", skip: "Atla", login: "Giriş yap", register: "Kayıt ol",
    name: "Ad Soyad", email: "E-posta", phone: "Telefon", pass: "Şifre", pass2: "Şifre tekrar",
    seller: "Satıcı", sellerD: "Mefticaret mağazası sahibi", customer: "Müşteri", customerD: "Alıcı",
    terms: "Kullanım Koşulları ve Gizlilik Politikası'nı okudum, kabul ediyorum.", submit: "Kayıt Ol", cont: "Devam et",
    google: "Google ile Giriş", apple: "Apple ile Giriş", forgot: "Şifremi unuttum", or: "veya",
    otpT: "Doğrulama kodu", otpD: "adresine gönderilen 6 haneli kodu girin.", resend: "Tekrar Gönder", verify: "Doğrula",
    resetT: "Şifre sıfırlama", sendCode: "Kod gönder", newPass: "Yeni şifre", setPass: "Şifreyi kaydet",
    storeT: "Mefticaret mağazanızı bağlayın", storeD: "Bağlandığında mağaza müşterilerinin mesajları bu hesaba gelir.",
    storeQ: "Mağaza adı veya linki", find: "Bul", confirm: "Bu mağazayı bağla", later: "Şimdi değil",
  },
  en: {
    s1t: "Instant Messaging", s1d: "Chat in real time with sellers, customers and the Mefticaret support team.",
    s2t: "Files & Media", s2d: "Send photos, documents and voice notes in seconds.",
    s3t: "Safe & Fast", s3d: "Messages are visible only to chat members; files live in private storage.",
    start: "Get started", next: "Next", skip: "Skip", login: "Sign in", register: "Sign up",
    name: "Full name", email: "Email", phone: "Phone", pass: "Password", pass2: "Repeat password",
    seller: "Seller", sellerD: "Mefticaret store owner", customer: "Customer", customerD: "Buyer",
    terms: "I have read and accept the Terms of Use and Privacy Policy.", submit: "Sign up", cont: "Continue",
    google: "Sign in with Google", apple: "Sign in with Apple", forgot: "Forgot password", or: "or",
    otpT: "Verification code", otpD: "— enter the 6-digit code we sent.", resend: "Resend", verify: "Verify",
    resetT: "Reset password", sendCode: "Send code", newPass: "New password", setPass: "Save password",
    storeT: "Connect your Mefticaret store", storeD: "Once connected, your store's customer messages arrive here.",
    storeQ: "Store name or link", find: "Find", confirm: "Connect this store", later: "Not now",
  },
};
type Dict = typeof T.tr;

const COUNTRIES = [
  { code: "+90", label: "🇹🇷 +90" },
  { code: "+49", label: "🇩🇪 +49" },
  { code: "+31", label: "🇳🇱 +31" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+994", label: "🇦🇿 +994" },
];

const PASS_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

type Step = "intro" | "auth" | "otp" | "reset" | "resetOtp" | "store";

function ChatAuthPage() {
  const navigate = useNavigate();
  const [t, setT] = useState<Dict>(T.tr);
  const [step, setStep] = useState<Step>("intro");
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState<"login" | "register">("register");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", email: "", cc: "+90", phone: "", pass: "", pass2: "", type: "customer" as "seller" | "customer", terms: false });
  const signingUp = useRef(false);
  const save = useServerFn(saveChatSettings);

  useEffect(() => {
    if (navigator.language?.toLowerCase().startsWith("en")) setT(T.en);
    if (localStorage.getItem("mefti-chat-intro")) setStep("auth");
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session && !signingUp.current) void navigate({ to: "/mesajlar", replace: true });
    });
  }, [navigate]);

  const upd = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  async function afterSignup() {
    try {
      await save({ data: { user_type: f.type, phone: `${f.cc}${f.phone}`, consent: true } });
    } catch {
      /* ayarlar sonradan Profil'den de kaydedilebilir */
    }
    if (f.type === "seller") setStep("store");
    else void navigate({ to: "/mesajlar", replace: true });
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    if (!PASS_RE.test(f.pass)) return void toast.error("Şifre en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermeli.");
    if (f.pass !== f.pass2) return void toast.error("Şifreler eşleşmiyor.");
    if (!f.terms) return void toast.error("Devam etmek için Kullanım Koşulları'nı kabul edin.");
    if (f.phone.replace(/\D/g, "").length < 7) return void toast.error("Geçerli bir telefon numarası girin.");
    setBusy(true);
    signingUp.current = true;
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.pass,
      options: {
        emailRedirectTo: `${window.location.origin}/mesajlar`,
        data: { full_name: f.name.trim(), phone: `${f.cc}${f.phone.replace(/\D/g, "")}`, chat_user_type: f.type },
      },
    });
    setBusy(false);
    if (error) {
      signingUp.current = false;
      return void toast.error(error.message);
    }
    if (data.session) return afterSignup();
    setStep("otp");
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.pass });
    setBusy(false);
    if (error) return void toast.error(error.message === "Invalid login credentials" ? "E-posta veya şifre hatalı" : error.message);
    void navigate({ to: "/mesajlar", replace: true });
  }

  async function social(provider: "google" | "apple") {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/mesajlar-giris` });
    if (r.error) {
      setBusy(false);
      return void toast.error(provider === "google" ? "Google ile giriş başarısız oldu" : "Apple ile giriş başarısız oldu");
    }
    if (r.redirected) return;
    void navigate({ to: "/mesajlar", replace: true });
  }

  const intro = [
    { icon: MessageCircle, title: t.s1t, desc: t.s1d },
    { icon: Paperclip, title: t.s2t, desc: t.s2d },
    { icon: ShieldCheck, title: t.s3t, desc: t.s3d },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="flex items-center justify-between bg-chat-header px-4 py-3 text-chat-header-foreground">
        <span className="font-semibold">Mefticaret Chat</span>
        <button type="button" className="text-xs underline" onClick={() => setT((c) => (c === T.tr ? T.en : T.tr))}>
          {t === T.tr ? "English" : "Türkçe"}
        </button>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        {step === "intro" ? (
          <div className="flex flex-1 flex-col">
            <div
              className="flex flex-1 flex-col items-center justify-center gap-5 text-center"
              onTouchStart={(e) => ((e.currentTarget as HTMLElement).dataset["x"] = String(e.touches[0]!.clientX))}
              onTouchEnd={(e) => {
                const x0 = Number((e.currentTarget as HTMLElement).dataset["x"]);
                const dx = e.changedTouches[0]!.clientX - x0;
                if (dx < -50) setSlide((s) => Math.min(2, s + 1));
                if (dx > 50) setSlide((s) => Math.max(0, s - 1));
              }}
            >
              {(() => {
                const S = intro[slide]!;
                return (
                  <>
                    <span className="grid size-28 place-items-center rounded-full bg-chat-out">
                      <S.icon className="size-12 text-chat-header" />
                    </span>
                    <h1 className="text-2xl font-semibold">{S.title}</h1>
                    <p className="max-w-xs text-muted-foreground">{S.desc}</p>
                  </>
                );
              })()}
            </div>
            <div className="mb-6 flex justify-center gap-2">
              {intro.map((_, i) => (
                <button key={i} type="button" aria-label={`${i + 1}. sayfa`} onClick={() => setSlide(i)} className={cn("h-2 rounded-full transition-all", i === slide ? "w-6 bg-chat-unread" : "w-2 bg-muted")} />
              ))}
            </div>
            <Button
              className="h-12 w-full"
              onClick={() => {
                if (slide < 2) return setSlide(slide + 1);
                localStorage.setItem("mefti-chat-intro", "1");
                setStep("auth");
              }}
            >
              {slide < 2 ? t.next : t.start}
            </Button>
            {slide < 2 ? (
              <button type="button" className="mt-3 text-sm text-muted-foreground" onClick={() => { localStorage.setItem("mefti-chat-intro", "1"); setStep("auth"); }}>
                {t.skip}
              </button>
            ) : null}
          </div>
        ) : null}

        {step === "auth" ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
              {(["register", "login"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setTab(v)} className={cn("h-10 rounded text-sm font-medium", tab === v && "bg-background shadow-sm")}>
                  {v === "login" ? t.login : t.register}
                </button>
              ))}
            </div>
            <form onSubmit={tab === "login" ? login : register} className="space-y-3">
              {tab === "register" ? <Input required placeholder={t.name} autoComplete="name" value={f.name} onChange={(e) => upd("name", e.target.value)} maxLength={80} /> : null}
              <Input required type="email" placeholder={t.email} autoComplete="email" value={f.email} onChange={(e) => upd("email", e.target.value)} />
              {tab === "register" ? (
                <div className="flex gap-2">
                  <select aria-label="Ülke kodu" value={f.cc} onChange={(e) => upd("cc", e.target.value)} className="h-10 rounded-md border bg-background px-2 text-sm">
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <Input required type="tel" inputMode="tel" autoComplete="tel-national" placeholder="5XX XXX XX XX" value={f.phone} onChange={(e) => upd("phone", e.target.value.replace(/[^\d ]/g, "").slice(0, 16))} />
                </div>
              ) : null}
              <Input required type="password" placeholder={t.pass} autoComplete={tab === "login" ? "current-password" : "new-password"} value={f.pass} onChange={(e) => upd("pass", e.target.value)} />
              {tab === "register" ? (
                <>
                  <Input required type="password" placeholder={t.pass2} autoComplete="new-password" value={f.pass2} onChange={(e) => upd("pass2", e.target.value)} />
                  <p className="text-xs text-muted-foreground">En az 8 karakter; büyük harf, küçük harf ve rakam.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["seller", t.seller, t.sellerD],
                        ["customer", t.customer, t.customerD],
                      ] as const
                    ).map(([v, l, d]) => (
                      <button key={v} type="button" onClick={() => upd("type", v)} className={cn("rounded-md border p-3 text-left", f.type === v && "border-chat-unread bg-muted")}>
                        <p className="font-medium">{l}</p>
                        <p className="text-xs text-muted-foreground">{d}</p>
                      </button>
                    ))}
                  </div>
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" className="mt-1 size-4" checked={f.terms} onChange={(e) => upd("terms", e.target.checked)} />
                    <span>
                      <Link to="/mesajlar-kosullar" className="underline">Kullanım Koşulları</Link> ve <Link to="/mesajlar-gizlilik" className="underline">Gizlilik Politikası</Link> — {t.terms}
                    </span>
                  </label>
                </>
              ) : (
                <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setStep("reset")}>
                  {t.forgot}
                </button>
              )}
              <Button type="submit" className="h-12 w-full" disabled={busy}>
                {tab === "login" ? t.login : t.submit}
              </Button>
            </form>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> {t.or} <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid gap-2">
              <Button variant="outline" className="h-12" onClick={() => void social("google")} disabled={busy}>
                {t.google}
              </Button>
              <Button variant="outline" className="h-12" onClick={() => void social("apple")} disabled={busy}>
                {t.apple}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "otp" ? (
          <OtpStep
            t={t}
            email={f.email.trim()}
            type="email"
            onResend={() => supabase.auth.resend({ type: "signup", email: f.email.trim() })}
            onVerified={() => void afterSignup()}
          />
        ) : null}

        {step === "reset" ? (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const { error } = await supabase.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: `${window.location.origin}/auth` });
              setBusy(false);
              if (error) return void toast.error(error.message);
              setStep("resetOtp");
            }}
          >
            <h1 className="text-xl font-semibold">{t.resetT}</h1>
            <Input required type="email" placeholder={t.email} value={f.email} onChange={(e) => upd("email", e.target.value)} />
            <Button type="submit" className="h-12 w-full" disabled={busy}>
              {t.sendCode}
            </Button>
            <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setStep("auth")}>
              {t.login}
            </button>
          </form>
        ) : null}

        {step === "resetOtp" ? (
          <ResetWithCode t={t} email={f.email.trim()} onDone={() => void navigate({ to: "/mesajlar", replace: true })} />
        ) : null}

        {step === "store" ? <StoreLink t={t} onDone={() => void navigate({ to: "/mesajlar", replace: true })} /> : null}
      </main>
    </div>
  );
}

function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  return (
    <div className="flex justify-between gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={6}
          aria-label={`${i + 1}. hane`}
          value={value[i] ?? ""}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "");
            if (d.length > 1) {
              onChange(d.slice(0, 6));
              refs.current[Math.min(5, d.length - 1)]?.focus();
              return;
            }
            const arr = value.padEnd(6, " ").split("");
            arr[i] = d || " ";
            onChange(arr.join("").trimEnd());
            if (d && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          className="h-14 w-12 rounded-md border bg-background text-center text-xl font-semibold outline-none focus:border-chat-unread"
        />
      ))}
    </div>
  );
}

function useCountdown(start: number) {
  const [left, setLeft] = useState(start);
  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);
  return [left, () => setLeft(start)] as const;
}

function OtpStep({
  t,
  email,
  type,
  onResend,
  onVerified,
}: {
  t: Dict;
  email: string;
  type: "email" | "recovery";
  onResend: () => Promise<{ error: { message: string } | null }>;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, restart] = useCountdown(60);
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{t.otpT}</h1>
      <p className="text-sm text-muted-foreground">
        <strong>{email}</strong> {t.otpD}
      </p>
      <OtpBoxes value={code} onChange={setCode} />
      <Button
        className="h-12 w-full"
        disabled={busy || code.replace(/\s/g, "").length !== 6}
        onClick={async () => {
          setBusy(true);
          const { error } = await supabase.auth.verifyOtp({ email, token: code.replace(/\s/g, ""), type });
          setBusy(false);
          if (error) return void toast.error("Kod hatalı veya süresi dolmuş.");
          onVerified();
        }}
      >
        {t.verify}
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        disabled={left > 0}
        onClick={async () => {
          const { error } = await onResend();
          if (error) return void toast.error(error.message);
          restart();
          toast.success("Kod yeniden gönderildi");
        }}
      >
        {left > 0 ? `${t.resend} (${left} sn)` : t.resend}
      </Button>
    </div>
  );
}

function ResetWithCode({ t, email, onDone }: { t: Dict; email: string; onDone: () => void }) {
  const [verified, setVerified] = useState(false);
  const [pass, setPass] = useState("");
  if (!verified)
    return (
      <OtpStep
        t={t}
        email={email}
        type="recovery"
        onResend={() => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth` })}
        onVerified={() => setVerified(true)}
      />
    );
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!PASS_RE.test(pass)) return void toast.error("Şifre en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermeli.");
        const { error } = await supabase.auth.updateUser({ password: pass });
        if (error) return void toast.error(error.message);
        toast.success("Şifreniz güncellendi");
        onDone();
      }}
    >
      <h1 className="text-xl font-semibold">{t.newPass}</h1>
      <Input required type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />
      <Button type="submit" className="h-12 w-full">
        {t.setPass}
      </Button>
    </form>
  );
}

function StoreLink({ t, onDone }: { t: Dict; onDone: () => void }) {
  const match = useServerFn(matchMyStore);
  const save = useServerFn(saveChatSettings);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ id: string; name: string; url: string }[] | null>(null);
  return (
    <div className="space-y-4">
      <span className="grid size-16 place-items-center rounded-full bg-chat-out">
        <Store className="size-7 text-chat-header" />
      </span>
      <h1 className="text-xl font-semibold">{t.storeT}</h1>
      <p className="text-sm text-muted-foreground">{t.storeD}</p>
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.storeQ} />
        <Button
          disabled={q.trim().length < 2}
          onClick={async () => {
            try {
              setRes(await match({ data: { q: q.trim() } }));
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          {t.find}
        </Button>
      </div>
      {res && !res.length ? (
        <p className="text-sm text-muted-foreground">
          Bu hesapla eşleşen bir mağaza bulunamadı. Mağaza sahibiyseniz aynı e-postayla giriş yapın; ekip üyesiyseniz mağaza sahibinin sizi ekibe eklemesi gerekir.
        </p>
      ) : null}
      {res?.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{s.name}</p>
            <p className="truncate text-xs text-muted-foreground">{s.url}</p>
          </div>
          <Button
            size="sm"
            onClick={async () => {
              await save({ data: { store_url: s.url } });
              toast.success("Mağaza bağlandı");
              onDone();
            }}
          >
            {t.confirm}
          </Button>
        </div>
      ))}
      <Button variant="ghost" className="w-full" onClick={onDone}>
        {t.later}
      </Button>
    </div>
  );
}
