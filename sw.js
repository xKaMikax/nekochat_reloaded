// Service worker: lets the installed app start offline and shows notifications.
// App files are fetched from the network first (so updates arrive right away) and fall back
// to the cached copy offline. The chat server and other origins are never cached.
const CACHE = 'nekochat-web-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'web/host.css', 'web/host.js', 'web/native.js', 'web/themes.js', 'web/aero-css.js', 'icons/icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
    return response;
  }).catch(() => caches.match(request, { ignoreSearch: true }).then(cached => cached || Response.error())));
});
// Clicking a notification opens (or focuses) the app.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const open = windows.find(client => client.url.startsWith(self.registration.scope));
    return open ? open.focus() : self.clients.openWindow(self.registration.scope);
  }));
});
