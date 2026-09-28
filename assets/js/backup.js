// Settings backups (Display Properties → Backups): a zip archive with backup.json (settings and
// the chat background) and, where the app can list them, the installed themes (themes/…),
// kept on the Nekochat Reloaded companion server.
(() => {
  const $ = selector => document.querySelector(selector);
  const controls = window.windowControls;
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[char]);
  // Sign-in data stays out of backups.
  const PRIVATE_KEY = /^(nk_token|nk_saved_sessions|nk_reloaded_token:.*|nk_reloaded_active)$/;
  let backups = []; let selected = null; let busy = false;
  // Which client made the backup: the phone and web copies load their own bridge script.
  const platform = document.querySelector('script[src$="android-bridge.js"]') ? 'Android' : document.querySelector('script[src$="ios-bridge.js"]') ? 'iPhone' : document.querySelector('script[src$="web-bridge.js"]') ? 'Web' : 'PC';
  const clientName = `${platform} ${window.NEKOCHAT_RELOADED_VERSION || '?'}`;

  // ---- zip (deflate when the browser can, stored otherwise) ----
  const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = data => { let crc = 0xffffffff; for (let i = 0; i < data.length; i += 1) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; };
  async function transform(data, stream) { return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(stream)).arrayBuffer()); }
  async function deflate(data) { try { return await transform(data, new CompressionStream('deflate-raw')); } catch { return null; } }
  async function buildZip(files) {
    const parts = []; const central = []; let offset = 0;
    for (const file of files) {
      const name = new TextEncoder().encode(file.path); const data = file.data;
      const packed = data.length > 64 ? await deflate(data) : null; const useDeflate = packed && packed.length < data.length;
      const body = useDeflate ? packed : data; const crc = crc32(data);
      const header = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, useDeflate ? 8 : 0, 2], [14, crc, 4], [18, body.length, 4], [22, data.length, 4], [26, name.length, 2]].forEach(([at, value, size]) => size === 4 ? header.setUint32(at, value, true) : header.setUint16(at, value, true));
      const entry = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, useDeflate ? 8 : 0, 2], [16, crc, 4], [20, body.length, 4], [24, data.length, 4], [28, name.length, 2], [42, offset, 4]].forEach(([at, value, size]) => size === 4 ? entry.setUint32(at, value, true) : entry.setUint16(at, value, true));
      parts.push(new Uint8Array(header.buffer), name, body); central.push(new Uint8Array(entry.buffer), name);
      offset += 30 + name.length + body.length;
    }
    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [8, files.length, 2], [10, files.length, 2], [12, centralSize, 4], [16, offset, 4]].forEach(([at, value, size]) => size === 4 ? end.setUint32(at, value, true) : end.setUint16(at, value, true));
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }
  async function readZipFile(bytes, wanted) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1; for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i -= 1) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    if (end < 0) throw new Error('The backup is not a zip archive.');
    let at = view.getUint32(end + 16, true);
    for (let i = 0; i < view.getUint16(end + 10, true); i += 1) {
      const method = view.getUint16(at + 10, true); const size = view.getUint32(at + 20, true);
      const nameLength = view.getUint16(at + 28, true); const skip = nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
      const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength)); const local = view.getUint32(at + 42, true);
      if (name === wanted) {
        const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        const body = bytes.subarray(start, start + size);
        return method === 8 ? transform(body, new DecompressionStream('deflate-raw')) : body;
      }
      at += 46 + skip;
    }
    return null;
  }

  // ---- companion server (the chat window keeps the session) ----
  function session() {
    try {
      // The chat window names its session key: nk_reloaded_token:<server>|<Nekochat server>|<user id>.
      const key = localStorage.getItem('nk_reloaded_active') || '';
      const url = key.startsWith('nk_reloaded_token:') ? key.slice('nk_reloaded_token:'.length).split('|')[0] : '';
      const token = url ? localStorage.getItem(key) : '';
      return url && token ? { url, token } : null;
    } catch { return null; }
  }
  async function request(method, path, body) {
    const current = session(); if (!current) throw new Error('Sign in with a Nekochat Reloaded server (Settings tab) to use backups.');
    const response = await fetch(`${current.url}${path}`, { method, headers: { Authorization: `Bearer ${current.token}`, ...(body ? { 'Content-Type': 'application/zip' } : {}) }, body });
    if (!response.ok) { let detail = ''; try { detail = (await response.json()).detail; } catch {} throw new Error(typeof detail === 'string' && detail ? detail : `The server answered ${response.status}.`); }
    return response;
  }

  const status = (text, error = false) => { $('#backup-status').textContent = text; $('#backup-status').classList.toggle('error', error); };
  const sizeText = bytes => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const timeText = seconds => new Date(seconds * 1000).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  function setBusy(value) { busy = value; ['#backup-create', '#backup-refresh'].forEach(id => { $(id).disabled = value; }); ['#backup-restore', '#backup-delete'].forEach(id => { $(id).disabled = value || !selected; }); }
  function render() {
    if (!backups.some(item => item.id === selected)) selected = null;
    $('#backup-list').innerHTML = backups.length ? backups.map(item => `<tr data-id="${esc(item.id)}" class="${item.id === selected ? 'selected' : ''}" title="${esc(item.device || '')}"><td>${esc(item.name)}</td><td>${esc(timeText(item.created_at))}</td><td>${esc(item.client || '—')}</td><td>${esc(sizeText(item.size))}</td></tr>`).join('') : '<tr class="empty"><td colspan="4">No backups yet.</td></tr>';
    setBusy(busy);
  }
  async function refresh() {
    if (!session()) { backups = []; render(); status('Sign in with a Nekochat Reloaded server (Settings tab) to use backups.'); return; }
    try { backups = (await (await request('GET', '/backups')).json()).backups || []; render(); status(''); } catch (error) { status(error.message, true); }
  }

  // What a backup can hold; every part is on by default, both when saving and when restoring.
  const PARTS = [
    { id: 'themes', label: 'Themes', hint: 'installed themes, cursor, sound and icon packs, and the chosen theme', keys: /^nk_active_(theme|scheme)$/ },
    { id: 'display', label: 'Display', hint: 'language, logon screen, chat background and its picture', keys: /^nk_chat_wallpaper/, display: ['language', 'loginUi'] },
    { id: 'sounds', label: 'Sounds', hint: 'sound scheme and volume', keys: /^nk_sound_/ },
    { id: 'settings', label: 'Settings', hint: 'microphone, noise suppression, servers, screen codec, DNS', display: ['micDeviceId', 'noiseSuppression', 'dns', 'dnsCustom'] },
    { id: 'accounts', label: 'Accounts', hint: 'the account list on the sign-in screen (you sign in again)' },
    { id: 'chats', label: 'Muted chats', hint: 'chats with notifications turned off', keys: /^nk_muted:/ },
  ];
  // Keys no part claims (new settings, for example) go with Settings.
  const partOfKey = key => (PARTS.find(part => part.keys?.test(key)) || { id: 'settings' }).id;
  const checkbox = (part, name, checked = true, extra = '') => `<label title="${esc(part.hint)}"><input type="checkbox" name="${name}" value="${part.id}"${checked ? ' checked' : ''}>${esc(part.label)}${extra}</label>`;
  $('#backup-include').insertAdjacentHTML('beforeend', PARTS.map(part => checkbox(part, 'backup-include')).join(''));
  const chosen = container => new Set([...container.querySelectorAll('input:checked')].map(input => input.value));

  async function createBackup(parts) {
    const settings = {};
    for (let i = 0; i < localStorage.length; i += 1) { const key = localStorage.key(i); if (key?.startsWith('nk_') && !PRIVATE_KEY.test(key) && parts.has(partOfKey(key))) settings[key] = localStorage.getItem(key); }
    let current = {}; try { current = await controls.getDisplaySettings(); } catch {}
    const display = {}; PARTS.filter(part => parts.has(part.id)).forEach(part => (part.display || []).forEach(name => { if (current[name] !== undefined) display[name] = current[name]; }));
    // Accounts without their sessions: restoring puts them on the sign-in screen, you sign in again.
    let accounts = [];
    if (parts.has('accounts')) try { accounts = JSON.parse(localStorage.getItem('nk_saved_sessions') || '[]').filter(item => item?.server && item?.user).map(item => ({ key: item.key, server: item.server, user: item.user })); } catch {}
    const files = parts.has('themes') && controls.exportThemeFiles ? await controls.exportThemeFiles() : [];
    const manifest = { format: 1, app: 'Nekochat Reloaded', client: { platform, version: window.NEKOCHAT_RELOADED_VERSION || '' }, created: new Date().toISOString(), device: navigator.userAgent.slice(0, 120), parts: [...parts], display, localStorage: settings, accounts, themes: files.length > 0 };
    return buildZip([{ path: 'backup.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 1)) }, ...files.map(file => ({ path: file.path, data: new Uint8Array(file.data) }))]);
  }
  $('#backup-create').onclick = async () => {
    if (busy) return;
    const parts = chosen($('#backup-include')); if (!parts.size) { status('Choose at least one thing to back up.', true); return; }
    setBusy(true);
    try {
      status('Packing your settings…'); const archive = await createBackup(parts);
      status(`Uploading ${sizeText(archive.size)}…`);
      const name = $('#backup-name').value.trim() || `Backup ${new Date().toLocaleString()}`;
      await request('POST', `/backups?name=${encodeURIComponent(name)}&device=${encodeURIComponent(navigator.platform || '')}&client=${encodeURIComponent(clientName)}`, archive);
      $('#backup-name').value = ''; await refresh(); status(`Backup “${name}” saved.`);
    } catch (error) { status(error.message, true); }
    setBusy(false);
  };

  // Restore: download, show what the backup holds, restore the ticked parts.
  let pending = null;
  function showRestorePanel(show) { $('#backup-restore-panel').hidden = !show; $('#backup-list-wrap').hidden = show; $('#backup-main-actions').hidden = show; $('#backup-include').hidden = show; if (!show) pending = null; }
  function partsIn(manifest) {
    const present = new Set(Object.keys(manifest.localStorage || {}).map(partOfKey));
    PARTS.forEach(part => { if ((part.display || []).some(name => manifest.display?.[name] !== undefined)) present.add(part.id); });
    if (manifest.themes) present.add('themes');
    if (manifest.accounts?.length) present.add('accounts');
    return PARTS.filter(part => present.has(part.id));
  }
  $('#backup-restore').onclick = async () => {
    const item = backups.find(backup => backup.id === selected); if (!item || busy) return;
    setBusy(true);
    try {
      status('Downloading…'); const bytes = new Uint8Array(await (await request('GET', `/backups/${encodeURIComponent(item.id)}`)).arrayBuffer());
      const manifestBytes = await readZipFile(bytes, 'backup.json'); if (!manifestBytes) throw new Error('This archive is not a Nekochat Reloaded backup.');
      const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
      if (manifest.format !== 1) throw new Error('This backup was made by a newer version of Nekochat Reloaded.');
      const parts = partsIn(manifest); if (!parts.length) throw new Error('This backup is empty.');
      pending = { item, bytes, manifest };
      $('#backup-restore-title').textContent = `Restore “${item.name}”`;
      $('#backup-restore-parts').innerHTML = parts.map(part => checkbox(part, 'backup-restore', true, ` <small>— ${esc(part.hint)}</small>`)).join('');
      showRestorePanel(true); status(`Made by ${item.client || 'an older client'}. Choose what to restore; the rest stays as it is.`);
    } catch (error) { status(error.message, true); }
    setBusy(false);
  };
  $('#backup-restore-cancel').onclick = () => { showRestorePanel(false); status(''); };
  $('#backup-restore-confirm').onclick = async () => {
    if (!pending || busy) return;
    const parts = chosen($('#backup-restore-parts')); if (!parts.size) { status('Choose at least one thing to restore.', true); return; }
    const { bytes, manifest } = pending; setBusy(true); $('#backup-restore-confirm').disabled = true;
    try {
      status('Restoring…');
      if (parts.has('themes') && manifest.themes && controls.restoreThemeFiles) await controls.restoreThemeFiles(bytes);
      for (const [key, value] of Object.entries(manifest.localStorage || {})) if (key.startsWith('nk_') && !PRIVATE_KEY.test(key) && typeof value === 'string' && parts.has(partOfKey(key))) try { localStorage.setItem(key, value); } catch {}
      const display = {}; PARTS.filter(part => parts.has(part.id)).forEach(part => (part.display || []).forEach(name => { if (manifest.display?.[name] !== undefined) display[name] = manifest.display[name]; }));
      if (Object.keys(display).length) { let current = {}; try { current = await controls.getDisplaySettings(); } catch {} await controls.applyDisplaySettings({ ...current, ...display }); }
      // Accounts are added to the list; the ones already there keep their sessions.
      if (parts.has('accounts') && Array.isArray(manifest.accounts)) {
        let saved = []; try { saved = JSON.parse(localStorage.getItem('nk_saved_sessions') || '[]'); } catch {}
        if (!Array.isArray(saved)) saved = [];
        const known = new Set(saved.map(item => item?.key));
        const added = manifest.accounts.filter(item => item?.server && item?.user && !known.has(item.key)).map(item => ({ key: item.key || `${item.server}|${item.user.id}`, server: item.server, user: item.user }));
        localStorage.setItem('nk_saved_sessions', JSON.stringify([...saved, ...added].slice(0, 12)));
      }
      if (parts.has('themes')) { const theme = localStorage.getItem('nk_active_theme'); if (theme) try { await controls.applyTheme(theme, localStorage.getItem('nk_active_scheme') || undefined); } catch {} }
      status('Restored. Restarting…');
      setTimeout(() => { if (controls.relaunch) controls.relaunch(); else top.location.reload(); }, 800);
    } catch (error) { status(error.message, true); setBusy(false); $('#backup-restore-confirm').disabled = false; }
  };
  $('#backup-delete').onclick = async () => {
    const item = backups.find(backup => backup.id === selected); if (!item || busy) return;
    if (!confirm(`Delete the backup “${item.name}”?`)) return;
    setBusy(true);
    try { await request('DELETE', `/backups/${encodeURIComponent(item.id)}`); await refresh(); status(`“${item.name}” deleted.`); } catch (error) { status(error.message, true); }
    setBusy(false);
  };
  $('#backup-refresh').onclick = refresh;
  $('#backup-list').ondblclick = () => $('#backup-restore').click();
  $('#backup-list').onclick = event => { const row = event.target.closest('tr[data-id]'); if (!row) return; selected = row.dataset.id; render(); };
  document.querySelector('.property-tab[data-page="backups"]').addEventListener('click', refresh);
})();
