export type GuideAudience = "satici" | "ev-hanimlari" | "tedarikci" | "musteri";

export const GUIDE_AUDIENCES: { id: GuideAudience; label: string; desc: string }[] = [
  { id: "satici", label: "Satıcılar", desc: "Mağaza sahipleri ve ekipleri" },
  { id: "ev-hanimlari", label: "Ev Hanımları", desc: "El emeği ve ev üretimi satıcılar" },
  { id: "tedarikci", label: "Tedarikçiler", desc: "B2B ürün tedarik edenler" },
  { id: "musteri", label: "Müşteriler", desc: "Mefticaret mağazalarından alışveriş yapanlar" },
];

export type Guide = {
  slug: string;
  audience: GuideAudience;
  title: string;
  summary: string;
  minutes: number;
  steps: { title: string; body: string; bullets?: string[] }[];
  cta?: { label: string; to: string };
};

export const GUIDES: Guide[] = [
  {
    slug: "magaza-acma",
    audience: "satici",
    title: "Mağazanı açıp ilk ürününü yayınla",
    summary: "Hesap oluşturmadan ilk ürünün vitrinde görünmesine kadar tüm adımlar.",
    minutes: 6,
    cta: { label: "Mağaza aç", to: "/auth" },
    steps: [
      { title: "Hesap oluştur", body: "Giriş sayfasından e-posta ve şifreyle kayıt ol, gelen onay bağlantısına tıkla." },
      { title: "Mağazanı oluştur", body: "Mağazalarım ekranında 'Yeni mağaza' de; mağaza adı ve alt adres belirle.", bullets: ["Adres sonradan kendi alan adınla değiştirilebilir.", "Ücretsiz paketle başlayıp istediğin zaman yükseltebilirsin."] },
      { title: "Tema seç", body: "Temalar bölümünden hazır bir tema seç, logo ve renklerini tema düzenleyicide ayarla." },
      { title: "Ürün ekle", body: "Ürünler → Yeni ürün: fotoğraf, fiyat, stok ve açıklama gir. Kaydettiğinde vitrinde görünür." },
      { title: "Yayına al", body: "Ödeme ve kargo ayarlarını tamamladıktan sonra mağazanı yayına al ve adresini paylaş." },
    ],
  },
  {
    slug: "odeme-kargo",
    audience: "satici",
    title: "Ödeme ve kargo ayarları",
    summary: "Kartla ödeme almak, kargo firması bağlamak ve iadeleri yönetmek.",
    minutes: 5,
    steps: [
      { title: "Ödeme yöntemi", body: "Ayarlar → Ödeme bölümünden ödeme sağlayıcı bilgilerini gir. Bilgiler güvenli şekilde saklanır; kart bilgisi mağazanda tutulmaz." },
      { title: "Kargo", body: "Kargo bölümünden çalıştığın firmayı seç, gönderim ücretini ve ücretsiz kargo sınırını belirle." },
      { title: "Sipariş hazırlama", body: "Siparişler ekranında siparişi onayla, kargo takip numarasını gir; müşteriye otomatik bildirim gider." },
      { title: "İadeler", body: "İade talepleri Siparişler altında listelenir; onayladığında ücret iadesi ve stok güncellemesi yapılır." },
    ],
  },
  {
    slug: "ai-ve-seo",
    audience: "satici",
    title: "Yapay zekâ ile daha çok görünür ol",
    summary: "Anahtar kelime üretici, ürün açıklaması ve AI kredisi kullanımı.",
    minutes: 4,
    steps: [
      { title: "AI kredisi yükle", body: "Yapay Zekâ menüsünden kredi paketi al. Her üretim yalnızca başarılı olduğunda kredi düşer." },
      { title: "Anahtar kelime üret", body: "Anahtar Kelime Üreticisi'nde ürün adı, fotoğraf veya rakip linki gir; Google, Trendyol, Hepsiburada ve Amazon için öneriler al." },
      { title: "Ürüne uygula", body: "Beğendiğin kelimeleri seç, 'Meta etiketlere kopyala' ile ürünün başlık, açıklama ve etiketlerine yaz." },
    ],
  },
  {
    slug: "kolay-panel-baslangic",
    audience: "ev-hanimlari",
    title: "Kolay Panel ile evden satışa başla",
    summary: "Telefonla birkaç dakikada mağaza aç, el emeği ürünlerini sat.",
    minutes: 5,
    cta: { label: "Ev Hanımları'na katıl", to: "/ev-hanimlari" },
    steps: [
      { title: "Kayıt ol", body: "Ev Hanımları sayfasından kayıt ol; telefonuna gelen kodla hesabını onayla." },
      { title: "Mağazanı kur", body: "Mağaza adını ve ürün kategorini seç (örgü, yöresel gıda, takı…). Vitrinin hemen oluşur." },
      { title: "Ürün yükle", body: "Ürün fotoğrafını telefonla çek, fiyat ve stok gir. Hazır şablonlarla açıklama yazmak kolaylaşır." },
      { title: "Paylaş", body: "Vitrin adresini WhatsApp ve sosyal medyada paylaş; siparişler Kolay Panel'e düşer." },
    ],
  },
  {
    slug: "kazanc-ve-odeme",
    audience: "ev-hanimlari",
    title: "Kazancını görmek ve ödeme talep etmek",
    summary: "Komisyon sonrası net tutar ve ödeme talebi nasıl işler?",
    minutes: 3,
    steps: [
      { title: "Net kazanç", body: "Her siparişte komisyon düşüldükten sonra eline geçecek net tutar panelde gösterilir." },
      { title: "Ödeme talebi", body: "Biriken bakiyen için ödeme talebi oluştur; talep incelendikten sonra hesabına aktarılır." },
      { title: "Takip", body: "Talebin durumunu (beklemede, onaylandı, ödendi) aynı ekrandan izleyebilirsin." },
    ],
  },
  {
    slug: "tedarikci-portali",
    audience: "tedarikci",
    title: "Tedarikçi portalına giriş ve ürün paylaşımı",
    summary: "Mağazalara toptan ürün sunmak için tedarikçi portalını kullan.",
    minutes: 4,
    cta: { label: "Tedarikçi girişi", to: "/tedarikci-giris" },
    steps: [
      { title: "Davet ve giriş", body: "Tedarikçi erişimi, çalıştığın mağaza tarafından açılır. Gelen bilgilerle tedarikçi giriş sayfasından gir." },
      { title: "Ürün ve stok", body: "Portal üzerinden ürün listeni, fiyatlarını ve stok durumunu güncel tut." },
      { title: "Siparişler", body: "Mağazalardan gelen tedarik siparişlerini portalda görüp durumlarını güncelle." },
    ],
  },
  {
    slug: "xml-entegrasyon",
    audience: "tedarikci",
    title: "XML ile ürünlerini otomatik aktar",
    summary: "Ürün listeni XML dosyasıyla mağazalara otomatik gönder.",
    minutes: 4,
    steps: [
      { title: "XML adresi hazırla", body: "Ürünlerini içeren XML dosyanın erişilebilir bir https adresi olsun." },
      { title: "Eşleştirme", body: "Mağaza, XML Entegratör'de alanları (ad, fiyat, stok, görsel) kendi alanlarıyla eşleştirir." },
      { title: "Otomatik güncelleme", body: "Belirlenen aralıklarla fiyat ve stok güncellemeleri kendiliğinden aktarılır." },
    ],
  },
  {
    slug: "guvenli-alisveris",
    audience: "musteri",
    title: "Güvenli alışveriş ve sipariş takibi",
    summary: "Sipariş verme, ödeme güvenliği ve kargonu takip etme.",
    minutes: 3,
    steps: [
      { title: "Sipariş ver", body: "Ürünü sepete ekle, adres ve iletişim bilgini girip ödemeyi tamamla." },
      { title: "Güvenli ödeme", body: "Kart bilgilerin mağazaya iletilmez; ödeme sağlayıcının güvenli sayfasında işlenir." },
      { title: "Takip", body: "Sipariş onayı ve kargo takip numarası e-posta veya SMS ile gelir." },
    ],
  },
  {
    slug: "iade-ve-mesaj",
    audience: "musteri",
    title: "İade talebi ve satıcıya mesaj",
    summary: "Ürünü iade etmek ve mağazayla doğrudan yazışmak.",
    minutes: 3,
    cta: { label: "Mesajlar'a git", to: "/mesajlar-giris" },
    steps: [
      { title: "İade talebi", body: "Siparişini açıp 'İade talebi' oluştur, nedenini seç. Mağaza onayladığında iade süreci başlar." },
      { title: "Satıcıya yaz", body: "Mefticaret Mesajlar ile alışveriş yaptığın mağazanın ekibine doğrudan yazabilirsin." },
      { title: "Şikayet", body: "Uygunsuz bir mesajı uzun basıp 'Şikayet et' ile platform ekibine bildirebilirsin." },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
export const audienceLabel = (a: GuideAudience) => GUIDE_AUDIENCES.find((x) => x.id === a)?.label ?? "";
