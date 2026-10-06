// Watching a game (a spectator): the game of the add-on runs in a frame, fed with the public log of the game.
// The add-ons already replay an ordered log of entries (a window that opens late catches up that way); here the
// log comes from the server's /watch/<id> instead of the chat window, and nobody can move: the spectator is a
// user id no player has. The page plays the part of the host page of the web client (window.NKHost).
(() => {
  const APP = '/app/';
  const params = new URLSearchParams(location.search);
  const watchId = params.get('id') || '';
  const ru = document.documentElement.lang === 'ru';
  const home = ru ? '/ru/games.html' : '/games.html';
  const T = ru
    ? { loading: 'Загрузка игры…', gone: 'Эта игра уже закончилась или не существует.', back: 'К списку игр', ended: 'Игра закончилась.', live: 'Идёт игра', watching: 'Смотрят', players: 'Игроки', error: 'Не удалось показать игру.', noaddon: 'Для этой игры пока нельзя смотреть партию.' }
    : { loading: 'Loading the game…', gone: 'This game is over or does not exist.', back: 'Back to the games', ended: 'The game is over.', live: 'The game is on', watching: 'Watching', players: 'Players', error: 'The game could not be shown.', noaddon: 'This game cannot be watched yet.' };
  const $ = id => document.getElementById(id);
  // the other language's page keeps the game
  document.querySelectorAll('.nav a[href*="watch.html"], .nav a[href="/ru/"], .nav a[href="/"]').forEach(link => { if (/watch\.html$/.test(link.getAttribute('href'))) link.href += location.search; });
  const status = text => { $('watch-status').textContent = text; };
  const MIME = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', wav: 'audio/wav', mp3: 'audio/mpeg', css: 'text/css', js: 'text/javascript', json: 'application/json', html: 'text/html', wasm: 'application/wasm' };
  const mime = name => MIME[name.split('.').pop().toLowerCase()] || 'application/octet-stream';
  const baseName = target => decodeURIComponent(String(target).split('?')[0].split('#')[0].split('/').pop());

  // ---- the XP theme of the add-on's window (Luna, like the client's default) ------------------------------
  async function lunaCss() {
    const directory = new URL(`${APP}prebuilt/Luna/schemes/blue/`, location.href);
    const response = await fetch(new URL('theme.css', directory));
    if (!response.ok) return '';
    const css = (await response.text()).replace(/url\("([^"]+)"\)/g, (match, target) => /^(data|https?|blob):/i.test(target) ? match : `url("${new URL(baseName(target), directory).href}")`);
    return URL.createObjectURL(new Blob([css], { type: 'text/css' }));
  }

  // ---- the host page's part: what an add-on asks of window.windowControls ------------------------------
  let theme = null;
  const controls = new Proxy({
    close: () => { location.href = home; },
    minimize: () => {}, maximize: () => {}, setWindowMeta: () => {},
    getActiveTheme: () => Promise.resolve(theme),
    getDisplaySettings: () => Promise.resolve({ language: ru ? 'ru' : 'en', loginUi: 'xp', micDeviceId: '' }),
    getUpdateInfo: () => Promise.resolve({ mode: 'reload', platform: 'web' }),
  }, {
    get: (target, name) => name in target ? target[name]
      : /^on[A-Z]/.test(String(name)) ? () => {}
      : /^list/.test(String(name)) ? () => Promise.resolve([])
      : () => Promise.resolve(null),
  });
  window.NKHost = { controlsFor: () => controls, focusFrom: () => {}, requestNotifications: () => {}, moveBy: () => {} };

  // ---- the log ---------------------------------------------------------------------------------------------
  const key = `nk_game_log:${watchId}`;
  const log = { host: 0, entries: [], ended: false };
  let lastSeq = 0;
  const store = () => { try { localStorage.setItem(key, JSON.stringify(log)); } catch {} };
  function addEntries(data) {
    log.host = Number(data.host) || log.host;
    for (const entry of data.entries || []) { if (entry.seq > lastSeq) { log.entries.push(entry); lastSeq = entry.seq; } }
    if (data.closed) log.ended = true;
    store();
    const names = new Map();
    if (data.host) names.set(data.host, data.hostName || '');
    for (const entry of log.entries) if (entry.name) names.set(entry.from, entry.name);
    $('watch-players').textContent = [...names.values()].filter(Boolean).join(', ') || '-';
    $('watch-count').textContent = String(data.watching ?? '');
  }
  async function fetchLog(wait) {
    const response = await fetch(`/watch/${encodeURIComponent(watchId)}?since=${lastSeq}${wait ? `&wait=${wait}` : ''}`);
    if (response.status === 404) throw Object.assign(new Error('gone'), { gone: true });
    if (!response.ok) throw new Error(`status ${response.status}`);
    return response.json();
  }

  // ---- the add-on: its files from the catalog, filled in like the web client's host does -----------------
  async function openAddon(game) {
    const where = await fetch(`/watch-files/${encodeURIComponent(game)}`);
    if (!where.ok) throw Object.assign(new Error('noaddon'), { noaddon: true });
    const { raw, dir, files } = await where.json();
    const own = {};
    const bodies = {};
    await Promise.all(files.map(async name => {
      const response = await fetch(`${raw}/${encodeURI(dir)}/${encodeURI(name)}`);
      if (!response.ok) return;
      bodies[name] = await response.blob();
    }));
    const info = JSON.parse(await bodies['addon.json'].text());
    const BRIDGE = `<script src="${APP}assets/js/web-bridge.js"></script><link rel="stylesheet" href="${APP}assets/css/web.css">`;
    const processed = {};
    const fill = text => text.replace(/\{\{APP\}\}/g, new URL(APP, location.href).href).replace(/\{\{BRIDGE\}\}/g, BRIDGE).replace(/\{\{ADDON\}\}([\w.-]+)/g, (_, name) => processed[name] || own[name] || '');
    for (const [name, blob] of Object.entries(bodies)) if (!/\.css$/i.test(name)) own[name] = URL.createObjectURL(new Blob([blob], { type: mime(name) }));
    for (const [name, blob] of Object.entries(bodies)) if (/\.css$/i.test(name)) processed[name] = URL.createObjectURL(new Blob([fill(await blob.text())], { type: 'text/css' }));
    const urls = { ...own, ...processed };
    const entry = String(info.entry || 'index.html');
    const html = fill(await bodies[entry].text()).replace(/<head>/i, `<head><script>window.NK_ADDON = ${JSON.stringify({ id: String(info.id || game), files: urls }).replace(/</g, '\\u003c')};</script>`);
    const size = info.window || {};
    const frame = $('watch-frame');
    frame.width = size.width || 720; frame.height = size.height || 560;
    $('watch-title').textContent = (info.name && (info.name[ru ? 'ru' : 'en'] || info.name.en)) || game;
    const hash = new URLSearchParams({ session: watchId, me: '-1', name: '', host: '0', hostName: '', chat: '' }).toString();
    frame.src = `${URL.createObjectURL(new Blob([html], { type: 'text/html' }))}#${hash}`;
    $('watch-stage').hidden = false;
  }

  // ---- Pinball: everybody plays at their own table at once. The add-on draws the other players' balls over its table
  // (it reads the latest "live" entry of each player from nk_game_live:<session>); here the server's latest ones are written there.
  function feedLive(data) {
    for (const [id, item] of Object.entries(data.live || {})) {
      const { name, ...payload } = item;
      try { localStorage.setItem(`nk_game_live:${watchId}`, JSON.stringify({ from: Number(id), name, payload, t: Date.now(), r: Math.random() })); } catch {}
    }
  }

  async function main() {
    if (!/^[\w-]{4,40}$/.test(watchId)) { status(T.gone); return; }
    status(T.loading);
    try {
      theme = { id: 'Luna', scheme: 'blue', revision: 1, cssUrl: await lunaCss() };
      const first = await fetchLog(0);
      addEntries(first);
      const pinball = first.game === 'pinball';
      await openAddon(first.game);
      if (pinball) { $('watch-shield').hidden = false; feedLive(first); }
      status(first.closed ? T.ended : T.live);
      if (first.closed) return;
      for (;;) {
        let data;
        try { data = pinball ? (await new Promise(resolve => setTimeout(resolve, 600)), await fetchLog(0)) : await fetchLog(15); } catch (error) { if (error.gone) { log.ended = true; store(); status(T.ended); return; } await new Promise(resolve => setTimeout(resolve, 3000)); continue; }
        addEntries(data);
        if (pinball) feedLive(data);
        if (data.closed) { status(T.ended); return; }
        status(T.live);
      }
    } catch (error) {
      status(error.gone ? T.gone : error.noaddon ? T.noaddon : T.error);
      console.warn(error);
      if (params.get('debug')) status(`${error.message}\n${error.stack || ''}`.slice(0, 600));
    }
  }
  main();
})();
