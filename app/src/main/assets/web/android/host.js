// Android replacement for main.js + preload.js.
// Every Electron BrowserWindow becomes an iframe with the same desktop page; the
// ipcMain handlers below mirror main.js one to one. Platform work (themes on disk,
// downloads, notifications) goes to the Kotlin bridge window.NekoNative.
(() => {
  const native = window.NekoNative;
  const desktop = document.querySelector('#desktop');

  // ---- native RPC ------------------------------------------------------------------
  const pending = new Map();
  let requestId = 0;
  function invoke(method, ...args) {
    return new Promise((resolve, reject) => {
      const id = String(++requestId);
      pending.set(id, { resolve, reject });
      native.call(id, method, JSON.stringify(args));
    });
  }
  function resolveNative(id, ok, payload) {
    const request = pending.get(id); if (!request) return;
    pending.delete(id);
    if (ok) request.resolve(JSON.parse(payload)); else request.reject(new Error(payload));
  }

  // ---- state (same names as main.js) -------------------------------------------------
  let activeTheme;
  let activeDisplay = { language: 'ru', loginUi: 'xp', micDeviceId: '' };
  let mainWindow, settingsWindow, themeBrowserWindow, emojiBrowserWindow, emojiBrowserOwner, controlPanelWindow;
  let profileWindow, roomCreateWindow, callWindow, callOwner, closingCallWindow = false;
  const detachedChatWindows = new Map();
  const windows = new Set();
  let zIndex = 1;

  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

  // ---- windows -----------------------------------------------------------------------
  function createWindow({ url, width, height, minWidth = 0, minHeight = 0, parent = null, maximized = false, onClose }) {
    const win = { url, parent, minWidth, minHeight, listeners: new Map(), queue: [], loaded: false, destroyed: false, onClose, closingSilently: false };
    win.element = document.createElement('div');
    win.element.className = 'nk-window';
    win.frame = document.createElement('iframe');
    win.element.append(win.frame);
    desktop.append(win.element);
    windows.add(win);
    setBounds(win, { width, height }, true);
    if (maximized) win.element.classList.add('maximized');
    fitToScreen(win);
    win.frame.addEventListener('load', () => {
      win.loaded = true;
      markFocus();
      // Electron's 'ready-to-show': deliver what was sent before the page was ready.
      win.queue.splice(0).forEach(([channel, data]) => send(win, channel, data));
    });
    win.frame.src = url;
    focus(win);
    return win;
  }
  function setBounds(win, bounds, center = false) {
    const area = desktop.getBoundingClientRect();
    const width = Math.max(win.minWidth, bounds.width ?? win.width);
    const height = Math.max(win.minHeight, bounds.height ?? win.height);
    Object.assign(win, { width, height });
    win.x = center ? Math.round((area.width - width) / 2) : bounds.x ?? win.x;
    win.y = center ? Math.round((area.height - height) / 2) : bounds.y ?? win.y;
    Object.assign(win.element.style, { left: `${win.x}px`, top: `${win.y}px`, width: `${width}px`, height: `${height}px` });
  }
  // A phone screen is smaller than the PC window sizes: such windows open maximized.
  function fitToScreen(win) {
    const area = desktop.getBoundingClientRect();
    if (win.width > area.width || win.height > area.height) win.element.classList.add('maximized', 'auto-maximized');
    else if (win.element.classList.contains('auto-maximized')) { win.element.classList.remove('maximized', 'auto-maximized'); setBounds(win, {}, true); }
    else setBounds(win, { x: Math.min(Math.max(0, win.x), Math.max(0, area.width - win.width)), y: Math.min(Math.max(0, win.y), Math.max(0, area.height - win.height)) });
  }
  window.addEventListener('resize', () => windows.forEach(fitToScreen));

  let focusedWindow = null;
  function focus(win) {
    if (!win || win.destroyed) return;
    win.element.classList.remove('hidden');
    win.element.style.zIndex = String(++zIndex);
    focusedWindow = win;
    markFocus();
  }
  // Like Electron's focus/blur on PC: the other windows get the inactive frame (xp-inactive).
  function markFocus() {
    windows.forEach(item => { try { item.frame.contentDocument?.documentElement.classList.toggle('xp-inactive', item !== focusedWindow); } catch {} });
  }
  function show(win) { focus(win); }
  function isDestroyed(win) { return !win || win.destroyed; }

  function send(win, channel, data) {
    if (isDestroyed(win)) return;
    if (!win.loaded) { win.queue.push([channel, data]); return; }
    (win.listeners.get(channel) || []).forEach(callback => { try { callback(clone(data)); } catch (error) { console.warn(error); } });
  }
  function allWindows() { return [...windows]; }

  // BrowserWindow.close(): runs the window's 'close' handler, which may prevent it.
  function close(win) {
    if (isDestroyed(win)) return;
    if (!win.closingSilently && win.onClose?.() === false) return;
    destroy(win);
  }
  function destroy(win) {
    if (isDestroyed(win)) return;
    win.destroyed = true;
    windows.delete(win);
    // Electron closes child windows together with their parent.
    allWindows().filter(child => child.parent === win).forEach(child => { child.closingSilently = true; close(child); });
    win.onClosed?.();
    win.element.remove();
  }

  // ---- window openers (main.js) ------------------------------------------------------
  // tab: the page of Display Properties to show (the Control Panel opens them one by one).
  function openThemeSettings(owner, tab) {
    const page = typeof tab === 'string' && /^[a-z]+$/.test(tab) ? tab : '';
    if (!isDestroyed(settingsWindow)) { focus(settingsWindow); if (page) send(settingsWindow, 'settings:show-tab', page); return; }
    settingsWindow = createWindow({ url: `/assets/html/theme_settings_frame.html${page ? `?tab=${page}` : ''}`, width: 520, height: 560, minWidth: 460, minHeight: 400, parent: owner });
    settingsWindow.onClosed = () => { settingsWindow = null; };
  }
  function openThemeBrowser(owner) {
    if (!isDestroyed(themeBrowserWindow)) { focus(themeBrowserWindow); return; }
    themeBrowserWindow = createWindow({ url: '/assets/html/theme_browser.html', width: 720, height: 540, minWidth: 520, minHeight: 360, parent: owner });
    themeBrowserWindow.onClosed = () => { themeBrowserWindow = null; };
  }
  function openControlPanel(owner) {
    if (!isDestroyed(controlPanelWindow)) { focus(controlPanelWindow); return; }
    controlPanelWindow = createWindow({ url: '/assets/html/control_panel.html', width: 680, height: 480, minWidth: 420, minHeight: 320, parent: owner });
    controlPanelWindow.onClosed = () => { controlPanelWindow = null; };
  }
  // Control Panel applets (Display, Sounds, Mouse…): Display Properties showing only their pages.
  const appletWindows = new Map();
  function openApplet(owner, applet, tab) {
    const name = typeof applet === 'string' && /^[a-z]+$/.test(applet) ? applet : 'display';
    const page = typeof tab === 'string' && /^[a-z]+$/.test(tab) ? tab : '';
    const existing = appletWindows.get(name);
    if (!isDestroyed(existing)) { focus(existing); if (page) send(existing, 'settings:show-tab', page); return; }
    const [width, height] = { display: [520, 560], backups: [520, 560], mouse: [410, 480], updates: [410, 520], assistant: [420, 360] }[name] || [440, 420];
    const win = createWindow({ url: `/assets/html/theme_settings_frame.html?applet=${name}${page ? `&tab=${page}` : ''}`, width, height, minWidth: 380, minHeight: 320, parent: owner });
    appletWindows.set(name, win);
    win.onClosed = () => { if (appletWindows.get(name) === win) appletWindows.delete(name); };
  }
  // Windows opened from the Control Panel belong to the chat window, so they stay open when it closes.
  const windowOwner = win => win === controlPanelWindow ? win.parent : win;
  function openEmojiBrowser(owner) {
    emojiBrowserOwner = owner;
    if (!isDestroyed(emojiBrowserWindow)) { focus(emojiBrowserWindow); return; }
    emojiBrowserWindow = createWindow({ url: '/assets/html/emoji_browser.html', width: 520, height: 580, minWidth: 420, minHeight: 400, parent: owner });
    emojiBrowserWindow.onClosed = () => { emojiBrowserWindow = null; emojiBrowserOwner = null; };
  }
  function showSystemDialog(owner, data = {}) {
    const dialogWindow = createWindow({ url: '/assets/html/system_dialog.html', width: 380, height: 185, minWidth: 330, minHeight: 165, parent: owner });
    send(dialogWindow, 'system:update', data);
  }
  function openProfileSettings() {
    if (!isDestroyed(profileWindow)) { focus(profileWindow); return; }
    profileWindow = createWindow({ url: '/assets/html/profile_settings_frame.html', width: 700, height: 520, minWidth: 460, minHeight: 360 });
    profileWindow.onClosed = () => { profileWindow = null; };
  }
  function openRoomCreate(owner) {
    if (!isDestroyed(roomCreateWindow)) { focus(roomCreateWindow); return; }
    roomCreateWindow = createWindow({ url: '/assets/html/room_create.html', width: 400, height: 470, minWidth: 350, minHeight: 360, parent: owner });
    roomCreateWindow.onClosed = () => { roomCreateWindow = null; };
  }

  function sendCallState(state) {
    if (!isDestroyed(callWindow)) send(callWindow, 'call:update', state);
    // Android: the call window cannot pop up over other apps, so ring through a notification.
    if (state?.incoming && !native.isForeground()) native.notifyCall(String(state.title || 'Nekochat Reloaded'), String(state.status || ''));
  }
  function openCallWindow(owner, state) {
    callOwner = owner;
    if (!isDestroyed(callWindow)) { sendCallState(state); return; }
    callWindow = createWindow({ url: '/assets/html/call.html', width: 520, height: 430, minWidth: 380, minHeight: 300, parent: owner });
    sendCallState(state);
    callWindow.onClosed = () => {
      const shouldNotify = !closingCallWindow;
      callWindow = null; closingCallWindow = false;
      native.cancelCall();
      if (shouldNotify && !isDestroyed(callOwner)) send(callOwner, 'call:action', { action: 'dismiss' });
      callOwner = null;
    };
  }
  function closeCallWindow() {
    if (isDestroyed(callWindow)) return;
    closingCallWindow = true;
    close(callWindow);
  }

  function chatKey(chat) {
    const kind = chat?.kind === 'room' ? 'room' : chat?.kind === 'dm' ? 'dm' : null;
    const id = Number(chat?.id);
    return kind && Number.isInteger(id) && id >= 1 ? { kind, id, key: `${kind}:${id}` } : null;
  }
  function openDetachedChat(owner, chat) {
    const parsed = chatKey(chat); if (!parsed) return false;
    const { kind, id, key } = parsed;
    const existing = detachedChatWindows.get(key);
    if (!isDestroyed(existing)) { focus(existing); return true; }
    const win = createWindow({
      url: `/assets/html/index.html?${new URLSearchParams({ detached: '1', kind, id: String(id) })}`,
      width: 620, height: 480, minWidth: 400, minHeight: 260,
      onClose: () => {
        if (isDestroyed(mainWindow)) return true;
        returnDetachedChat(win, { kind, id });
        return false;
      },
    });
    win.onClosed = () => detachedChatWindows.delete(key);
    detachedChatWindows.set(key, win);
    return true;
  }
  function returnDetachedChat(sender, chat) {
    const parsed = chatKey(chat); if (!parsed || isDestroyed(mainWindow)) return;
    if (detachedChatWindows.get(parsed.key) !== sender) return;
    // main.js ignores drops outside the main window; here the main window fills the screen.
    show(mainWindow);
    send(mainWindow, 'chat:restore', { kind: parsed.kind, id: parsed.id });
    sender.closingSilently = true;
    close(sender);
  }
  function closeDetachedChats() {
    for (const win of detachedChatWindows.values()) { win.closingSilently = true; close(win); }
  }
  function focusDetachedChat(chat) {
    const parsed = chatKey(chat); if (!parsed) return false;
    const win = detachedChatWindows.get(parsed.key);
    if (isDestroyed(win)) return false;
    show(win);
    return true;
  }

  function notifyThemeChanged(theme) { allWindows().forEach(win => send(win, 'theme:changed', theme)); }
  function notifyDisplayChanged(settings) { allWindows().forEach(win => send(win, 'display:changed', settings)); }

  // ---- window.windowControls (preload.js) ----------------------------------------------
  function controlsFor(win) {
    const on = channel => callback => {
      if (!win.listeners.has(channel)) win.listeners.set(channel, []);
      win.listeners.get(channel).push(callback);
    };
    return {
      // No minimise on a phone screen: like hiding to the tray, the app goes to the background.
      minimize: () => native.moveToBack(),
      maximize: () => { win.element.classList.remove('auto-maximized'); win.element.classList.toggle('maximized'); fitToScreen(win); },
      close: () => close(win),
      setWindowMeta: () => {},
      openThemeSettings: tab => openThemeSettings(windowOwner(win), tab),
      openControlPanel: () => openControlPanel(win),
      openApplet: (applet, tab) => openApplet(windowOwner(win), applet, tab),
      openThemeBrowser: () => openThemeBrowser(windowOwner(win)),
      openEmojiBrowser: () => openEmojiBrowser(win),
      openProfileSettings: () => openProfileSettings(),
      openRoomCreate: () => openRoomCreate(win),
      openCallWindow: state => openCallWindow(win, clone(state) || {}),
      updateCallWindow: state => sendCallState(clone(state) || {}),
      closeCallWindow: () => closeCallWindow(),
      callAction: action => { if (!isDestroyed(callOwner)) send(callOwner, 'call:action', clone(action) || {}); },
      detachChat: chat => Promise.resolve(openDetachedChat(win, clone(chat))),
      returnChat: chat => returnDetachedChat(win, clone(chat)),
      closeDetachedChats: () => closeDetachedChats(),
      focusDetachedChat: chat => Promise.resolve(focusDetachedChat(clone(chat))),
      listThemes: () => invoke('theme:list'),
      getActiveTheme: () => Promise.resolve(clone(activeTheme)),
      previewTheme: (id, scheme) => invoke('theme:preview', id, scheme),
      applyTheme: async (id, scheme) => { activeTheme = await invoke('theme:apply', id, scheme); notifyThemeChanged(activeTheme); return clone(activeTheme); },
      importTheme: () => invoke('theme:import'),
      // Updates (nekochat.js): the APK of the release is downloaded and the system installer opens.
      getUpdateInfo: () => Promise.resolve({ mode: 'install', platform: 'android' }),
      installUpdate: release => { const apk = (release?.assets || []).find(asset => /\.apk$/i.test(asset.name || '')); if (!apk) return Promise.resolve(null); return invoke('update:install', String(apk.url || '')); },
      // Settings backups (backup.js): themes travel as base64 through the native bridge.
      exportThemeFiles: async () => (await invoke('backup:export-themes')).map(file => ({ path: file.path, data: Uint8Array.from(atob(file.data), char => char.charCodeAt(0)) })),
      restoreThemeFiles: archive => { let binary = ''; const bytes = new Uint8Array(archive); for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return invoke('backup:restore-themes', btoa(binary)); },
      listCatalogThemes: () => invoke('theme:browser-list'),
      getCatalogThemeDetails: id => invoke('theme:browser-details', String(id || '')),
      installCatalogTheme: id => invoke('theme:browser-install', String(id || '')),
      // Cursor, sound and icon packs from the catalog (theme-browser.js, theme-settings.js, packs.js).
      listCatalogPacks: () => invoke('pack:catalog'),
      installCatalogPack: id => invoke('pack:install', String(id || '')),
      listPacks: () => invoke('pack:list'),
      removePack: id => invoke('pack:remove', String(id || '')),
      removeTheme: async id => {
        const result = await invoke('theme:remove', String(id || ''));
        if (result?.activeTheme && result.activeTheme.revision !== activeTheme?.revision) { activeTheme = result.activeTheme; notifyThemeChanged(activeTheme); }
        return result;
      },
      notifyMessage: message => native.notifyMessage(String(message?.sender || 'User'), String(message?.content || ''), String(message?.avatarUrl || '')),
      showSystemDialog: data => showSystemDialog(win, clone(data) || {}),
      systemAction: action => { if (!isDestroyed(win.parent)) send(win.parent, 'system:action', clone(action)); },
      getDisplaySettings: () => Promise.resolve(clone(activeDisplay)),
      // The Android consent dialog is shown by getDisplayMedia() itself (android-bridge.js).
      prepareDisplayCapture: () => Promise.resolve(true),
      applyDisplaySettings: async settings => { activeDisplay = await invoke('display:apply', settings || {}); notifyDisplayChanged(activeDisplay); return clone(activeDisplay); },
      onThemeChanged: on('theme:changed'),
      onSettingsTab: on('settings:show-tab'),
      onDisplayChanged: on('display:changed'),
      onProfileChanged: on('profile:changed'),
      onRoomCreated: on('room:created'),
      onCallUpdate: on('call:update'),
      onCallAction: on('call:action'),
      onChatRestore: on('chat:restore'),
      onEmojiSelected: on('emoji:selected'),
      onSystemDialog: on('system:update'),
      onSystemAction: on('system:action'),
      selectEmoji: emoji => {
        if (win !== emojiBrowserWindow || typeof emoji !== 'string' || emoji.length > 32) return;
        if (!isDestroyed(emojiBrowserOwner)) send(emojiBrowserOwner, 'emoji:selected', emoji);
        close(emojiBrowserWindow);
      },
      profileChanged: user => allWindows().forEach(target => send(target, 'profile:changed', user)),
      roomCreated: room => { if (!isDestroyed(win.parent)) send(win.parent, 'room:created', room); close(win); },
      resize: (direction, dx, dy) => {
        if (win.element.classList.contains('maximized')) return;
        let { x, y, width, height } = win;
        if (direction.includes('e')) width += dx;
        if (direction.includes('s')) height += dy;
        if (direction.includes('w')) { width -= dx; x += dx; }
        if (direction.includes('n')) { height -= dy; y += dy; }
        if (width < win.minWidth) { if (direction.includes('w')) x -= win.minWidth - width; width = win.minWidth; }
        if (height < win.minHeight) { if (direction.includes('n')) y -= win.minHeight - height; height = win.minHeight; }
        setBounds(win, { x, y, width, height });
      },
    };
  }

  // Finds the window that owns a frame (the chat iframe sits inside index.html).
  function windowFor(frameWindow) {
    let current = frameWindow;
    while (current.parent && current.parent !== window) current = current.parent;
    return allWindows().find(win => win.frame.contentWindow === current);
  }

  // ---- back button -----------------------------------------------------------------------
  const backHandlers = new Map();
  let screenCaptureEnded = null;
  function topWindow() { return allWindows().filter(win => !win.element.classList.contains('hidden')).sort((a, b) => Number(b.element.style.zIndex) - Number(a.element.style.zIndex))[0]; }
  function back() {
    const win = topWindow();
    if (!win) return false;
    // Frames of the top window, innermost first: close an open <dialog> etc.
    const handlers = [...backHandlers.entries()].filter(([frameWindow]) => !frameWindow.closed && windowFor(frameWindow) === win).reverse();
    for (const [, handler] of handlers) { try { if (handler()) return true; } catch {} }
    if (win === mainWindow) return false;
    close(win);
    return true;
  }

  window.NKHost = {
    resolveNative,
    controlsFor(frameWindow) {
      const win = windowFor(frameWindow);
      if (!win) return undefined;
      win.controls ||= controlsFor(win);
      return win.controls;
    },
    focusFrom(frameWindow) { focus(windowFor(frameWindow)); },
    moveBy(frameWindow, dx, dy) {
      const win = windowFor(frameWindow);
      if (!win || win.element.classList.contains('maximized')) return;
      setBounds(win, { x: win.x + dx, y: win.y + dy });
    },
    registerBack(frameWindow, handler) { backHandlers.set(frameWindow, handler); frameWindow.addEventListener('pagehide', () => backHandlers.delete(frameWindow)); },
    back,
    // Screen sharing through MediaProjection (see ScreenCapture.kt).
    startScreenCapture: () => invoke('screen:start'),
    stopScreenCapture: () => native.stopScreenCapture(),
    onScreenCaptureEnded(callback) { screenCaptureEnded = callback; },
    screenCaptureEnded() { const callback = screenCaptureEnded; screenCaptureEnded = null; callback?.(); },
  };

  // ---- startup (app.whenReady in main.js) ----------------------------------------------------
  Promise.all([invoke('theme:current'), invoke('display:current')]).catch(() => [null, activeDisplay]).then(([theme, display]) => {
    activeTheme = theme; activeDisplay = display || activeDisplay;
    mainWindow = createWindow({
      url: '/assets/html/index.html', width: 807, height: 562, minWidth: 320, minHeight: 180, maximized: true,
      // Closing the main window hides it (tray on PC, background on Android).
      onClose: () => { native.moveToBack(); return false; },
    });
    mainWindow.onClosed = () => { mainWindow = null; };
  });
})();
