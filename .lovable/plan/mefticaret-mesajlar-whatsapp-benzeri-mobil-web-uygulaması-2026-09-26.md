# Mefticaret Mesajlar — WhatsApp benzeri mobil web uygulaması

Mefticaret içinde çalışan, telefona "Ana ekrana ekle" ile kurulabilen, anlık mesajlaşma uygulaması. React Native/Expo ve Laravel Reverb yerine mevcut Mefticaret altyapısı (giriş, veritabanı, anlık bağlantı, dosya deposu) kullanılır. Yeni genel API adresi açılmaz; her şey panel içi güvenli sunucu işlemleriyle çalışır.

## Kimler konuşabilir
- Satıcı ↔ müşteri: mağaza ekibi, o mağazadan alışveriş yapan / kayıtlı müşterilerle.
- Platform yöneticisi ↔ satıcı: destek yazışmaları.
- Grup sohbetleri: aynı mağaza kapsamındaki kişilerle, yönetici eklenebilir.
- Kimse başka mağazanın müşterilerini veya ekibini arayamaz/göremez.

## Ekranlar (`/mesajlar` altında, Türkçe, telefon öncelikli)
1. Giriş: Mefticaret logosu, e-posta + şifre, şifremi unuttum, hata mesajları (mevcut giriş sistemi).
2. Sohbet listesi: "Mesajlar" başlığı, arama, yeni sohbet; her satırda avatar + çevrimiçi nokta, isim + rol rozeti (Admin/Satıcı/Müşteri), son mesaj, saat, okunmamış sayısı, sessiz ikonu; kaydırarak sil/sessize al, aşağı çekip yenile.
3. Sohbet ekranı: geri, avatar, "çevrimiçi / son görülme X dk önce", sessize al; tarih ayırıcılar (Bugün/Dün/23 Eylül), "X okunmamış mesaj" ayırıcısı, gelen sol / giden sağ baloncuk, yazıyor göstergesi (3 nokta), yeni mesajda en alta kayma, yukarı kaydırınca eski mesajlar.
   - Baloncuk: tıklanabilir linkler, resim → tam ekran görüntüleyici, dosya (ad/boyut/indir), ses (oynat/durdur/ilerleme/süre), yanıt alıntısı, emoji tepkileri + sayı, tik durumu (gönderildi / iletildi / okundu mavi).
   - Uzun basış menüsü (alttan açılır): Yanıtla, Tepki, Kopyala, Sil.
   - Yazma alanı: 5 satıra kadar büyür, emoji seçici, ataç (resim/dosya/kamera), basılı tut ses kaydı, yazıyor bildirimi (1 sn), yanıt önizlemesi.
4. Yeni sohbet: isim/e-posta ile arama, avatar/rol/çevrimiçi, seçilenler çip olarak, "Sohbet Başlat" (2+ kişi seçilirse grup adı).
5. Profil: avatar değiştirme, isim, rol, durum (Çevrimiçi / Rahatsız Etme / Görünmez), bildirim ayarları, çıkış.
- Tablet/yatay ekran: solda liste, sağda sohbet (WhatsApp Web gibi).
- Karanlık mod otomatik; "Çevrimdışı" şeridi ve son 50 mesaj cihazda önbellekte.

## Bildirimler
- Uygulama açıkken: sayfa içi bildirim + sekme başlığında okunmamış sayısı.
- Uygulama kapalıyken: tarayıcı bildirimi (izin verilirse; iPhone'da ana ekrana eklenmiş olması gerekir). Tıklayınca ilgili sohbet açılır. Sessize alınan sohbetler bildirim göndermez.

## Tasarım
- Başlık: Mefticaret ana rengi; giden baloncuk açık yeşil, gelen beyaz, sohbet arka planı bej desen; karanlık modda koyu karşılıkları. Hepsi tema renkleri olarak tanımlanır.
- Mesaj 16px, saat 11px %60 opaklık, önizleme 14px tek satır.
- Animasyonlar: gönderimde aşağıdan kayarak belirme, tik renk geçişi, 3 nokta zıplama; hareket azaltma ayarına uyar.

## Güvenlik
- Mesajları yalnız sohbetin üyeleri görür/yazar; mağaza bazında izole.
- Medya özel depoda, 24 saat geçerli imzalı bağlantılarla; dosya türü/boyut sınırı (resim 10MB, dosya 25MB, ses 5 dk).
- Silme yalnız kendi mesajı için ("Bu mesaj silindi" olarak kalır).
- Mesaj metni uzunluk sınırı ve kötüye kullanıma karşı hız sınırı.
- Özellik anahtarı `module_chat` — varsayılan kapalı, Süper Admin açar.

## Kapsam dışı (açıkça)
- Yerel iOS/Android (App Store/Play Store) uygulaması ve parmak izi kilidi.
- Sesli/görüntülü arama.
- Uçtan uca şifreleme.

## Teknik detaylar
- Tablolar (ek, mevcutlara dokunulmaz): `chat_conversations` (store_id nullable, type direct/group/support, title), `chat_participants` (role, muted_until, last_read_at, archived), `chat_messages` (kind text/image/file/audio, reply_to_id, deleted_at, attachment path/meta), `chat_reactions`, `chat_presence` (status, last_seen_at), `chat_push_subscriptions`. GRANT + RLS: üyelik kontrolü `app_private` security definer yardımcısı ile (özyinelemesiz).
- Anlık katman: veritabanı değişiklik yayını (yeni/silinen mesaj, okundu) + yayın kanalı (yazıyor) + presence kanalı (çevrimiçi). Kanal adları `chat:{conversationId}`, erişim RLS ile.
- Uygun kullanıcı arama: sunucu işlemi, yetki kapsamına göre (mağaza üyeleri, o mağazanın müşterileri, platform yöneticileri).
- Liste/mesajlar TanStack Query; mesajlarda imleçli sayfalama + sanal liste; durum Zustand yerine küçük React context.
- Depo: özel `chat-media` kovası, yol `{conversationId}/{uuid}`; imzalı URL sunucuda.
- Ses kaydı MediaRecorder, emoji seçici hafif paket; manifest ile ana ekrana ekleme; kapalıyken bildirim için web push service worker (yalnız yayınlanmış sitede kaydedilir, önizlemede kapalı).
- Uygulama adımları: 1) tablolar/RLS/depo, 2) liste + sohbet + gönderme + anlık, 3) medya/ses/tepki/yanıt/silme, 4) yeni sohbet/grup/profil/durum, 5) tablet düzeni, çevrimdışı önbellek, bildirimler, 390px ve tablet testleri.
