import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/mesajlar-gizlilik")({
  head: () => ({
    meta: [
      { title: "Gizlilik Politikası — Mefticaret Chat" },
      { name: "description", content: "Mefticaret Chat mesajlaşma uygulamasının KVKK ve GDPR kapsamında kişisel veri işleme politikası." },
      { property: "og:title", content: "Gizlilik Politikası — Mefticaret Chat" },
      { property: "og:description", content: "Mefticaret Chat'te hangi verilerin neden işlendiği ve haklarınız." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://mefticaret.com/mesajlar-gizlilik" }],
  }),
  component: () => (
    <article className="mx-auto max-w-2xl space-y-4 px-5 py-10 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold">Mefticaret Chat Gizlilik Politikası</h1>
      <p className="text-muted-foreground">Son güncelleme: 26 Eylül 2026</p>
      <h2 className="text-lg font-semibold">İşlenen veriler</h2>
      <p>Ad soyad, e-posta, telefon (eşleştirme için yalnızca özetlenmiş hali), profil fotoğrafı, kullanıcı adı ve biyografi, gönderdiğiniz mesajlar ve dosyalar, çevrimiçi/son görülme bilgisi, cihaz ve oturum bilgileri.</p>
      <h2 className="text-lg font-semibold">Amaç ve hukuki sebep</h2>
      <p>Mesajlaşma hizmetinin sunulması (sözleşmenin ifası), güvenlik ve kötüye kullanımın önlenmesi (meşru menfaat) ve açık rızanız. Verileriniz reklam amacıyla üçüncü kişilere satılmaz; uygulamada kullanıcı takibi (tracking) yapılmaz.</p>
      <h2 className="text-lg font-semibold">Rehber</h2>
      <p>Rehberden bulma özelliğini kullanırsanız seçtiğiniz numaralar yalnızca eşleştirme için gönderilir, özetlenerek karşılaştırılır ve saklanmaz.</p>
      <h2 className="text-lg font-semibold">Saklama</h2>
      <p>Mesajlar hesabınız açık olduğu sürece saklanır. Hesabınızı sildiğinizde gönderdiğiniz mesajlar ve dosyalar kalıcı olarak silinir.</p>
      <h2 className="text-lg font-semibold">Haklarınız (KVKK md. 11)</h2>
      <p>Verilerinize erişme, düzeltme, silme ve itiraz haklarınız vardır. Profil → KVKK bölümünden verilerinizi indirebilir veya hesabınızı silebilirsiniz.</p>
      <h2 className="text-lg font-semibold">İletişim</h2>
      <p>Talepleriniz için Mefticaret destek ekibine uygulama içinden yazabilirsiniz.</p>
      <Link to="/mesajlar-giris" className="inline-block underline">Uygulamaya dön</Link>
    </article>
  ),
});
