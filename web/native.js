// window.NekoNative for the browser: the interface host.js uses on Android and iPhone,
// implemented in JavaScript. Themes go to web/themes.js; notifications use the service worker
// (Android Chrome allows notifications only through it) or the Notification API.
(() => {
  const themes = window.NekoThemes;
  const methods = {
    'theme:list': () => themes.listThemes(),
    'theme:current': async () => { await themes.ready(); return themes.activeTheme; },
    'theme:preview': (id, scheme) => themes.previewTheme(String(id || ''), scheme || undefined),
    'theme:apply': (id, scheme) => themes.activateTheme(String(id || ''), scheme || undefined),
    'theme:remove': id => themes.removeTheme(String(id || '')),
    'theme:import': () => themes.importTheme(),
    'theme:browser-list': () => themes.fetchCatalog(),
    'theme:browser-details': id => themes.fetchCatalogThemeDetails(String(id || '')),
    'theme:browser-install': id => themes.installCatalogTheme(String(id || '')),
    'display:current': async () => { await themes.ready(); return themes.activeDisplay; },
    'display:apply': settings => themes.saveDisplaySettings(settings || {}),
    'backup:export-themes': () => themes.exportThemeFiles(),
    'backup:restore-themes': archive => themes.restoreThemeFiles(String(archive || '')),
    'pack:catalog': () => themes.fetchCatalogPacks(),
    'pack:install': id => themes.installCatalogPack(String(id || '')),
    'pack:list': () => themes.listPacks(),
    'pack:remove': id => themes.removePack(String(id || '')),
  };

  const icon = new URL('icons/icon-192.png', location.href).href;
  const callTag = 'nekochat-call';
  async function showNotification(title, options) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const registration = await navigator.serviceWorker?.getRegistration().catch(() => null);
    if (registration) { await registration.showNotification(title, options); return; }
    const notification = new Notification(title, options);
    notification.onclick = () => { window.focus(); notification.close(); };
  }

  window.NekoNative = {
    call(id, method, argsJson) {
      const handler = methods[method];
      Promise.resolve()
        .then(() => { if (!handler) throw new Error(`Unknown method ${method}`); return handler(...JSON.parse(argsJson)); })
        .then(payload => window.NKHost.resolveNative(id, true, JSON.stringify(payload ?? null)))
        .catch(error => window.NKHost.resolveNative(id, false, String(error?.message || error)));
    },
    notifyMessage(sender, content, avatarUrl) {
      showNotification('Nekochat Reloaded', { body: `${sender}\n${content}`, icon: avatarUrl || icon, badge: icon }).catch(() => {});
    },
    notifyCall(title, status) {
      showNotification(title, { body: status, icon, badge: icon, tag: callTag, renotify: true, requireInteraction: true }).catch(() => {});
    },
    cancelCall() {
      navigator.serviceWorker?.getRegistration().then(registration => registration?.getNotifications({ tag: callTag })).then(list => list?.forEach(item => item.close())).catch(() => {});
    },
    requestNotifications() {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    },
    isForeground: () => document.visibilityState === 'visible' && document.hasFocus(),
    // A page cannot hide itself or quit.
    moveToBack() {},
    quit() {},
    stopScreenCapture() {},
  };
})();
