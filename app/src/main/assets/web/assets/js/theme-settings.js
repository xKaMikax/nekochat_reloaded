const $ = selector => document.querySelector(selector);
const controls = window.windowControls;
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[char]);
let themeMetadata = [];
let previewTheme;
function refreshSchemes(selected) {
  const theme = themeMetadata.find(item => item.id === $('#theme-list').value);
  const schemes = theme?.schemes || [{ id: 'default', name: 'Default' }];
  $('#colour-scheme').innerHTML = schemes.map(scheme => `<option value="${esc(scheme.id)}">${esc(scheme.name)}</option>`).join('');
  if (selected && schemes.some(scheme => scheme.id === selected)) $('#colour-scheme').value = selected;
  $('#windows-style').innerHTML = `<option>${esc(theme?.name || 'Windows style')}</option>`;
}
async function refreshThemes() {
  themeMetadata = await controls.listThemes();
  $('#theme-list').innerHTML = themeMetadata.map(theme => `<option value="${esc(theme.id)}">${esc(theme.name)}</option>`).join('');
  const active = localStorage.getItem('nk_active_theme');
  if (active && [...$('#theme-list').options].some(option => option.value === active)) $('#theme-list').value = active;
  refreshSchemes(localStorage.getItem('nk_active_scheme'));
}
async function refreshMicDevices(selected) {
  try {
    let devices = await navigator.mediaDevices.enumerateDevices();
    if (devices.some(device => device.kind === 'audioinput' && !device.label)) {
      try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach(track => track.stop()); devices = await navigator.mediaDevices.enumerateDevices(); } catch {}
    }
    const mics = devices.filter(device => device.kind === 'audioinput');
    $('#mic-device').innerHTML = '<option value="">Default</option>' + mics.map((device, index) => `<option value="${esc(device.deviceId)}">${esc(device.label || `Microphone ${index + 1}`)}</option>`).join('');
    if (selected && mics.some(device => device.deviceId === selected)) $('#mic-device').value = selected;
  } catch (error) { $('#mic-device').innerHTML = '<option value="">Default</option>'; }
}
// The theme's XP trackbar skins the sliders only when the theme has one (not Classic).
function refreshSliderSkin() { const style = getComputedStyle(document.documentElement); document.documentElement.classList.toggle('xp-sliders', style.getPropertyValue('--xp-slider-thumb').trim() !== ''); document.documentElement.classList.toggle('xp-checkboxes', style.getPropertyValue('--xp-checkbox-checked').trim() !== ''); }
// The stylesheet's load event is not reliable for file:// links, so check again shortly after.
function refreshFrame(theme) {
  if (theme?.cssUrl) document.querySelector('#frame-theme').href = theme.cssUrl;
  [0, 150, 500, 1500].forEach(delay => setTimeout(refreshSliderSkin, delay));
}
function refreshPreview(theme) { previewTheme = theme; document.querySelectorAll('iframe[src="assets/html/theme_preview.html"]').forEach(frame => frame.contentWindow?.postMessage({ type: 'theme-preview', theme }, '*')); }
document.querySelectorAll('iframe[src="assets/html/theme_preview.html"]').forEach(frame => frame.addEventListener('load', () => { if (previewTheme) frame.contentWindow.postMessage({ type: 'theme-preview', theme: previewTheme }, '*'); }));
async function applySelection() {
  const result = await controls.applyTheme($('#theme-list').value, $('#colour-scheme').value);
  await controls.applyDisplaySettings({ language: $('#display-language').value, loginUi: $('#login-ui').value, micDeviceId: $('#mic-device').value, noiseSuppression: $('#noise-suppression').value, ...(controls.dnsSupported ? { dns: $('#dns-provider').value, dnsCustom: $('#dns-custom').value.trim() } : {}) });
  // Per device, like the active theme: the chat window reads it when screen sharing starts.
  localStorage.setItem('nk_screen_codec', $('#screen-codec').value);
  // Companion server that syncs settings and read state between devices (empty = off).
  { const url = $('#reloaded-server').value.trim(); if (url && !/^https?:\/\//i.test(url)) throw new Error('The Nekochat Reloaded server address must start with http:// or https://'); localStorage.setItem('nk_reloaded_server', url.replace(/\/$/, '')); }
  // Empty address = the public server; the check box turns the companion off altogether.
  localStorage.setItem('nk_reloaded_enabled', $('#reloaded-enabled').checked ? '1' : '0');
  localStorage.setItem('nk_show_admin_button', $('#show-admin-button').checked ? '1' : '0');
  localStorage.setItem('nk_media_socket', $('#media-socket').checked ? '1' : '0');
  localStorage.setItem('nk_hide_last_seen', $('#show-last-seen').checked ? '0' : '1');
  localStorage.setItem('nk_auto_away_minutes', $('#auto-away').value);
  localStorage.setItem('nk_update_auto', $('#update-auto').checked ? '1' : '0');
  // Automatic Updates applet: the four XP choices (nekochat.js updatePolicy()).
  const updateChoice = document.querySelector('[name="update-mode"]:checked')?.value;
  if (updateChoice) { localStorage.setItem('nk_update_mode', updateChoice); localStorage.setItem('nk_update_auto', updateChoice === 'off' ? '0' : '1'); }
  else localStorage.setItem('nk_update_mode', $('#update-auto').checked ? (localStorage.getItem('nk_update_mode') || 'notify').replace('off', 'notify') : 'off');
  localStorage.setItem('nk_update_beta', $('#update-beta').checked ? '1' : '0');
  localStorage.setItem('nk_sound_scheme', $('#sound-scheme').value);
  applyPackChoices();
  localStorage.setItem('nk_sound_volume', $('#sound-volume').value);
  localStorage.setItem('nk_chat_wallpaper_opacity', $('#chat-wallpaper-opacity').value);
  saveWallpaper();
  localStorage.setItem('nk_active_theme', result.id);
  localStorage.setItem('nk_active_scheme', result.scheme || '');
  refreshFrame(result);
}
// ---- Packs (cursors, sounds, icons) from the catalog; the choice is stored with resolved URLs
// so every window applies it (assets/js/packs.js).
let packs = [];
const packOption = pack => `<option value="pack:${esc(pack.id)}">${esc(pack.name)}${pack.author ? ` — ${esc(pack.author)}` : ''}</option>`;
async function refreshPacks() {
  try { packs = (await controls.listPacks?.()) || []; } catch { packs = []; }
  const fill = (select, builtIn, part, stored, fallback) => {
    select.innerHTML = builtIn + packs.filter(pack => Object.keys(pack[part] || {}).length).map(packOption).join('');
    const value = localStorage.getItem(stored) || fallback;
    select.value = [...select.options].some(option => option.value === value) ? value : fallback;
  };
  fill($('#sound-scheme'), '<option value="xp">Windows XP (default)</option><option value="none">No sounds</option>', 'sounds', 'nk_sound_scheme', 'xp');
  fill($('#cursor-scheme'), '<option value="xp">Windows XP (default)</option><option value="system">System</option>', 'cursors', 'nk_cursor_scheme', 'xp');
  fill($('#icon-scheme'), '<option value="default">Nekochat Reloaded (default)</option>', 'icons', 'nk_icon_scheme', 'default');
  // Chat backgrounds from wallpaper packs: one option per picture, pack:<id>/<name>.
  const wallpaper = $('#chat-wallpaper'); wallpaper.querySelectorAll('.pack-wallpaper').forEach(option => option.remove());
  const custom = wallpaper.querySelector('option[value="custom"]');
  for (const pack of packs) for (const name of Object.keys(pack.wallpapers || {}).sort()) {
    const option = document.createElement('option'); option.className = 'pack-wallpaper'; option.value = `pack:${pack.id}/${name}`; option.textContent = name; wallpaper.insertBefore(option, custom);
  }
  const stored = localStorage.getItem('nk_chat_wallpaper') || 'none';
  wallpaper.value = [...wallpaper.options].some(option => option.value === stored) ? stored : 'none';
  renderDesktopList();
  refreshAssistantChoice();
  renderPointers();
}
async function applyPackChoices() {
  const packFor = value => value.startsWith('pack:') ? packs.find(pack => pack.id === value.slice(5)) : null;
  const sound = $('#sound-scheme').value, cursor = $('#cursor-scheme').value, icon = $('#icon-scheme').value;
  localStorage.setItem('nk_sound_pack', JSON.stringify(packFor(sound)?.sounds || {}));
  localStorage.setItem('nk_cursor_scheme', cursor);
  localStorage.setItem('nk_cursor_pack', JSON.stringify(cursor.startsWith('pack:') ? packFor(cursor)?.cursors || {} : {}));
  localStorage.setItem('nk_icon_scheme', icon);
  localStorage.setItem('nk_icon_pack', JSON.stringify(packFor(icon)?.icons || {}));
  const assistant = $('#assistant-choice')?.value;
  if (assistant) { localStorage.setItem('nk_assistant_pack', JSON.stringify(assistantPack(assistant) || null)); localStorage.setItem('nk_assistant', assistant); }
  window.nkPacks?.applyCursors(); window.nkPacks?.applyIcons();
}
async function previewSelection() { refreshPreview(await controls.previewTheme($('#theme-list').value, $('#colour-scheme').value)); }
$('#theme-list').onchange = async () => { try { refreshSchemes(); await previewSelection(); } catch (error) { $('#theme-error').textContent = error.message; } };
$('#colour-scheme').onchange = async () => { try { await previewSelection(); } catch (error) { $('#theme-error').textContent = error.message; } };
function showTab(name) { const tab = document.querySelector(`.property-tab[data-page="${CSS.escape(String(name))}"]`); if (!tab) return; document.querySelectorAll('.property-tab').forEach(item => item.classList.toggle('active', item === tab)); document.querySelectorAll('.property-page').forEach(page => { page.hidden = page.id !== `${tab.dataset.page}-page`; }); }
document.querySelectorAll('.property-tab').forEach(tab => tab.onclick = () => showTab(tab.dataset.page));
// The Control Panel opens each applet in its own window, like Windows XP: ?applet= keeps only
// that applet's pages. A page is an existing tab (page), maybe without some rows (hide), or a new
// one made of rows moved from the other tabs (rows). Hidden rows still exist, so Apply saves all.
const APPLETS = {
  display: { title: 'Display Properties', icon: 'display', pages: [{ page: 'themes' }, { page: 'desktop' }, { page: 'appearance' }, { page: 'display', label: 'Settings', hide: ['#display-language', '#cursor-scheme'] }] },
  sounds: { title: 'Sounds and Audio Devices Properties', icon: 'sounds', pages: [{ page: 'sounds' }, { id: 'audio', label: 'Audio', rows: ['#mic-device', '#noise-suppression'] }] },
  mouse: { title: 'Mouse Properties', icon: 'mouse', pages: [{ id: 'pointers', label: 'Pointers', build: buildPointersPage }] },
  regional: { title: 'Regional and Language Options', icon: 'regional', pages: [{ id: 'languages', label: 'Languages', rows: ['#display-language'] }] },
  network: { title: 'Network Connections', icon: 'network-connections', pages: [{ id: 'server', label: 'Nekochat Reloaded', rows: ['#reloaded-enabled', '#reloaded-server', '#media-socket', '#screen-codec', '#dns-provider', '#dns-custom'] }] },
  updates: { title: 'Automatic Updates', icon: 'updates', pages: [{ id: 'updates', label: 'Automatic Updates', build: buildUpdatesPage }] },
  backups: { title: 'Backup', icon: 'backups', pages: [{ page: 'backups' }] },
  privacy: { title: 'User Accounts', icon: 'users', pages: [{ id: 'privacy', label: 'Privacy', rows: ['#show-last-seen', '#auto-away', '#show-admin-button'] }] },
  assistant: { title: 'Assistant', icon: 'assistant', pages: [{ id: 'assistant', label: 'Assistant', build: buildAssistantPage }] },
};
// Mouse Properties → Pointers, like XP's: the scheme, a preview and every pointer of the scheme.
const POINTER_NAMES = [['default', 'Normal Select'], ['help', 'Help Select'], ['progress', 'Working In Background'], ['wait', 'Busy'], ['crosshair', 'Precision Select'], ['text', 'Text Select'],
  ['not-allowed', 'Unavailable'], ['ns-resize', 'Vertical Resize'], ['ew-resize', 'Horizontal Resize'], ['nwse-resize', 'Diagonal Resize 1'], ['nesw-resize', 'Diagonal Resize 2'], ['move', 'Move'], ['pointer', 'Link Select']];
function buildPointersPage(section) {
  section.classList.add('pointers-page');
  section.innerHTML = '<div class="pointers-top"><fieldset class="xp-group"><legend>Scheme</legend><div class="pointers-scheme"></div><div class="pointers-scheme-buttons"><button type="button" disabled>Save As...</button><button type="button" disabled>Delete</button></div></fieldset><div class="pointers-preview" id="pointers-preview"></div></div><span>Customize:</span><div class="pointers-list" id="pointers-list" tabindex="0"></div><div class="pointers-bottom"><button type="button" disabled>Use Default</button><button type="button" disabled>Browse...</button></div>';
  const select = $('#cursor-scheme'); select.closest('label').hidden = true; section.querySelector('.pointers-scheme').append(select);
  select.addEventListener('change', renderPointers);
  section.querySelector('#pointers-list').addEventListener('click', event => { const row = event.target.closest('.pointer-row'); if (!row) return; section.querySelectorAll('.pointer-row').forEach(item => item.classList.toggle('selected', item === row)); renderPointerPreview(row.dataset.kind); });
}
function pointerSet() { const value = $('#cursor-scheme').value; return window.nkPacks?.schemeCursors(value.startsWith('pack:') ? 'pack' : value, packs.find(pack => `pack:${pack.id}` === value)?.cursors) || {}; }
function renderPointerPreview(kind) { const cursor = pointerSet()[kind]; const preview = $('#pointers-preview'); if (preview) preview.innerHTML = cursor?.url ? `<img src="${esc(cursor.url)}" alt="">` : `<span style="cursor:${kind}">${esc(kind)}</span>`; }
function renderPointers() {
  const list = $('#pointers-list'); if (!list) return;
  const set = pointerSet(), selected = list.querySelector('.selected')?.dataset.kind || 'default';
  list.innerHTML = POINTER_NAMES.map(([kind, name]) => `<div class="pointer-row${kind === selected ? ' selected' : ''}" data-kind="${kind}"><span>${esc(name)}</span>${set[kind]?.url ? `<img src="${esc(set[kind].url)}" alt="">` : '<i></i>'}</div>`).join('');
  renderPointerPreview(selected);
}
// Assistant: Rover (built in), an assistant pack from the Catalog, or none; a preview of the first
// frame. Saved on Apply as nk_assistant (+ nk_assistant_pack with the pack's files).
function buildAssistantPage(section) {
  section.classList.add('assistant-page');
  section.innerHTML = '<h2>Assistant</h2><p>The assistant sits in the chat window. Click him to search all your chats, see unread chats, change your status or get a tip.</p><div class="assistant-choice"><canvas id="assistant-preview" width="80" height="80"></canvas><label>Character:<select id="assistant-choice"></select></label></div><p>More assistants are in the Catalog.</p>';
  section.querySelector('#assistant-choice').addEventListener('change', previewAssistant);
}
const assistantPack = value => value.startsWith('pack:') ? packs.find(pack => `pack:${pack.id}` === value)?.assistant : null;
function refreshAssistantChoice() {
  const select = $('#assistant-choice'); if (!select) return;
  select.innerHTML = '<option value="rover">Rover (Windows XP)</option>' + packs.filter(pack => pack.assistant).map(pack => `<option value="pack:${esc(pack.id)}">${esc(pack.name)}${pack.author ? ` — ${esc(pack.author)}` : ''}</option>`).join('') + '<option value="none">(None)</option>';
  const stored = localStorage.getItem('nk_assistant') || 'rover';
  select.value = [...select.options].some(option => option.value === stored) ? stored : 'rover';
  previewAssistant();
}
async function previewAssistant() {
  const value = $('#assistant-choice').value, canvas = $('#assistant-preview'), context = canvas.getContext('2d');
  context.clearRect(0, 0, 80, 80); if (value === 'none') return;
  const files = assistantPack(value) || { json: 'assets/agent/rover/agent.json', frames: 'assets/agent/rover/frames.png' };
  try {
    const [agent, image] = await Promise.all([fetch(files.json).then(response => response.json()), new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = files.frames; })]);
    const frame = (agent.animations.RestPose || Object.values(agent.animations)[0]).frames[0];
    for (const [index, x, y] of [...frame.images].reverse()) context.drawImage(image, (index % agent.columns) * agent.width, Math.floor(index / agent.columns) * agent.height, agent.width, agent.height, x * 80 / agent.width, y * 80 / agent.height, 80, 80);
  } catch {}
}
// Automatic Updates, like XP's: a banner and the four choices, plus the beta channel and Check now.
// Automatic and Download work on the desktop app; phones and the web ask before installing anyway.
const UPDATE_CHOICES = [
  ['auto', '<b>Automatic (recommended)</b>', 'Automatically download new versions and install them when Nekochat Reloaded closes.', 'shield-on'],
  ['download', 'Download updates for me, but let me choose when to install them.', '', ''],
  ['notify', 'Notify me but don\'t automatically download or install them.', '', ''],
  ['off', 'Turn off Automatic Updates.', 'Nekochat Reloaded will look for new versions only when you click Check now. Install them from the <a href="https://github.com/xKaMikax/nekochat_reloaded/releases" target="_blank">releases page</a>.', 'shield-off'],
];
function buildUpdatesPage(section) {
  section.classList.add('updates-page');
  section.innerHTML = '<div class="updates-banner"><img src="assets/images/control-panel/shield.png" alt=""><span>Help keep Nekochat Reloaded up to date</span></div><p>Nekochat Reloaded can regularly check for new versions and install them for you.<br><a href="https://github.com/xKaMikax/nekochat_reloaded/releases" target="_blank">What\'s new in Nekochat Reloaded?</a></p>'
    + UPDATE_CHOICES.map(([value, title, text, icon]) => `<label class="updates-option"><input type="radio" name="update-mode" value="${value}"><span class="updates-title">${title}</span>${text ? `<span class="updates-detail">${icon ? `<img src="assets/images/control-panel/${icon}.png" alt="">` : '<i></i>'}<span>${text}</span></span>` : ''}</label>`).join('')
    + '<div class="updates-extra"></div>';
  const extra = section.querySelector('.updates-extra');
  extra.append($('#update-beta').closest('label'), $('#update-check').closest('label'));
  $('#update-auto').closest('label').hidden = true; section.append($('#update-auto').closest('label'));
  const stored = localStorage.getItem('nk_update_mode') || (localStorage.getItem('nk_update_auto') === '0' ? 'off' : 'notify');
  section.querySelectorAll('[name="update-mode"]').forEach(radio => { radio.checked = radio.value === stored; radio.addEventListener('change', () => { $('#update-auto').checked = radio.value !== 'off'; }); });
}
const appletName = new URLSearchParams(location.search).get('applet');
const applet = APPLETS[appletName];
if (applet) {
  document.title = applet.title; $('.xp-title').textContent = applet.title;
  $('.xp-app-icon').style.backgroundImage = `url('assets/images/control-panel/${applet.icon}.png')`;
  const keep = new Set();
  for (const spec of applet.pages) {
    if (spec.page) {
      keep.add(spec.page);
      if (spec.label) document.querySelector(`.property-tab[data-page="${spec.page}"]`).textContent = spec.label;
      (spec.hide || []).forEach(selector => { $(selector).closest('label').hidden = true; });
      continue;
    }
    const section = document.createElement('section');
    section.className = 'property-page display-page'; section.id = `${spec.id}-page`; section.hidden = true;
    if (spec.build) spec.build(section);
    else {
      section.innerHTML = `<h2>${esc(spec.label)}</h2>`;
      spec.rows.forEach(selector => section.append($(selector).closest('label')));
      section.insertAdjacentHTML('beforeend', '<p>Changes are saved when you click Apply.</p>');
    }
    $('.properties footer').before(section);
    const tab = document.createElement('button'); tab.className = 'property-tab'; tab.dataset.page = spec.id; tab.textContent = spec.label; tab.onclick = () => showTab(spec.id);
    $('.property-tabs').append(tab); keep.add(spec.id);
  }
  document.querySelectorAll('.property-tab').forEach(tab => { if (!keep.has(tab.dataset.page)) tab.remove(); });
}
// The first page, or the one asked for (?tab= at start, then the event when already open).
const firstPage = applet ? (applet.pages[0].page || applet.pages[0].id) : 'themes';
showTab(new URLSearchParams(location.search).get('tab') || firstPage);
controls.onSettingsTab?.(showTab);
$('#close').onclick = () => controls.close(); $('#cancel').onclick = () => controls.close(); $('#ok').onclick = () => controls.close();
$('#apply').onclick = async () => { try { $('#theme-error').textContent = ''; await applySelection(); } catch (error) { $('#theme-error').textContent = error.message; } };
$('#theme-import').onclick = async () => { try { $('#theme-error').textContent = 'Importing theme…'; const result = await controls.importTheme(); if (!result) { $('#theme-error').textContent = ''; return; } themeMetadata = result.themes; $('#theme-list').innerHTML = themeMetadata.map(theme => `<option value="${esc(theme.id)}">${esc(theme.name)}</option>`).join(''); $('#theme-list').value = result.id; refreshSchemes(result.scheme); await previewSelection(); $('#theme-error').textContent = 'Theme added. Click Apply to use it.'; } catch (error) { $('#theme-error').textContent = error.message; } };
// DNS is chosen only in the desktop app; Chromium takes custom resolvers as DNS-over-HTTPS.
function refreshDnsRows() { const supported = Boolean(controls.dnsSupported); document.querySelectorAll('.dns-setting').forEach(row => { row.hidden = !supported; }); $('#dns-custom-row').hidden = !supported || $('#dns-provider').value !== 'custom'; }
$('#dns-provider').onchange = refreshDnsRows;
// The chat window checks for updates (nekochat.js) when this key changes.
$('#update-check').onclick = () => { localStorage.setItem('nk_update_beta', $('#update-beta').checked ? '1' : '0'); localStorage.setItem('nk_update_check', String(Date.now())); };
$('#reloaded-enabled').onchange = () => { $('#reloaded-server').disabled = !$('#reloaded-enabled').checked; };
$('#chat-wallpaper-opacity').oninput = () => { $('#chat-wallpaper-opacity-value').textContent = `${$('#chat-wallpaper-opacity').value}%`; };
$('#sound-volume').oninput = () => { $('#sound-volume-value').textContent = `${$('#sound-volume').value}%`; };
// Chat background: built-in pictures or your own, shrunk to a JPEG that fits in localStorage.
let pendingWallpaper = null;
$('#chat-wallpaper').onchange = () => { if ($('#chat-wallpaper').value === 'custom') $('#chat-wallpaper-file').click(); };
$('#chat-wallpaper-file').onchange = async () => {
  const file = $('#chat-wallpaper-file').files[0]; $('#chat-wallpaper-file').value = '';
  if (!file) { $('#chat-wallpaper').value = localStorage.getItem('nk_chat_wallpaper') || 'none'; return; }
  const bitmap = await createImageBitmap(file); const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  pendingWallpaper = canvas.toDataURL('image/jpeg', .85);
  $('#chat-wallpaper').value = 'custom'; renderDesktopList();
};
function saveWallpaper() {
  const choice = $('#chat-wallpaper').value;
  if (choice === 'custom' && pendingWallpaper) { try { localStorage.setItem('nk_chat_wallpaper_image', pendingWallpaper); } catch { $('#theme-error').textContent = 'The picture is too large.'; return; } }
  if (choice === 'custom' && !localStorage.getItem('nk_chat_wallpaper_image')) return;
  if (choice.startsWith('pack:')) { const [id, ...name] = choice.slice(5).split('/'); localStorage.setItem('nk_chat_wallpaper_pack', packs.find(pack => pack.id === id)?.wallpapers?.[name.join('/')] || ''); }
  localStorage.setItem('nk_chat_wallpaper', choice); pendingWallpaper = null;
  localStorage.setItem('nk_chat_wallpaper_position', $('#chat-wallpaper-position').value);
  localStorage.setItem('nk_chat_wallpaper_color', $('#chat-wallpaper-color-off').checked ? '' : $('#chat-wallpaper-color').value);
}
// Desktop tab: the list shows the options of #chat-wallpaper (built-in pictures, wallpaper packs,
// your own picture) and the monitor shows the choice before Apply.
const wallpaperUrl = value => {
  if (value === 'bliss') return 'assets/images/Bliss.jpg';
  if (value === 'logon') return 'assets/images/xp_1920x1200.jpg';
  if (value === 'custom') return pendingWallpaper || localStorage.getItem('nk_chat_wallpaper_image') || '';
  if (value.startsWith('pack:')) { const [id, ...name] = value.slice(5).split('/'); return packs.find(pack => pack.id === id)?.wallpapers?.[name.join('/')] || ''; }
  return '';
};
function renderDesktopList() {
  const select = $('#chat-wallpaper'), hasCustom = Boolean(pendingWallpaper || localStorage.getItem('nk_chat_wallpaper_image'));
  $('#desktop-list').innerHTML = [...select.options].filter(option => option.value !== 'custom' || hasCustom).map(option => {
    const label = option.value === 'custom' ? 'My picture' : option.textContent;
    return `<div class="desktop-item${option.value === select.value ? ' selected' : ''}" role="option" data-value="${esc(option.value)}"><img src="assets/images/control-panel/${option.value === 'none' ? 'bg-none' : 'bg-picture'}.png" alt=""><span>${esc(label)}</span></div>`;
  }).join('');
  $('#desktop-list .selected')?.scrollIntoView({ block: 'nearest' });
  refreshDesktopPreview();
}
const naturalSizes = new Map();
function refreshDesktopPreview() {
  const screen = $('#desktop-screen'), url = wallpaperUrl($('#chat-wallpaper').value), position = $('#chat-wallpaper-position').value;
  const veil = 100 - Math.min(100, Math.max(5, Number($('#chat-wallpaper-opacity').value) || 35));
  const colour = $('#chat-wallpaper-color-off').checked ? '' : $('#chat-wallpaper-color').value;
  const tint = `color-mix(in srgb, var(--xp-theme-window, #ece9d8) ${veil}%, transparent)`;
  // The screen is about a quarter of a chat window, so Center and Tile shrink the picture as much.
  let size = 'cover';
  if (position !== 'stretch') {
    const known = naturalSizes.get(url);
    if (!known && url) { const image = new Image(); image.onload = () => { naturalSizes.set(url, [image.naturalWidth, image.naturalHeight]); refreshDesktopPreview(); }; image.src = url; }
    size = known ? `${Math.round(known[0] / 4)}px ${Math.round(known[1] / 4)}px` : 'auto';
  }
  screen.style.backgroundImage = url ? `linear-gradient(${tint}, ${tint}), url("${url.replace(/["\\\n]/g, '')}")` : '';
  screen.style.backgroundSize = url ? `100% 100%, ${size}` : '';
  screen.style.backgroundRepeat = url ? `no-repeat, ${position === 'tile' ? 'repeat' : 'no-repeat'}` : '';
  screen.style.backgroundPosition = url ? `0 0, ${position === 'tile' ? '0 0' : 'center'}` : '';
  screen.style.backgroundColor = colour ? `color-mix(in srgb, var(--xp-theme-window, #ece9d8) ${veil}%, ${colour})` : '';
  $('#chat-wallpaper-color').disabled = $('#chat-wallpaper-color-off').checked;
}
function selectWallpaper(value) {
  if (value === 'custom' && !pendingWallpaper && !localStorage.getItem('nk_chat_wallpaper_image')) { $('#chat-wallpaper-file').click(); return; }
  $('#chat-wallpaper').value = value; renderDesktopList();
}
$('#desktop-list').onclick = event => { const item = event.target.closest('.desktop-item'); if (item) selectWallpaper(item.dataset.value); };
$('#desktop-list').onkeydown = event => {
  if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  const items = [...document.querySelectorAll('.desktop-item')], index = items.findIndex(item => item.classList.contains('selected'));
  const next = items[Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]; if (next) selectWallpaper(next.dataset.value);
};
$('#desktop-browse').onclick = () => $('#chat-wallpaper-file').click();
['#chat-wallpaper-position', '#chat-wallpaper-color', '#chat-wallpaper-color-off', '#chat-wallpaper-opacity'].forEach(selector => $(selector).addEventListener('input', refreshDesktopPreview));
$('#chat-wallpaper-position').value = localStorage.getItem('nk_chat_wallpaper_position') || 'stretch';
{ const colour = localStorage.getItem('nk_chat_wallpaper_color') || ''; $('#chat-wallpaper-color-off').checked = !colour; if (colour) $('#chat-wallpaper-color').value = colour; }
$('#effects').onclick = () => alert('Effects are supplied by the selected Windows XP theme.');
$('#advanced').onclick = () => alert('Advanced colour editing is available when the theme provides multiple colour schemes.');
controls.onThemeChanged(theme => { refreshFrame(theme); refreshPreview(theme); });
Promise.all([refreshThemes(), controls.getActiveTheme(), controls.getDisplaySettings()]).then(([, theme, settings]) => { $('#display-language').value = settings.language || 'ru'; $('#login-ui').value = settings.loginUi || 'xp'; $('#noise-suppression').value = settings.noiseSuppression || 'webrtc'; $('#dns-provider').value = settings.dns || 'system'; $('#dns-custom').value = settings.dnsCustom || ''; $('#screen-codec').value = localStorage.getItem('nk_screen_codec') || 'auto'; $('#reloaded-server').value = localStorage.getItem('nk_reloaded_server') || ''; $('#reloaded-enabled').checked = localStorage.getItem('nk_reloaded_enabled') !== '0'; $('#reloaded-server').disabled = !$('#reloaded-enabled').checked; $('#show-admin-button').checked = localStorage.getItem('nk_show_admin_button') === '1'; $('#media-socket').checked = localStorage.getItem('nk_media_socket') !== '0'; $('#show-last-seen').checked = localStorage.getItem('nk_hide_last_seen') !== '1'; $('#auto-away').value = localStorage.getItem('nk_auto_away_minutes') ?? '10'; $('#update-auto').checked = localStorage.getItem('nk_update_auto') !== '0'; $('#update-beta').checked = localStorage.getItem('nk_update_beta') === '1'; refreshPacks(); $('#sound-volume').value = localStorage.getItem('nk_sound_volume') ?? 72; $('#sound-volume-value').textContent = `${$('#sound-volume').value}%`; $('#chat-wallpaper').value = localStorage.getItem('nk_chat_wallpaper') || 'none'; $('#chat-wallpaper-opacity').value = localStorage.getItem('nk_chat_wallpaper_opacity') ?? 35; $('#chat-wallpaper-opacity-value').textContent = `${$('#chat-wallpaper-opacity').value}%`; refreshDnsRows(); refreshMicDevices(settings.micDeviceId); refreshFrame(theme); refreshPreview(theme); }).catch(error => { $('#theme-error').textContent = error.message; });
// XP click sound on buttons, like in the chat window.
document.addEventListener('click', event => { if (!event.target.closest?.('button')) return; let scheme = 'xp', volume = 72; try { scheme = localStorage.getItem('nk_sound_scheme') || 'xp'; volume = Number(localStorage.getItem('nk_sound_volume') ?? 72); } catch {} if (scheme === 'none' || !(volume > 0)) return; const audio = new Audio(window.nkSoundUrl ? window.nkSoundUrl('navigation') : 'assets/sounds/navigation.wav'); audio.volume = Math.min(1, volume / 100); audio.play().catch(() => {}); });
