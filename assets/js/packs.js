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
  // The pointers a scheme shows (Mouse Properties → Pointers): 'xp', 'system' or a pack's cursors.
  const schemeCursors = (scheme, pack) => scheme === 'xp' ? Object.fromEntries(Object.entries(XP_CURSORS).map(([kind, [file, x, y]]) => [kind, { url: new URL(`assets/cursors/${file}`, document.baseURI).href, x, y }])) : scheme === 'system' ? {} : pack || {};
  window.nkPacks = { applyCursors, applyIcons, schemeCursors, CURSORS: Object.keys(CURSORS), ICONS: Object.keys(ICONS) };
})();
