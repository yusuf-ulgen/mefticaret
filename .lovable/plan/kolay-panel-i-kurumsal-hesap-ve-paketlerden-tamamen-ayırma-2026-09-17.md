# Kolay Panel'i kurumsal hesap ve paketlerden tamamen ayırma

## Yapılacaklar
- Kolay Panel için mağaza oluşturmayı kurumsal `createStore` akışından çıkarıp tek ve güvenli bir ev üreticisi kurulum işlemi yap.
- Ev üreticisi mağazasını açık bir mağaza türüyle işaretle; ücretli/ücretsiz kurumsal plan ve abonelik kaydı bağlama.
- Kolay Panel girişinde kurumsal mağazaları, kurumsal panelde ise Kolay Panel mağazalarını hiçbir mağaza seçici veya listede gösterme.
- Sunucu erişim kapılarında mağaza türünü doğrula: mikro mağaza yalnız Kolay Panel'e, kurumsal mağaza yalnız kurumsal panele girebilsin.
- Kolay Panel'deki kurumsal pakete yükseltme bağlantısını kaldır; iki ürün ailesi arasında otomatik rol, paket veya veri bağlantısı kurma.
- Daha önce aynı kullanıcı altında oluşmuş mağazaları türüne göre ayır ve mevcut ürün/sipariş kayıtlarını mağazasında koru.
- Telefon ve masaüstünde mikro hesap ile ücretli kurumsal hesabı ayrı ayrı doğrula; çapraz panel URL'lerinin reddedildiğini test et.

## Teknik ayrıntılar
- Ayrım tema adına veya frontend durumuna değil, veritabanındaki kalıcı mağaza türüne dayanacak.
- Mikro mağazalarda `plan_id` boş kalacak ve `subscriptions` kaydı bulunmayacak; kurumsal paket hakları Kolay Panel'e uygulanmayacak.
- Kurulum tek sunucu işlemi olacak: mağaza, sahiplik, ayarlar, bağımsız vitrin, ev üreticisi profili ve rol birlikte oluşturulacak.
- Listeleme ve erişim denetimleri sunucuda mağaza türünü filtreleyecek; yalnız görünümü gizlemekle yetinilmeyecek.
- Kimlik doğrulama altyapısı ortak kalsa bile satıcı profili, mağaza türü, panel rotaları ve paket/abonelik kapsamı birbirine karışmayacak.
