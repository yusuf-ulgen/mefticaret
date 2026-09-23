import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Copy, Download, Loader2, MessageCircle, Printer, Sparkles } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Field, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import { supabase } from "@/integrations/supabase/client";
import { getHomeMakerProfile } from "@/lib/home-maker.functions";
import { simpleProductsQuery } from "@/lib/homemaker-queries";

export const Route = createFileRoute("/ev-hanimlari/sablonlar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Hazır Şablonlar — Ev Hanımları Portalı" },
      { name: "description", content: "Hazır paylaşım metinleri, yazdırılabilir teşekkür kartları ve WhatsApp hızlı cevapları." },
      { property: "og:title", content: "Hazır Şablonlar — Ev Hanımları Portalı" },
      { property: "og:description", content: "Instagram hikâyesi, teşekkür kartı ve WhatsApp mesajları tek dokunuşla." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TemplatesPage,
});

type Store = { id: string; name: string; slug: string };

function useMyStore() {
  const navigate = useNavigate();
  const loadProfile = useServerFn(getHomeMakerProfile);
  const [store, setStore] = useState<Store | null>(null);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return void navigate({ to: "/ev-hanimlari" });
      try {
        const profile = await loadProfile();
        if (!profile?.store_id) return void navigate({ to: "/ev-hanimlari/kurulum" });
        const { data: s } = await supabase.from("stores").select("id, name, slug").eq("id", profile.store_id).maybeSingle();
        if (s) setStore(s);
      } catch {
        toast.error("Mağaza bilgileriniz yüklenemedi");
      }
    })();
  }, [loadProfile, navigate]);
  return store;
}

async function copy(text: string, label = "Metin kopyalandı") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Kopyalanamadı, metni uzun basarak kopyalayın");
  }
}

type Section = "post" | "card" | "whatsapp";

function TemplatesPage() {
  const store = useMyStore();
  const [section, setSection] = useState<Section>("post");
  if (!store)
    return (
      <div className="grid min-h-screen place-items-center bg-hm-sand">
        <Loader2 className="size-6 animate-spin text-hm-rose" />
      </div>
    );
  const storeUrl = `${window.location.origin}/s/${store.slug}`;
  return (
    <div className="hm-app min-h-screen bg-hm-sand pb-10">
      <header className="sticky top-0 z-10 border-b border-hm-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link to="/store/$storeId/kolay" params={{ storeId: store.id }} aria-label="Panele dön" className="grid size-11 place-items-center rounded-2xl bg-hm-sand text-hm-ink">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <p className="text-lg font-bold text-hm-ink">Hazır Şablonlar</p>
            <p className="text-xs text-hm-ink-soft">{store.name}</p>
          </div>
        </div>
        <div className="mx-auto grid max-w-lg grid-cols-3 gap-2 px-4 pb-3">
          {([
            ["post", "Paylaşım"],
            ["card", "Teşekkür Kartı"],
            ["whatsapp", "WhatsApp"],
          ] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setSection(k)} className={`min-h-12 rounded-2xl text-sm font-semibold ${section === k ? "bg-hm-rose text-white" : "bg-hm-rose-soft text-hm-rose"}`}>
              {l}
            </button>
          ))}
        </div>
      </header>
      <main className="mx-auto grid max-w-lg gap-4 px-4 py-4">
        {section === "post" ? <PostGenerator store={store} storeUrl={storeUrl} /> : null}
        {section === "card" ? <CardBuilder store={store} storeUrl={storeUrl} /> : null}
        {section === "whatsapp" ? <QuickReplies store={store} storeUrl={storeUrl} /> : null}
      </main>
    </div>
  );
}

/* ------------------------------ paylaşım ------------------------------ */

const POST_TEMPLATES: Record<string, { label: string; texts: ((p: string, s: string) => string)[] }> = {
  pre: {
    label: "Ön Sipariş",
    texts: [
      (p) => `🧺 ${p} için ön siparişler açıldı! Sınırlı sayıda, taze taze hazırlıyorum. Yerinizi şimdiden ayırın 💛`,
      (p) => `Bu hafta ${p} yapıyorum 👩‍🍳 Ön sipariş verenlere öncelik! Mesaj atmanız yeterli.`,
    ],
  },
  new: {
    label: "Yeni Ürün",
    texts: [
      (p) => `✨ Yeni ürün: ${p}! Sevgiyle, evimde el emeğiyle hazırlandı. Siz de denemek ister misiniz?`,
      (p, s) => `${s} ailesine yeni bir lezzet katıldı: ${p} 🌸 Linkten hemen sipariş verebilirsiniz.`,
    ],
  },
  sale: {
    label: "İndirim Duyurusu",
    texts: [
      (p) => `🎉 Kaçırmayın! ${p} bu hafta indirimde. Stoklar tükenmeden sipariş verin.`,
      (p) => `💝 Size özel fırsat: ${p} alana sürpriz indirim! Sadece bu hafta sonu geçerli.`,
    ],
  },
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function PostGenerator({ store, storeUrl }: { store: Store; storeUrl: string }) {
  const { data: products } = useQuery(simpleProductsQuery(store.id));
  const [cat, setCat] = useState("pre");
  const [idx, setIdx] = useState(0);
  const [productId, setProductId] = useState<string>("");
  const product = products?.find((p) => p.id === productId) ?? products?.[0];
  const name = product?.title ?? "ürünüm";
  const text = POST_TEMPLATES[cat]!.texts[idx % POST_TEMPLATES[cat]!.texts.length]!(name, store.name);
  const full = `${text}\n\n👉 ${storeUrl}`;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tainted, setTainted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const W = 1080;
    const H = 1920;
    const style = getComputedStyle(document.documentElement);
    const rose = style.getPropertyValue("--color-hm-rose").trim() || "#c9677a";
    const roseSoft = style.getPropertyValue("--color-hm-rose-soft").trim() || "#fbeef0";
    const ink = style.getPropertyValue("--color-hm-ink").trim() || "#3a322c";
    const draw = (img?: HTMLImageElement) => {
      ctx.fillStyle = roseSoft;
      ctx.fillRect(0, 0, W, H);
      if (img) {
        const size = 900;
        const scale = Math.max(size / img.width, size / img.height);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(90, 220, size, size, 60);
        ctx.clip();
        ctx.drawImage(img, 90 + (size - img.width * scale) / 2, 220 + (size - img.height * scale) / 2, img.width * scale, img.height * scale);
        ctx.restore();
      }
      ctx.fillStyle = rose;
      ctx.font = "bold 64px Geist, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(store.name, W / 2, 150);
      ctx.fillStyle = ink;
      ctx.font = "600 52px Geist, sans-serif";
      wrapText(ctx, text, 900).slice(0, 7).forEach((l, i) => ctx.fillText(l, W / 2, 1230 + i * 72));
      ctx.fillStyle = rose;
      ctx.beginPath();
      ctx.roundRect(140, 1730, 800, 110, 55);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = "bold 40px Geist, sans-serif";
      ctx.fillText(storeUrl.replace(/^https?:\/\//, ""), W / 2, 1800);
    };
    setTainted(false);
    if (product?.imageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => draw(img);
      img.onerror = () => {
        setTainted(true);
        draw();
      };
      img.src = product.imageUrl;
    } else draw();
  }, [product?.imageUrl, text, store.name, storeUrl]);

  function download() {
    try {
      const url = canvasRef.current!.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${store.slug}-hikaye.png`;
      a.click();
      toast.success("Hikâye görseli indirildi");
    } catch {
      toast.error("Görsel indirilemedi, ekran görüntüsü alabilirsiniz");
    }
  }

  return (
    <>
      <SoftCard className="grid gap-3">
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(POST_TEMPLATES).map(([k, v]) => (
            <button key={k} type="button" onClick={() => { setCat(k); setIdx(0); }} className={`min-h-12 rounded-2xl text-sm font-semibold ${cat === k ? "bg-hm-amber text-white" : "bg-hm-amber-soft text-hm-amber"}`}>
              {v.label}
            </button>
          ))}
        </div>
        {products && products.length > 0 ? (
          <Field label="Ürün">
            <select className={inputClass} value={product?.id ?? ""} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
        ) : <p className="text-sm text-hm-ink-soft">Henüz ürününüz yok; metinler “ürünüm” diye yazılır.</p>}
        <p className="whitespace-pre-line rounded-2xl bg-hm-sand p-3 text-sm text-hm-ink">{full}</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setIdx(idx + 1)} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-hm-line bg-white text-sm font-semibold text-hm-ink">
            <Sparkles className="size-4" /> Başka metin
          </button>
          <button type="button" onClick={() => copy(full, "Instagram için kopyalandı")} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-hm-rose text-sm font-semibold text-white">
            <Copy className="size-4" /> Instagram
          </button>
          <button type="button" onClick={() => copy(full, "WhatsApp durumu için kopyalandı")} className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-hm-teal text-sm font-semibold text-white">
            <MessageCircle className="size-4" /> WhatsApp durumu için kopyala
          </button>
        </div>
      </SoftCard>
      <SoftCard className="grid gap-3">
        <p className="font-semibold text-hm-ink">Hikâye önizleme</p>
        <canvas ref={canvasRef} width={1080} height={1920} className="mx-auto w-full max-w-[280px] rounded-2xl border border-hm-line" />
        {tainted ? <p className="text-xs text-hm-ink-soft">Ürün fotoğrafı yüklenemedi, sade tasarım gösteriliyor.</p> : null}
        <button type="button" onClick={download} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-hm-rose text-sm font-semibold text-white">
          <Download className="size-4" /> Görseli indir
        </button>
      </SoftCard>
    </>
  );
}

/* ---------------------------- teşekkür kartı --------------------------- */

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function CardBuilder({ store, storeUrl }: { store: Store; storeUrl: string }) {
  const [name, setName] = useState(store.name);
  const [message, setMessage] = useState("Beni tercih ettiğiniz için çok teşekkür ederim! Afiyet olsun 💛");
  const [care, setCare] = useState("Serin ve kuru yerde saklayınız. 3 gün içinde tüketiniz.");
  const [link, setLink] = useState(storeUrl);
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (!link.trim()) {
      setQr("");
      return;
    }
    QRCode.toDataURL(link.trim(), { width: 300, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, [link]);

  const cardHtml = useMemo(
    () => `<div class="c"><h2>${esc(name)}</h2><p class="m">${esc(message)}</p>${care ? `<p class="k"><b>Bakım:</b> ${esc(care)}</p>` : ""}${qr ? `<img src="${qr}"/>` : ""}</div>`,
    [name, message, care, qr],
  );

  function print() {
    const w = window.open("", "_blank");
    if (!w) return toast.error("Açılır pencereye izin verin");
    w.document.write(`<!doctype html><html><head><title>${esc(name)} - Teşekkür kartları</title><style>
      @page{size:A4;margin:10mm}body{margin:0;font-family:Geist,Arial,sans-serif}
      .g{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:6mm;height:270mm}
      .c{border:1px dashed #bbb;border-radius:6mm;padding:8mm;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center}
      h2{margin:0 0 4mm;color:#b85a6c;font-size:20pt}.m{font-size:12pt;margin:0 0 4mm}.k{font-size:9pt;color:#555}img{width:28mm;height:28mm;margin-top:3mm}
    </style></head><body><div class="g">${cardHtml.repeat(4)}</div><script>window.onload=()=>{window.print()}</script></body></html>`);
    w.document.close();
    toast.success("Yazdırma sayfası açıldı. “PDF olarak kaydet” seçebilirsiniz.");
  }

  return (
    <>
      <SoftCard className="grid gap-3">
        <Field label="Mağaza adı"><input className={inputClass} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Teşekkür mesajı"><textarea className={`${inputClass} min-h-20`} maxLength={200} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
        <Field label="Saklama / yıkama talimatı"><input className={inputClass} maxLength={150} value={care} onChange={(e) => setCare(e.target.value)} /></Field>
        <Field label="QR kod bağlantısı" hint="Mağazanız, Instagram veya yorum sayfanız"><input className={inputClass} value={link} onChange={(e) => setLink(e.target.value)} /></Field>
      </SoftCard>
      <SoftCard className="grid gap-3">
        <p className="font-semibold text-hm-ink">Kart önizleme</p>
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-hm-line bg-white p-5 text-center">
          <p className="text-xl font-bold text-hm-rose">{name}</p>
          <p className="text-sm text-hm-ink">{message}</p>
          {care ? <p className="text-xs text-hm-ink-soft"><b>Bakım:</b> {care}</p> : null}
          {qr ? <img src={qr} alt="QR kod" className="size-24" /> : null}
        </div>
        <button type="button" onClick={print} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-hm-teal text-sm font-semibold text-white">
          <Printer className="size-4" /> PDF Olarak İndir / Yazdır (sayfada 4 kart)
        </button>
      </SoftCard>
    </>
  );
}

/* ------------------------------ WhatsApp ------------------------------ */

function QuickReplies({ store, storeUrl }: { store: Store; storeUrl: string }) {
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState("");
  const [code, setCode] = useState("");
  const [detail, setDetail] = useState("");
  const hi = customer.trim() ? `Merhaba ${customer.trim()}` : "Merhaba";
  const presets = [
    { key: "welcome", label: "Hoş Geldin Mesajı", text: `${hi} 🌸 ${store.name}'a hoş geldiniz! Tüm ürünlerimi buradan görebilirsiniz: ${storeUrl} Sorunuz olursa yazmanız yeterli.` },
    { key: "cargo", label: "Kargo Kodu Gönderimi", text: `${hi} 📦 Siparişiniz yola çıktı! Kargo takip kodunuz: ${code.trim() || "[kod]"}. Güzel günlerde kullanın 💛 — ${store.name}` },
    { key: "custom", label: "Özel Sipariş Detayı", text: `${hi} 👩‍🍳 Özel siparişinizin detayları: ${detail.trim() || "[detay]"}. Onaylarsanız hemen hazırlamaya başlıyorum. — ${store.name}` },
  ];

  function open(text: string) {
    const digits = phone.replace(/\D/g, "");
    const num = digits.startsWith("0") ? `9${digits}` : digits.length === 10 ? `90${digits}` : digits;
    const url = `https://wa.me/${num.length >= 11 ? num : ""}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
    toast.success("WhatsApp açılıyor");
  }

  return (
    <>
      <SoftCard className="grid gap-3">
        <Field label="Müşteri telefonu" hint="Boş bırakırsanız WhatsApp'ta kişiyi siz seçersiniz"><input className={inputClass} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx xxx xx xx" /></Field>
        <Field label="Müşteri adı"><input className={inputClass} value={customer} onChange={(e) => setCustomer(e.target.value)} /></Field>
        <Field label="Kargo takip kodu"><input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <Field label="Özel sipariş detayı"><input className={inputClass} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Örn: 2 kg mantı, cumartesi teslim" /></Field>
      </SoftCard>
      {presets.map((p) => (
        <SoftCard key={p.key} className="grid gap-2">
          <p className="font-semibold text-hm-ink">{p.label}</p>
          <p className="rounded-2xl bg-hm-sand p-3 text-sm text-hm-ink">{p.text}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => copy(p.text)} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-hm-line bg-white text-sm font-semibold text-hm-ink"><Copy className="size-4" /> Kopyala</button>
            <button type="button" onClick={() => open(p.text)} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-hm-teal text-sm font-semibold text-white"><MessageCircle className="size-4" /> WhatsApp'ta aç</button>
          </div>
        </SoftCard>
      ))}
    </>
  );
}
