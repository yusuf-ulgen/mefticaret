/* Mefticaret Mesajlar — uygulama kapalıyken bildirim */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (_) {
    d = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(d.title || "Mefticaret Mesajlar", {
      body: d.body || "Yeni mesaj",
      tag: d.tag,
      renotify: true,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [120, 60, 120],
      data: { url: d.url || "/mesajlar" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/mesajlar";
  const target = new URL(path.startsWith("/") ? path : "/mesajlar", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).pathname.startsWith("/mesajlar") && "focus" in c) {
          return c.navigate(target).then((w) => (w || c).focus());
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

/* Çevrimdışı destek: ağ yoksa açık sayfalar için basit yedek yanıt */
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response("<meta charset=utf-8><h1 style='font-family:sans-serif'>İnternet bağlantısı yok</h1><p>Bağlantı gelince tekrar deneyin.</p>", { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
