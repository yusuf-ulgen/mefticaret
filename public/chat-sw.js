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
      icon: "/favicon.png",
      badge: "/favicon.png",
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
