# Roadmap

## Couture teması
- [x] Adım 1: Couture teması, efekt paketi, ana sayfa, /demo/couture, özellik anahtarları
- [x] Adım 2: Üç katlı yapışkan üst menü, mega menü, anlık arama, mobil menü/alt menü, sağdan sepet paneli, footer
- [x] Adım 3: Liste filtreleri/sıralama, ürün detayı (mercek, taksit, akordeon, yorum dağılımı, yapışkan alt bar)
- [x] Adım 4: Adımlı ödeme (81 il/ilçe), Hesabım sekmeleri
- [ ] Couture özellik anahtarlarını vitrinde uygulamak (şu an yalnız tanımlı, kapalı)

## Mystique teması (fantezi/kostüm)
- [ ] Tema, efekt paketi, bölümler, chrome, /demo/mystique

## Güvenlik & güvenlik duvarı (v2_security, varsayılan kapalı)
- [ ] Adım 1: sec_ tabloları (IP kuralları, itibar, ülke engeli, saldırı kayıtları, tehdit istihbaratı, giriş denemeleri, kilitler, WAF kuralları/istisnaları, hız limitleri, dolandırıcılık kuralları/skorları/sinyalleri, oturumlar, güvenilir cihazlar, SSL, saklama politikaları) + RLS/GRANT + varsayılan WAF/fraud kuralları
- [ ] Adım 2: Güvenlik katmanı sunucu kodu: IP/ülke kontrolü, hız limiti, WAF (SQLi/XSS/path traversal/başlık/gövde), bot tespiti, brute-force kilitleri, saldırı kaydı
- [ ] Adım 3: Dolandırıcılık risk skoru motoru (hız, coğrafya, sipariş, cihaz, e-posta/telefon) ve inceleme kuyruğu
- [ ] Adım 4: /admin/security paneli (Genel bakış, Saldırılar, IP kuralları, Fraud, Oturumlar, API anahtarları, KVKK, Ayarlar)
- [ ] Adım 5: Süper admin platform güvenlik görünümü + gerçek zamanlı uyarılar (e-posta/webhook) + haftalık özet
- [ ] Adım 6: Oturum/cihaz güvenliği, parola politikası, 2FA zorunluluk ayarları
