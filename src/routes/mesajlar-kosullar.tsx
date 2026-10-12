import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/mesajlar-kosullar")({
  head: () => ({
    meta: [
      { title: "Kullanım Koşulları — Mefticaret Chat" },
      { name: "description", content: "Mefticaret Chat mesajlaşma uygulamasının kullanım koşulları ve topluluk kuralları." },
      { property: "og:title", content: "Kullanım Koşulları — Mefticaret Chat" },
      { property: "og:description", content: "Mefticaret Chat'i kullanırken uymanız gereken kurallar." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://mefticaret.com/mesajlar-kosullar" }],
  }),
  component: () => (
    <article className="mx-auto max-w-2xl space-y-4 px-5 py-10 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold">Mefticaret Chat Kullanım Koşulları</h1>
      <p className="text-muted-foreground">Son güncelleme: 26 Eylül 2026</p>
      <p>Mefticaret Chat, Mefticaret satıcıları, müşterileri ve destek ekibi arasında iletişim için sunulur. Uygulamayı kullanarak aşağıdaki kuralları kabul edersiniz.</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Spam, taciz, hakaret, dolandırıcılık ve yasa dışı içerik paylaşmak yasaktır.</li>
        <li>Başkasının kişisel verilerini izinsiz paylaşamazsınız.</li>
        <li>Şikayet edilen mesajlar moderasyon ekibince incelenir; kuralları ihlal eden hesaplar kısıtlanabilir veya kapatılabilir.</li>
        <li>Kötüye kullanımı önlemek için mesaj ve sohbet başlatma sayıları sınırlandırılır.</li>
        <li>Hesabınızı dilediğiniz an Profil → KVKK bölümünden silebilirsiniz.</li>
      </ul>
      <Link to="/mesajlar-giris" className="inline-block underline">Uygulamaya dön</Link>
    </article>
  ),
});
