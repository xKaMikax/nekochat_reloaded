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
  localStorage.setItem('nk_update_auto', $('#update-auto').checked ? '1' : '0');
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
}
// Built-in Windows XP cursors (assets/cursors/cursors.json) when the app ships them.
async function builtInCursors() {
  try { const map = await (await fetch('assets/cursors/cursors.json')).json(); return Object.fromEntries(Object.entries(map).map(([kind, value]) => [kind, { url: new URL(`assets/cursors/${typeof value === 'string' ? value : value.file}`, document.baseURI).href, x: Number(value?.x) || 0, y: Number(value?.y) || 0 }])); } catch { return {}; }
}
async function applyPackChoices() {
  const packFor = value => value.startsWith('pack:') ? packs.find(pack => pack.id === value.slice(5)) : null;
  const sound = $('#sound-scheme').value, cursor = $('#cursor-scheme').value, icon = $('#icon-scheme').value;
  localStorage.setItem('nk_sound_pack', JSON.stringify(packFor(sound)?.sounds || {}));
  localStorage.setItem('nk_cursor_scheme', cursor);
  localStorage.setItem('nk_cursor_pack', JSON.stringify(cursor === 'system' ? {} : cursor === 'xp' ? await builtInCursors() : packFor(cursor)?.cursors || {}));
  localStorage.setItem('nk_icon_scheme', icon);
  localStorage.setItem('nk_icon_pack', JSON.stringify(packFor(icon)?.icons || {}));
  window.nkPacks?.applyCursors(); window.nkPacks?.applyIcons();
}
async function previewSelection() { refreshPreview(await controls.previewTheme($('#theme-list').value, $('#colour-scheme').value)); }
$('#theme-list').onchange = async () => { try { refreshSchemes(); await previewSelection(); } catch (error) { $('#theme-error').textContent = error.message; } };
$('#colour-scheme').onchange = async () => { try { await previewSelection(); } catch (error) { $('#theme-error').textContent = error.message; } };
document.querySelectorAll('.property-tab').forEach(tab => tab.onclick = () => { document.querySelectorAll('.property-tab').forEach(item => item.classList.toggle('active', item === tab)); document.querySelectorAll('.property-page').forEach(page => { page.hidden = page.id !== `${tab.dataset.page}-page`; }); });
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
};
function saveWallpaper() {
  const choice = $('#chat-wallpaper').value;
  if (choice === 'custom' && pendingWallpaper) { try { localStorage.setItem('nk_chat_wallpaper_image', pendingWallpaper); } catch { $('#theme-error').textContent = 'The picture is too large.'; return; } }
  if (choice === 'custom' && !localStorage.getItem('nk_chat_wallpaper_image')) return;
  localStorage.setItem('nk_chat_wallpaper', choice); pendingWallpaper = null;
}
$('#effects').onclick = () => alert('Effects are supplied by the selected Windows XP theme.');
$('#advanced').onclick = () => alert('Advanced colour editing is available when the theme provides multiple colour schemes.');
controls.onThemeChanged(theme => { refreshFrame(theme); refreshPreview(theme); });
Promise.all([refreshThemes(), controls.getActiveTheme(), controls.getDisplaySettings()]).then(([, theme, settings]) => { $('#display-language').value = settings.language || 'ru'; $('#login-ui').value = settings.loginUi || 'xp'; $('#noise-suppression').value = settings.noiseSuppression || 'webrtc'; $('#dns-provider').value = settings.dns || 'system'; $('#dns-custom').value = settings.dnsCustom || ''; $('#screen-codec').value = localStorage.getItem('nk_screen_codec') || 'auto'; $('#reloaded-server').value = localStorage.getItem('nk_reloaded_server') || ''; $('#reloaded-enabled').checked = localStorage.getItem('nk_reloaded_enabled') !== '0'; $('#reloaded-server').disabled = !$('#reloaded-enabled').checked; $('#show-admin-button').checked = localStorage.getItem('nk_show_admin_button') === '1'; $('#media-socket').checked = localStorage.getItem('nk_media_socket') !== '0'; $('#show-last-seen').checked = localStorage.getItem('nk_hide_last_seen') !== '1'; $('#update-auto').checked = localStorage.getItem('nk_update_auto') !== '0'; $('#update-beta').checked = localStorage.getItem('nk_update_beta') === '1'; refreshPacks(); $('#sound-volume').value = localStorage.getItem('nk_sound_volume') ?? 72; $('#sound-volume-value').textContent = `${$('#sound-volume').value}%`; $('#chat-wallpaper').value = localStorage.getItem('nk_chat_wallpaper') || 'none'; $('#chat-wallpaper-opacity').value = localStorage.getItem('nk_chat_wallpaper_opacity') ?? 35; $('#chat-wallpaper-opacity-value').textContent = `${$('#chat-wallpaper-opacity').value}%`; refreshDnsRows(); refreshMicDevices(settings.micDeviceId); refreshFrame(theme); refreshPreview(theme); }).catch(error => { $('#theme-error').textContent = error.message; });
// XP click sound on buttons, like in the chat window.
document.addEventListener('click', event => { if (!event.target.closest?.('button')) return; let scheme = 'xp', volume = 72; try { scheme = localStorage.getItem('nk_sound_scheme') || 'xp'; volume = Number(localStorage.getItem('nk_sound_volume') ?? 72); } catch {} if (scheme === 'none' || !(volume > 0)) return; const audio = new Audio(window.nkSoundUrl ? window.nkSoundUrl('navigation') : 'assets/sounds/navigation.wav'); audio.volume = Math.min(1, volume / 100); audio.play().catch(() => {}); });
