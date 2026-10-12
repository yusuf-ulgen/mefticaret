import { useEffect, useState } from "react";

/** Keep the mounted editor intact; a release must never silently discard its draft. */
export function ChunkRecovery() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const recover = (event: Event) => {
      event.preventDefault();
      setFailed(true);
    };
    window.addEventListener("vite:preloadError", recover);
    return () => window.removeEventListener("vite:preloadError", recover);
  }, []);
  if (!failed) return null;
  return (
    <aside
      role="alert"
      className="fixed bottom-4 left-4 right-4 z-[100] rounded-lg border bg-background p-4 shadow-lg"
    >
      <p>
        Yeni sayfa dosyası yüklenemedi. Mevcut ekranınız açık tutuldu. Kaydedilmemiş çalışmanızı
        kaydedin veya kopyalayın; ardından sayfayı yenileyin.
      </p>
      <button type="button" className="mt-2 underline" onClick={() => window.location.reload()}>
        Kaydettim, sayfayı yenile
      </button>
      <button type="button" className="ml-4 underline" onClick={() => setFailed(false)}>
        Çalışmaya devam et
      </button>
    </aside>
  );
}
