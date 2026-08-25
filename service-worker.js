const ICON = "/assets/brand/icon-192.png";
const BADGE = "/assets/brand/favicon.png";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "IMPORTB2B", body: event.data?.text() || "Nuevo recordatorio" };
  }

  const title = payload.title || "IMPORTB2B";
  const options = {
    body: payload.body || "Nuevo recordatorio financiero",
    icon: ICON,
    badge: BADGE,
    tag: payload.tag || "importb2b",
    renotify: true,
    data: {
      url: payload.url || "/",
      payload: payload.data || {}
    }
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
        clients.forEach(client => client.postMessage({ type: "IMPORTB2B_PUSH_RECEIVED" }));
      })
    ])
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    })
  );
});
