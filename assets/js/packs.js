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
    crosshair: '.nk-crosshair', move: '.nk-move', 'ew-resize': '.nk-resize-ew', 'ns-resize': '.nk-resize-ns', 'nwse-resize': '.nk-resize-nwse', 'nesw-resize': '.nk-resize-nesw',
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
  // Standard Windows XP cursors (assets/cursors) unless another scheme is chosen.
  const XP_CURSORS = {"default": "default_arrow.cur", "pointer": "default_link.cur", "text": "default_ibeam.cur", "wait": "default_busy.cur", "progress": "default_wait.cur", "not-allowed": "default_no.cur", "help": "default_helpsel.cur", "move": "default_move.cur", "ew-resize": "default_size3.cur", "ns-resize": "default_size4.cur", "nwse-resize": "default_size2.cur", "nesw-resize": "default_size1.cur"};
  function applyCursors() {
    let scheme = 'xp'; try { scheme = localStorage.getItem('nk_cursor_scheme') || 'xp'; } catch {}
    let pack = scheme === 'xp' ? Object.fromEntries(Object.entries(XP_CURSORS).map(([kind, file]) => [kind, { url: new URL(`assets/cursors/${file}`, document.baseURI).href }])) : read('nk_cursor_pack') || {};
    if (scheme === 'system') pack = {};
    style('nk-pack-cursors').textContent = Object.entries(CURSORS).filter(([kind]) => pack[kind]?.url)
      // .cur files carry their own hot spot; x/y only when the pack gives them (PNG cursors).
      .map(([kind, selector]) => { const { x, y } = pack[kind]; const spot = Number.isFinite(Number(x)) && Number.isFinite(Number(y)) && x !== null && y !== null && x !== undefined ? ` ${Number(x)} ${Number(y)}` : ''; return `${selector} { cursor: ${quote(pack[kind].url)}${spot}, ${kind} !important; }`; }).join('\n');
  }
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
  window.nkPacks = { applyCursors, applyIcons, CURSORS: Object.keys(CURSORS), ICONS: Object.keys(ICONS) };
})();
