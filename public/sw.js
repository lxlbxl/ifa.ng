/* IFA.ng service worker: offline app shell + push. Bump VERSION to invalidate caches. */
const VERSION = "v1";
const SHELL_CACHE = `ifa-shell-${VERSION}`;
const ASSET_CACHE = `ifa-assets-${VERSION}`;
const SHELL_URLS = ["/", "/offline.html", "/manifest.webmanifest", "/brand/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL_CACHE, ASSET_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never cache API, auth, payment or video traffic, or any cross-origin request.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/functions/") || url.pathname.startsWith("/auth/v1")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(async () => (await caches.match("/")) || caches.match("/offline.html"))
    );
    return;
  }

  // Hashed build assets and icons: cache-first with background refresh
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/brand/")) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res.ok) caches.open(ASSET_CACHE).then((c) => c.put(req, res.clone()));
          return res;
        });
        return hit || net;
      })
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || "IFA.ng", {
      body: data.body || "",
      icon: "/brand/icon-192.png",
      badge: "/brand/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) { w.navigate(target); return w.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});
