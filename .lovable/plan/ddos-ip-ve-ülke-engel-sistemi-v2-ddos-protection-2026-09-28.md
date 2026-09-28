# DDoS, IP ve Ülke Engel Sistemi (v2_ddos_protection)

Mefticaret'te zaten çalışan bir güvenlik duvarı var (IP kuralları, ülke engeli, WAF desenleri, bot tespiti, hız limiti, IP itibarı, saldırı kayıtları, /admin/security). Bu plan onu **yeniden yazmaz, genişletir**. Yeni her şey `v2_ddos_protection` bayrağı arkasında, varsayılan **kapalı**; kapalıyken sistem bugünkü gibi çalışır.

## Bu ortamda yapılamayanlar (dürüst not)
- **Redis yok.** Sayaçlar mevcut veritabanı hız sayacında tutulur. Saniyede on binlerce isteği uygulama katmanında saymak mümkün değil; büyük hacimli saldırıyı (UDP/SYN flood, Slowloris, null route) zaten sitenin önündeki Cloudflare karşılıyor. Nginx ayarı da yok.
- **"Her saniye" görevleri** yapılamaz; en sık 1 dakikalık zamanlanmış görev çalışır.
- **Yeni genel API adresleri açılmaz** (sizin "API oluşturma yok" kuralınız). Tüm yönetim panel içinden, yalnız süper yönetici yetkisiyle.
- **AbuseIPDB / IPInfo / hCaptcha / Turnstile** anahtar ister. İlk sürümde ücretsiz yollar: ülke bilgisi Cloudflare başlığından, basit **matematik doğrulama** sayfası. Anahtar verirseniz Turnstile ve AbuseIPDB sonra eklenir.
- Tor/ASN listelerini internetten her gece çekme: ilk sürümde elle eklenen ASN kuralları + Cloudflare'in verdiği ASN bilgisi.

## Yapılacaklar
1. **Yeni tablolar (fw_ öneki):** ASN kuralları, DDoS olayları + kaynak IP'leri, hız limiti ihlalleri, doğrulama (captcha) kayıtları, dakikalık trafik özetleri, uç nokta bazlı hız kuralları, DDoS eşik ayarları. Mevcut sec_ IP/ülke tablolarına CIDR aralığı, öncelik, süre sonu, "captcha/izle" türleri eklenir (yeni kopya tablo açılmaz). Hepsi RLS ile yalnız süper yönetici.
2. **Güvenlik duvarı adımları** (mevcut katmanın içinde, sırayla): izin listesi → kara liste (tek IP + CIDR) → ülke kuralı (engelle / doğrulama / yavaşlat) → ASN kuralı → kötü bot imzaları (curl, sqlmap, nikto…) → uç nokta hız limiti (/giris 5/dk, /kayit 10/dk, şifre sıfırlama 3/dk, ödeme 20/dk) → tek IP'den aşırı istek otomatik ban → doğrulama bekleniyorsa doğrulama sayfası.
3. **Sayfalar:** "Güvenlik Kontrolü" matematik doğrulama sayfası (geçince 10 dk serbest) ve iki dilli "Erişim Kısıtlı" ülke sayfası.
4. **Varsayılanlar:** Türkiye, KKTC, Azerbaycan her zaman izinli. Yüksek riskli ülke listesi ve datacenter ASN'leri hazır gelir ama **kapalı** — siz tek tıkla açarsınız (yanlışlıkla gerçek müşteri engellenmesin).
5. **DDoS seviyeleri 0–4:** dakikalık görev trafik özetini yazar, eşiklere göre seviye belirler, seviye 2+ uyarı, 3+ sıkı limit + şüpheli IP'lere doğrulama; 5 dk sakin kalınca bir seviye geri iner. Eşikler panelden değiştirilir.
6. **Süresi dolan banlar** saatlik, 90 günden eski kayıtlar gece temizlenir.
7. **Panel: /admin/security/firewall** — Genel Bakış (durum kartı, son 60 dk grafik, canlı olaylar 30 sn), DDoS İzleme (olaylar + eşik ayarları), IP Kuralları, Ülke Kuralları (+ "yüksek riskli ülkeleri ekle"), ASN Kuralları, Hız Limitleri (+ simülasyon aracı), Doğrulama istatistikleri, Trafik Analizi (en çok istek atan IP'ler: Ban / Doğrulama / İzin ver). Dünya haritası yerine ülke tablosu (harita kütüphanesi ağır).
8. Bayrak `plan-features.ts`'e eklenir; kapalıyken yeni adımlar hiç çalışmaz.

## Teknik ayrıntılar
- Uygulama: `src/lib/security-firewall.server.ts` genişletilir, `firewallMiddleware` (start.ts) zaten ilk sırada çalışıyor; yeni kurallar ~60 sn bellek önbelleği ile okunur, sayaçlar `consume_rate_limit` RPC.
- Yönetim işlemleri `security-admin.functions.ts` benzeri `createServerFn` + `requireSupabaseAuth` + `assertSecurityAdmin`; her değişiklik audit_logs'a.
- Zamanlanmış görevler mevcut `/api/public/cron.*` deseniyle, cron gizli anahtarı doğrulanarak.
- Kendi kendini kilitlemeye karşı: süper yönetici oturumu ve panel IP'si otomatik ban dışı.
