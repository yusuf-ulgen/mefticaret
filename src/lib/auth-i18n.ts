import type { DocumentLocale } from "./document-locale";
const rows: Array<[string, string, string, string, string]> = [
  ["Seçilen paket", "Selected plan", "Gewähltes Paket", "Offre choisie", "الباقة المختارة"],
  ["Aylık", "Monthly", "Monatlich", "Mensuel", "شهري"],
  ["Yıllık", "Yearly", "Jährlich", "Annuel", "سنوي"],
  [
    "Panel Girişi — Mefticaret",
    "Panel sign in — Mefticaret",
    "Panel-Anmeldung — Mefticaret",
    "Connexion au panneau — Mefticaret",
    "تسجيل الدخول — Mefticaret",
  ],
  [
    "Mağaza panelinize erişin",
    "Access your store panel",
    "Öffnen Sie Ihr Shop-Panel",
    "Accédez au panneau de votre boutique",
    "الوصول إلى لوحة متجرك",
  ],
  [
    "Ücretsiz hesabınızı oluşturun",
    "Create your free account",
    "Erstellen Sie Ihr kostenloses Konto",
    "Créez votre compte gratuit",
    "إنشاء حسابك المجاني",
  ],
  ["Giriş yap", "Sign in", "Anmelden", "Se connecter", "تسجيل الدخول"],
  ["Kayıt ol", "Register", "Registrieren", "Créer un compte", "إنشاء حساب"],
  ["Ad Soyad", "Full name", "Vollständiger Name", "Nom complet", "الاسم الكامل"],
  [
    "Adınız Soyadınız",
    "Your full name",
    "Ihr vollständiger Name",
    "Votre nom complet",
    "اسمك الكامل",
  ],
  ["E-posta Adresi", "Email address", "E-Mail-Adresse", "Adresse e-mail", "البريد الإلكتروني"],
  ["E-posta", "Email", "E-Mail", "E-mail", "البريد الإلكتروني"],
  ["Şifre", "Password", "Passwort", "Mot de passe", "كلمة المرور"],
  [
    "Şifreyi gizle",
    "Hide password",
    "Passwort ausblenden",
    "Masquer le mot de passe",
    "إخفاء كلمة المرور",
  ],
  [
    "Şifreyi göster",
    "Show password",
    "Passwort anzeigen",
    "Afficher le mot de passe",
    "إظهار كلمة المرور",
  ],
  [
    "Şifremi unuttum",
    "Forgot password",
    "Passwort vergessen",
    "Mot de passe oublié",
    "نسيت كلمة المرور",
  ],
  [
    "En az 8 karakter kullan.",
    "Use at least 8 characters.",
    "Verwenden Sie mindestens 8 Zeichen.",
    "Utilisez au moins 8 caractères.",
    "استخدم 8 أحرف على الأقل.",
  ],
  [
    "Lütfen bekleyin...",
    "Please wait...",
    "Bitte warten...",
    "Veuillez patienter...",
    "يرجى الانتظار...",
  ],
  ["Devam Et", "Continue", "Weiter", "Continuer", "متابعة"],
  [
    "Hesabımı oluştur",
    "Create my account",
    "Mein Konto erstellen",
    "Créer mon compte",
    "إنشاء حسابي",
  ],
  ["veya", "or", "oder", "ou", "أو"],
  [
    "Google ile devam et",
    "Continue with Google",
    "Mit Google fortfahren",
    "Continuer avec Google",
    "المتابعة باستخدام Google",
  ],
  [
    "Henüz hesabınız yok mu?",
    "Don't have an account?",
    "Noch kein Konto?",
    "Vous n'avez pas de compte ?",
    "ليس لديك حساب؟",
  ],
  ["Kayıt Olun", "Register", "Registrieren", "Créer un compte", "إنشاء حساب"],
  [
    "Hesabınız var mı?",
    "Already have an account?",
    "Bereits ein Konto?",
    "Vous avez déjà un compte ?",
    "لديك حساب بالفعل؟",
  ],
  ["Giriş Yapın", "Sign in", "Anmelden", "Se connecter", "تسجيل الدخول"],
  [
    "E-posta veya şifre hatalı",
    "Incorrect email or password",
    "E-Mail oder Passwort falsch",
    "E-mail ou mot de passe incorrect",
    "البريد الإلكتروني أو كلمة المرور غير صحيحة",
  ],
  ["Hoş geldin!", "Welcome!", "Willkommen!", "Bienvenue !", "مرحباً!"],
  [
    "Hesabın hazır, ilk mağazanı kuralım.",
    "Your account is ready. Let's set up your store.",
    "Ihr Konto ist bereit. Richten wir Ihren Shop ein.",
    "Votre compte est prêt. Configurons votre boutique.",
    "حسابك جاهز. لننشئ متجرك.",
  ],
  [
    "Hesabını doğrulamak için e-postanı kontrol et.",
    "Check your email to verify your account.",
    "Prüfen Sie Ihre E-Mails, um Ihr Konto zu bestätigen.",
    "Consultez votre e-mail pour vérifier votre compte.",
    "تحقق من بريدك الإلكتروني لتأكيد حسابك.",
  ],
  [
    "Google ile giriş başarısız oldu",
    "Google sign in failed",
    "Google-Anmeldung fehlgeschlagen",
    "La connexion Google a échoué",
    "فشل تسجيل الدخول باستخدام Google",
  ],
  [
    "Panelini seç",
    "Choose your panel",
    "Panel auswählen",
    "Choisissez votre panneau",
    "اختر لوحتك",
  ],
  [
    "Kurumsal mağazalarım",
    "My business stores",
    "Meine Unternehmensshops",
    "Mes boutiques professionnelles",
    "متاجري التجارية",
  ],
  ["Tekrar dene", "Try again", "Erneut versuchen", "Réessayer", "حاول مجدداً"],
  [
    "Şifreni sıfırla",
    "Reset your password",
    "Passwort zurücksetzen",
    "Réinitialisez votre mot de passe",
    "إعادة تعيين كلمة المرور",
  ],
  [
    "Hesabına bağlı e-posta adresini gir; şifre yenileme bağlantısını gönderelim.",
    "Enter your account email to receive a password reset link.",
    "Geben Sie Ihre E-Mail für den Link zum Zurücksetzen ein.",
    "Saisissez votre e-mail pour recevoir un lien de réinitialisation.",
    "أدخل بريد حسابك لتلقي رابط إعادة تعيين كلمة المرور.",
  ],
  ["Bağlantı gönderildi", "Link sent", "Link gesendet", "Lien envoyé", "تم إرسال الرابط"],
  ["Gönderiliyor...", "Sending...", "Wird gesendet...", "Envoi...", "جارٍ الإرسال..."],
  [
    "Sıfırlama bağlantısı gönder",
    "Send reset link",
    "Link senden",
    "Envoyer le lien",
    "إرسال رابط إعادة التعيين",
  ],
  [
    "Girişe dön",
    "Back to sign in",
    "Zurück zur Anmeldung",
    "Retour à la connexion",
    "العودة لتسجيل الدخول",
  ],
  [
    "Sıfırlama bağlantısı gönderildi.",
    "Reset link sent.",
    "Link zum Zurücksetzen gesendet.",
    "Lien de réinitialisation envoyé.",
    "تم إرسال رابط إعادة التعيين.",
  ],
  [
    "KVKK & GDPR uyumlu • Rol bazlı erişim • Denetim kayıtları",
    "Privacy controls • Role-based access • Audit records",
    "Datenschutz • Rollenbasierter Zugriff • Prüfprotokolle",
    "Confidentialité • Accès par rôle • Journal d'audit",
    "الخصوصية • صلاحيات حسب الدور • سجلات التدقيق",
  ],
];
export function authText(locale: DocumentLocale, text: string) {
  if (locale === "tr") return text;
  const index = { en: 1, de: 2, fr: 3, ar: 4 }[locale];
  return rows.find((row) => row[0] === text)?.[index] ?? text;
}
export function withLocale(path: string, locale: DocumentLocale) {
  const url = new URL(path, "https://local.invalid");
  if (url.origin !== "https://local.invalid") return path;
  url.searchParams.set("locale", locale);
  return `${url.pathname}${url.search}${url.hash}`;
}
export function safeAuthNext(next: string | undefined) {
  if (!next?.startsWith("/")) return "/stores";
  const url = new URL(next, "https://local.invalid");
  return url.origin === "https://local.invalid"
    ? `${url.pathname}${url.search}${url.hash}`
    : "/stores";
}
