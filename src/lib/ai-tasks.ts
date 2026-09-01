/** AI asistan görev kataloğu — istemci ve sunucu tarafında paylaşılır. */

export type AiFieldType = "text" | "textarea" | "select";

export type AiField = {
  name: string;
  label: string;
  type: AiFieldType;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  rows?: number;
};

export type AiTaskGroup = "content" | "seo" | "catalog" | "marketing" | "support" | "analysis";

export type AiTask = {
  key: string;
  label: string;
  description: string;
  group: AiTaskGroup;
  fields: AiField[];
  system: string;
  maxTokens: number;
};

export const AI_TASK_GROUP_LABELS: Record<AiTaskGroup, string> = {
  content: "İçerik",
  seo: "SEO",
  catalog: "Katalog",
  marketing: "Pazarlama",
  support: "Müşteri desteği",
  analysis: "Analiz",
};

const BASE_RULES =
  "Sade, doğal ve abartısız yaz. Uydurma bilgi, sahte istatistik veya gerçek dışı iddia üretme. Markdown başlığı kullanma; gerekiyorsa tire ile maddele.";

const TONE_FIELD: AiField = {
  name: "tone",
  label: "Marka tonu",
  type: "select",
  options: [
    { value: "premium", label: "Premium" },
    { value: "samimi", label: "Samimi" },
    { value: "teknik", label: "Teknik" },
    { value: "minimal", label: "Minimal" },
    { value: "esprili", label: "Esprili" },
  ],
};

export const AI_TASKS: AiTask[] = [
  {
    key: "product_description",
    label: "Ürün açıklaması",
    description: "Satış odaklı ürün açıklaması ve öne çıkan özellikler.",
    group: "content",
    maxTokens: 900,
    fields: [
      { name: "product", label: "Ürün adı", type: "text", required: true, placeholder: "Su itici trençkot" },
      { name: "details", label: "Ürün detayları", type: "textarea", rows: 3, placeholder: "Kumaş, kalıp, kullanım alanı…" },
      { name: "audience", label: "Hedef kitle", type: "text", placeholder: "25-40 yaş şehirli kadın" },
      TONE_FIELD,
    ],
    system: `Sen Türkiye pazarına odaklı bir e-ticaret metin yazarısın. ${BASE_RULES} Yanıtı "Açıklama" (2-3 paragraf) ve "Öne çıkan özellikler" (3-5 madde) bölümleriyle ver.`,
  },
  {
    key: "seo_title",
    label: "SEO başlığı",
    description: "60 karakterin altında, anahtar kelime içeren başlık alternatifleri.",
    group: "seo",
    maxTokens: 400,
    fields: [
      { name: "subject", label: "Ürün / sayfa", type: "text", required: true },
      { name: "keywords", label: "Anahtar kelimeler", type: "text", placeholder: "trençkot, su itici" },
    ],
    system: `Sen teknik SEO uzmanısın. ${BASE_RULES} 5 farklı başlık öner; her biri 60 karakterin altında olsun ve karakter sayısını parantez içinde yaz.`,
  },
  {
    key: "meta_description",
    label: "Meta açıklama",
    description: "155 karakter altı, tıklama oranı yüksek meta açıklamalar.",
    group: "seo",
    maxTokens: 400,
    fields: [
      { name: "subject", label: "Ürün / sayfa", type: "text", required: true },
      { name: "keywords", label: "Anahtar kelimeler", type: "text" },
    ],
    system: `Sen teknik SEO uzmanısın. ${BASE_RULES} 3 farklı meta açıklama öner; her biri 155 karakterin altında olsun, karakter sayısını parantez içinde yaz ve eylem çağrısı içersin.`,
  },
  {
    key: "blog_post",
    label: "Blog yazısı",
    description: "SEO uyumlu, bölümlere ayrılmış blog içeriği.",
    group: "content",
    maxTokens: 2200,
    fields: [
      { name: "topic", label: "Konu", type: "text", required: true },
      { name: "keywords", label: "Anahtar kelimeler", type: "text" },
      {
        name: "length",
        label: "Uzunluk",
        type: "select",
        options: [
          { value: "kısa", label: "Kısa (~400 kelime)" },
          { value: "orta", label: "Orta (~800 kelime)" },
          { value: "uzun", label: "Uzun (~1200 kelime)" },
        ],
      },
      TONE_FIELD,
    ],
    system: `Sen e-ticaret içerik editörüsün. ${BASE_RULES} Yanıtı "Başlık", "Giriş", numaralı ara bölümler, "Sonuç" ve "Meta açıklama" ile ver.`,
  },
  {
    key: "category_suggestion",
    label: "Ürün kategorisi önerisi",
    description: "Ürün için en uygun kategori ve alt kategori yolu.",
    group: "catalog",
    maxTokens: 400,
    fields: [
      { name: "product", label: "Ürün adı", type: "text", required: true },
      { name: "details", label: "Ürün detayları", type: "textarea", rows: 2 },
      { name: "existing", label: "Mevcut kategoriler", type: "textarea", rows: 2, placeholder: "Kadın > Dış Giyim, Aksesuar…" },
    ],
    system: `Sen e-ticaret katalog uzmanısın. ${BASE_RULES} En uygun 3 kategori yolunu "Ana kategori > Alt kategori" biçiminde, her biri için kısa gerekçeyle sırala. Mevcut kategoriler verildiyse önce onlardan seç.`,
  },
  {
    key: "product_tags",
    label: "Ürün etiketleme",
    description: "Filtreleme ve arama için etiket seti.",
    group: "catalog",
    maxTokens: 400,
    fields: [
      { name: "product", label: "Ürün adı", type: "text", required: true },
      { name: "details", label: "Ürün detayları", type: "textarea", rows: 2 },
    ],
    system: `Sen e-ticaret katalog uzmanısın. ${BASE_RULES} 10-15 etiket üret; tek satırda virgülle ayır, tümü küçük harf ve Türkçe olsun.`,
  },
  {
    key: "translation",
    label: "Çeviri",
    description: "Ürün, sayfa veya kampanya metnini hedef dile çevir.",
    group: "content",
    maxTokens: 1600,
    fields: [
      { name: "text", label: "Çevrilecek metin", type: "textarea", rows: 5, required: true },
      {
        name: "target",
        label: "Hedef dil",
        type: "select",
        options: [
          { value: "İngilizce", label: "İngilizce" },
          { value: "Almanca", label: "Almanca" },
          { value: "Arapça", label: "Arapça" },
          { value: "Rusça", label: "Rusça" },
          { value: "Fransızca", label: "Fransızca" },
          { value: "Türkçe", label: "Türkçe" },
        ],
      },
    ],
    system: `Sen e-ticaret yerelleştirme uzmanısın. ${BASE_RULES} Yalnızca çeviriyi ver; ürün adları, marka ve birimleri koru, pazarlama tonunu hedef dile uyarla.`,
  },
  {
    key: "support_reply",
    label: "Müşteri destek asistanı",
    description: "Gelen müşteri mesajına profesyonel yanıt taslağı.",
    group: "support",
    maxTokens: 700,
    fields: [
      { name: "message", label: "Müşteri mesajı", type: "textarea", rows: 4, required: true },
      { name: "context", label: "Sipariş / durum bilgisi", type: "textarea", rows: 2, placeholder: "Sipariş kargoda, tahmini teslim 2 gün" },
      {
        name: "channel",
        label: "Kanal",
        type: "select",
        options: [
          { value: "e-posta", label: "E-posta" },
          { value: "WhatsApp", label: "WhatsApp" },
          { value: "canlı destek", label: "Canlı destek" },
        ],
      },
    ],
    system: `Sen deneyimli bir müşteri deneyimi temsilcisisin. ${BASE_RULES} Empatik, çözüm odaklı ve kanala uygun uzunlukta yanıt yaz. Bilgi eksikse müşteriden hangi bilgiyi isteyeceğini belirt; söz verme veya tazminat taahhüdü uydurma.`,
  },
  {
    key: "sales_analysis",
    label: "Satış analizi",
    description: "Mağaza metriklerini yorumlayıp aksiyon önerir.",
    group: "analysis",
    maxTokens: 1200,
    fields: [
      {
        name: "days",
        label: "Dönem",
        type: "select",
        options: [
          { value: "7", label: "Son 7 gün" },
          { value: "30", label: "Son 30 gün" },
          { value: "90", label: "Son 90 gün" },
        ],
      },
      { name: "focus", label: "Odak sorusu", type: "text", placeholder: "Sepet terk oranını nasıl düşürürüm?" },
    ],
    system: `Sen bir e-ticaret büyüme analistisin. ${BASE_RULES} Yanıtı "Durum özeti", "Riskler" ve "Öncelikli 3 aksiyon" bölümleriyle ver. Veri yetersizse bunu açıkça söyle, varsayım üretme.`,
  },
  {
    key: "campaign",
    label: "Kampanya oluşturma",
    description: "İndirim mekaniği, mesaj ve kanal planı.",
    group: "marketing",
    maxTokens: 1200,
    fields: [
      { name: "goal", label: "Kampanya amacı", type: "text", required: true, placeholder: "Sezon sonu stok eritme" },
      { name: "period", label: "Tarih aralığı", type: "text", placeholder: "1-10 Eylül" },
      { name: "products", label: "Öne çıkacak ürünler", type: "textarea", rows: 2 },
      TONE_FIELD,
    ],
    system: `Sen performans pazarlama uzmanısın. ${BASE_RULES} Yanıtı "Kampanya adı", "Mekanik" (indirim/kupon kuralı), "Ana mesaj", "Kanal planı" (e-posta, WhatsApp, SMS, Instagram) ve "Ölçüm metrikleri" bölümleriyle ver.`,
  },
  {
    key: "email",
    label: "E-posta yazma",
    description: "Konu satırı ve gövdesiyle hazır e-posta.",
    group: "marketing",
    maxTokens: 1000,
    fields: [
      {
        name: "purpose",
        label: "E-posta türü",
        type: "select",
        options: [
          { value: "kampanya duyurusu", label: "Kampanya duyurusu" },
          { value: "sepet hatırlatma", label: "Sepet hatırlatma" },
          { value: "yeni ürün", label: "Yeni ürün" },
          { value: "sipariş bilgilendirme", label: "Sipariş bilgilendirme" },
          { value: "geri kazanım", label: "Geri kazanım" },
        ],
      },
      { name: "details", label: "İçerik notları", type: "textarea", rows: 3 },
      TONE_FIELD,
    ],
    system: `Sen e-posta pazarlama uzmanısın. ${BASE_RULES} 3 konu satırı alternatifi, ön izleme metni, gövde ve tek net eylem çağrısı ver. Kişiselleştirme için {{musteri_adi}} gibi değişkenler kullan.`,
  },
  {
    key: "instagram",
    label: "Instagram içeriği",
    description: "Gönderi metni, hashtag ve reels senaryosu.",
    group: "marketing",
    maxTokens: 900,
    fields: [
      { name: "subject", label: "Ürün / konu", type: "text", required: true },
      {
        name: "format",
        label: "Format",
        type: "select",
        options: [
          { value: "tek gönderi", label: "Tek gönderi" },
          { value: "karusel", label: "Karusel" },
          { value: "reels", label: "Reels" },
          { value: "story", label: "Story" },
        ],
      },
      TONE_FIELD,
    ],
    system: `Sen sosyal medya içerik üreticisisin. ${BASE_RULES} Yanıtı "Gönderi metni", "Hook alternatifleri" (3 adet), "Hashtag" (10-15 adet, tek satır) ve formata göre "Sahne planı" bölümleriyle ver.`,
  },
  {
    key: "product_recommendation",
    label: "Ürün önerisi",
    description: "Çapraz satış ve üst satış için ürün eşleştirme.",
    group: "catalog",
    maxTokens: 800,
    fields: [
      { name: "product", label: "Ana ürün", type: "text", required: true },
      { name: "catalog", label: "Katalogdaki diğer ürünler", type: "textarea", rows: 3 },
      { name: "audience", label: "Müşteri profili", type: "text" },
    ],
    system: `Sen e-ticaret merchandising uzmanısın. ${BASE_RULES} "Birlikte al" (3 ürün), "Üst satış" (2 ürün) ve "Paket teklifi" önerilerini gerekçeleriyle ver. Katalog verildiyse yalnızca oradaki ürünleri kullan.`,
  },
  {
    key: "image_enhancement",
    label: "Görsel iyileştirme",
    description: "Görsel kalitesi için brief, alt metin ve üretim istemi.",
    group: "content",
    maxTokens: 900,
    fields: [
      { name: "product", label: "Ürün adı", type: "text", required: true },
      { name: "current", label: "Mevcut görselin durumu", type: "textarea", rows: 3, placeholder: "Beyaz fon, gölge yok, düşük çözünürlük" },
      {
        name: "style",
        label: "İstenen stil",
        type: "select",
        options: [
          { value: "stüdyo", label: "Stüdyo / beyaz fon" },
          { value: "yaşam tarzı", label: "Yaşam tarzı" },
          { value: "editoryal", label: "Editoryal" },
          { value: "detay makro", label: "Detay / makro" },
        ],
      },
    ],
    system: `Sen ürün fotoğrafı yönetmenisin. ${BASE_RULES} Yanıtı "İyileştirme adımları" (kadraj, ışık, fon, retouch, çözünürlük), "Görsel üretim istemi" (İngilizce, tek paragraf) ve "Alt metin" (125 karakter altı, Türkçe) bölümleriyle ver.`,
  },
];

export const AI_TASK_MAP = new Map(AI_TASKS.map((task) => [task.key, task]));

export function taskLabel(key: string): string {
  return AI_TASK_MAP.get(key)?.label ?? key;
}
