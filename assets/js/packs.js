// Cursor, icon and sound packs (Display Properties, Theme catalog). Every window loads this file:
// it applies the chosen cursors and icons and tells which file plays a sound. The choice lives in
// localStorage as resolved URLs (nk_cursor_pack, nk_icon_pack, nk_sound_pack) so all windows,
// including Display Properties and the call window, follow it through the storage event.
(() => {
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const quote = url => `url("${String(url).replace(/["\\\n]/g, '')}")`;
  // cursors.json kinds → the elements that use them (CSS keywords as the fallback).
  const CURSORS = {
    default: 'html, body, .xp-titlebar',
    pointer: 'a, button, select, label, summary, [role="button"], .chat-item, .theme-card, input[type="checkbox"], input[type="range"], input[type="color"]',
    text: 'input:not([type="checkbox"]):not([type="range"]):not([type="button"]):not([type="color"]), textarea, [contenteditable="true"]',
    help: '[data-help]', wait: '.nk-wait', progress: '.nk-progress', 'not-allowed': 'button:disabled, [aria-disabled="true"]',
    crosshair: '.nk-crosshair', move: '.nk-move, .conversation-header:not(.detached-chat *)', 'ew-resize': '.nk-resize-ew', 'ns-resize': '.nk-resize-ns', 'nwse-resize': '.nk-resize-nwse', 'nesw-resize': '.nk-resize-nesw',
  };
  // icons.json names → where the app shows them.
  const ICONS = {
    app: ['.xp-app-icon.has-icon', 'background-image: {url} !important; background-size: 16px 16px !important;'],
    personalize: ['.profile-action-icon.icon-personalize', 'background: {url} center / 16px 16px no-repeat !important;'],
    'change-user': ['.profile-action-icon.icon-change-user, .xp-startpanel #change-user .profile-action-icon', 'background: {url} center / 16px 16px no-repeat !important;'],
    'sign-out': ['.profile-actions #logout.icon-only', 'background: {url} center / 22px 22px no-repeat, #ece9d8 !important;'],
    room: ['.chat-item[data-kind="room"] .avatar', 'font-size: 0 !important; background: {url} center / 22px 22px no-repeat, #fff !important;'],
    add: ['#add-chat', 'font-size: 0 !important; background: {url} center / 18px 18px no-repeat, #ece9d8 !important;'],
    call: ['#start-call svg', 'display: none;', '#start-call', 'background: {url} center / 20px 20px no-repeat !important;'],
    members: ['#room-members svg', 'display: none;', '#room-members', 'background: {url} center / 20px 20px no-repeat !important;'],
    notifications: ['#mute-chat svg', 'display: none;', '#mute-chat', 'background: {url} center / 20px 20px no-repeat !important;'],
  };
  function style(id) { let node = document.getElementById(id); if (!node) { node = document.createElement('style'); node.id = id; (document.head || document.documentElement).append(node); } return node; }
  // Standard Windows XP cursors (assets/cursors, PNG + hot spot) unless another scheme is chosen.
  // PNG, because Chromium mis-draws old 1-bit .cur files and falls back to the system cursor.
  const XP_CURSORS = {"default": ["default_arrow.png", 10, 10], "pointer": ["default_link.png", 10, 10], "text": ["default_ibeam.png", 6, 10], "wait": ["default_busy.png", 10, 10], "progress": ["default_wait.png", 10, 10], "not-allowed": ["default_no.png", 10, 10], "help": ["default_helpsel.png", 10, 10], "move": ["default_move.png", 10, 10], "ew-resize": ["default_size3.png", 10, 10], "ns-resize": ["default_size4.png", 10, 10], "nwse-resize": ["default_size2.png", 10, 10], "nesw-resize": ["default_size1.png", 10, 10]};
  let activeCursors = {};
  function applyCursors() {
    let scheme = 'xp'; try { scheme = localStorage.getItem('nk_cursor_scheme') || 'xp'; } catch {}
    let pack = scheme === 'xp' ? Object.fromEntries(Object.entries(XP_CURSORS).map(([kind, [file, x, y]]) => [kind, { url: new URL(`assets/cursors/${file}`, document.baseURI).href, x, y }])) : read('nk_cursor_pack') || {};
    if (scheme === 'system') pack = {};
    activeCursors = pack;
    style('nk-pack-cursors').textContent = Object.entries(CURSORS).filter(([kind]) => pack[kind]?.url)
      // .cur files carry their own hot spot; x/y only when the pack gives them (PNG cursors).
      .map(([kind, selector]) => { const { x, y } = pack[kind]; const spot = Number.isFinite(Number(x)) && Number.isFinite(Number(y)) && x !== null && y !== null && x !== undefined ? ` ${Number(x)} ${Number(y)}` : ''; return `${selector} { cursor: ${quote(pack[kind].url)}${spot}, ${kind} !important; }`; }).join('\n');
  }
  // Page and theme styles set plain cursor keywords (button { cursor: pointer }, .x { cursor: default })
  // that the rules above cannot all name, and a keyword shows the system cursor. So on hover,
  // swap a keyword the scheme has for the scheme's picture.
  const CURSOR_ALIASES = { grab: ['move', 'default'], grabbing: ['move', 'default'], 'all-scroll': ['move'], 'col-resize': ['ew-resize'], 'row-resize': ['ns-resize'], 'e-resize': ['ew-resize'], 'w-resize': ['ew-resize'], 'n-resize': ['ns-resize'], 's-resize': ['ns-resize'],
    'ne-resize': ['nesw-resize'], 'sw-resize': ['nesw-resize'], 'nw-resize': ['nwse-resize'], 'se-resize': ['nwse-resize'], 'no-drop': ['not-allowed'], cell: ['crosshair'], 'vertical-text': ['text'], 'context-menu': ['default'], alias: ['default'], copy: ['default'] };
  const swapped = new WeakMap();
  document.addEventListener('mouseover', event => {
    const element = event.target; if (!element || element.nodeType !== 1) return;
    if (swapped.has(element)) { element.style.removeProperty('cursor'); swapped.delete(element); }
    const keyword = getComputedStyle(element).cursor;
    if (keyword.includes('url(')) return;
    // Keywords XP has no picture for take the nearest one (grab: dragging a chat out of the window).
    const kind = [keyword, ...(CURSOR_ALIASES[keyword] || [])].find(name => activeCursors[name]?.url);
    if (!kind) return;
    const { url, x, y } = activeCursors[kind];
    const spot = Number.isFinite(Number(x)) && Number.isFinite(Number(y)) && x != null && y != null ? ` ${Number(x)} ${Number(y)}` : '';
    element.style.setProperty('cursor', `${quote(url)}${spot}, ${keyword}`, 'important'); swapped.set(element, kind);
  }, true);
  function applyIcons() {
    const pack = read('nk_icon_pack') || {};
    style('nk-pack-icons').textContent = Object.entries(ICONS).filter(([name]) => pack[name]).map(([name, rules]) => {
      const out = []; for (let i = 0; i < rules.length; i += 2) out.push(`${rules[i]} { ${rules[i + 1].replace('{url}', quote(pack[name]))} }`); return out.join('\n');
    }).join('\n');
  }
  const apply = () => { applyCursors(); applyIcons(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true }); else apply();
  window.addEventListener('storage', event => { if (event.key === 'nk_cursor_pack' || event.key === 'nk_cursor_scheme') applyCursors(); if (event.key === 'nk_icon_pack') applyIcons(); });
  // The file a sound plays from: the chosen sound pack, or the built-in Windows XP sounds.
  window.nkSoundUrl = (name, file) => { const pack = read('nk_sound_pack'); return pack?.[name] || `assets/sounds/${file || `${name}.wav`}`; };
  // Plays a Windows sound of the chosen scheme at the chosen volume, in any window.
  const FILES = { navigation: 'navigation.wav', notify: 'notify.wav', default: 'default.wav', error: 'error.wav', exclamation: 'exclamation.wav', critical: 'critical-stop.wav', minimize: 'minimize.wav' };
  window.nkPlaySound = name => {
    let scheme = 'xp', volume = 72; try { scheme = localStorage.getItem('nk_sound_scheme') || 'xp'; volume = Number(localStorage.getItem('nk_sound_volume') ?? 72); } catch {}
    if (scheme === 'none' || !(volume > 0)) return null;
    const audio = new Audio(window.nkSoundUrl(name, FILES[name])); audio.volume = Math.min(1, volume / 100); audio.play().catch(() => {}); return audio;
  };
  // An error shown in a window (role="alert" or an .error line) sounds like a Windows XP error.
  const errorTexts = new WeakMap();
  const watchErrors = () => new MutationObserver(records => {
    for (const record of records) {
      const node = (record.target.nodeType === 1 ? record.target : record.target.parentElement)?.closest?.('[role="alert"], .error, .ua-error, .editor-status.error');
      if (!node) continue;
      const text = node.textContent.trim(); if (text && text !== errorTexts.get(node) && (node.getAttribute('role') === 'alert' ? /error|ошибк|failed|не удалось|unable|invalid|too large/i.test(text) : true)) window.nkPlaySound('error');
      errorTexts.set(node, text);
    }
  }).observe(document.body, { childList: true, characterData: true, subtree: true });
  if (document.body) watchErrors(); else document.addEventListener('DOMContentLoaded', watchErrors, { once: true });
  // The pointers a scheme shows (Mouse Properties → Pointers): 'xp', 'system' or a pack's cursors.
  const schemeCursors = (scheme, pack) => scheme === 'xp' ? Object.fromEntries(Object.entries(XP_CURSORS).map(([kind, [file, x, y]]) => [kind, { url: new URL(`assets/cursors/${file}`, document.baseURI).href, x, y }])) : scheme === 'system' ? {} : pack || {};
  // Display → Appearance: font size, Effects… and Advanced… (nk_font_size, nk_effects,
  // nk_appearance), applied in every window.
  function applyLook() {
    const scale = { large: 1.15, xlarge: 1.3 }[(() => { try { return localStorage.getItem('nk_font_size'); } catch { return ''; } })()] || 1;
    const fx = read('nk_effects') || {}; const look = read('nk_appearance') || {};
    const css = [];
    if (scale !== 1) css.push(`.xp-body-frame, .chat-app { zoom: ${scale}; }`);
    const menus = '.message-menu, .assistant-balloon, #mention-box, .pins-popover, .cp-menu-popup, dialog[open], .status-menu, .quick-switch';
    if (fx.transition === 'fade') css.push(`@keyframes nk-fade { from { opacity: 0; } } ${menus} { animation: nk-fade .18s ease-out; }`);
    if (fx.transition === 'scroll') css.push(`@keyframes nk-scroll { from { clip-path: inset(0 0 100% 0); } } ${menus} { animation: nk-scroll .2s ease-out; }`);
    if (fx.shadows === false) css.push(`${menus} { box-shadow: none !important; }`);
    if (fx.largeIcons) css.push('.chat-item .avatar { width: 40px !important; height: 40px !important; flex-basis: 40px !important; } .message .avatar { width: 44px !important; height: 44px !important; }');
    if (fx.smoothing === 'none') css.push('html, body, button, input, textarea, select { -webkit-font-smoothing: none !important; font-smooth: never; }');
    if (fx.smoothing === 'cleartype') css.push('html, body, button, input, textarea, select { -webkit-font-smoothing: subpixel-antialiased !important; }');
    const vars = [];
    const colour = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value : '';
    if (look.title) { const [a, b] = [colour(look.title.color1), colour(look.title.color2)]; if (a) vars.push(`--xp-title-fill: linear-gradient(270deg, ${b || a} 0%, ${a} 100%)`); if (colour(look.title.text)) css.push(`.xp-title, .dialog-title { color: ${look.title.text} !important; }`); }
    if (look.inactive) { const [a, b] = [colour(look.inactive.color1), colour(look.inactive.color2)]; if (a) vars.push(`--xp-title-fill-inactive: linear-gradient(270deg, ${b || a} 0%, ${a} 100%)`); }
    if (look.window) { if (colour(look.window.color1)) vars.push(`--xp-theme-window: ${look.window.color1}`); if (colour(look.window.text)) vars.push(`--xp-theme-windowtext: ${look.window.text}`); }
    if (look.selected) { if (colour(look.selected.color1)) vars.push(`--xp-theme-highlight: ${look.selected.color1}`); if (colour(look.selected.text)) vars.push(`--xp-theme-highlighttext: ${look.selected.text}`); }
    if (look.face && colour(look.face.color1)) vars.push(`--xp-theme-buttonface: ${look.face.color1}`, `--classic-face: ${look.face.color1}`);
    if (look.message) { const size = Number(look.message.size); css.push(`.message-body { ${size >= 8 && size <= 28 ? `font-size: ${size}px !important;` : ''}${look.message.bold ? 'font-weight: bold;' : ''}${look.message.italic ? 'font-style: italic;' : ''}${colour(look.message.text) ? `color: ${look.message.text};` : ''} }`); }
    if (look.tooltip) { if (colour(look.tooltip.color1)) css.push(`.assistant-balloon { background: ${look.tooltip.color1} !important; } .assistant-balloon::before { border-top-color: ${look.tooltip.color1} !important; }`); if (colour(look.tooltip.text)) css.push(`.assistant-balloon { color: ${look.tooltip.text} !important; }`); }
    if (vars.length) css.push(`:root { ${vars.join('; ')}; }`);
    style('nk-look').textContent = css.join('\n');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyLook, { once: true }); else applyLook();
  window.addEventListener('storage', event => { if (['nk_font_size', 'nk_effects', 'nk_appearance'].includes(event.key)) applyLook(); });
  // Add-ons from the Catalog (games, the Theme Editor, the Admin Panel): installed packs with
  // addon/addon.json. Each is { packId, id, name, icon, help, files } — the same on every platform.
  let addonCache = null;
  window.nkAddons = async (fresh = false) => {
    if (addonCache && !fresh) return addonCache;
    const packs = (await (window.windowControls || window.parent?.windowControls)?.listPacks?.().catch(() => [])) || [];
    const list = [];
    for (const pack of packs) {
      const manifest = pack.files?.['addon/addon.json']; if (!manifest) continue;
      try {
        const info = await (await fetch(manifest)).json();
        list.push({ packId: pack.id, id: String(info.id || pack.id), name: info.name || { en: pack.name }, version: info.version || '', author: pack.author || info.author || '', icon: pack.files[`addon/${info.icon || 'icon.png'}`] || '', icon32: pack.files[`addon/${info.icon32 || info.icon || 'icon.png'}`] || '', help: pack.files['addon/help.json'] || '', about: info.about || null, multiplayer: info.multiplayer || null });
      } catch {}
    }
    addonCache = list; window.dispatchEvent(new Event('nk-addons-ready'));
    return list;
  };
  // Synchronous check for menus drawn on the spot (after the first nkAddons()).
  window.nkAddonList = () => addonCache || [];
  window.nkAddonInstalled = id => Boolean(addonCache?.some(addon => addon.id === id));
  window.nkHasAddon = async id => Boolean((await window.nkAddons()).find(addon => addon.id === id));
  // The Catalog says when packs change, so buttons of add-ons appear and disappear at once.
  window.addEventListener('storage', event => { if (event.key === 'nk_packs_changed') { addonCache = null; window.dispatchEvent(new Event('nk-addons-changed')); window.nkAddons(true).catch(() => {}); } });
  window.nkPacks = { applyLook, applyCursors, applyIcons, schemeCursors, CURSORS: Object.keys(CURSORS), ICONS: Object.keys(ICONS) };
})();
