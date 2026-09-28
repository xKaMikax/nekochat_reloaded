const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, Notification, desktopCapturer, session, screen, shell } = require('electron');
const path = require('path');
const { fileURLToPath, pathToFileURL } = require('url');
const fs = require('fs/promises');
const { execFile } = require('child_process');
// Settings, saved sessions and themes stay in the folder the app used before it was renamed
// from "NekoChat Reloaded" to "Nekochat Reloaded" (Linux paths are case-sensitive).
app.setPath('userData', path.join(app.getPath('appData'), 'NekoChat Reloaded'));
const { promisify } = require('util');
const zlib = require('zlib');

const execFileAsync = promisify(execFile);
function readZipEntries(buffer) {
  const minEOCD = 22;
  let eocdOffset = -1;
  for (let i = buffer.length - minEOCD; i >= 0 && i >= buffer.length - minEOCD - 0xffff; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) throw new Error('Invalid ZIP file: end of central directory not found.');
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];
  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP file: corrupt central directory.');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.push({ name, method, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
function readZipEntryData(buffer, entry) {
  if (buffer.readUInt32LE(entry.localHeaderOffset) !== 0x04034b50) throw new Error('Invalid ZIP file: corrupt local header.');
  const nameLength = buffer.readUInt16LE(entry.localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(entry.localHeaderOffset + 28);
  const dataStart = entry.localHeaderOffset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method === 8) return zlib.inflateRawSync(compressed);
  throw new Error(`Unsupported ZIP compression method: ${entry.method}.`);
}
async function extractZip(buffer, destinationRoot, prefix = '') {
  // With a prefix only the entries under it are written, relative to it (backups keep themes in themes/).
  const entries = readZipEntries(buffer).filter(entry => entry.name.startsWith(prefix) && entry.name.length > prefix.length).map(entry => ({ ...entry, name: entry.name.slice(prefix.length) }));
  // ZIP names come from the archive: reject backslashes, drive letters and anything that
  // resolves outside the destination (on Windows a backslash and "C:" also act as path parts).
  const root = path.resolve(destinationRoot);
  const targetOf = name => {
    if (!name || name.includes('\\') || name.includes('\0') || /^[a-z]:/i.test(name) || name.startsWith('/') || name.split('/').includes('..')) return null;
    const target = path.resolve(root, name);
    return target === root || target.startsWith(`${root}${path.sep}`) ? target : null;
  };
  if (entries.some(entry => !targetOf(entry.name))) throw new Error('Theme.ZIP contains an unsafe path.');
  for (const entry of entries) {
    const target = targetOf(entry.name);
    if (entry.name.endsWith('/')) { await fs.mkdir(target, { recursive: true }); continue; }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, readZipEntryData(buffer, entry));
  }
}
const themesRoot = path.join(__dirname, 'themes');
const prebuiltRoot = path.join(__dirname, 'prebuilt');
const userThemesRoot = path.join(app.getPath('userData'), 'themes');
const userPacksRoot = path.join(app.getPath('userData'), 'packs');
const runtimeThemesRoot = path.join(app.getPath('temp'), 'nekochat-msstyles');
const themeStatePath = path.join(app.getPath('userData'), 'theme-selection.json');
const displayStatePath = path.join(app.getPath('userData'), 'display-settings.json');
// NEKOCHAT_CATALOG points the app at another catalog (a local copy for testing).
const themeCatalogRoot = process.env.NEKOCHAT_CATALOG || 'https://raw.githubusercontent.com/xKaMikax/nekochat_reloaded_themes/main';
const builtInThemes = [
  { id: 'Classic', classic: true, source: path.join(themesRoot, 'classic', 'theme.css') },
  { id: 'Luna', source: path.join(themesRoot, 'luna', 'Luna.theme') },
];
let settingsWindow;
let themeBrowserWindow;
let themeEditorWindow;
let emojiBrowserWindow;
let emojiBrowserOwner;
const systemDialogWindows = new Set();
let profileWindow;
let roomCreateWindow;
let callWindow;
let mainWindow;
let tray;
let quitting = false;
let callOwner;
let closingCallWindow = false;
const detachedChatWindows = new Map();
const closingDetachedWindows = new Set();
let activeTheme;
let activeDisplay = { language: 'ru', loginUi: 'xp', micDeviceId: '', noiseSuppression: 'webrtc', dns: 'system', dnsCustom: '' };
// Chromium resolves names itself; it accepts custom resolvers only as DNS-over-HTTPS.
const DNS_PROVIDERS = { cloudflare: 'https://cloudflare-dns.com/dns-query', google: 'https://dns.google/dns-query', quad9: 'https://dns.quad9.net/dns-query', adguard: 'https://dns.adguard-dns.com/dns-query' };
function dnsServer(settings) {
  if (settings.dns === 'custom') return /^https:\/\/[^\s]+$/i.test(settings.dnsCustom || '') ? settings.dnsCustom : '';
  return DNS_PROVIDERS[settings.dns] || '';
}
function applyDnsSettings() {
  const server = dnsServer(activeDisplay);
  try {
    app.configureHostResolver(server ? { secureDnsMode: 'secure', secureDnsServers: [server] } : { secureDnsMode: 'automatic', secureDnsServers: [] });
    session.defaultSession.clearHostResolverCache();
    session.defaultSession.closeAllConnections?.();
  } catch (error) { console.warn('DNS settings were not applied:', error); }
}
let displayCaptureSource;

function notifyThemeChanged(theme) {
  BrowserWindow.getAllWindows().forEach(win => win.webContents.send('theme:changed', theme));
}
function notifyDisplayChanged(settings) {
  BrowserWindow.getAllWindows().forEach(win => win.webContents.send('display:changed', settings));
}
async function saveDisplaySettings(changes) {
  // Screens save only what they show (the logon screen changes only DNS), so keep the rest.
  const settings = { ...activeDisplay, ...changes };
  const dns = settings.dns === 'custom' || DNS_PROVIDERS[settings.dns] ? settings.dns : 'system';
  if (dns === 'custom' && !dnsServer(settings)) throw new Error(settings.language === 'en' ? 'The DNS-over-HTTPS address must start with https://' : 'Адрес DNS-over-HTTPS должен начинаться с https://');
  activeDisplay = { language: settings.language === 'en' ? 'en' : 'ru', loginUi: settings.loginUi === 'classic' ? 'classic' : 'xp', micDeviceId: typeof settings.micDeviceId === 'string' ? settings.micDeviceId : '', noiseSuppression: ['off', 'rnnoise'].includes(settings.noiseSuppression) ? settings.noiseSuppression : 'webrtc', dns, dnsCustom: typeof settings.dnsCustom === 'string' ? settings.dnsCustom.trim() : '' };
  applyDnsSettings();
  await fs.mkdir(path.dirname(displayStatePath), { recursive: true });
  await fs.writeFile(displayStatePath, JSON.stringify(activeDisplay));
  notifyDisplayChanged(activeDisplay);
  return activeDisplay;
}

// tab: the page of Display Properties to show (the Control Panel opens them one by one).
function openThemeSettings(owner, tab) {
  const page = typeof tab === 'string' && /^[a-z]+$/.test(tab) ? tab : '';
  if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.focus(); if (page) settingsWindow.webContents.send('settings:show-tab', page); return; }
  settingsWindow = new BrowserWindow({
    title: 'Display Properties', width: 520, height: 560, minWidth: 460, minHeight: 400, resizable: true,
    parent: owner, frame: false, transparent: false, backgroundColor: '#ece9d8',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  settingsWindow.on('closed', () => { settingsWindow = null; });
  settingsWindow.loadFile(path.join(__dirname, 'assets', 'html', 'theme_settings_frame.html'), page ? { query: { tab: page } } : undefined);
}
// Control Panel applets (Display, Sounds, Mouse…): Display Properties showing only their pages,
// each in its own window like in Windows XP.
const appletWindows = new Map();
function openApplet(owner, applet, tab) {
  const name = typeof applet === 'string' && /^[a-z]+$/.test(applet) ? applet : 'display';
  const page = typeof tab === 'string' && /^[a-z]+$/.test(tab) ? tab : '';
  const existing = appletWindows.get(name);
  if (existing && !existing.isDestroyed()) { existing.focus(); if (page) existing.webContents.send('settings:show-tab', page); return; }
  // Window sizes of the XP applets.
  const [width, height] = { display: [520, 560], backups: [520, 560], mouse: [410, 480], updates: [410, 520], assistant: [420, 360] }[name] || [440, 420];
  const win = new BrowserWindow({
    title: name, width, height, minWidth: 380, minHeight: 320, resizable: true,
    parent: owner, frame: false, transparent: false, backgroundColor: '#ece9d8',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  appletWindows.set(name, win);
  win.on('closed', () => { if (appletWindows.get(name) === win) appletWindows.delete(name); });
  win.loadFile(path.join(__dirname, 'assets', 'html', 'theme_settings_frame.html'), { query: page ? { applet: name, tab: page } : { applet: name } });
}
let controlPanelWindow;
// Windows opened from the Control Panel belong to the chat window, so they stay open when it closes.
const windowOwner = event => { const win = BrowserWindow.fromWebContents(event.sender); return win && win === controlPanelWindow ? win.getParentWindow() || undefined : win; };
function openControlPanel(owner) {
  if (controlPanelWindow && !controlPanelWindow.isDestroyed()) { controlPanelWindow.focus(); return; }
  controlPanelWindow = new BrowserWindow({
    title: 'Control Panel', width: 680, height: 480, minWidth: 420, minHeight: 320, resizable: true,
    parent: owner, frame: false, transparent: false, backgroundColor: '#ece9d8',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  controlPanelWindow.on('closed', () => { controlPanelWindow = null; });
  controlPanelWindow.loadFile(path.join(__dirname, 'assets', 'html', 'control_panel.html'));
}

// Server admin panel (/admin/*). Its session is an HttpOnly SameSite=Lax cookie, which a page
// on file:// never sends to the server, so the requests go through the main process and the
// cookie is kept here, per server, until the app quits.
let adminWindow;
const adminCookies = new Map();
function openAdminPanel(owner, server) {
  const url = typeof server === 'string' && /^https?:\/\//.test(server) ? server.replace(/\/$/, '') : '';
  if (!url) return;
  if (adminWindow && !adminWindow.isDestroyed()) { adminWindow.focus(); return; }
  adminWindow = new BrowserWindow({
    title: 'Nekochat Reloaded Admin', width: 860, height: 600, minWidth: 620, minHeight: 420,
    parent: owner, frame: false, transparent: false, backgroundColor: '#ece9d8',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  adminWindow.on('closed', () => { adminWindow = null; });
  adminWindow.loadFile(path.join(__dirname, 'assets', 'html', 'admin.html'), { query: { server: url } });
}
async function adminRequest({ server, method = 'GET', path: route = '', body } = {}) {
  const url = typeof server === 'string' && /^https?:\/\//.test(server) ? server.replace(/\/$/, '') : '';
  if (!url || typeof route !== 'string' || !/^\/[a-z0-9/_?=&%.-]*$/i.test(route)) throw new Error('Invalid admin request.');
  const response = await fetch(`${url}/admin${route}`, {
    method, headers: { 'Content-Type': 'application/json', ...(adminCookies.get(url) ? { Cookie: adminCookies.get(url) } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const cookie = response.headers.getSetCookie?.().find(item => item.startsWith('neko_admin='));
  if (cookie) adminCookies.set(url, cookie.split(';')[0]);
  if (route === '/logout') adminCookies.delete(url);
  const data = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, data };
}
function openThemeEditor(owner) {
  if (themeEditorWindow && !themeEditorWindow.isDestroyed()) { themeEditorWindow.focus(); return; }
  themeEditorWindow = new BrowserWindow({
    title: 'Theme Editor', width: 860, height: 600, minWidth: 620, minHeight: 420,
    parent: owner, frame: false, transparent: false, backgroundColor: '#ece9d8',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  themeEditorWindow.on('closed', () => { themeEditorWindow = null; });
  themeEditorWindow.loadFile(path.join(__dirname, 'assets', 'html', 'theme_editor.html'));
}
function openThemeBrowser(owner) {
  if (themeBrowserWindow && !themeBrowserWindow.isDestroyed()) { themeBrowserWindow.focus(); return; }
  themeBrowserWindow = new BrowserWindow({
    title: 'Nekochat Reloaded Catalog', width: 720, height: 540, minWidth: 520, minHeight: 360,
    parent: owner, frame: false, transparent: false, backgroundColor: '#ece9d8',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  themeBrowserWindow.on('closed', () => { themeBrowserWindow = null; });
  themeBrowserWindow.loadFile(path.join(__dirname, 'assets', 'html', 'theme_browser.html'));
}

function openEmojiBrowser(owner) {
  emojiBrowserOwner = owner;
  if (emojiBrowserWindow && !emojiBrowserWindow.isDestroyed()) { emojiBrowserWindow.focus(); return; }
  emojiBrowserWindow = new BrowserWindow({
    title: 'Nekochat Reloaded Emoji', width: 520, height: 580, minWidth: 420, minHeight: 400,
    parent: owner, modal: false, frame: false, transparent: false, backgroundColor: '#ece9d8',
    icon: path.join(__dirname, 'assets', 'images', 'nekochat_icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  emojiBrowserWindow.on('closed', () => { emojiBrowserWindow = null; emojiBrowserOwner = null; });
  emojiBrowserWindow.loadFile(path.join(__dirname, 'assets', 'html', 'emoji_browser.html'));
}

function showSystemDialog(owner, data = {}) {
  const dialogWindow = new BrowserWindow({
    title: data.title || 'Nekochat Reloaded', width: 380, height: 185, minWidth: 330, minHeight: 165, resizable: false,
    parent: owner, modal: false, frame: false, transparent: false, backgroundColor: '#ece9d8',
    icon: path.join(__dirname, 'assets', 'images', 'nekochat_icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  systemDialogWindows.add(dialogWindow);
  dialogWindow.once('ready-to-show', () => { dialogWindow.webContents.send('system:update', data); dialogWindow.show(); });
  dialogWindow.on('closed', () => { systemDialogWindows.delete(dialogWindow); });
  dialogWindow.loadFile(path.join(__dirname, 'assets', 'html', 'system_dialog.html'));
}

function openProfileSettings() {
  if (profileWindow && !profileWindow.isDestroyed()) { profileWindow.focus(); return; }
  profileWindow = new BrowserWindow({
    title: 'User Accounts', width: 700, height: 520, minWidth: 460, minHeight: 360, resizable: true,
    frame: false, transparent: false, backgroundColor: '#ece9d8',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  profileWindow.on('closed', () => { profileWindow = null; });
  profileWindow.loadFile(path.join(__dirname, 'assets', 'html', 'profile_settings_frame.html'));
}

function openRoomCreate(owner) {
  if (roomCreateWindow && !roomCreateWindow.isDestroyed()) { roomCreateWindow.focus(); return; }
  roomCreateWindow = new BrowserWindow({
    title: 'Create Room', width: 400, height: 470, minWidth: 350, minHeight: 360, resizable: true,
    parent: owner, modal: false, frame: false, transparent: false, backgroundColor: '#ece9d8',
    icon: path.join(__dirname, 'assets', 'images', 'nekochat_icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  roomCreateWindow.on('closed', () => { roomCreateWindow = null; });
  roomCreateWindow.loadFile(path.join(__dirname, 'assets', 'html', 'room_create.html'));
}

function sendCallState(state) {
  if (callWindow && !callWindow.isDestroyed()) callWindow.webContents.send('call:update', state);
}
function openCallWindow(owner, state) {
  callOwner = owner;
  if (callWindow && !callWindow.isDestroyed()) { sendCallState(state); return; }
  callWindow = new BrowserWindow({
    title: 'Nekochat Reloaded Call', width: 520, height: 430, minWidth: 380, minHeight: 300,
    resizable: true, parent: owner, modal: false, frame: false, transparent: false, backgroundColor: '#ece9d8',
    icon: path.join(__dirname, 'assets', 'images', 'nekochat_icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  callWindow.once('ready-to-show', () => { sendCallState(state); callWindow.show(); });
  callWindow.on('closed', () => {
    const shouldNotify = !closingCallWindow;
    callWindow = null; closingCallWindow = false;
    if (shouldNotify && callOwner && !callOwner.isDestroyed()) callOwner.webContents.send('call:action', { action: 'dismiss' });
    callOwner = null;
  });
  callWindow.loadFile(path.join(__dirname, 'assets', 'html', 'call.html'));
}
function closeCallWindow() {
  if (!callWindow || callWindow.isDestroyed()) return;
  closingCallWindow = true;
  callWindow.close();
}

function openDetachedChat(owner, chat) {
  const kind = chat?.kind === 'room' ? 'room' : chat?.kind === 'dm' ? 'dm' : null;
  const id = Number(chat?.id);
  if (!kind || !Number.isInteger(id) || id < 1) return false;
  const key = `${kind}:${id}`;
  const existing = detachedChatWindows.get(key);
  if (existing && !existing.isDestroyed()) { existing.focus(); return true; }
  const win = new BrowserWindow({
    title: 'Nekochat Reloaded', icon: path.join(__dirname, 'assets', 'images', 'nekochat_icon.png'),
    width: 620, height: 480, minWidth: 400, minHeight: 260,
    frame: false, transparent: false, resizable: true, show: false, backgroundColor: '#ece9d8',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  detachedChatWindows.set(key, win);
  win.on('close', event => {
    if (closingDetachedWindows.has(win.id) || !mainWindow || mainWindow.isDestroyed()) return;
    event.preventDefault();
    returnDetachedChat(win, { kind, id });
  });
  win.on('closed', () => { closingDetachedWindows.delete(win.id); detachedChatWindows.delete(key); });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'assets', 'html', 'index.html'), { query: { detached: '1', kind, id: String(id) } });
  return true;
}

function returnDetachedChat(sender, chat) {
  const kind = chat?.kind === 'room' ? 'room' : chat?.kind === 'dm' ? 'dm' : null;
  const id = Number(chat?.id);
  if (!kind || !Number.isInteger(id) || id < 1 || !mainWindow || mainWindow.isDestroyed()) return;
  const key = `${kind}:${id}`;
  if (detachedChatWindows.get(key) !== sender) return;
  const point = chat?.point;
  if (point && !(point.x >= mainWindow.getBounds().x && point.y >= mainWindow.getBounds().y && point.x <= mainWindow.getBounds().x + mainWindow.getBounds().width && point.y <= mainWindow.getBounds().y + mainWindow.getBounds().height)) return;
  mainWindow.show(); mainWindow.focus();
  mainWindow.webContents.send('chat:restore', { kind, id });
  closingDetachedWindows.add(sender.id);
  sender.close();
}

function closeDetachedChats() {
  for (const win of detachedChatWindows.values()) {
    if (!win.isDestroyed()) { closingDetachedWindows.add(win.id); win.close(); }
  }
}

function focusDetachedChat(chat) {
  const kind = chat?.kind === 'room' ? 'room' : chat?.kind === 'dm' ? 'dm' : null;
  const id = Number(chat?.id);
  if (!kind || !Number.isInteger(id) || id < 1) return false;
  const win = detachedChatWindows.get(`${kind}:${id}`);
  if (!win || win.isDestroyed()) return false;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
  return true;
}

const reservedThemeIds = ['Current', 'Luna', 'Embedded', 'Royale'];

async function scanThemes(root, userInstalled = false) {
  const found = [];
  let entries;
  try { entries = await fs.readdir(root, { withFileTypes: true }); } catch { return found; }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || reservedThemeIds.includes(entry.name)) continue;
    const directory = path.join(root, entry.name);
    const files = await fs.readdir(directory, { withFileTypes: true });
    let source = files.find(file => file.isFile() && file.name.toLowerCase().endsWith('.theme')) || files.find(file => file.isFile() && file.name.toLowerCase().endsWith('.msstyles')) || files.find(file => file.isFile() && file.name.toLowerCase() === 'theme.css');
    // A CSS theme with colour schemes: schemes/<scheme>/theme.css (names in an optional theme.json).
    let schemed = false;
    if (!source && files.some(file => file.isDirectory() && file.name === 'schemes')) {
      const schemeDirs = await fs.readdir(path.join(directory, 'schemes'), { withFileTypes: true }).catch(() => []);
      for (const scheme of schemeDirs) if (scheme.isDirectory()) { try { await fs.access(path.join(directory, 'schemes', scheme.name, 'theme.css')); schemed = true; break; } catch {} }
      if (schemed) source = { name: 'theme.css' };
    }
    if (source) {
      let catalogId;
      try { catalogId = JSON.parse(await fs.readFile(path.join(directory, 'catalog-theme.json'), 'utf8')).id; } catch {}
      found.push({ id: entry.name, source: path.join(directory, source.name), css: source.name.toLowerCase() === 'theme.css', schemed, userInstalled, catalogId, editorMade: files.some(file => file.name === 'theme-editor.json') });
    }
  }
  return found;
}

async function discoverThemes() {
  const found = new Map(builtInThemes.map(theme => [theme.id, theme]));
  // themes/classic and themes/luna are the sources of the built-in Classic and Luna, not extra themes.
  for (const theme of await scanThemes(themesRoot)) if (!builtInThemes.some(item => item.id.toLowerCase() === theme.id.toLowerCase())) found.set(theme.id, theme);
  for (const theme of await scanThemes(userThemesRoot, true)) found.set(theme.id, theme);
  return [...found.values()];
}

async function copyDirectory(source, destination) {
  // fs.cp()'s recursive walk relies on fs.opendir, which Electron's asar
  // interception does not patch — it throws ENOENT when the source lives
  // inside app.asar. readdir/mkdir/copyFile are patched, so use those instead.
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyDirectory(from, to);
    else await fs.copyFile(from, to);
  }
}
async function copyThemeBundle(sourceFile, destination) {
  const sourceRoot = path.dirname(sourceFile);
  const copyRelevantFiles = async directory => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const from = path.join(directory, entry.name);
      if (entry.isDirectory()) { await copyRelevantFiles(from); continue; }
      // Aero themes keep extra visual-style resources next to the .theme.
      // Keep them together so imported Windows 7 themes remain portable.
      if (!/\.(theme|msstyles|dll|mui)$/i.test(entry.name)) continue;
      const relative = path.relative(sourceRoot, from);
      const target = path.join(destination, relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(from, target);
    }
  };
  await copyRelevantFiles(sourceRoot);
  return path.join(destination, path.basename(sourceFile));
}

const produceThemeAssets = async (id, destination) => {
  const source = (await discoverThemes()).find(item => item.id === id);
  if (!source) throw new Error('Theme not found');

  if (source.classic) {
    const directory = path.join(destination, 'schemes', 'classic');
    await fs.mkdir(directory, { recursive: true });
    await fs.copyFile(source.source, path.join(directory, 'theme.css'));
    return { theme: 'Windows Classic', schemes: [{ id: 'classic', name: 'Windows Classic' }], defaultScheme: 'classic' };
  }

  const runImporter = async python => {
    await execFileAsync(python, [path.join(__dirname, 'tools', 'import_msstyles.py'), source.source, destination]);
    return JSON.parse(await fs.readFile(path.join(destination, 'theme.json'), 'utf8'));
  };

  const candidates = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
  let cause;
  for (const python of candidates) {
    try {
      return await runImporter(python);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      cause = error;
    }
  }
  throw Object.assign(new Error('Importing themes requires Python 3 with the "pefile" and "Pillow" packages installed.'), { code: 'ENOENT', cause });
};

async function prebuiltFor(id) {
  const directory = path.join(prebuiltRoot, id);
  try {
    await fs.readFile(path.join(directory, 'theme.json'), 'utf8');
    const metadata = JSON.parse(await fs.readFile(path.join(directory, 'theme.json'), 'utf8'));
    return { output: directory, metadata };
  } catch {
    return null;
  }
}

async function materializePrebuiltTheme(id, source, metadata) {
  const output = path.join(runtimeThemesRoot, id);
  // The stamp covers every stylesheet and the app version, so an update of the app (or of a
  // built-in theme.css) replaces the copy in tmp; before, only theme.json was compared.
  const stats = [await fs.stat(path.join(source, 'theme.json'))];
  for (const scheme of metadata.schemes || []) try { stats.push(await fs.stat(path.join(source, 'schemes', scheme.id, 'theme.css'))); } catch {}
  try { stats.push(await fs.stat(path.join(source, 'theme.css'))); } catch {}
  const stamp = `${app.getVersion()}:${stats.map(stat => `${stat.mtimeMs}:${stat.size}`).join('|')}`;
  let cached = false;
  try { cached = JSON.parse(await fs.readFile(path.join(output, '.prebuilt-cache.json'), 'utf8')).stamp === stamp; } catch {}
  if (!cached) {
    // CSS custom properties resolve url(...) in the stylesheet that consumes
    // them, not where the variable was declared.  Keep the rendered assets in
    // tmp and make every asset URL absolute before the app loads the theme.
    await fs.rm(output, { recursive: true, force: true });
    await copyDirectory(source, output);
    const rewriteCss = async directory => {
      const cssPath = path.join(directory, 'theme.css');
      let css = await fs.readFile(cssPath, 'utf8');
      css = css.replace(/url\("[^"]+"\)/g, match => {
        if (/^url\("(data|https?|blob):/i.test(match)) return match;
        const asset = path.basename(match.slice(5, -2));
        return `url("${pathToFileURL(path.join(directory, asset)).href}")`;
      });
      await fs.writeFile(cssPath, css);
    };
    // Classic has only a colour-scheme stylesheet; imported msstyles themes
    // may also provide a root stylesheet.  Rewrite the latter when present.
    try { await fs.access(path.join(output, 'theme.css')); await rewriteCss(output); } catch {}
    for (const scheme of metadata.schemes || []) await rewriteCss(path.join(output, 'schemes', scheme.id));
    await fs.writeFile(path.join(output, '.prebuilt-cache.json'), JSON.stringify({ stamp }));
  }
  return output;
}

// A url() inside a custom property resolves against the stylesheet that uses the variable,
// not theme.css, so relative pictures are made absolute in a runtime copy of theme.css.
async function materializeCssTheme(id, source) {
  const css = await fs.readFile(source, 'utf8');
  if (!/url\((["']?)(?!(?:data|file|https?|blob):)[^"')]+\1\)/i.test(css)) return path.dirname(source);
  const base = pathToFileURL(`${path.dirname(source)}${path.sep}`).href;
  const output = path.join(runtimeThemesRoot, `css-${id}`);
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'theme.css'), css.replace(/url\((["']?)([^"')]+)\1\)/g, (match, quote, url) => /^(data|file|https?|blob):/i.test(url) ? match : `url("${new URL(url, base).href}")`));
  return output;
}
// Every scheme of a CSS theme becomes runtime-themes/css-<id>/schemes/<scheme>/theme.css with
// absolute picture URLs, the same layout the .msstyles importer writes.
async function materializeSchemedCssTheme(id, root) {
  let info = {};
  try { info = JSON.parse(await fs.readFile(path.join(root, 'theme.json'), 'utf8')); } catch {}
  const named = new Map((Array.isArray(info.schemes) ? info.schemes : []).map(item => [String(item.id), String(item.name || item.id)]));
  const output = path.join(runtimeThemesRoot, `css-${id}`);
  const schemes = [];
  for (const entry of await fs.readdir(path.join(root, 'schemes'), { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[\w.-]+$/.test(entry.name)) continue;
    const source = path.join(root, 'schemes', entry.name, 'theme.css');
    let css; try { css = await fs.readFile(source, 'utf8'); } catch { continue; }
    const base = pathToFileURL(`${path.dirname(source)}${path.sep}`).href;
    const target = path.join(output, 'schemes', entry.name);
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'theme.css'), css.replace(/url\((["']?)([^"')]+)\1\)/g, (match, quote, url) => /^(data|file|https?|blob):/i.test(url) ? match : `url("${new URL(url, base).href}")`));
    schemes.push({ id: entry.name, name: named.get(entry.name) || entry.name });
  }
  if (!schemes.length) throw new Error('The theme has no colour schemes.');
  const defaultScheme = schemes.some(item => item.id === info.defaultScheme) ? info.defaultScheme : schemes[0].id;
  return { output, metadata: { theme: info.name || id, schemes, defaultScheme } };
}
async function prepareTheme(id) {
  const theme = (await discoverThemes()).find(item => item.id === id);
  if (!theme) throw new Error('Theme not found');
  const prebuilt = await prebuiltFor(id);
  if (prebuilt) return { ...theme, output: await materializePrebuiltTheme(id, prebuilt.output, prebuilt.metadata), metadata: prebuilt.metadata };
  if (theme.css && theme.schemed) return { ...theme, ...(await materializeSchemedCssTheme(id, path.dirname(theme.source))), css: false };
  if (theme.css) return { ...theme, output: await materializeCssTheme(id, theme.source), css: true, metadata: { theme: id, schemes: [{ id: 'default', name: 'Default' }], defaultScheme: 'default' } };
  const output = path.join(runtimeThemesRoot, id);
  await fs.mkdir(runtimeThemesRoot, { recursive: true });
  if (theme.classic) {
    await produceThemeAssets(id, output);
    return { ...theme, output, metadata: JSON.parse(await fs.readFile(path.join(output, 'theme.json'), 'utf8')) };
  }
  const sourceStat = await fs.stat(theme.source);
  const importerPath = path.join(__dirname, 'tools', 'import_msstyles.py');
  const importerStat = await fs.stat(importerPath);
  const stamp = `${sourceStat.mtimeMs}:${sourceStat.size}:${importerStat.mtimeMs}`;
  let cached = false;
  try { cached = JSON.parse(await fs.readFile(path.join(output, '.cache.json'), 'utf8')).stamp === stamp; } catch {}
  if (!cached) {
    await produceThemeAssets(id, output);
    await fs.writeFile(path.join(output, '.cache.json'), JSON.stringify({ stamp }));
  }
  const metadata = JSON.parse(await fs.readFile(path.join(output, 'theme.json'), 'utf8'));
  return { ...theme, output, metadata };
}

function runtimeCssUrl(directory, revision = Date.now()) {
  return `${pathToFileURL(path.join(directory, 'theme.css')).href}?theme=${revision}`;
}

async function activateTheme(id, requestedScheme) {
  const prepared = await prepareTheme(id);
  const scheme = requestedScheme || prepared.metadata.defaultScheme;
  if (!prepared.metadata.schemes?.some(item => item.id === scheme)) throw new Error('Unknown colour scheme');
  const directory = prepared.css ? prepared.output : path.join(prepared.output, 'schemes', scheme);
  await fs.access(path.join(directory, 'theme.css'));
  activeTheme = { id, scheme, revision: Date.now(), cssUrl: runtimeCssUrl(directory) };
  await fs.mkdir(path.dirname(themeStatePath), { recursive: true });
  await fs.writeFile(themeStatePath, JSON.stringify({ id, scheme }));
  notifyThemeChanged(activeTheme);
  return activeTheme;
}

function catalogEntries(manifest) {
  const entries = Array.isArray(manifest) ? manifest : Array.isArray(manifest?.themes) ? manifest.themes : Object.entries(manifest || {}).map(([theme_id, value]) => ({ theme_id, ...(value || {}) }));
  return entries.map((entry, index) => {
    const theme_id = String(entry.theme_id || entry.id || `theme-${index + 1}`);
    const directory = String(entry.directory || theme_id).replace(/^\/+|\/+$/g, '');
    const details = entry.Details || entry.details || {};
    return {
      id: theme_id, directory, displayName: entry.DisplayName || entry.displayName || theme_id,
      colorSchemes: entry.ColorSchemes || entry.ColorShemas || entry.colorSchemes || [],
      type: details.Type || details.type || entry.Type || entry.type || 'WindowsThemeFile',
      author: details.Author || details.author || entry.Author || entry.author || 'Unknown',
      added: String(details.Added || details.added || entry.Added || entry.added || ''),
      version: details.Version || details.version || entry.Version || entry.version || 'Unknown',
      previewUrl: entry.Preview || entry.preview || `${themeCatalogRoot}/${directory}/Preview.png`,
      descriptionUrl: entry.Description || entry.description || `${themeCatalogRoot}/${directory}/Description.md`,
      detailsUrl: entry.DetailsFile || entry.detailsFile || `${themeCatalogRoot}/${directory}/Details.json`,
      zipUrl: entry.ThemeZIP || entry.themeZip || `${themeCatalogRoot}/${directory}/Theme.ZIP`
    };
  });
}
async function fetchCatalog() {
  const response = await fetch(`${themeCatalogRoot}/themes.json`);
  if (!response.ok) throw new Error(response.status === 404 ? 'Theme catalog has not been published yet.' : `Unable to load theme catalog (${response.status}).`);
  return catalogEntries(await response.json());
}
// ---- Catalog packs: cursors, sounds, icons and combos (any of those plus a theme) -------------
// packs.json lists them; each directory holds Pack.ZIP with pack.json and the folders sounds/,
// cursors/ (cursors.json), icons/ (icons.json) and theme/.
const PACK_TYPES = ['cursors', 'sounds', 'icons', 'wallpapers', 'assistants', 'combo'];
const packFileList = entry => (Array.isArray(entry.Files || entry.files) ? (entry.Files || entry.files) : []).map(String).filter(name => /^[^/\\]+$/.test(name) && name !== '.' && name !== '..');
function packEntries(manifest) {
  const entries = Array.isArray(manifest) ? manifest : Array.isArray(manifest?.packs) ? manifest.packs : [];
  return entries.map((entry, index) => {
    const id = String(entry.pack_id || entry.id || `pack-${index + 1}`);
    const directory = String(entry.directory || id).replace(/^\/+|\/+$/g, '');
    const details = entry.Details || entry.details || {};
    const type = PACK_TYPES.includes(String(entry.type || entry.Type).toLowerCase()) ? String(entry.type || entry.Type).toLowerCase() : 'combo';
    return {
      id, type, directory, kind: 'pack', displayName: entry.DisplayName || entry.displayName || id,
      // A combo is only a list of other catalog items: { theme, cursors, sounds, icons } → their ids.
      includes: type === 'combo' && typeof (entry.Includes || entry.includes) === 'object' ? Object.fromEntries(Object.entries(entry.Includes || entry.includes).filter(([part, id]) => ['theme', 'cursors', 'sounds', 'icons', 'wallpapers', 'assistants'].includes(part) && id).map(([part, id]) => [part, String(id)])) : null,
      contains: type === 'combo' && (entry.Includes || entry.includes) ? Object.keys(entry.Includes || entry.includes) : Array.isArray(entry.Contains || entry.contains) ? (entry.Contains || entry.contains).map(String) : [type],
      author: details.Author || details.author || entry.Author || entry.author || 'Unknown',
      added: String(details.Added || details.added || entry.Added || entry.added || ''),
      version: details.Version || details.version || entry.Version || entry.version || '',
      // Plain files instead of Pack.ZIP: "Files": ["Autumn.jpg"] in the folder, installed under <type>/.
      files: packFileList(entry),
      previewUrl: entry.Preview || entry.preview || (type === 'wallpapers' && packFileList(entry)[0] ? `${themeCatalogRoot}/${directory}/${encodeURIComponent(packFileList(entry)[0])}` : `${themeCatalogRoot}/${directory}/Preview.png`),
      descriptionUrl: entry.Description || entry.description || `${themeCatalogRoot}/${directory}/Description.md`,
      zipUrl: entry.PackZIP || entry.packZip || `${themeCatalogRoot}/${directory}/Pack.ZIP`,
    };
  });
}
async function fetchCatalogPacks() {
  const response = await fetch(`${themeCatalogRoot}/packs.json`);
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Unable to load the catalog (${response.status}).`);
  return packEntries(await response.json());
}
const packFolder = id => { const folder = path.resolve(userPacksRoot, String(id)); if (!folder.startsWith(`${path.resolve(userPacksRoot)}${path.sep}`)) throw new Error('Invalid pack.'); return folder; };
// sounds/<name>.wav|mp3|ogg → { name: url }; cursors/cursors.json → { kind: { url, x, y } };
// icons/icons.json → { name: url }; wallpapers/<name>.jpg|png → { name: url } (chat backgrounds).
// Missing or broken parts are left out.
async function packContents(folder, files) {
  const sounds = {};
  for (const [name, url] of Object.entries(files)) { const match = name.match(/^sounds\/([\w-]+)\.(wav|mp3|ogg)$/i); if (match) sounds[match[1].toLowerCase()] = url; }
  const readJson = async file => { try { return JSON.parse(await fs.readFile(path.join(folder, file), 'utf8')); } catch { return null; } };
  const cursors = {};
  for (const [kind, value] of Object.entries(await readJson('cursors/cursors.json') || {})) { const file = typeof value === 'string' ? value : value?.file; const url = files[`cursors/${file}`]; if (url) cursors[kind] = { url, x: value?.x, y: value?.y }; }
  const icons = {};
  for (const [name, file] of Object.entries(await readJson('icons/icons.json') || {})) { const url = files[`icons/${file}`]; if (url) icons[name] = url; }
  const wallpapers = {};
  for (const [name, url] of Object.entries(files)) { const match = name.match(/^wallpapers\/([^/]+)\.(jpe?g|png|webp)$/i); if (match) wallpapers[match[1]] = url; }
  // assistant/agent.json + frames.png + sound<N>.wav: a Microsoft Agent character (assets/js/assistant.js).
  const assistant = files['assistant/agent.json'] && files['assistant/frames.png'] ? { json: files['assistant/agent.json'], frames: files['assistant/frames.png'], sounds: Object.fromEntries(Object.entries(files).map(([name, url]) => [name.match(/^assistant\/sound(\d+)\.(wav|mp3|ogg)$/i)?.[1], url]).filter(([index]) => index !== undefined)) } : null;
  return { sounds, cursors, icons, wallpapers, assistant };
}
async function listPacks() {
  const packs = [];
  let entries = []; try { entries = await fs.readdir(userPacksRoot, { withFileTypes: true }); } catch {}
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const folder = path.join(userPacksRoot, entry.name);
    let info; try { info = JSON.parse(await fs.readFile(path.join(folder, 'pack.json'), 'utf8')); } catch { continue; }
    // Every file as a URL the windows can load (sounds/notify.wav → file:///…).
    const files = {};
    const walk = async (dir, relative) => { for (const item of await fs.readdir(dir, { withFileTypes: true })) { const name = relative ? `${relative}/${item.name}` : item.name; if (item.isDirectory()) { if (name !== 'theme') await walk(path.join(dir, item.name), name); } else files[name] = pathToFileURL(path.join(dir, item.name)).href; } };
    await walk(folder, '');
    // A combo's own folder has no files: it points at the packs it installed.
    const own = await packContents(folder, files);
    const parts = Array.isArray(info.parts) ? await Promise.all(info.parts.map(async part => { try { const partFolder = packFolder(part); const partFiles = {}; const walkPart = async (dir, relative) => { for (const item of await fs.readdir(dir, { withFileTypes: true })) { const name = relative ? `${relative}/${item.name}` : item.name; if (item.isDirectory()) await walkPart(path.join(dir, item.name), name); else partFiles[name] = pathToFileURL(path.join(dir, item.name)).href; } }; await walkPart(partFolder, ''); return packContents(partFolder, partFiles); } catch { return { sounds: {}, cursors: {}, icons: {}, wallpapers: {}, assistant: null }; } })) : [];
    const merged = parts.reduce((all, part) => ({ sounds: { ...all.sounds, ...part.sounds }, cursors: { ...all.cursors, ...part.cursors }, icons: { ...all.icons, ...part.icons }, wallpapers: { ...all.wallpapers, ...part.wallpapers }, assistant: all.assistant || part.assistant }), own);
    packs.push({ id: entry.name, catalogId: info.catalogId || null, type: info.type || 'combo', name: info.name || entry.name, author: info.author || '', contains: info.contains || [], theme: info.theme || null, parts: info.parts || [], files, ...merged });
  }
  return packs;
}
async function installCatalogPack(id) {
  const catalog = await fetchCatalogPacks();
  const item = catalog.find(pack => pack.id === id);
  if (!item) throw new Error('The pack no longer exists in the catalog.');
  if (item.includes) return installCombo(item, catalog);
  const temporary = await fs.mkdtemp(path.join(app.getPath('temp'), 'nekochat-pack-'));
  const safeId = item.id.replace(/[^a-zA-Z0-9._-]/g, '_');
  const destination = packFolder(safeId);
  try {
    if (item.files.length) {
      // No Pack.ZIP: download the listed files into the folder of the pack's type.
      const folder = item.type === 'assistants' ? 'assistant' : item.type;
      await fs.mkdir(path.join(temporary, folder), { recursive: true });
      for (const name of item.files) {
        const response = await fetch(`${themeCatalogRoot}/${item.directory}/${encodeURIComponent(name)}`);
        if (!response.ok) throw new Error(`Unable to download ${name} (${response.status}).`);
        await fs.writeFile(path.join(temporary, folder, name), Buffer.from(await response.arrayBuffer()));
      }
    } else {
      const response = await fetch(item.zipUrl);
      if (!response.ok) throw new Error(`Unable to download Pack.ZIP (${response.status}).`);
      await extractZip(Buffer.from(await response.arrayBuffer()), temporary);
    }
    let info = {}; try { info = JSON.parse(await fs.readFile(path.join(temporary, 'pack.json'), 'utf8')); } catch {}
    const contains = [];
    for (const part of ['sounds', 'cursors', 'icons', 'wallpapers', 'assistant', 'theme']) { try { await fs.access(path.join(temporary, part)); contains.push(part); } catch {} }
    // The theme of a combo goes to the installed themes, like a catalog theme.
    let themeId = null;
    if (contains.includes('theme')) {
      const source = await findThemeSource(path.join(temporary, 'theme'));
      if (source) {
        const themeDestination = path.join(userThemesRoot, `${safeId}-theme`);
        await fs.rm(themeDestination, { recursive: true, force: true });
        await fs.mkdir(themeDestination, { recursive: true });
        const cssRoot = path.basename(path.dirname(path.dirname(source))) === 'schemes' ? path.dirname(path.dirname(path.dirname(source))) : path.dirname(source);
        if (path.basename(source).toLowerCase() === 'theme.css') await copyDirectory(cssRoot, themeDestination); else await copyThemeBundle(source, themeDestination);
        await fs.writeFile(path.join(themeDestination, 'catalog-theme.json'), JSON.stringify({ id: `pack:${item.id}` }));
        themeId = path.basename(themeDestination);
      }
    }
    await fs.rm(destination, { recursive: true, force: true });
    await fs.mkdir(destination, { recursive: true });
    for (const part of contains.filter(part => part !== 'theme')) await copyDirectory(path.join(temporary, part), path.join(destination, part));
    await fs.writeFile(path.join(destination, 'pack.json'), JSON.stringify({ catalogId: item.id, type: item.type, name: info.name || item.displayName, author: info.author || item.author, contains, theme: themeId }, null, 1));
    return { id: safeId, packs: await listPacks(), themes: await listThemes() };
  } finally { await fs.rm(temporary, { recursive: true, force: true }).catch(() => {}); }
}
// Installs every item a combo lists (skipping what is already installed) and remembers them.
async function installCombo(item, catalog) {
  const installed = { theme: null, packs: [] };
  if (item.includes.theme) {
    const existing = (await listThemes()).find(theme => theme.catalogId === item.includes.theme);
    installed.theme = existing ? existing.id : (await installCatalogTheme(item.includes.theme)).id;
  }
  const packs = await listPacks();
  for (const part of ['cursors', 'sounds', 'icons', 'wallpapers', 'assistants']) {
    const ref = item.includes[part]; if (!ref) continue;
    if (!catalog.some(pack => pack.id === ref && !pack.includes)) throw new Error(`The combo lists a missing ${part} pack: ${ref}`);
    const existing = packs.find(pack => pack.catalogId === ref);
    installed.packs.push(existing ? existing.id : (await installCatalogPack(ref)).id);
  }
  const safeId = item.id.replace(/[^a-zA-Z0-9._-]/g, '_');
  const destination = packFolder(safeId);
  await fs.mkdir(destination, { recursive: true });
  await fs.writeFile(path.join(destination, 'pack.json'), JSON.stringify({ catalogId: item.id, type: 'combo', name: item.displayName, author: item.author, contains: Object.keys(item.includes), theme: installed.theme, parts: installed.packs }, null, 1));
  return { id: safeId, packs: await listPacks(), themes: await listThemes() };
}
async function removePack(id) {
  const folder = packFolder(id);
  let info = {}; try { info = JSON.parse(await fs.readFile(path.join(folder, 'pack.json'), 'utf8')); } catch {}
  if (info.theme) await removeTheme(info.theme).catch(() => {});
  // A combo takes the items it installed with it.
  for (const part of Array.isArray(info.parts) ? info.parts : []) await fs.rm(packFolder(part), { recursive: true, force: true }).catch(() => {});
  await fs.rm(folder, { recursive: true, force: true });
  return { packs: await listPacks(), themes: await listThemes() };
}
async function fetchCatalogThemeDetails(id) {
  const item = (await fetchCatalog()).find(theme => theme.id === id);
  if (!item) throw new Error('Theme no longer exists in the catalog.');
  let description = '';
  try {
    const response = await fetch(item.descriptionUrl);
    if (response.ok) description = await response.text();
  } catch {}
  return { ...item, description };
}
async function findThemeSource(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) { const found = await findThemeSource(target); if (found) return found; }
    if (entry.isFile() && (/\.(theme|msstyles)$/i.test(entry.name) || entry.name.toLowerCase() === 'theme.css')) return target;
  }
  return null;
}
async function installCatalogTheme(id) {
  const item = (await fetchCatalog()).find(theme => theme.id === id);
  if (!item) throw new Error('Theme no longer exists in the catalog.');
  const response = await fetch(item.zipUrl);
  if (!response.ok) throw new Error(`Unable to download Theme.ZIP (${response.status}).`);
  const zipBuffer = Buffer.from(await response.arrayBuffer());
  const temporary = await fs.mkdtemp(path.join(app.getPath('temp'), 'nekochat-theme-'));
  const destination = path.join(userThemesRoot, `${item.id.replace(/[^a-zA-Z0-9._-]/g, '_')}-${Date.now()}`);
  try {
    await extractZip(zipBuffer, temporary);
    const source = await findThemeSource(temporary);
    if (!source) throw new Error('Theme.ZIP must contain a .theme, .msstyles, or theme.css file.');
    await fs.mkdir(destination, { recursive: true });
    // A theme.css inside schemes/<scheme>/ belongs to a theme with colour schemes: copy its root.
    const cssRoot = path.basename(path.dirname(path.dirname(source))) === 'schemes' ? path.dirname(path.dirname(path.dirname(source))) : path.dirname(source);
    if (path.basename(source).toLowerCase() === 'theme.css') await copyDirectory(cssRoot, destination);
    else await copyThemeBundle(source, destination);
    await fs.writeFile(path.join(destination, 'catalog-theme.json'), JSON.stringify({ id: item.id }));
    return { id: path.basename(destination), themes: await listThemes() };
  } catch (error) {
    await fs.rm(destination, { recursive: true, force: true }).catch(() => {});
    throw error;
  } finally { await fs.rm(temporary, { recursive: true, force: true }).catch(() => {}); }
}

// ---- Settings backups: installed themes go into the archive the Display Properties window builds.
async function exportUserThemes() {
  const files = [];
  // Installed packs (cursors, sounds, icons) travel with the themes, under packs/.
  const walk = async (folder, relative, prefix) => {
    let entries = [];
    try { entries = await fs.readdir(folder, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { if (!entry.name.startsWith('.')) await walk(path.join(folder, entry.name), name, prefix); }
      else if (entry.isFile()) files.push({ path: `${prefix}/${name}`, data: await fs.readFile(path.join(folder, entry.name)) });
    }
  };
  await walk(userThemesRoot, '', 'themes');
  await walk(userPacksRoot, '', 'packs');
  return files;
}
// Adds the backup's themes next to the installed ones; nothing installed is removed.
async function restoreUserThemes(archive) {
  const buffer = Buffer.from(archive);
  await fs.mkdir(userThemesRoot, { recursive: true });
  await extractZip(buffer, userThemesRoot, 'themes/');
  await fs.mkdir(userPacksRoot, { recursive: true });
  await extractZip(buffer, userPacksRoot, 'packs/');
  return listThemes();
}
// ---- Theme editor: a theme is edited as its theme.css (variables); saving writes a user theme
// folder with theme.css and every picture it uses, so it no longer depends on the base theme.
async function loadThemeForEditor(id, scheme) {
  const prepared = await prepareTheme(id);
  const activeScheme = scheme || prepared.metadata.defaultScheme;
  const directory = prepared.css ? prepared.output : path.join(prepared.output, 'schemes', activeScheme);
  const css = await fs.readFile(path.join(directory, 'theme.css'), 'utf8');
  const base = pathToFileURL(`${directory}${path.sep}`).href;
  // Relative pictures become absolute file URLs, so the editor can show and preview them.
  return { id, scheme: activeScheme, css: css.replace(/url\((["']?)([^"')]+)\1\)/g, (match, quote, url) => /^(data|file|https?):/i.test(url) ? match : `url("${new URL(url, base).href}")`) };
}
function editorThemeId(name) {
  // Same characters the theme:apply handler accepts.
  const id = String(name || '').replace(/[^\p{L}\p{N}._ ()-]/gu, '').replace(/\s+/g, ' ').replace(/\.{2,}/g, '.').trim().replace(/^\.+|\.+$/g, '').slice(0, 48);
  if (!id) throw new Error('Enter a name for the theme.');
  if (reservedThemeIds.includes(id) || builtInThemes.some(theme => theme.id.toLowerCase() === id.toLowerCase())) throw new Error('This name belongs to a built-in theme; choose another.');
  return id;
}
async function saveEditedTheme({ name, css, images, base }) {
  const id = editorThemeId(name);
  const directory = path.resolve(userThemesRoot, id);
  if (!directory.startsWith(`${path.resolve(userThemesRoot)}${path.sep}`)) throw new Error('Invalid theme name.');
  // Only a theme made in the editor is overwritten; an installed theme with the same name is kept.
  let existing = false;
  try { await fs.access(directory); existing = true; } catch {}
  if (existing) { try { await fs.access(path.join(directory, 'theme-editor.json')); } catch { throw new Error('A theme with this name is already installed; choose another name.'); } }
  const staging = path.join(userThemesRoot, `.saving-${Date.now()}`);
  await fs.mkdir(path.join(staging, 'images'), { recursive: true });
  const used = new Map(); const names = new Set();
  const fileName = wanted => { let candidate = wanted.replace(/[^\w.-]/g, '_') || 'image.png'; for (let n = 2; names.has(candidate.toLowerCase()); n += 1) candidate = candidate.replace(/(-\d+)?(\.\w+)?$/, `-${n}$2`); names.add(candidate.toLowerCase()); return candidate; };
  for (const [wanted, data] of Object.entries(images || {})) {
    const file = fileName(path.basename(wanted)); await fs.writeFile(path.join(staging, 'images', file), Buffer.from(data)); used.set(`edited:${wanted}`, file);
  }
  let output = String(css || '');
  const references = [...output.matchAll(/url\((["']?)(file:[^"')]+)\1\)/g)].map(match => match[2]);
  for (const url of new Set(references)) {
    const file = fileName(path.basename(fileURLToPath(url)));
    await fs.copyFile(fileURLToPath(url), path.join(staging, 'images', file)); used.set(url, file);
  }
  output = output.replace(/url\((["']?)((?:file|edited):[^"')]+)\1\)/g, (match, quote, url) => used.has(url) ? `url("images/${used.get(url)}")` : match);
  await fs.writeFile(path.join(staging, 'theme.css'), output);
  await fs.writeFile(path.join(staging, 'theme-editor.json'), JSON.stringify({ name: id, base: base || null, saved: new Date().toISOString() }, null, 1));
  await fs.rm(directory, { recursive: true, force: true });
  await fs.rename(staging, directory);
  return { id, themes: await listThemes() };
}
async function listThemes() {
  const themes = await discoverThemes();
  const results = await Promise.all(themes.map(async theme => {
    try {
      const prepared = await prepareTheme(theme.id);
      const rawName = prepared.metadata.theme || theme.id;
      const name = String(rawName).replace(/\.(theme|msstyles)$/i, '');
      return { id: theme.id, name, schemes: prepared.metadata.schemes || [], removable: Boolean(theme.userInstalled), catalogId: theme.catalogId || null, editable: Boolean(theme.userInstalled && theme.editorMade) };
    } catch (error) {
      console.warn(`Ignoring incomplete theme ${theme.id}: ${error.message}`);
      return null;
    }
  }));
  return results.filter(Boolean);
}

async function removeTheme(id) {
  const theme = (await discoverThemes()).find(item => item.id === id);
  if (!theme?.userInstalled) throw new Error('Built-in themes cannot be removed.');
  if (activeTheme?.id === id) await activateTheme('Classic', 'classic');
  const directory = path.resolve(userThemesRoot, id);
  if (!directory.startsWith(`${path.resolve(userThemesRoot)}${path.sep}`)) throw new Error('Invalid theme location.');
  await fs.rm(directory, { recursive: true, force: true });
  return { themes: await listThemes(), activeTheme };
}

app.setName('Nekochat Reloaded');
app.commandLine.appendSwitch('class', 'nekochat');

function createWindow() {
  const win = new BrowserWindow({
    title: 'Nekochat Reloaded',
    icon: path.join(__dirname, 'assets', 'images', 'nekochat_icon.png'),
    width: 807,
    height: 562,
    minWidth: 320,
    minHeight: 180,
    frame: false,
    transparent: false,
    resizable: true,
    backgroundColor: '#ece9d8',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  mainWindow = win;
  win.on('close', event => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
  });
  win.on('closed', () => { mainWindow = null; });
  win.loadFile(path.join(__dirname, 'assets', 'html', 'index.html'));
}

// ---- Updates: the chat window finds a newer GitHub release (nekochat.js) and asks here to
// install it. The Windows installer and the AppImage update themselves with electron-updater
// from that release's latest*.yml; the portable exe and the .deb package open the download.
const UPDATE_RELEASES = 'https://github.com/xKaMikax/nekochat_reloaded/releases';
const updateMode = () => process.platform === 'win32' ? (process.env.PORTABLE_EXECUTABLE_FILE ? 'download' : 'install')
  : process.platform === 'linux' ? (process.env.APPIMAGE ? 'install' : 'download') : 'download';
const updateAsset = () => process.platform === 'win32' ? (process.env.PORTABLE_EXECUTABLE_FILE ? /-portable\.exe$/i : /Setup-[^/]*\.exe$/i)
  : process.platform === 'linux' ? (process.env.APPIMAGE ? /\.AppImage$/i : /\.deb$/i) : null;
function sendUpdateStatus(status) { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:status', status); }
let updater;
async function installUpdate(release = {}, options = {}) {
  const tag = String(release.tag || '');
  if (!/^[\w.-]+$/.test(tag)) throw new Error('Invalid release.');
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const pattern = updateAsset();
  const asset = pattern && assets.find(item => pattern.test(String(item?.name || '')));
  // A quiet (automatic) download never opens the browser where the app cannot update itself.
  if (options?.quiet && (updateMode() !== 'install' || !app.isPackaged)) return { mode: 'none' };
  if (updateMode() !== 'install' || !app.isPackaged) {
    // Only GitHub links of this repository are opened.
    const url = asset && String(asset.url || '').startsWith(`${UPDATE_RELEASES}/download/`) ? asset.url : `${UPDATE_RELEASES}/tag/${encodeURIComponent(tag)}`;
    await shell.openExternal(url);
    return { mode: 'download' };
  }
  if (!updater) {
    ({ autoUpdater: updater } = require('electron-updater'));
    updater.autoDownload = false; updater.autoInstallOnAppQuit = false; updater.allowDowngrade = false; updater.allowPrerelease = true;
    updater.on('download-progress', progress => sendUpdateStatus({ state: 'progress', percent: Math.round(progress.percent || 0) }));
    updater.on('update-downloaded', info => sendUpdateStatus({ state: 'downloaded', version: info.version }));
    updater.on('error', error => sendUpdateStatus({ state: 'error', message: error?.message || String(error) }));
  }
  // Automatic Updates → Automatic: the downloaded version installs when the app quits.
  updater.autoInstallOnAppQuit = Boolean(options?.installOnQuit);
  updater.setFeedURL({ provider: 'generic', url: `${UPDATE_RELEASES}/download/${tag}` });
  const result = await updater.checkForUpdates();
  if (!result?.isUpdateAvailable) return { mode: 'none' };
  sendUpdateStatus({ state: 'progress', percent: 0 });
  updater.downloadUpdate().catch(error => sendUpdateStatus({ state: 'error', message: error?.message || String(error) }));
  return { mode: 'install', version: result.updateInfo.version };
}
// Links in messages (target=_blank) and any http(s) navigation open in the system browser,
// never inside an app window.
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  contents.on('will-navigate', (event, url) => { if (/^https?:\/\//i.test(url)) { event.preventDefault(); shell.openExternal(url); } });
});
function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show(); mainWindow.focus();
}
// Unread messages: tray icon with a red dot and a tooltip, the taskbar badge (Linux launchers /
// macOS) and a red overlay dot on the Windows taskbar button.
let unreadCount = 0;
function setUnreadCount(count) {
  unreadCount = Math.max(0, Number(count) || 0);
  const icon = unreadCount ? 'nekochat_icon_unread.png' : 'nekochat_icon.png';
  tray?.setImage(nativeImage.createFromPath(path.join(__dirname, 'assets', 'images', icon)).resize({ width: 16, height: 16 }));
  tray?.setToolTip(unreadCount ? `Nekochat Reloaded — ${unreadCount} ${activeDisplay.language === 'en' ? 'unread' : 'непрочитанных'}` : 'Nekochat Reloaded');
  try { app.setBadgeCount(unreadCount); } catch {}
  if (process.platform === 'win32' && mainWindow && !mainWindow.isDestroyed()) mainWindow.setOverlayIcon(unreadCount ? nativeImage.createFromPath(path.join(__dirname, 'assets', 'images', 'unread-overlay.png')) : null, unreadCount ? String(unreadCount) : '');
}
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'images', 'nekochat_icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Nekochat Reloaded');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open Nekochat Reloaded', click: showMainWindow }, { type: 'separator' }, { label: 'Quit', click: () => app.quit() }]));
  tray.on('click', showMainWindow);
}
async function notificationIcon(avatarUrl) {
  if (!avatarUrl) return path.join(__dirname, 'assets', 'images', 'nekochat_icon.png');
  try {
    const response = await fetch(avatarUrl);
    if (!response.ok) throw new Error('Avatar unavailable');
    const image = nativeImage.createFromBuffer(Buffer.from(await response.arrayBuffer()));
    return image.isEmpty() ? path.join(__dirname, 'assets', 'images', 'nekochat_icon.png') : image;
  } catch { return path.join(__dirname, 'assets', 'images', 'nekochat_icon.png'); }
}
// New messages pop up as a Windows XP notification balloon above the tray instead of the
// system notification. The balloon never takes focus and hides itself after 7 seconds.
let balloonWindow; let balloonTimer; let balloonReady;
function hideBalloon() { clearTimeout(balloonTimer); if (balloonWindow && !balloonWindow.isDestroyed()) balloonWindow.hide(); }
async function showMessageNotification({ sender, content, avatarUrl } = {}) {
  const width = 330; const height = 118;
  if (!balloonWindow || balloonWindow.isDestroyed()) {
    balloonWindow = new BrowserWindow({
      width, height, frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true, alwaysOnTop: true,
      focusable: false, show: false, hasShadow: false, backgroundColor: '#00000000',
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
    });
    balloonWindow.setAlwaysOnTop(true, 'pop-up-menu');
    balloonReady = balloonWindow.loadFile(path.join(__dirname, 'assets', 'html', 'balloon.html'));
  }
  await balloonReady;
  const area = screen.getPrimaryDisplay().workArea;
  balloonWindow.setBounds({ x: area.x + area.width - width - 10, y: area.y + area.height - height - 4, width, height });
  balloonWindow.webContents.send('balloon:show', { title: 'Nekochat Reloaded', sender: String(sender || 'User'), content: String(content || ''), avatarUrl: String(avatarUrl || ''), language: activeDisplay.language });
  balloonWindow.showInactive();
  clearTimeout(balloonTimer); balloonTimer = setTimeout(hideBalloon, 7000);
}

// XP draws an inactive window with a lighter frame: tell every window when it gains or loses focus.
app.on('browser-window-created', (_, win) => {
  const send = focused => { if (!win.isDestroyed()) win.webContents.send('window:focus', focused); };
  win.on('focus', () => send(true));
  win.on('blur', () => send(false));
  win.webContents.on('did-finish-load', () => send(win.isFocused()));
});
app.whenReady().then(async () => {
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    // This handler is reached only after display:prepare-capture has successfully
    // enumerated a portal source for the explicit user request.
    if (displayCaptureSource) callback({ video: displayCaptureSource });
  });
  let saved = { id: 'Classic' };
  try { saved = JSON.parse(await fs.readFile(themeStatePath, 'utf8')); } catch {}
  if (String(saved.id).toLowerCase() === 'aero') saved = { id: 'Classic', scheme: 'classic' };
  try { activeDisplay = { ...activeDisplay, ...JSON.parse(await fs.readFile(displayStatePath, 'utf8')) }; } catch {}
  applyDnsSettings();
  try { await activateTheme(saved.id, saved.scheme); }
  catch { try { await activateTheme('Classic', 'classic'); } catch (error) { console.error('Theme activation failed (built-in assets missing?):', error); } }
  ipcMain.on('window:minimize', e => BrowserWindow.fromWebContents(e.sender).minimize());
  ipcMain.on('window:maximize', e => {
    const win = BrowserWindow.fromWebContents(e.sender);
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on('window:close', e => BrowserWindow.fromWebContents(e.sender).close());
  ipcMain.on('notification:message', (_, data) => { showMessageNotification(data); });
  ipcMain.on('theme:open-settings', (e, tab) => openThemeSettings(windowOwner(e), tab));
  ipcMain.on('control-panel:open', e => openControlPanel(BrowserWindow.fromWebContents(e.sender)));
  ipcMain.on('applet:open', (e, applet, tab) => openApplet(windowOwner(e), applet, tab));
  ipcMain.on('theme:open-browser', e => openThemeBrowser(windowOwner(e)));
  ipcMain.on('theme:open-editor', e => openThemeEditor(windowOwner(e)));
  ipcMain.handle('theme-editor:load', (_, id, scheme) => loadThemeForEditor(String(id || ''), scheme ? String(scheme) : undefined));
  ipcMain.handle('theme-editor:save', (_, theme) => saveEditedTheme(theme || {}));
  ipcMain.on('emoji:open-browser', e => openEmojiBrowser(BrowserWindow.fromWebContents(e.sender)));
  ipcMain.on('system:show', (e, data) => showSystemDialog(BrowserWindow.fromWebContents(e.sender), data || {}));
  ipcMain.on('system:action', (e, action) => {
    const owner = BrowserWindow.fromWebContents(e.sender)?.getParentWindow();
    if (owner && !owner.isDestroyed()) owner.webContents.send('system:action', action);
  });
  ipcMain.on('emoji:selected', (event, emoji) => {
    if (BrowserWindow.fromWebContents(event.sender) !== emojiBrowserWindow || typeof emoji !== 'string' || emoji.length > 32) return;
    if (emojiBrowserOwner && !emojiBrowserOwner.isDestroyed()) emojiBrowserOwner.webContents.send('emoji:selected', emoji);
    emojiBrowserWindow?.close();
  });
  ipcMain.on('profile:open-settings', () => openProfileSettings());
  ipcMain.on('room:create-open', e => openRoomCreate(BrowserWindow.fromWebContents(e.sender)));
  ipcMain.on('room:created', (e, room) => { const owner = BrowserWindow.fromWebContents(e.sender).getParentWindow(); if (owner && !owner.isDestroyed()) owner.webContents.send('room:created', room); BrowserWindow.fromWebContents(e.sender).close(); });
  ipcMain.on('call:open', (e, state) => openCallWindow(BrowserWindow.fromWebContents(e.sender), state || {}));
  ipcMain.on('call:update', (_, state) => sendCallState(state || {}));
  ipcMain.on('call:close', () => closeCallWindow());
  ipcMain.on('call:action', (_, action) => { if (callOwner && !callOwner.isDestroyed()) callOwner.webContents.send('call:action', action || {}); });
  ipcMain.handle('chat:detach', (event, chat) => openDetachedChat(BrowserWindow.fromWebContents(event.sender), chat));
  ipcMain.on('chat:return', (event, chat) => returnDetachedChat(BrowserWindow.fromWebContents(event.sender), chat));
  ipcMain.on('chat:close-all', () => closeDetachedChats());
  ipcMain.handle('chat:focus-detached', (_, chat) => focusDetachedChat(chat));
  ipcMain.on('profile:changed', (_, user) => BrowserWindow.getAllWindows().forEach(win => win.webContents.send('profile:changed', user)));
  ipcMain.handle('theme:list', () => listThemes());
  ipcMain.handle('theme:browser-list', () => fetchCatalog());
  ipcMain.handle('theme:browser-details', (_, id) => fetchCatalogThemeDetails(String(id || '')));
  ipcMain.handle('theme:browser-install', (_, id) => installCatalogTheme(String(id || '')));
  ipcMain.handle('pack:catalog', () => fetchCatalogPacks());
  ipcMain.handle('pack:install', (_, id) => installCatalogPack(String(id || '')));
  ipcMain.handle('pack:list', () => listPacks());
  ipcMain.handle('pack:remove', (_, id) => removePack(String(id || '')));
  ipcMain.handle('theme:remove', (_, id) => removeTheme(String(id || '')));
  ipcMain.handle('theme:current', () => activeTheme);
  ipcMain.handle('backup:export-themes', () => exportUserThemes());
  ipcMain.handle('backup:restore-themes', (_, archive) => restoreUserThemes(archive));
  ipcMain.on('app:relaunch', () => { quitting = true; app.relaunch(); app.exit(0); });
  ipcMain.handle('update:info', () => ({ mode: updateMode(), platform: process.platform, packaged: app.isPackaged }));
  ipcMain.handle('update:install', (_, release, options) => installUpdate(release || {}, options || {}));
  ipcMain.on('update:restart', () => { if (!updater) return; quitting = true; updater.quitAndInstall(false, true); });
  ipcMain.on('balloon:click', () => { hideBalloon(); showMainWindow(); });
  ipcMain.on('balloon:close', hideBalloon);
  ipcMain.on('admin:open', (event, server) => openAdminPanel(windowOwner(event), server));
  ipcMain.handle('admin:request', (_, request) => adminRequest(request));
  ipcMain.on('unread:set', (_, count) => setUnreadCount(count));
  ipcMain.handle('display:current', () => activeDisplay);
  ipcMain.handle('display:prepare-capture', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 } });
    if (!sources[0]) throw new Error(activeDisplay.language === 'en' ? 'No screen or window is available for sharing.' : 'В системе не найден доступный экран или окно для демонстрации.');
    displayCaptureSource = sources[0]; return true;
  });
  ipcMain.handle('display:apply', (_, settings) => saveDisplaySettings(settings || {}));
  ipcMain.handle('theme:preview', async (_, id, scheme) => {
    const prepared = await prepareTheme(id);
    const activeScheme = scheme || prepared.metadata.defaultScheme;
    const directory = prepared.css ? prepared.output : path.join(prepared.output, 'schemes', activeScheme);
    return { id, scheme: activeScheme, revision: Date.now(), cssUrl: runtimeCssUrl(directory) };
  });
  ipcMain.handle('theme:apply', async (_, id, scheme) => {
    // Theme editor names may use any letters ("Luna (моя)"); separators and ".." never pass.
    if (!/^[\p{L}\p{N}._ ()-]+$/u.test(id) || id.includes('..') || (scheme && !/^[a-zA-Z0-9._-]+$/.test(scheme))) throw new Error('Invalid theme name');
    return activateTheme(id, scheme);
  });
  ipcMain.handle('theme:import', async event => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Windows XP themes', extensions: ['theme', 'msstyles'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const sourceFile = result.filePaths[0];
    const base = path.basename(sourceFile, path.extname(sourceFile)).replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 60) || 'Custom-theme';
    const destination = path.join(userThemesRoot, `${base}-${Date.now()}`);
    await fs.mkdir(destination, { recursive: true });
    try {
      await copyThemeBundle(sourceFile, destination);
      const id = path.basename(destination);
      const prepared = await prepareTheme(id);
      const scheme = prepared.metadata.defaultScheme;
      return { themes: await listThemes(), id, scheme, revision: Date.now(), cssUrl: runtimeCssUrl(path.join(prepared.output, 'schemes', scheme)) };
    } catch (error) {
      await fs.rm(destination, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  });
  ipcMain.on('window:set-meta', (e, { title, icon }) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (title && title.trim()) win.setTitle(title.trim());
    if (icon) {
      try {
        win.setIcon(icon.startsWith('file:') ? fileURLToPath(icon) : icon);
      } catch {
        // A web/data URL cannot be used as a Linux window-manager icon path.
      }
    }
  });
  ipcMain.on('window:resize', (e, { direction, dx, dy }) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const bounds = win.getBounds();
    const minimum = win.getMinimumSize();
    let { x, y, width, height } = bounds;
    if (direction.includes('e')) width += dx;
    if (direction.includes('s')) height += dy;
    if (direction.includes('w')) { width -= dx; x += dx; }
    if (direction.includes('n')) { height -= dy; y += dy; }
    if (width < minimum[0]) { if (direction.includes('w')) x -= minimum[0] - width; width = minimum[0]; }
    if (height < minimum[1]) { if (direction.includes('n')) y -= minimum[1] - height; height = minimum[1]; }
    win.setBounds({ x, y, width, height });
  });
  createTray();
  createWindow();
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (!tray && process.platform !== 'darwin') app.quit(); });
