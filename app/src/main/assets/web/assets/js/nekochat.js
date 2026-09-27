const DEFAULT_API = 'https://nekochat.komdu.is-cool.dev';
let API = localStorage.getItem('nk_server_url') || DEFAULT_API;
const xpLogonBackgrounds = [
  ['xp_1024x1280.jpg', 1024, 1280], ['xp_1024x768.jpg', 1024, 768], ['xp_1280x1024.jpg', 1280, 1024],
  ['xp_1280x768.jpg', 1280, 768], ['xp_1280x960.jpg', 1280, 960], ['xp_1360x768.jpg', 1360, 768],
  ['xp_1440x900.jpg', 1440, 900], ['xp_1920x1200.jpg', 1920, 1200], ['xp_768x1280.jpg', 768, 1280],
  ['xp_768x1360.jpg', 768, 1360], ['xp_900x1440.jpg', 900, 1440], ['xp_960x1280.jpg', 960, 1280],
];
let token = localStorage.getItem('nk_token');
const SAVED_SESSIONS_KEY = 'nk_saved_sessions';
let me; let rooms = []; let users = []; let activeTab = 'rooms'; let current; let historyKey = '';
// Real-time channel: NATS over WSS first, the plain /ws WebSocket as fallback. Both carry
// the same JSON messages; `socket` is whichever connection is currently up.
let socket; let socketRetry; let socketRetryDelay = 1000; let socketConnecting = false;
let heartbeat; let missedPongs = 0;
// The last unsent call signal of each type, delivered after reconnecting.
const pendingCallSignals = new Map();
const RESENT_CALL_SIGNALS = new Set(['call', 'call_answer', 'call_hangup']);
// Calls can travel over the WebSocket or over SSE (/stream) + HTTP/2 POST (/push).
let callTransport = localStorage.getItem('nk_call_transport') === 'sse' ? 'sse' : 'ws';
let eventStream; let eventStreamRetry; let eventStreamRetryDelay = 1000;
const CALL_EVENT_TYPES = new Set(['call', 'call_answer', 'call_hangup', 'call_audio', 'screen_start', 'screen_stop', 'screen_frame']);
const recentCallEvents = new Map();
let activeCall;
let callAudio;
let screenShare;
let remoteScreen;
let ringtone;
const $ = selector => document.querySelector(selector);
const desktopControls = window.windowControls || window.parent?.windowControls;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
const windowQuery = new URLSearchParams(location.search);
const detachedChat = windowQuery.get('detached') === '1' && ['room', 'dm'].includes(windowQuery.get('kind')) && /^\d+$/.test(windowQuery.get('id') || '')
  ? { kind: windowQuery.get('kind'), id: Number(windowQuery.get('id')) }
  : null;
if (detachedChat) document.documentElement.classList.add('detached-chat');
const sounds = Object.freeze({ navigation: 'navigation.wav', notify: 'notify.wav', logon: 'logon.wav', logoff: 'logoff.wav', ringin: 'ringin.wav', ringout: 'ringout.wav', exclamation: 'exclamation.wav', default: 'default.wav', error: 'error.wav', critical: 'critical-stop.wav' });
function playSound(name) { const audio = new Audio(`assets/sounds/${sounds[name]}`); audio.volume = .72; audio.play().catch(() => {}); return audio; }
function showSystemDialog(message, type = 'error', title = 'NekoChat Reloaded', options = {}) {
  if (desktopControls?.showSystemDialog) { desktopControls.showSystemDialog({ message: String(message || t('unknownError')), type, title, ...options }); return; }
  const dialog = $('#system-dialog'); if (!dialog) return;
  const validType = ['critical', 'error', 'warning', 'info', 'question'].includes(type) ? type : 'error';
  dialog.className = `xp-dialog system-dialog ${validType}`; $('#system-title').textContent = title; $('#system-message').textContent = String(message || t('unknownError'));
  playSound(validType === 'critical' ? 'critical' : validType === 'warning' ? 'exclamation' : validType === 'info' || validType === 'question' ? 'default' : 'error');
  if (!dialog.open) dialog.showModal(); requestAnimationFrame(() => $('#system-ok').focus());
}
window.alert = message => showSystemDialog(message, 'error', t('error'));
function startRingtone(name) { stopRingtone(); ringtone = playSound(name); ringtone.loop = true; }
function stopRingtone() { if (!ringtone) return; ringtone.pause(); ringtone.currentTime = 0; ringtone = null; }
function playServerSound(kind, status = 0) {
  // The API does not decide the severity: derive it locally from the transport result.
  if (kind === 'notification' || kind === 'notice') return playSound('default');
  if (kind === 'warning') return playSound('exclamation');
  if (status >= 400 && status < 500) return playSound('exclamation');
  // These mean that the gateway/service is unavailable, rather than a bad request.
  if ([502, 503, 504].includes(status)) return playSound('critical');
  if (status >= 500 || kind === 'error') return playSound('error');
  return playSound('default');
}
const translations = {
  ru: { loginHint: 'Чтобы начать, выберите учётную запись', loginTitle: 'Вход в NekoChat', liveMessages: 'Сообщения реального времени', username: 'Имя пользователя', password: 'Пароль', displayName: 'Отображаемое имя', createAccount: 'Создать учётную запись', backToLogin: 'Вернуться ко входу', otherUser: 'Другой пользователь', chooseOtherUser: '← Выбрать другого пользователя', changeServer: 'Сменить URL сервера', loginFooter: 'После входа можно общаться в комнатах и личных диалогах.', rooms: 'Комнаты', direct: 'Личные', theme: 'Тема', chooseChat: 'Выберите комнату или диалог.', send: 'Отправить ›', search: 'Поиск...', emoji: 'Эмодзи', allEmoji: 'Все', emojiSearch: 'Поиск emoji…', emojiFound: 'Найдено', signIn: 'Войти', register: 'Создать учётную запись', ok: 'ОК', cancel: 'Отмена', serverUrl: 'URL сервера', editProfile: 'Изменить профиль', themeBrowser: 'Каталог тем', personalize: 'Персонализация', changeUser: 'Сменить пользователя', logout: 'Выйти из аккаунта', error: 'Ошибка', loginError: 'Ошибка входа', sessionEnded: 'Сеанс завершён', sessionExpired: 'Сохранённая сессия истекла. Войдите снова.', connectionFailed: 'Не удалось подключиться к серверу. Проверьте URL сервера и подключение к сети.', serverError: 'Ошибка сервера ({status})', historyFormat: 'Сервер вернул историю в неизвестном формате.', loadMessages: 'Не удалось загрузить сообщения', socketConnecting: 'Соединение с сервером ещё устанавливается.', callStart: 'Не удалось начать звонок', callAccept: 'Не удалось принять звонок', microphone: 'Не удалось включить микрофон', sendMessage: 'Не удалось отправить сообщение', screenShare: 'Демонстрация экрана', screenAccess: 'Не удалось получить доступ к экрану. Проверьте, что в системе доступен захват экрана, и повторите попытку.', roomAudioUnsupported: 'Аудиозвонки в комнатах API не поддерживает.', screenUnsupported: 'Демонстрация экрана не поддерживается этой версией Electron.', vp8Unsupported: 'Кодек VP8 недоступен для демонстрации экрана.', opusUnsupported: 'В этой версии приложения нет поддержки Opus WebCodecs.', opusConfigUnsupported: 'Opus 48 кГц не поддержан этим Chromium.', roomCreate: 'Не удалось создать комнату', themeApply: 'Не удалось применить тему', themeImport: 'Не удалось импортировать тему', imageUpload: 'Не удалось загрузить изображение.', importingTheme: 'Импорт темы…', themeInstalled: 'Тема добавлена и применена.', call: 'Звонок', incomingCall: 'Входящий звонок: {name}', outgoingCall: 'Звонок: {name}', callWaiting: 'Ожидание ответа…', callConnecting: 'Подключение микрофона…', callConnected: 'Разговор по Opus', you: 'Вы', user: 'Пользователь' },
  en: { loginHint: 'To begin, choose an account', loginTitle: 'Sign in to NekoChat', liveMessages: 'Real-time messages', username: 'Username', password: 'Password', displayName: 'Display name', createAccount: 'Create an account', backToLogin: 'Back to sign in', otherUser: 'Other user', chooseOtherUser: '← Choose another user', changeServer: 'Change Server URL', loginFooter: 'After signing in, you can chat in rooms and direct messages.', rooms: 'Rooms', direct: 'Direct', theme: 'Theme', chooseChat: 'Choose a room or conversation.', send: 'Send ›', search: 'Search...', emoji: 'Emoji', allEmoji: 'All', emojiSearch: 'Search emoji…', emojiFound: 'Found', signIn: 'Sign in', register: 'Create account', ok: 'OK', cancel: 'Cancel', serverUrl: 'Server URL', editProfile: 'Edit profile', themeBrowser: 'Theme Browser', personalize: 'Personalization', changeUser: 'Change user', logout: 'Log out', error: 'Error', loginError: 'Sign-in error', sessionEnded: 'Session ended', sessionExpired: 'The saved session has expired. Sign in again.', connectionFailed: 'Could not connect to the server. Check the server URL and network connection.', serverError: 'Server error ({status})', historyFormat: 'The server returned message history in an unknown format.', loadMessages: 'Could not load messages', socketConnecting: 'The connection to the server is still being established.', callStart: 'Could not start the call', callAccept: 'Could not accept the call', microphone: 'Could not enable the microphone', sendMessage: 'Could not send the message', screenShare: 'Screen sharing', screenAccess: 'Could not access the screen. Check that screen capture is available and try again.', roomAudioUnsupported: 'The API does not support audio calls in rooms.', screenUnsupported: 'Screen sharing is not supported by this version of Electron.', vp8Unsupported: 'VP8 is unavailable for screen sharing.', opusUnsupported: 'This version of the app does not support Opus WebCodecs.', opusConfigUnsupported: 'Opus 48 kHz is not supported by this Chromium build.', roomCreate: 'Could not create the room', themeApply: 'Could not apply the theme', themeImport: 'Could not import the theme', imageUpload: 'Could not upload the image.', importingTheme: 'Importing theme…', themeInstalled: 'Theme added and applied.', call: 'Call', incomingCall: 'Incoming call: {name}', outgoingCall: 'Calling: {name}', callWaiting: 'Waiting for an answer…', callConnecting: 'Connecting microphone…', callConnected: 'Opus call', you: 'You', user: 'User' },
};
function t(key, values = {}) { return String((translations[displaySettings?.language === 'en' ? 'en' : 'ru'] || translations.ru)[key] || key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? ''); }
// Call states are keys, so the call window follows the chosen language.
function callStatusText(status) { return ({ waiting: t('callWaiting'), ringing: t('callRinging'), connecting: t('callConnecting'), connected: t('callConnected'), invite: t('roomInviteStatus') })[status] || status; }
let displaySettings = { language: 'ru', loginUi: 'xp' };
Object.assign(translations.ru, { profileOnline: 'онлайн', online: 'В сети', offline: 'Не в сети', noBio: 'Пока ничего не написано.', userNoBio: 'Пользователь пока ничего не написал.', nothingFound: 'Ничего не найдено.' });
Object.assign(translations.en, { profileOnline: 'online', online: 'Online', offline: 'Offline', noBio: 'Nothing has been written yet.', userNoBio: 'This user has not written anything yet.', nothingFound: 'Nothing found.' });
Object.assign(translations.ru, { join: 'Присоединиться', roomJoin: 'Не удалось присоединиться к комнате' });
Object.assign(translations.en, { join: 'Join', roomJoin: 'Could not join room' });
Object.assign(translations.ru, { roomChannel: 'Голосовой канал: {room}', roomInvite: '{name} в голосовом канале {room}', roomInviteStatus: 'Войти в канал?', roomParticipants: 'В канале: {count}', noAnswer: 'Абонент не ответил.', callBusy: 'Абонент занят.', callDeclined: 'Звонок отклонён.', accountBanned: 'Ваша учётная запись заблокирована на этом сервере.', serverMessage: 'Сообщение сервера', screenCodecUnsupported: 'Этот Chromium не умеет кодировать экран ни в VP9, ни в VP8.', screenCodecDecode: 'Демонстрация экрана в кодеке {codec} не поддерживается на этом устройстве.' });
Object.assign(translations.en, { roomChannel: 'Voice channel: {room}', roomInvite: '{name} is in voice channel {room}', roomInviteStatus: 'Join the channel?', roomParticipants: 'In the channel: {count}', noAnswer: 'No answer.', callBusy: 'The user is busy.', callDeclined: 'The call was declined.', accountBanned: 'Your account is banned on this server.', serverMessage: 'Server message', screenCodecUnsupported: 'This Chromium can encode the screen neither in VP9 nor in VP8.', screenCodecDecode: 'Screen sharing in the {codec} codec is not supported on this device.' });
Object.assign(translations.ru, { dns: 'DNS', dns_system: 'Системный', dns_cloudflare: 'Cloudflare (1.1.1.1)', dns_google: 'Google (8.8.8.8)', dns_quad9: 'Quad9 (9.9.9.9)', dns_adguard: 'AdGuard DNS', dns_custom: 'Свой DNS-over-HTTPS…' });
Object.assign(translations.en, { dns: 'DNS', dns_system: 'System default', dns_cloudflare: 'Cloudflare (1.1.1.1)', dns_google: 'Google (8.8.8.8)', dns_quad9: 'Quad9 (9.9.9.9)', dns_adguard: 'AdGuard DNS', dns_custom: 'Custom DNS-over-HTTPS…' });
Object.assign(translations.ru, { refreshList: 'Обновить список', searchChats: 'Поиск чатов', createRoom: 'Создать комнату', close: 'Закрыть', closeButton: 'Закрыть', userAccounts: 'Учётные записи пользователей', back: '← Назад', home: 'Домой', relatedTasks: 'Связанные задачи', help: 'Справка', profileHelp: 'Настройте профиль NekoChat.', pickTask: 'Выберите задачу…', taskDetailsLong: 'Изменить статус и описание', status: 'Статус', about: 'О себе', profileColour: 'Цвет профиля', changeAvatar: 'Сменить аватар', save: 'Сохранить', xpAppearance: 'Оформление Windows XP', themeDialogHint: 'Выберите установленную тему рамки или добавьте файл', installedThemes: 'Установленные темы', apply: 'Применить', addTheme: 'Добавить тему…', roomMembers: 'Участники комнаты' });
Object.assign(translations.en, { refreshList: 'Refresh list', searchChats: 'Search chats', createRoom: 'Create room', close: 'Close', closeButton: 'Close', userAccounts: 'User Accounts', back: '← Back', home: 'Home', relatedTasks: 'Related Tasks', help: 'Help', profileHelp: 'Set up your NekoChat profile.', pickTask: 'Pick a task…', taskDetailsLong: 'Change status and description', status: 'Status', about: 'About me', profileColour: 'Profile colour', changeAvatar: 'Change avatar', save: 'Save', xpAppearance: 'Windows XP appearance', themeDialogHint: 'Choose an installed frame theme or add a file', installedThemes: 'Installed themes', apply: 'Apply', addTheme: 'Add theme…', roomMembers: 'Room members' });
Object.assign(translations.ru, { unknownError: 'Неизвестная ошибка.', unknown: 'Неизвестно', messagePlaceholder: 'Сообщение...', members: 'Участники', membersTitle: 'Участники: # {name}', membersUnavailable: 'Список участников пока недоступен.', memberCount: '{count} участник(ов)', startCall: 'Позвонить', room: 'Комната', callRinging: 'Вам звонят', serverUrlInvalid: 'URL сервера должен начинаться с http:// или https://', enterAccountDetails: 'Введите данные учётной записи', taskDetails: 'Изменить сведения', taskAvatar: 'Сменить рисунок', taskBanner: 'Сменить баннер', taskColour: 'Изменить цвет профиля', themeElectronOnly: 'Настройки темы доступны только в приложении NekoChat Reloaded.', notDelivered: 'Не доставлено. Нажмите, чтобы отправить снова.' });
Object.assign(translations.en, { unknownError: 'Unknown error.', unknown: 'Unknown', messagePlaceholder: 'Message...', members: 'Members', membersTitle: 'Members: # {name}', membersUnavailable: 'The member list is not available yet.', memberCount: '{count} member(s)', startCall: 'Call', room: 'Room', callRinging: 'Incoming call…', serverUrlInvalid: 'Server URL must start with http:// or https://', enterAccountDetails: 'Enter your account details', taskDetails: 'Change details', taskAvatar: 'Change picture', taskBanner: 'Change banner', taskColour: 'Change profile colour', themeElectronOnly: 'Theme settings are only available in the NekoChat Reloaded app.', notDelivered: 'Not delivered. Click to send again.' });
function applyDisplaySettings(settings) {
  displaySettings = { ...displaySettings, ...settings };
  const language = displaySettings.language === 'en' ? 'en' : 'ru';
  const text = translations[language];
  document.documentElement.lang = language;
  document.documentElement.dataset.loginUi = displaySettings.loginUi === 'classic' ? 'classic' : 'xp';
  renderDnsControls();
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = text[node.dataset.i18n] || node.textContent; });
  // Tooltips, screen-reader labels and placeholders use data-i18n-label.
  document.querySelectorAll('[data-i18n-label]').forEach(node => { const value = text[node.dataset.i18nLabel]; if (!value) return; ['aria-label', 'title', 'placeholder'].forEach(name => { if (node.hasAttribute(name)) node.setAttribute(name, value); }); });
  $('#search').placeholder = text.search; $('#message-input').placeholder = text.messagePlaceholder;
  $('#emoji-button').setAttribute('aria-label', text.emoji); $('#emoji-button').title = text.emoji;
  $('#auth-switch').textContent = registering ? text.backToLogin : text.createAccount;
  $('#auth-submit').setAttribute('aria-label', registering ? text.register : text.signIn);
  if (me) { $('#profile-bio').textContent = me.bio || t('noBio'); $('#profile-status').textContent = me.status || `● ${t('profileOnline')}`; renderList(); renderConversationHeader(); }
  updateCallWindow();
}
const api = async (path, options = {}) => {
  let response; const session = token;
  try {
    response = await fetch(API + path, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
  } catch (error) { throw new Error(t('connectionFailed')); }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && session && session === token && !path.startsWith('/auth/')) expireSession();
  if (!response.ok) {
    const validationError = Array.isArray(data.detail) ? data.detail.map(item => item.msg).filter(Boolean).join('; ') : '';
    const message = response.status >= 500 ? t('serverError', { status: response.status }) : (typeof data.detail === 'string' ? data.detail : validationError || t('serverError', { status: response.status }));
    const error = new Error(message); error.status = response.status; throw error;
  }
  return data;
};
function savedSessions() { try { const value = JSON.parse(localStorage.getItem(SAVED_SESSIONS_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function writeSavedSessions(items) { localStorage.setItem(SAVED_SESSIONS_KEY, JSON.stringify(items.slice(0, 12))); }
function rememberSession(user) {
  if (!token || !user?.id) return;
  const key = `${API}|${user.id}`;
  writeSavedSessions([{ key, server: API, token, user }, ...savedSessions().filter(item => item?.key !== key)]);
}
function renderSavedUsers() {
  const sessions = savedSessions(); const list = $('#saved-users');
  list.hidden = false;
  $('#auth-screen').classList.remove('account-selected');
  list.innerHTML = sessions.map((session, index) => {
    const user = session.user || {}; const image = user.avatar ? `<img src="${esc(session.server)}/avatars/${encodeURIComponent(user.avatar)}" alt="">` : esc((user.display_name || user.username || '?')[0].toUpperCase());
    return `<button class="saved-user" type="button" data-saved-session="${index}"><span class="xp-user-avatar">${image}</span><span><b>${esc(user.display_name || user.username)}</b><small>@${esc(user.username || '')}</small></span></button>`;
  }).join('');
  $('#show-login-form').hidden = sessions.length === 0;
  $('#auth-form').hidden = sessions.length > 0;
  $('#back-to-users').hidden = true;
}
function showAuthScreen() { $('#chat-app').hidden = true; $('#auth-screen').hidden = false; $('#welcome-screen').hidden = true; renderSavedUsers(); refreshServerInfo(); }
function showLoginForm() { $('#auth-screen').classList.remove('account-selected'); $('#auth-form').hidden = false; $('#saved-users').hidden = true; $('#show-login-form').hidden = true; $('#back-to-users').hidden = savedSessions().length === 0; $('#auth-error').textContent = ''; $('#login-selected-avatar').innerHTML = '<img src="assets/images/nekochat_icon.png" alt="NekoChat">'; $('#login-selected-name').textContent = t('loginTitle'); $('#login-selected-hint').textContent = t('enterAccountDetails'); }
function showWelcome() { $('#auth-screen').hidden = false; $('#welcome-screen').hidden = false; }
async function useSavedSession(index) {
  const session = savedSessions()[index]; if (!session?.token || !session?.server) return;
  API = session.server; token = session.token; localStorage.setItem('nk_server_url', API); localStorage.setItem('nk_token', token); $('#server-url').value = API; $('#classic-server-url').value = API; showWelcome();
  try { const user = await api('/api/me'); rememberSession(user); setLoggedIn(user, true); await refresh(); }
  catch (error) { writeSavedSessions(savedSessions().filter(item => item?.key !== session.key)); token = null; localStorage.removeItem('nk_token'); showAuthScreen(); showLoginForm(); $('#auth-username').value = session.user?.username || ''; showSystemDialog(t('sessionExpired'), 'warning', t('sessionEnded')); }
}
const avatarColour = user => /^#[0-9a-f]{6}$/i.test(user?.profile_color || '') ? user.profile_color : '';
const avatar = user => user?.avatar ? `<img src="${API}/avatars/${encodeURIComponent(user.avatar)}" alt="">` : `<span class="avatar-fallback">${esc((user?.display_name || user?.username || '?')[0].toUpperCase())}</span>`;
function avatarFrameAttributes(user) { const colour = avatarColour(user); return colour ? ` avatar-profile-colour style="--profile-avatar-colour:${colour}"` : ''; }
function setProfileAvatarFrame(user) { const colour = avatarColour(user); document.querySelectorAll('.avatar-me').forEach(node => { node.classList.toggle('has-profile-colour', Boolean(colour)); colour ? node.style.setProperty('--profile-avatar-colour', colour) : node.style.removeProperty('--profile-avatar-colour'); }); }
function setUserAvatarFrame(node, user) { const colour = avatarColour(user); node.classList.toggle('avatar-profile-colour', Boolean(colour)); colour ? node.style.setProperty('--profile-avatar-colour', colour) : node.style.removeProperty('--profile-avatar-colour'); }
const formatTime = value => new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const displayName = user => user?.display_name || user?.username || t('user');
const userFor = id => users.find(user => user.id === id) || (me?.id === id ? me : null);
function fitXpLogonBackground() {
  const ratio = window.innerWidth / window.innerHeight;
  const [file] = xpLogonBackgrounds.reduce((best, candidate) => Math.abs(candidate[1] / candidate[2] - ratio) < Math.abs(best[1] / best[2] - ratio) ? candidate : best);
  $('#auth-screen').style.backgroundImage = `url("assets/images/${file}")`;
}

function setLoggedIn(user, announceLogin = false) {
  me = user; rememberSession(user); $('#welcome-screen').hidden = true; $('#auth-screen').hidden = true; $('#chat-app').hidden = false;
  setProfileAvatarFrame(me);
  $('#me-avatar').innerHTML = avatar(me); $('#me-name').textContent = me.display_name; $('#me-handle').textContent = `@${me.username}`;
  $('#profile-avatar').innerHTML = avatar(me); $('#profile-name').textContent = me.display_name; $('#profile-bio').textContent = me.bio || t('noBio'); $('#profile-status').textContent = me.status || `● ${t('profileOnline')}`;
  const banner = $('.profile-banner');
  banner.style.backgroundImage = me.banner ? `url("${API}/avatars/${encodeURIComponent(me.banner)}")` : 'var(--xp-title-fill)';
  banner.style.backgroundColor = me.banner ? '' : (me.profile_color || '');
  banner.classList.toggle('has-user-banner', Boolean(me.banner));
  connectSocket(); connectEventStream();
  if (announceLogin) playSound('logon');
}
let conversationOrder = new Map();
async function refresh() {
  const [roomList, userList, conversations] = await Promise.all([api('/rooms'), api('/users'), api('/users/conversations/me').catch(() => [])]);
  rooms = roomList; users = userList;
  // People you already talk to come first in Direct, newest conversation on top.
  conversationOrder = new Map((Array.isArray(conversations) ? conversations : []).slice().sort((a, b) => Number(b.conversation_id) - Number(a.conversation_id)).map((item, index) => [Number(item.user?.id), index]));
  renderList();
}
const byConversation = (a, b) => (conversationOrder.get(Number(a.id)) ?? Infinity) - (conversationOrder.get(Number(b.id)) ?? Infinity);
// Server name and version under the logon form, from /api/server-info.
async function refreshServerInfo() {
  const server = API;
  let text = '';
  try { const response = await fetch(`${server}/api/server-info`); if (response.ok) { const info = await response.json(); text = [info.name, info.version && `v${info.version}`].filter(Boolean).join(' ') + (info.description ? ` — ${info.description}` : ''); } } catch {}
  if (server !== API) return;
  document.querySelectorAll('.server-info-text').forEach(node => { node.textContent = text; node.hidden = !text; });
}
function showRoomMembers(room) {
  const members = Array.isArray(room?.members) ? room.members : [];
  $('#room-members-title').textContent = t('membersTitle', { name: room?.name || '' });
  $('#room-members-list').innerHTML = members.map(user => `<article class="room-member"><span class="avatar${avatarFrameAttributes(user)}">${avatar(user)}</span><span><b>${esc(displayName(user))}</b><small>@${esc(user.username || '')}</small></span></article>`).join('') || `<p class="room-member">${esc(t('membersUnavailable'))}</p>`;
  $('#room-members-dialog').showModal();
}
function renderList() {
  const query = $('#search').value.trim().toLowerCase(); const list = $('#chat-list');
  const items = activeTab === 'rooms' ? rooms.filter(room => String(room.name ?? '').toLowerCase().includes(query)).map(room => ({ id: room.id, title: String(room.name ?? ''), sub: t('memberCount', { count: room.member_count ?? 0 }), icon: '#', kind: 'room', member: !Array.isArray(room.members) || room.members.some(user => Number(user.id) === Number(me?.id)) })) : users.filter(user => user.id !== me?.id && `${user.username ?? ''} ${user.display_name ?? ''}`.toLowerCase().includes(query)).sort(byConversation).map(user => ({ id: user.id, title: displayName(user), sub: `@${user.username}`, icon: avatar(user), online: user.is_online === true, kind: 'dm', frame: avatarFrameAttributes(user) }));
  list.innerHTML = items.map(item => `<button class="chat-item ${item.kind === 'room' && !item.member ? 'not-member' : ''} ${current?.kind === item.kind && current?.data.id === item.id ? 'active' : ''}" data-kind="${item.kind}" data-id="${item.id}"><span class="avatar${item.frame || ''} ${item.kind === 'dm' ? (item.online ? 'is-online' : 'is-offline') : ''}">${item.icon}${item.kind === 'dm' ? `<i class="presence-dot ${item.online ? 'online' : 'offline'}"></i>` : ''}</span><span class="chat-name"><b>${esc(item.title)}</b><small>${esc(item.sub)}</small></span></button>`).join('') || `<p style="padding:12px;color:#777">${esc(t('nothingFound'))}</p>`;
}
function showUserProfile(user) {
  const online = user.is_online === true;
  $('#user-profile-avatar').innerHTML = avatar(user);
  setUserAvatarFrame($('#user-profile-avatar'), user);
  $('#user-profile-name').textContent = displayName(user);
  $('#user-profile-handle').textContent = `@${user.username}`;
  $('#user-profile-status').textContent = `● ${online ? t('online') : t('offline')}${user.status ? ` · ${user.status}` : ''}`;
  $('#user-profile-status').classList.toggle('offline', !online);
  $('#user-profile-bio').textContent = user.bio || t('userNoBio');
  const banner = $('#user-profile-banner');
  banner.style.backgroundImage = user.banner ? `url("${API}/avatars/${encodeURIComponent(user.banner)}")` : 'var(--xp-title-fill)';
  banner.style.backgroundColor = user.banner ? '' : (user.profile_color || '');
  banner.classList.toggle('has-user-banner', Boolean(user.banner));
  $('#user-profile-dialog').showModal();
}
function messageKey(message) { return `${message.id ?? ''}:${message.created_at ?? ''}:${message.content ?? ''}`; }
function appendMessage(message, mine, key = messageKey(message), pending = false) {
  const sender = message.user || message.sender || userFor(message.user_id || message.sender_id) || { display_name: t('unknown') };
  const profileId = sender.id ? ` data-profile-id="${sender.id}"` : '';
  $('#messages').insertAdjacentHTML('beforeend', `<article class="message ${mine ? 'mine' : ''}" data-key="${esc(key)}" data-content="${esc(message.content)}"${pending ? ' data-pending="true"' : ''}><span class="avatar profile-trigger"${profileId}>${avatar(sender)}</span><div class="message-body"><div class="message-meta profile-trigger"${profileId}>${esc(displayName(sender))}<time>${formatTime(message.created_at)}</time></div><p>${esc(message.content)}</p></div></article>`);
  $('#messages').scrollTop = $('#messages').scrollHeight;
}
function renderConversationHeader() {
  if (!current) return;
  const { kind, data } = current;
  const title = kind === 'room' ? `# ${data.name ?? ''}` : displayName(data); const subtitle = kind === 'room' ? t('memberCount', { count: data.member_count ?? 0 }) : `@${data.username}`; const frame = kind === 'dm' ? avatarFrameAttributes(data) : '';
  const profileId = kind === 'dm' ? ` data-profile-id="${data.id}"` : '';
  $('#conversation-header').innerHTML = `<span class="avatar${frame} ${kind === 'dm' ? 'profile-trigger' : ''}"${profileId}>${kind === 'room' ? '#' : avatar(data)}</span><span class="${kind === 'dm' ? 'profile-trigger' : ''}"${profileId}><h1>${esc(title)}</h1><small>${esc(subtitle)}</small></span><span class="header-actions">${kind === 'room' ? `<button class="call-button member-button" id="room-members" type="button" aria-label="${esc(t('members'))}" title="${esc(t('members'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></button>` : ''}<button class="call-button" id="start-call" type="button" aria-label="${esc(t('startCall'))}" title="${esc(t('startCall'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.62 10.79a15.46 15.46 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.32.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.24 1.02z"/></svg></button></span>`;
}
async function openChat(kind, id, { force = false } = {}) {
  const data = kind === 'room' ? rooms.find(room => room.id === id) : users.find(user => user.id === id); if (!data) return;
  if (!force && !detachedChat && await desktopControls?.focusDetachedChat?.({ kind, id })) return;
  current = { kind, data }; $('#messages').innerHTML = ''; $('#empty-state').hidden = true;
  historyKey = '';
  $('#message-input').disabled = false; document.querySelectorAll('#composer button').forEach(button => { button.disabled = false; });
  $('#message-input').placeholder = t('messagePlaceholder');
  $('#composer button').title = '';
  renderConversationHeader();
  renderList();
  await refreshCurrentHistory();
}
async function fetchHistory(chat) {
  const response = await api(chat.kind === 'room' ? `/rooms/${chat.data.id}/messages` : `/users/${chat.data.id}/messages`);
  const history = Array.isArray(response) ? response : (response.messages || response.items || []);
  if (!Array.isArray(history)) throw new Error(t('historyFormat'));
  return history;
}
async function refreshCurrentHistory() {
  if (!current) return;
  const selected = current;
  try {
    const history = await fetchHistory(selected);
    if (current !== selected) return;
    const key = history.map(message => `${message.id}:${message.created_at}:${message.content}`).join('|');
    if (key === historyKey) return;
    historyKey = key; $('#messages').innerHTML = '';
    history.forEach(message => appendMessage(message, (message.user?.id || message.sender?.id) === me.id));
  } catch (error) {
    $('#messages').innerHTML = '';
    const warning = /not a member|forbidden|access denied/i.test(String(error.message));
    showSystemDialog(error.message, error.status >= 500 ? 'critical' : warning ? 'warning' : 'error', t('loadMessages'), warning && selected.kind === 'room' ? { action: { type: 'join-room', roomId: selected.data.id }, actionLabel: t('join') } : {});
  }
}
function websocketUrl() {
  const url = new URL(API);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/ws`.replace(/^\/\//, '/');
  url.search = ''; url.searchParams.set('token', token);
  return url.href;
}
// The server explains a rejected action in {type:'error', message}; repeats are shown once.
let lastServerError = { text: '', time: 0 };
function showServerError(text) {
  if (text === lastServerError.text && Date.now() - lastServerError.time < 5000) return;
  lastServerError = { text, time: Date.now() };
  showSystemDialog(text, 'error', t('serverMessage'));
}
function socketMessage(payload) {
  const type = payload?.type;
  if (CALL_EVENT_TYPES.has(type) && isDuplicateCallEvent(payload)) return;
  if (type === 'status') {
    const user = users.find(item => item.id === (payload.user_id ?? payload.user?.id));
    if (user) { user.is_online = payload.is_online ?? payload.online ?? true; renderList(); }
    return;
  }
  if (type === 'error' && payload.message) { showServerError(String(payload.message)); return; }
  if (type === 'error' || type === 'warning' || type === 'notification' || type === 'notice') {
    playServerSound(type);
    return;
  }
  if (type === 'call' || type === 'call_answer' || type === 'call_hangup') { handleCallSignal(payload); return; }
  if (type === 'screen_start' || type === 'screen_stop' || type === 'screen_frame') { handleScreenSignal(payload); return; }
  if (type === 'call_audio') { receiveCallAudio(payload); return; }
  if (type !== 'room_message' && type !== 'direct_message') return;
  const message = payload.message || payload;
  const roomId = payload.room_id ?? message.room_id;
  const otherId = payload.to_id ?? payload.user_id ?? message.to_id ?? message.user_id;
  const matchingRoom = current?.kind === 'room' && Number(roomId) === Number(current.data.id);
  const matchingDirect = current?.kind === 'dm' && [message.user_id, message.sender_id, message.to_id, payload.from_id, payload.to_id].some(id => Number(id) === Number(current.data.id));
  const mine = Number(message.user?.id || message.sender?.id || message.user_id || message.sender_id) === Number(me?.id);
  const sender = message.user || message.sender || userFor(message.user_id || message.sender_id || payload.from_id) || { display_name: t('user') };
  // An open conversation is already the notification: do not interrupt the user
  // with a toast for messages they can see immediately. A hidden window (tray on PC,
  // background on phones) shows nothing, so the open chat gets a notification too.
  const seen = (matchingRoom || matchingDirect) && document.visibilityState === 'visible';
  if (!mine && !seen) {
    desktopControls?.notifyMessage?.({ sender: displayName(sender), content: String(message.content || ''), avatarUrl: sender.avatar ? `${API}/avatars/${encodeURIComponent(sender.avatar)}` : '' });
  }
  if (!matchingRoom && !matchingDirect) { if (!mine) playSound('notify'); return; }
  const key = messageKey(message);
  if ([...document.querySelectorAll('#messages article')].some(node => node.dataset.key === key)) return;
  if (mine) {
    const pending = [...document.querySelectorAll('#messages article[data-pending="true"], #messages article[data-failed="true"]')].find(node => node.dataset.content === String(message.content));
    if (pending) { markDelivered(pending, key); return; }
  }
  appendMessage(message, mine);
  $('#messages article:last-child').dataset.key = key;
}
function openWebSocketConnection() {
  return new Promise((resolve, reject) => {
    let ws;
    try { ws = new WebSocket(websocketUrl()); } catch (error) { reject(error); return; }
    let open = false; let closed = false;
    const connection = {
      kind: 'ws',
      send: payload => { if (ws.readyState !== WebSocket.OPEN) throw new Error(t('socketConnecting')); ws.send(JSON.stringify(payload)); },
      close: () => finish(),
    };
    function finish() {
      if (closed) return; closed = true;
      try { ws.close(); } catch {}
      if (open) connection.onclose?.(); else { const error = new Error('WebSocket closed.'); error.code = connection.closeCode; reject(error); }
    }
    ws.onopen = () => { open = true; resolve(connection); };
    ws.onmessage = event => { try { connection.onmessage?.(JSON.parse(event.data)); } catch {} };
    // The server closes with 4401 (bad token) or 4403 (banned); 'error' is always followed by 'close'.
    ws.onclose = event => { connection.closeCode = event.code; finish(); };
    ws.onerror = () => {};
  });
}
function natsUrl(url) {
  // The server reports its internal http:// URL; the tunnel serves NATS over the API's scheme.
  const target = new URL(url || `${API.replace(/\/$/, '')}/nats`, API);
  target.protocol = new URL(API).protocol === 'https:' || target.protocol === 'https:' || target.protocol === 'wss:' ? 'wss:' : 'ws:';
  return target.href;
}
async function openNatsConnection() {
  if (!window.NekoNats) throw new Error('NATS client is not loaded.');
  const creds = await api('/nats/creds');
  const connection = { kind: 'nats' };
  const nats = await window.NekoNats.connect({
    url: natsUrl(creds.url), user: creds.user, pass: creds.password, subscribe: `nkc.out.${creds.uid}`,
    onMessage: text => { try { connection.onmessage?.(JSON.parse(text)); } catch {} },
    onClose: () => connection.onclose?.(),
  });
  connection.send = payload => nats.publish(`nkc.in.${creds.uid}`, JSON.stringify(payload));
  connection.close = () => nats.close();
  // nats-server can be up while the chat backend is not bridged to it: use NATS only once
  // the backend answers a ping on nkc.out.<uid>, otherwise fall back to /ws.
  const early = [];
  const answered = await new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 5000);
    connection.onmessage = payload => { if (payload?.type === 'pong') { clearTimeout(timer); resolve(true); } else early.push(payload); };
    try { connection.send({ type: 'ping' }); } catch { clearTimeout(timer); resolve(false); }
  });
  connection.onmessage = null;
  if (!answered) { nats.close(); throw new Error('the chat backend did not answer over NATS.'); }
  connection.early = early;
  return connection;
}
function stopHeartbeat() { clearInterval(heartbeat); heartbeat = null; missedPongs = 0; }
function startHeartbeat(connection) {
  stopHeartbeat();
  // Cloudflare drops idle connections after ~125 s without telling the client, so send a
  // data ping every 10 s and drop the connection when two pongs in a row are missing.
  heartbeat = setInterval(() => {
    if (socket !== connection) return;
    if (missedPongs >= 2) { connection.close(); return; }
    missedPongs += 1;
    try { connection.send({ type: 'ping' }); } catch { connection.close(); }
  }, 10000);
}
function scheduleReconnect() {
  clearTimeout(socketRetry);
  if (!token) return;
  socketRetry = setTimeout(connectSocket, socketRetryDelay);
  socketRetryDelay = Math.min(socketRetryDelay * 2, 15000);
}
function flushPendingCallSignals() {
  const now = Date.now();
  for (const [type, { payload, time }] of [...pendingCallSignals]) {
    pendingCallSignals.delete(type);
    if (now - time > 60000) continue;
    try { socket.send(payload); } catch { pendingCallSignals.set(type, { payload, time }); }
  }
}
// Reconnecting cannot fix these: an expired token needs a new sign-in, a ban ends the session.
function handleCloseCode(code) {
  if (code === 4401) { expireSession(); return true; }
  if (code === 4403) { accountBanned(); return true; }
  return false;
}
function accountBanned() {
  if (!token) return;
  const username = me?.username || '';
  leaveAccount(true); showLoginForm(); $('#auth-username').value = username;
  showSystemDialog(t('accountBanned'), 'critical', t('sessionEnded'));
}
async function connectSocket() {
  if (!token || socket || socketConnecting) return;
  clearTimeout(socketRetry);
  socketConnecting = true;
  const session = token;
  let connection = null;
  try { connection = await openNatsConnection(); }
  catch (error) { console.warn('NATS unavailable, falling back to WebSocket:', error.message); }
  let closeCode;
  if (!connection && token === session) { try { connection = await openWebSocketConnection(); } catch (error) { closeCode = error.code; } }
  socketConnecting = false;
  if (token === session && handleCloseCode(closeCode)) return;
  if (token !== session) { connection?.close(); if (token) connectSocket(); return; }
  if (!connection) { scheduleReconnect(); return; }
  socket = connection; socketRetryDelay = 1000;
  connection.onmessage = payload => { if (payload?.type === 'pong') { missedPongs = 0; return; } socketMessage(payload); };
  connection.early?.splice(0).forEach(payload => connection.onmessage(payload));
  connection.onclose = () => { if (socket !== connection) return; socket = null; stopHeartbeat(); if (!handleCloseCode(connection.closeCode)) scheduleReconnect(); };
  startHeartbeat(connection);
  try { connection.send({ type: 'ping' }); } catch {}
  flushPendingCallSignals();
}
function disconnectSocket() { clearTimeout(socketRetry); socketRetryDelay = 1000; stopHeartbeat(); pendingCallSignals.clear(); const connection = socket; socket = null; connection?.close(); }
function sendSocketMessage(payload) {
  if (!socket) {
    connectSocket();
    // Call signals must not be lost while reconnecting: keep the latest and send it later.
    if (RESENT_CALL_SIGNALS.has(payload?.type)) { pendingCallSignals.set(payload.type, { payload, time: Date.now() }); return; }
    throw new Error(t('socketConnecting'));
  }
  try { socket.send(payload); }
  catch (error) {
    if (RESENT_CALL_SIGNALS.has(payload?.type)) { pendingCallSignals.set(payload.type, { payload, time: Date.now() }); socket.close(); return; }
    throw error;
  }
}
function isDuplicateCallEvent(payload) {
  // The server may relay a call event to both the WebSocket and the SSE stream.
  const now = Date.now();
  for (const [key, time] of recentCallEvents) { if (now - time <= 3000) break; recentCallEvents.delete(key); }
  const key = [payload.type, payload.call_id, payload.seq ?? '', payload.from_id ?? payload.sender_id ?? payload.user_id ?? '', payload.reason ?? ''].join('|');
  if (recentCallEvents.has(key)) return true;
  recentCallEvents.set(key, now);
  // A new screen share restarts its frame numbers, so forget the previous one.
  if (payload.type === 'screen_stop') [...recentCallEvents.keys()].forEach(item => { if (item.startsWith(`screen_start|${payload.call_id}|`) || item.startsWith(`screen_frame|${payload.call_id}|`)) recentCallEvents.delete(item); });
  return false;
}
function eventStreamUrl() {
  const url = new URL(`${API.replace(/\/$/, '')}/stream`);
  url.searchParams.set('token', token);
  return url.href;
}
function eventStreamMessage(event, data) {
  let payload; try { payload = JSON.parse(data); } catch { return; }
  if (payload && !payload.type && event && event !== 'message') payload.type = event;
  // Chat messages keep arriving over the WebSocket; SSE carries only call traffic.
  if (CALL_EVENT_TYPES.has(payload?.type)) socketMessage(payload);
}
function connectEventStream() {
  if (!token || callTransport !== 'sse' || eventStream) return;
  clearTimeout(eventStreamRetry);
  const controller = new AbortController(); eventStream = controller;
  (async () => {
    // fetch() instead of EventSource: it negotiates HTTP/2 and accepts any event name.
    const response = await fetch(eventStreamUrl(), { headers: { Accept: 'text/event-stream' }, cache: 'no-store', signal: controller.signal });
    if (response.status === 401 && eventStream === controller) expireSession();
    if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`);
    eventStreamRetryDelay = 1000;
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = ''; let event = ''; let data = [];
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buffer += value; const lines = buffer.split(/\r\n|\r|\n/); buffer = lines.pop();
      for (const line of lines) {
        if (!line) { if (data.length) eventStreamMessage(event, data.join('\n')); event = ''; data = []; continue; }
        if (line.startsWith(':')) continue;
        const colon = line.indexOf(':'); const field = colon < 0 ? line : line.slice(0, colon); const text = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
        if (field === 'event') event = text; else if (field === 'data') data.push(text);
      }
    }
  })().catch(() => {}).finally(() => {
    if (eventStream !== controller) return;
    eventStream = null;
    if (token && callTransport === 'sse') { eventStreamRetry = setTimeout(connectEventStream, eventStreamRetryDelay); eventStreamRetryDelay = Math.min(eventStreamRetryDelay * 2, 15000); }
  });
}
function disconnectEventStream() { clearTimeout(eventStreamRetry); eventStreamRetryDelay = 1000; const controller = eventStream; eventStream = null; controller?.abort(); }
function sendCallMessage(payload) {
  if (callTransport === 'sse') return api('/push', { method: 'POST', body: JSON.stringify(payload) });
  try { sendSocketMessage(payload); return Promise.resolve(); } catch (error) { return Promise.reject(error); }
}
function setCallTransport(value) {
  const next = value === 'sse' ? 'sse' : 'ws';
  if (next === callTransport) return;
  callTransport = next; localStorage.setItem('nk_call_transport', next);
  if (next === 'sse') connectEventStream(); else disconnectEventStream();
  updateCallWindow();
}
function callId() { return globalThis.crypto?.randomUUID?.() || `call-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function callTarget(source = current) { return source?.kind === 'room' ? { room_id: source.data.id } : { to_id: source?.data.id }; }
function callPerson(target = current) { return target?.kind === 'room' ? { display_name: `# ${target.data.name ?? ''}` } : target?.data || { display_name: t('user') }; }
function bytesToBase64(bytes) { let text = ''; for (let start = 0; start < bytes.length; start += 0x8000) text += String.fromCharCode(...bytes.subarray(start, start + 0x8000)); return btoa(text); }
function base64ToBytes(value) { const text = atob(value); return Uint8Array.from(text, char => char.charCodeAt(0)); }
// Releases whatever part of the call audio exists; safe to call again for parts created later.
function releaseCallAudio(state) {
  if (state.processor) { state.processor.onaudioprocess = null; if (state.processor.port) state.processor.port.onmessage = null; state.processor.disconnect(); state.processor = null; }
  state.source?.disconnect(); state.source = null; state.silence?.disconnect(); state.silence = null;
  state.stream?.getTracks().forEach(track => track.stop()); state.stream = null;
  try { state.encoder?.close(); } catch {} state.encoder = null;
  state.peers?.forEach(peer => { try { peer.decoder.close(); } catch {} }); state.peers?.clear();
  state.denoiser?.destroy(); state.denoiser = null;
  if (state.context && state.context.state !== 'closed') state.context.close().catch(() => {});
}
function stopCallAudio() { const state = callAudio; if (!state) return; callAudio = null; releaseCallAudio(state); }
function setCallSpeaking(side, value) { if (!activeCall || activeCall[`${side}Speaking`] === value) return; activeCall[`${side}Speaking`] = value; updateCallWindow(); }
// Each remote speaker has its own Opus decoder and playback clock; their buffers play into the
// same AudioContext, which mixes them (N−1 in a room voice channel, one peer in a direct call).
function peerMuted(key) { return activeCall?.room ? Boolean(activeCall.participants?.get(key)?.muted) : Boolean(activeCall?.remoteMuted); }
function setPeerSpeaking(key, value) {
  if (!activeCall?.room) { setCallSpeaking('remote', value); return; }
  const participant = activeCall.participants?.get(key);
  if (!participant || participant.speaking === value) return;
  participant.speaking = value; updateCallWindow();
}
function playDecodedAudio(key, audioData) {
  const peer = callAudio?.peers?.get(key);
  // A participant muted in the call window is not played (and not shown as speaking).
  if (!callAudio?.context || !peer || peerMuted(key)) { audioData.close(); setPeerSpeaking(key, false); return; }
  const frames = audioData.numberOfFrames;
  const buffer = callAudio.context.createBuffer(audioData.numberOfChannels, frames, audioData.sampleRate);
  let energy = 0; for (let channel = 0; channel < audioData.numberOfChannels; channel += 1) { const samples = buffer.getChannelData(channel); audioData.copyTo(samples, { planeIndex: channel }); if (channel === 0) energy = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / Math.max(1, samples.length)); }
  setPeerSpeaking(key, energy > .018);
  audioData.close();
  const source = callAudio.context.createBufferSource(); source.buffer = buffer; source.connect(callAudio.context.destination);
  peer.playAt = Math.max(peer.playAt || 0, callAudio.context.currentTime + .04);
  source.start(peer.playAt); peer.playAt += buffer.duration;
}
function peerFor(key) {
  if (!callAudio?.peers) return null;
  let peer = callAudio.peers.get(key);
  if (!peer) {
    peer = { playAt: 0, decoder: new AudioDecoder({ output: data => playDecodedAudio(key, data), error: error => console.warn('Opus decode failed:', error) }) };
    peer.decoder.configure(OPUS_CONFIG);
    callAudio.peers.set(key, peer);
  }
  return peer;
}
const OPUS_CONFIG = { codec: 'opus', sampleRate: 48000, numberOfChannels: 1, bitrate: 32000 };
// RNNoise (neural noise suppression), loaded only when chosen in Display Properties.
async function createNoiseSuppressor() {
  if (!window.createRNNWasmModuleSync) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/js/vendor/rnnoise-sync.js';
      script.onload = resolve; script.onerror = () => reject(new Error('RNNoise failed to load.'));
      document.head.append(script);
    });
  }
  const module = await window.createRNNWasmModuleSync();
  const noise = module._rnnoise_create(); const pointer = module._malloc(480 * 4);
  return {
    // RNNoise works on 10 ms frames (480 samples at 48 kHz) in the 16-bit sample range.
    process(frame) {
      for (let start = 0; start + 480 <= frame.length; start += 480) {
        const part = frame.subarray(start, start + 480); const heap = module.HEAPF32.subarray(pointer >> 2, (pointer >> 2) + 480);
        for (let index = 0; index < 480; index += 1) heap[index] = part[index] * 32768;
        module._rnnoise_process_frame(noise, pointer, pointer);
        for (let index = 0; index < 480; index += 1) part[index] = heap[index] / 32768;
      }
    },
    destroy() { module._rnnoise_destroy(noise); module._free(pointer); },
  };
}
async function startCallAudio() {
  if (!activeCall?.target || callAudio) return;
  if (!globalThis.AudioEncoder || !globalThis.AudioDecoder || !navigator.mediaDevices?.getUserMedia) throw new Error(t('opusUnsupported'));
  const opus = OPUS_CONFIG;
  const support = await AudioEncoder.isConfigSupported(opus);
  if (!support.supported) throw new Error(t('opusConfigUnsupported'));
  if (!activeCall?.target || callAudio) return;
  const context = new AudioContext({ sampleRate: 48000 });
  const state = { context, sequence: 0, frameIndex: 0, lastVoice: -Infinity, peers: new Map(), call: activeCall };
  // callAudio owns the state from the start: a hangup during any await below releases it, and
  // a failure (no microphone, access denied) must not leave the AudioContext open.
  callAudio = state;
  const cancelled = () => { if (callAudio === state) return false; releaseCallAudio(state); return true; };
  try {
    await context.resume(); if (cancelled()) return;
    state.encoder = new AudioEncoder({ output: chunk => {
      if (!activeCall || activeCall !== state.call || chunk.byteLength === 0) return;
      const bytes = new Uint8Array(chunk.byteLength); chunk.copyTo(bytes);
      sendCallMessage({ type: 'call_audio', ...activeCall.target, call_id: activeCall.callId, seq: state.sequence++, audio: bytesToBase64(bytes) }).catch(() => {});
    }, error: error => console.warn('Opus encode failed:', error) });
    state.encoder.configure(opus);
    const display = await desktopControls?.getDisplaySettings?.(); if (cancelled()) return;
    const micDeviceId = display?.micDeviceId;
    const noiseSuppression = ['off', 'rnnoise'].includes(display?.noiseSuppression) ? display.noiseSuppression : 'webrtc';
    if (noiseSuppression === 'rnnoise') { try { state.denoiser = await createNoiseSuppressor(); } catch (error) { console.warn('RNNoise unavailable, using WebRTC noise suppression:', error); } if (cancelled()) return; }
    state.stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: micDeviceId ? { exact: micDeviceId } : undefined, channelCount: 1, sampleRate: 48000, echoCancellation: true, noiseSuppression: noiseSuppression === 'webrtc' || (noiseSuppression === 'rnnoise' && !state.denoiser), autoGainControl: true }, video: false });
    if (cancelled()) return;
    state.stream.getAudioTracks().forEach(track => { track.enabled = !activeCall?.muted; });
    state.source = context.createMediaStreamSource(state.stream); state.silence = context.createGain(); state.silence.gain.value = 0; state.silence.connect(context.destination);
    await connectCallCapture(state);
  } catch (error) { if (callAudio === state) callAudio = null; releaseCallAudio(state); throw error; }
}
function processCallFrame(state, frame) {
  if (callAudio !== state || state.encoder?.state !== 'configured') return;
  // With RNNoise the speaking indicator follows the cleaned signal, not the room noise.
  state.denoiser?.process(frame);
  const now = performance.now();
  if (Math.sqrt(frame.reduce((sum, value) => sum + value * value, 0) / frame.length) > .018) state.lastVoice = now;
  setCallSpeaking('self', now - state.lastVoice < 300);
  const data = new AudioData({ format: 'f32', sampleRate: 48000, numberOfFrames: 960, numberOfChannels: 1, timestamp: state.frameIndex++ * 20000, data: frame });
  state.encoder.encode(data); data.close();
}
async function connectCallCapture(state) {
  // AudioWorklet cuts 20 ms frames off the main thread; ScriptProcessor stays as the fallback
  // for WebViews without it.
  if (state.context.audioWorklet && globalThis.AudioWorkletNode) {
    try {
      await state.context.audioWorklet.addModule('assets/js/call-capture-worklet.js');
      if (callAudio !== state || !state.source) return;
      state.processor = new AudioWorkletNode(state.context, 'nekochat-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
      state.processor.port.onmessage = event => processCallFrame(state, event.data);
      state.source.connect(state.processor); state.processor.connect(state.silence);
      return;
    } catch (error) { console.warn('AudioWorklet unavailable, using ScriptProcessor:', error); }
  }
  if (callAudio !== state || !state.source) return;
  let pending = new Float32Array(0);
  state.processor = state.context.createScriptProcessor(4096, 1, 1);
  state.processor.onaudioprocess = event => {
    const input = event.inputBuffer.getChannelData(0);
    const joined = new Float32Array(pending.length + input.length); joined.set(pending); joined.set(input, pending.length);
    let offset = 0;
    for (; joined.length - offset >= 960; offset += 960) processCallFrame(state, joined.slice(offset, offset + 960));
    pending = joined.slice(offset);
  };
  state.source.connect(state.processor); state.processor.connect(state.silence);
}
function receiveCallAudio(payload) {
  const senderId = senderOf(payload);
  if (payload.room_id != null) noteRoomPresence(payload, senderId);
  if (!callAudio || !activeCall || !payload.audio || !sameCall(payload) || (senderId && senderId === Number(me?.id))) return;
  // A late participant is picked up by their first audio frame (from_id).
  if (activeCall.room && senderId) addParticipant(senderId);
  const peer = peerFor(senderId || 'remote'); if (!peer) return;
  try { peer.decoder.decode(new EncodedAudioChunk({ type: 'key', timestamp: Number(payload.seq || 0) * 20000, data: base64ToBytes(payload.audio) })); } catch (error) { console.warn('Invalid Opus frame:', error); }
}
// Both sides can share at once: each keeps its own picture and the call window shows the one
// chosen with the button under that person, so the two streams no longer overwrite each other.
function refreshScreenView(prefer) {
  if (!activeCall) return;
  const available = [screenShare && 'self', remoteScreen && 'remote'].filter(Boolean);
  activeCall.previews ||= { self: '', remote: '' };
  if (!screenShare) activeCall.previews.self = '';
  if (!remoteScreen) activeCall.previews.remote = '';
  activeCall.screenView = available.includes(prefer) ? prefer : available.includes(activeCall.screenView) ? activeCall.screenView : available[0] || null;
  updateCallWindow();
}
function updateScreenPreview(frame, state, side) {
  if (!activeCall || Date.now() - (state.lastPreview || 0) < 160) return;
  state.lastPreview = Date.now();
  const width = Math.max(1, Math.min(frame.displayWidth || frame.codedWidth, 960));
  const height = Math.max(1, Math.round(width * (frame.displayHeight || frame.codedHeight) / (frame.displayWidth || frame.codedWidth)));
  state.canvas ||= document.createElement('canvas'); state.canvas.width = width; state.canvas.height = height;
  state.canvas.getContext('2d').drawImage(frame, 0, 0, width, height);
  activeCall.previews ||= { self: '', remote: '' };
  activeCall.previews[side] = state.canvas.toDataURL('image/jpeg', .7);
  if (activeCall.screenView === side) updateCallWindow();
}
function stopScreenShare(notify = true) {
  if (!screenShare) return;
  screenShare.reader?.cancel().catch(() => {}); screenShare.stream?.getTracks().forEach(track => track.stop()); try { screenShare.encoder?.close(); } catch {}
  if (notify && activeCall?.target) sendCallMessage({ type: 'screen_stop', ...activeCall.target, call_id: activeCall.callId }).catch(() => {});
  screenShare = null; refreshScreenView();
}
function stopRemoteScreen() { try { remoteScreen?.decoder?.close(); } catch {} remoteScreen = null; }
// Screen sharing codec (Display Properties): VP9 by default, VP8 and AV1 on request; the first
// one this Chromium can encode is used, and the receiver decodes whatever screen_start names.
const SCREEN_CODECS = { vp8: 'vp8', vp9: 'vp09.00.41.08', av1: 'av01.0.08M.08' };
async function screenEncoderConfig(width, height) {
  let choice = 'auto'; try { choice = localStorage.getItem('nk_screen_codec') || 'auto'; } catch {}
  const order = [...new Set([...(SCREEN_CODECS[choice] ? [choice] : []), 'vp9', 'vp8'])];
  for (const name of order) {
    const config = { codec: SCREEN_CODECS[name], width, height, bitrate: name === 'av1' ? 1_000_000 : 1_500_000, framerate: 12 };
    try { if ((await VideoEncoder.isConfigSupported(config)).supported) return config; } catch {}
  }
  return null;
}
async function toggleScreenShare() {
  if (!activeCall?.target || activeCall.incoming || activeCall.status !== 'connected') return;
  if (screenShare) return stopScreenShare();
  if (!globalThis.VideoEncoder || !globalThis.MediaStreamTrackProcessor || !navigator.mediaDevices?.getDisplayMedia) throw new Error(t('screenUnsupported'));
  await desktopControls?.prepareDisplayCapture?.();
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 12, max: 15 } }, audio: false });
  const track = stream.getVideoTracks()[0]; const settings = track.getSettings(); const width = settings.width || 1280; const height = settings.height || 720;
  const config = await screenEncoderConfig(width, height);
  if (!config) { stream.getTracks().forEach(item => item.stop()); throw new Error(t('screenCodecUnsupported')); }
  const state = { stream, sequence: 0, lastPreview: 0 }; screenShare = state;
  state.encoder = new VideoEncoder({ output: chunk => { if (screenShare !== state || !activeCall) return; const bytes = new Uint8Array(chunk.byteLength); chunk.copyTo(bytes); sendCallMessage({ type: 'screen_frame', ...activeCall.target, call_id: activeCall.callId, seq: state.sequence++, key: chunk.type === 'key', data: bytesToBase64(bytes) }).catch(() => {}); }, error: error => console.warn('Screen encode failed:', error) });
  state.encoder.configure(config); state.reader = new MediaStreamTrackProcessor({ track }).readable.getReader();
  refreshScreenView('self');
  try { await sendCallMessage({ type: 'screen_start', ...activeCall.target, call_id: activeCall.callId, codec: config.codec, width, height }); }
  catch (error) { if (screenShare === state) stopScreenShare(false); throw error; }
  track.onended = () => { if (screenShare === state) stopScreenShare(); };
  (async () => { while (screenShare === state) { const { value: frame, done } = await state.reader.read(); if (done || !frame) break; updateScreenPreview(frame, state, 'self'); state.encoder.encode(frame, { keyFrame: state.sequence % 72 === 0 }); frame.close(); } })().catch(error => console.warn('Screen capture failed:', error));
}
function handleScreenSignal(payload) {
  if (!activeCall || activeCall.incoming || !sameCall(payload)) return;
  const senderId = senderOf(payload); if (senderId && senderId === Number(me?.id)) return;
  if (payload.type === 'screen_start') {
    // A room has one sharer: a new screen_start switches the screen to that person.
    stopRemoteScreen(); const state = { lastPreview: 0, senderId };
    const codec = payload.codec || 'vp8';
    const config = { codec, codedWidth: Number(payload.width) || 1280, codedHeight: Number(payload.height) || 720 };
    remoteScreen = state;
    (globalThis.VideoDecoder ? VideoDecoder.isConfigSupported(config).catch(() => ({ supported: false })) : Promise.resolve({ supported: false })).then(support => {
      if (remoteScreen !== state) return;
      if (!support.supported) { remoteScreen = null; showSystemDialog(t('screenCodecDecode', { codec }), 'warning', t('screenShare')); return; }
      try {
        state.decoder = new VideoDecoder({ output: frame => { if (remoteScreen === state) updateScreenPreview(frame, state, 'remote'); frame.close(); }, error: error => console.warn('Screen decode failed:', error) });
        state.decoder.configure(config);
        if (activeCall?.room && senderId) addParticipant(senderId);
        refreshScreenView('remote');
      } catch (error) { remoteScreen = null; console.warn('Screen share unavailable:', error); }
    });
    return;
  }
  if (payload.type === 'screen_stop') {
    // In a room only the current sharer's screen_stop turns the screen off.
    if (activeCall.room && remoteScreen?.senderId && senderId && remoteScreen.senderId !== senderId) return;
    stopRemoteScreen(); refreshScreenView(); return;
  }
  if (!remoteScreen?.decoder || !payload.data) return;
  try { remoteScreen.decoder.decode(new EncodedVideoChunk({ type: payload.key ? 'key' : 'delta', timestamp: Number(payload.seq || 0) * 83333, data: base64ToBytes(payload.data) })); } catch (error) { console.warn('Invalid screen frame:', error); }
}
function updateCallWindow() {
  if (!activeCall) return;
  const person = activeCall.person || { display_name: t('user') };
  const remoteName = displayName(person);
  const room = Boolean(activeCall.room);
  const participants = room ? [...activeCall.participants.values()] : [];
  // In a room the screen belongs to whoever shares it; show that person on the screen stage.
  const sharer = room && remoteScreen?.senderId ? (userFor(remoteScreen.senderId) || { display_name: t('user') }) : null;
  const remote = sharer || person;
  const title = !room ? (activeCall.incoming ? t('incomingCall', { name: remoteName }) : t('outgoingCall', { name: remoteName }))
    : activeCall.incoming ? t('roomInvite', { name: displayName(userFor(activeCall.invitedBy) || { display_name: t('user') }), room: remoteName }) : t('roomChannel', { room: remoteName });
  const status = room && activeCall.status === 'connected' ? t('roomParticipants', { count: participants.length + 1 }) : callStatusText(activeCall.status || 'connecting');
  desktopControls?.openCallWindow({
    title, status, avatar: room ? '#' : avatar(person), room,
    incoming: Boolean(activeCall.incoming), audioAvailable: false, muted: Boolean(activeCall.muted), direct: Boolean(activeCall.target.to_id), connected: activeCall.status === 'connected', self: { avatar: avatar(me || {}), name: me ? displayName(me) : t('you'), frame: avatarColour(me), speaking: Boolean(activeCall.selfSpeaking) }, remote: { avatar: room && !sharer ? '#' : avatar(remote), name: sharer ? displayName(sharer) : remoteName, frame: avatarColour(remote), speaking: Boolean(activeCall.remoteSpeaking) }, sharing: activeCall.screenView || null, screenPreview: activeCall.previews?.[activeCall.screenView] || '', selfSharing: Boolean(screenShare), remoteSharing: Boolean(remoteScreen), remoteMuted: Boolean(activeCall.remoteMuted), transport: callTransport,
    participants: participants.map(item => ({ id: item.id, avatar: avatar(item.user), name: displayName(item.user), frame: avatarColour(item.user), speaking: Boolean(item.speaking), muted: Boolean(item.muted) })),
  });
}
function endCall(reason, notify = true) {
  // Dismissing a room invite is local: call_hangup in a room means leaving the channel.
  if (activeCall?.room && activeCall.incoming) notify = false;
  if (activeCall?.room) reason = 'leave';
  if (activeCall && notify) {
    sendCallMessage({ type: 'call_hangup', call_id: activeCall.callId, ...activeCall.target, ...(reason ? { reason } : {}) }).catch(() => {});
  }
  clearTimeout(activeCall?.ringTimer); clearInterval(activeCall?.presenceTimer);
  stopRingtone();
  stopScreenShare(false);
  stopRemoteScreen();
  stopCallAudio();
  activeCall = null;
  desktopControls?.closeCallWindow();
}
const RING_TIMEOUT = 45000;
function startCall() {
  if (!current || activeCall) return;
  const target = callTarget();
  if (!target.to_id && !target.room_id) return;
  if (target.room_id) { joinRoomChannel(target.room_id); return; }
  activeCall = { callId: callId(), target, kind: current.kind, person: callPerson(), incoming: false, status: 'waiting' };
  updateCallWindow();
  startRingtone('ringout');
  const id = activeCall.callId;
  // Nobody answered: hang up with reason no-answer instead of ringing forever.
  activeCall.ringTimer = setTimeout(() => {
    if (activeCall?.callId !== id || activeCall.status !== 'waiting') return;
    endCall('no-answer'); showSystemDialog(t('noAnswer'), 'info', t('call'));
  }, RING_TIMEOUT);
  sendCallMessage({ type: 'call', call_id: id, ...target }).catch(error => {
    if (activeCall?.callId !== id) return;
    clearTimeout(activeCall.ringTimer); stopRingtone(); activeCall = null; desktopControls?.closeCallWindow(); showSystemDialog(error.message, 'error', t('callStart'));
  });
}

// ---- Room voice channels --------------------------------------------------------------------
// The server only relays: `call` with room_id announces joining, `call_answer` accepts an invite,
// `call_audio` goes to everyone else in the channel and `call_hangup` (reason leave) leaves it.
// Who is in a channel is derived from those messages (from_id), there is no REST list.
const roomChannels = new Map(); // room id → { callId, members: Map(user id → last seen) }
const PRESENCE_TIMEOUT = 20000;
const senderOf = payload => Number(payload.from_id ?? payload.sender_id ?? payload.user_id ?? payload.user?.id) || 0;
function sameCall(payload) {
  if (!activeCall) return false;
  return activeCall.room ? payload.room_id != null && Number(payload.room_id) === Number(activeCall.target.room_id) : payload.call_id === activeCall.callId;
}
function noteRoomPresence(payload, senderId) {
  const roomId = Number(payload.room_id);
  if (!roomId || !senderId || senderId === Number(me?.id)) return;
  const channel = roomChannels.get(roomId) || { callId: payload.call_id, members: new Map() };
  if (payload.type === 'call_hangup') channel.members.delete(senderId);
  else { channel.members.set(senderId, Date.now()); if (payload.call_id) channel.callId = payload.call_id; }
  roomChannels.set(roomId, channel);
}
function activeChannel(roomId) {
  const channel = roomChannels.get(Number(roomId)); if (!channel) return null;
  for (const [id, seen] of channel.members) if (Date.now() - seen > PRESENCE_TIMEOUT) channel.members.delete(id);
  return channel.members.size ? channel : null;
}
function addParticipant(userId) {
  if (!activeCall?.room || !userId || userId === Number(me?.id)) return;
  const existing = activeCall.participants.get(userId);
  if (existing) { existing.seen = Date.now(); return; }
  activeCall.participants.set(userId, { id: userId, user: userFor(userId) || { id: userId, display_name: t('user') }, seen: Date.now(), speaking: false, muted: false });
  updateCallWindow();
}
function removeParticipant(userId) {
  if (!activeCall?.room || !activeCall.participants.delete(userId)) return;
  const peer = callAudio?.peers?.get(userId);
  if (peer) { try { peer.decoder.close(); } catch {} callAudio.peers.delete(userId); }
  if (remoteScreen?.senderId === userId) { stopRemoteScreen(); refreshScreenView(); }
  updateCallWindow();
}
function roomCall(roomId, fields) {
  const room = rooms.find(item => Number(item.id) === Number(roomId));
  const participants = new Map();
  const call = { target: { room_id: Number(roomId) }, kind: 'room', room: true, person: { display_name: `# ${room?.name || t('room')}` }, participants, ...fields };
  // Someone who left without call_hangup disappears when their frames stop.
  call.presenceTimer = setInterval(() => {
    if (activeCall !== call) return;
    for (const [id, item] of participants) if (Date.now() - item.seen > PRESENCE_TIMEOUT) removeParticipant(id);
  }, 5000);
  return call;
}
function joinRoomChannel(roomId, invite) {
  const channel = activeChannel(roomId);
  const id = invite?.callId || channel?.callId || callId();
  activeCall = roomCall(roomId, { callId: id, incoming: false, status: 'connecting' });
  channel?.members.forEach((seen, userId) => addParticipant(userId));
  updateCallWindow();
  // Accepting an invite (or joining a channel that is already on) is call_answer; opening it is call.
  sendCallMessage({ type: invite || channel ? 'call_answer' : 'call', call_id: id, room_id: Number(roomId) }).catch(() => {});
  startCallAudio().then(() => { if (activeCall?.callId === id) { activeCall.status = 'connected'; updateCallWindow(); } }).catch(error => endCall() || showSystemDialog(error.message, 'error', t('microphone')));
}
function handleRoomSignal(payload, senderId) {
  noteRoomPresence(payload, senderId);
  if (senderId && senderId === Number(me?.id)) return; // the server echoes our own announce
  if (activeCall?.room && sameCall(payload)) {
    if (payload.type === 'call_hangup') removeParticipant(senderId);
    else addParticipant(senderId);
    // Everyone left before the invite was answered: nothing to join any more.
    if (activeCall?.incoming && !activeCall.participants.size) endCall(undefined, false);
    return;
  }
  // Not in this channel: an invite that rings like a call (no busy reply to a room, though).
  if (payload.type !== 'call' || activeCall || !senderId) return;
  activeCall = roomCall(payload.room_id, { callId: payload.call_id, incoming: true, status: 'invite', invitedBy: senderId });
  activeChannel(payload.room_id)?.members.forEach((seen, userId) => addParticipant(userId));
  const invite = activeCall;
  invite.ringTimer = setTimeout(() => { if (activeCall === invite && invite.incoming) endCall(undefined, false); }, RING_TIMEOUT);
  startRingtone('ringin');
  updateCallWindow();
}
function handleCallSignal(payload) {
  const senderId = senderOf(payload);
  if (payload.room_id != null) { handleRoomSignal(payload, senderId); return; }
  const isOwnEcho = activeCall?.callId === payload.call_id && !senderId || senderId === Number(me?.id);
  if (payload.type === 'call') {
    if (isOwnEcho) return;
    const target = payload.room_id != null ? { room_id: payload.room_id } : senderId ? { to_id: senderId } : null;
    if (!target) return;
    if (activeCall) { sendCallMessage({ type: 'call_hangup', call_id: payload.call_id, ...target, reason: 'busy' }).catch(() => {}); return; }
    activeCall = { callId: payload.call_id, target, kind: payload.room_id != null ? 'room' : 'dm', person: payload.room_id != null ? { display_name: `# ${rooms.find(room => Number(room.id) === Number(payload.room_id))?.name || t('room')}` } : userFor(senderId) || { display_name: t('user') }, incoming: true, status: 'ringing' };
    // If the caller's hangup is lost, stop ringing a little after they would have given up.
    const incoming = activeCall;
    incoming.ringTimer = setTimeout(() => { if (activeCall === incoming && incoming.incoming) endCall(undefined, false); }, RING_TIMEOUT + 15000);
    startRingtone('ringin');
    updateCallWindow(); return;
  }
  if (!activeCall || activeCall.callId !== payload.call_id) return;
  if (payload.type === 'call_answer') {
    clearTimeout(activeCall.ringTimer);
    stopRingtone();
    activeCall.incoming = false; activeCall.status = 'connecting'; updateCallWindow();
    startCallAudio().then(() => { if (activeCall?.callId === payload.call_id) { activeCall.status = 'connected'; updateCallWindow(); } }).catch(error => endCall('mic') || showSystemDialog(error.message, 'error', t('microphone')));
  }
  if (payload.type === 'call_hangup') {
    const calling = !activeCall.incoming && activeCall.status === 'waiting';
    clearTimeout(activeCall.ringTimer); stopRingtone(); stopCallAudio(); stopScreenShare(false); stopRemoteScreen(); activeCall = null; desktopControls?.closeCallWindow();
    // Tell the caller why the call did not start.
    const reasonText = calling && { busy: t('callBusy'), declined: t('callDeclined'), 'no-answer': t('noAnswer') }[payload.reason];
    if (reasonText) showSystemDialog(reasonText, 'info', t('call'));
  }
}
async function boot() {
  try {
    setLoggedIn(await api('/api/me'));
    await refresh();
    if (detachedChat) await openChat(detachedChat.kind, detachedChat.id);
  } catch (error) { disconnectSocket(); disconnectEventStream(); token = null; me = null; localStorage.removeItem('nk_token'); showAuthScreen(); $('#auth-error').textContent = t('sessionExpired'); }
}

let registering = false;
$('#auth-switch').onclick = () => { registering = !registering; $('.login-card').classList.toggle('registering', registering); applyDisplaySettings(displaySettings); };
$('#classic-cancel').onclick = () => { $('#auth-password').value = ''; $('#auth-error').textContent = ''; };
$('#show-login-form').onclick = showLoginForm;
$('#back-to-users').onclick = renderSavedUsers;
$('#saved-users').onclick = event => { const button = event.target.closest('[data-saved-session]'); if (button) useSavedSession(Number(button.dataset.savedSession)); };
$('#server-url').value = API; $('#classic-server-url').value = API;
$('#change-server').onclick = () => { const hidden = !$('#server-switch').hidden; $('#server-switch').hidden = hidden; $('#dns-switch').hidden = hidden; $('#server-url').focus(); };
// The XP footer and the classic logon form each have their own server URL field.
function applyServerUrl(value) {
  try {
    const url = new URL(value.trim() || DEFAULT_API);
    if (!/^https?:$/.test(url.protocol)) throw new Error();
    API = url.href.replace(/\/$/, ''); localStorage.setItem('nk_server_url', API); $('#server-url').value = API; $('#classic-server-url').value = API; $('#auth-error').textContent = '';
    return true;
  } catch { $('#auth-error').textContent = t('serverUrlInvalid'); return false; }
}
$('#server-url').onchange = () => { if (applyServerUrl($('#server-url').value)) { renderSavedUsers(); refreshServerInfo(); } };
$('#classic-server-url').onchange = () => { if (applyServerUrl($('#classic-server-url').value)) refreshServerInfo(); };
// DNS resolver (desktop only): chosen on the logon screen or in Display Properties.
const DNS_CHOICES = ['system', 'cloudflare', 'google', 'quad9', 'adguard', 'custom'];
let dnsDraft;
function renderDnsControls() {
  const supported = Boolean(desktopControls?.dnsSupported);
  const dns = dnsDraft || displaySettings.dns || 'system';
  document.querySelectorAll('.dns-control').forEach(node => node.classList.toggle('dns-unsupported', !supported));
  document.querySelectorAll('.dns-select').forEach(select => { select.innerHTML = DNS_CHOICES.map(id => `<option value="${id}">${esc(t(`dns_${id}`))}</option>`).join(''); select.value = dns; });
  document.querySelectorAll('.dns-custom').forEach(input => { if (document.activeElement !== input) input.value = displaySettings.dnsCustom || ''; input.hidden = dns !== 'custom'; });
}
async function saveDns(dns, dnsCustom) {
  try { dnsDraft = null; applyDisplaySettings(await desktopControls.applyDisplaySettings({ dns, dnsCustom })); $('#auth-error').textContent = ''; }
  catch (error) { $('#auth-error').textContent = String(error.message).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); renderDnsControls(); }
}
document.addEventListener('change', event => {
  const select = event.target.closest('.dns-select');
  if (select) {
    // A custom resolver needs its address first: show the field and save once it is filled.
    if (select.value === 'custom' && !displaySettings.dnsCustom) { dnsDraft = 'custom'; renderDnsControls(); select.parentElement.querySelector('.dns-custom')?.focus(); return; }
    saveDns(select.value, displaySettings.dnsCustom || '');
    return;
  }
  const input = event.target.closest('.dns-custom');
  if (input) saveDns('custom', input.value.trim());
});
renderDnsControls();
$('#auth-form').addEventListener('submit', async event => { event.preventDefault(); if (displaySettings.loginUi === 'classic' && !applyServerUrl($('#classic-server-url').value)) return; const username = $('#auth-username').value.trim(); const password = $('#auth-password').value; $('#auth-error').textContent = ''; showWelcome(); try { const body = registering ? { username, password, display_name: $('#auth-display').value.trim() || username } : { username, password }; const result = await api(registering ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify(body) }); token = result.access_token; localStorage.setItem('nk_token', token); rememberSession(result.user); setLoggedIn(result.user, true); await refresh(); } catch (error) { $('#welcome-screen').hidden = true; showSystemDialog(error.message, 'critical', t('loginError')); } });
$('#chat-list').addEventListener('click', event => {
  const button = event.target.closest('[data-kind]');
  if (!button) return;
  if (button.dataset.kind === 'dm' && event.target.closest('.avatar')) return showUserProfile(users.find(user => user.id === Number(button.dataset.id)));
  openChat(button.dataset.kind, Number(button.dataset.id));
});
function openProfileFromTrigger(event) {
  const trigger = event.target.closest('[data-profile-id]');
  const user = trigger && userFor(Number(trigger.dataset.profileId));
  if (user) showUserProfile(user);
}
$('#conversation-header').addEventListener('click', openProfileFromTrigger);
$('#conversation-header').addEventListener('click', event => { if (event.target.closest('#start-call')) startCall(); if (event.target.closest('#room-members') && current?.kind === 'room') showRoomMembers(current.data); });
$('#conversation-header').addEventListener('pointerdown', event => {
  if (!current || event.button !== 0 || event.target.closest('button, .profile-trigger')) return;
  const start = { x: event.screenX, y: event.screenY };
  const header = event.currentTarget;
  header.setPointerCapture(event.pointerId);
  header.classList.add('detaching');
  const finish = move => {
    header.classList.remove('detaching');
    if (Math.hypot(move.screenX - start.x, move.screenY - start.y) < 24) return;
    const chat = { kind: current.kind, id: current.data.id };
    if (detachedChat) desktopControls?.returnChat?.({ ...chat, point: { x: move.screenX, y: move.screenY } });
    else {
      const detach = desktopControls?.detachChat;
      if (!detach) return;
      detach(chat).then(opened => {
        if (!opened || !current || current.kind !== chat.kind || Number(current.data.id) !== Number(chat.id)) return;
        current = null; historyKey = ''; $('#empty-state').hidden = false; $('#messages').innerHTML = ''; $('#conversation-header').innerHTML = '';
        $('#message-input').disabled = true; document.querySelectorAll('#composer button').forEach(button => { button.disabled = true; });
      });
    }
  };
  header.addEventListener('pointerup', finish, { once: true });
  header.addEventListener('pointercancel', () => header.classList.remove('detaching'), { once: true });
});
desktopControls?.onChatRestore?.(chat => openChat(chat.kind, Number(chat.id), { force: true }));
$('#messages').addEventListener('click', openProfileFromTrigger);
document.querySelectorAll('.tab').forEach(button => button.onclick = () => { activeTab = button.dataset.tab; current = null; historyKey = ''; $('#empty-state').hidden = false; $('#messages').innerHTML = ''; $('#conversation-header').innerHTML = ''; $('#message-input').disabled = true; document.querySelectorAll('#composer button').forEach(button => { button.disabled = true; }); $('#message-input').placeholder = t('messagePlaceholder'); $('#send-message').title = ''; document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab === button)); renderList(); });
$('#system-ok').onclick = () => $('#system-dialog').close(); $('#system-close').onclick = () => $('#system-dialog').close();
$('#search').oninput = renderList;
$('#refresh-chats').onclick = async () => { const button = $('#refresh-chats'); button.disabled = true; try { await refresh(); if (current?.kind === 'room') current.data = rooms.find(room => room.id === current.data.id) || current.data; } catch (error) { showSystemDialog(error.message, 'error', t('loadMessages')); } finally { button.disabled = false; } };
$('#composer').addEventListener('submit', async event => {
  event.preventDefault();
  const content = $('#message-input').value.trim();
  if (!content || !current) return;
  const submit = $('#send-message'); submit.disabled = true;
  try { sendChatMessage(content); $('#message-input').value = ''; }
  catch (error) { showSystemDialog(error.message, 'error', t('sendMessage')); }
  finally { submit.disabled = false; }
});
// A connection can look open for up to ~30 s after it silently died (until two pongs are
// missed), so a sent message is only trusted once the server echoes it back.
const DELIVERY_TIMEOUT = 8000;
function sendChatMessage(content) {
  const chat = current;
  sendSocketMessage(chat.kind === 'room'
    ? { type: 'room_message', room_id: chat.data.id, content }
    : { type: 'direct_message', to_id: chat.data.id, content });
  appendMessage({ id: `local-${Date.now()}`, content, created_at: new Date().toISOString(), user: me }, true, `local:${Date.now()}:${content}`, true);
  const node = $('#messages article:last-child'); const connection = socket;
  setTimeout(() => confirmDelivery(node, chat, connection), DELIVERY_TIMEOUT);
}
function markDelivered(node, key) { node.dataset.key = key; delete node.dataset.pending; delete node.dataset.failed; node.classList.remove('failed'); node.removeAttribute('title'); node.querySelector('.delivery-error')?.remove(); }
async function confirmDelivery(node, chat, connection) {
  if (node.dataset.pending !== 'true' || !node.isConnected) return;
  // No echo: the message may still have reached the server, so ask the history first.
  let delivered;
  try {
    const shown = new Set([...document.querySelectorAll('#messages article')].map(item => item.dataset.key));
    delivered = (await fetchHistory(chat)).slice(-50).find(message => Number(message.user?.id || message.sender?.id || message.user_id || message.sender_id) === Number(me?.id) && String(message.content) === node.dataset.content && !shown.has(messageKey(message)));
  } catch {}
  if (node.dataset.pending !== 'true' || !node.isConnected) return;
  if (delivered) { markDelivered(node, messageKey(delivered)); return; }
  delete node.dataset.pending; node.dataset.failed = 'true'; node.classList.add('failed'); node.title = t('notDelivered');
  node.querySelector('.message-body')?.insertAdjacentHTML('beforeend', `<small class="delivery-error">${esc(t('notDelivered'))}</small>`);
  if (socket && socket === connection) socket.close();
}
$('#messages').addEventListener('click', event => {
  const node = event.target.closest('article[data-failed="true"]');
  if (!node || event.target.closest('.profile-trigger') || !current) return;
  const content = node.dataset.content;
  try { sendChatMessage(content); node.remove(); } catch (error) { showSystemDialog(error.message, 'error', t('sendMessage')); }
});
$('#emoji-button').onclick = () => desktopControls?.openEmojiBrowser?.();
desktopControls?.onEmojiSelected?.(emoji => {
  if (typeof emoji !== 'string') return;
  const input = $('#message-input');
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.setRangeText(emoji, start, end, 'end');
  input.focus();
});
$('#add-chat').onclick = () => {
  if (activeTab !== 'rooms') return;
  desktopControls?.openRoomCreate?.();
};
desktopControls?.onRoomCreated?.(async room => { try { await refresh(); await openChat('room', Number(room.id)); } catch (error) { showSystemDialog(error.message, 'error', t('roomCreate')); } });
desktopControls?.onSystemAction?.(async action => {
  if (action?.type !== 'join-room' || !Number.isFinite(Number(action.roomId))) return;
  const roomId = Number(action.roomId);
  try {
    await api(`/rooms/${roomId}/join`, { method: 'POST' });
    await refresh();
    await openChat('room', roomId, { force: true });
  } catch (error) { showSystemDialog(error.message, 'error', t('roomJoin')); }
});
$('#profile-button').onclick = () => $('#profile-dialog').showModal(); document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => document.querySelector(`#${button.dataset.close}`).close());
function leaveAccount(forgetSession) { if (activeCall) endCall(); stopRingtone(); playSound('logoff'); desktopControls?.closeDetachedChats?.(); disconnectSocket(); disconnectEventStream(); if (forgetSession) writeSavedSessions(savedSessions().filter(item => item?.key !== `${API}|${me?.id}`)); token = null; me = null; localStorage.removeItem('nk_token'); $('#profile-dialog').close(); showAuthScreen(); }
function expireSession() {
  if (!token || !me) return;
  const username = me.username || '';
  leaveAccount(true); showLoginForm(); $('#auth-username').value = username;
  showSystemDialog(t('sessionExpired'), 'warning', t('sessionEnded'));
}
// Closing or reloading the page must not leave the microphone or screen capture running.
window.addEventListener('pagehide', () => { if (activeCall) endCall(); });
$('#change-user').onclick = () => leaveAccount(false);
$('#logout').onclick = () => leaveAccount(true);
async function acceptCall() {
  if (!activeCall?.incoming) return;
  if (activeCall.room) {
    // Joining from an invite: keep the channel's call_id so everyone matches.
    const invite = activeCall; clearTimeout(invite.ringTimer); clearInterval(invite.presenceTimer); stopRingtone(); activeCall = null;
    joinRoomChannel(invite.target.room_id, { callId: invite.callId });
    return;
  }
  try {
    clearTimeout(activeCall.ringTimer);
    stopRingtone();
    const id = activeCall.callId;
    await sendCallMessage({ type: 'call_answer', call_id: id, ...activeCall.target });
    if (activeCall?.callId !== id) return;
    activeCall.incoming = false; activeCall.status = 'connecting'; updateCallWindow();
    startCallAudio().then(() => { if (activeCall?.callId === id) { activeCall.status = 'connected'; updateCallWindow(); } }).catch(error => endCall('mic') || showSystemDialog(error.message, 'error', t('microphone')));
  }
  catch (error) { showSystemDialog(error.message, 'error', t('callAccept')); }
}
desktopControls?.onCallAction?.(({ action, transport, side, id } = {}) => {
  if (action === 'accept') acceptCall();
  else if (action === 'transport') setCallTransport(transport);
  else if (action === 'decline') endCall('declined');
  else if (action === 'mute') {
    if (!activeCall) return;
    activeCall.muted = !activeCall.muted;
    callAudio?.stream?.getAudioTracks().forEach(track => { track.enabled = !activeCall.muted; });
    updateCallWindow();
  }
  else if (action === 'mute-remote') {
    if (!activeCall) return;
    const participant = activeCall.room ? activeCall.participants.get(Number(id)) : null;
    if (participant) participant.muted = !participant.muted; else activeCall.remoteMuted = !activeCall.remoteMuted;
    updateCallWindow();
  }
  else if (action === 'screen-view') refreshScreenView(side === 'self' ? 'self' : 'remote');
  else if (action === 'share') toggleScreenShare().catch(error => showSystemDialog(error.name === 'NotSupportedError' ? t('screenAccess') : error.message, 'warning', t('screenShare')));
  else if (action === 'hangup' || action === 'dismiss') endCall(activeCall?.incoming ? 'declined' : undefined);
});
document.addEventListener('click', event => { if (event.target.closest('button, .avatar, .profile-trigger')) playSound('navigation'); });
async function uploadProfileImage(path, file) {
  if (!file) return;
  const form = new FormData(); form.append('file', file);
  const response = await fetch(API + path, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || t('imageUpload'));
  me = { ...me, ...data }; setLoggedIn(me); renderList();
}
function openProfileTask(task) {
  const titles = { details: t('taskDetails'), avatar: t('taskAvatar'), banner: t('taskBanner'), colour: t('taskColour') };
  $('#account-tasks').hidden = false; $('#profile-form').hidden = true; $('#profile-back').hidden = true;
  if (!task) return;
  if (task === 'avatar') return $('#edit-avatar-file').click();
  if (task === 'banner') return $('#edit-banner-file').click();
  $('#account-tasks').hidden = true; $('#profile-form').hidden = false; $('#profile-back').hidden = false;
  $('#profile-task-title').textContent = titles[task];
  $('#edit-status').parentElement.hidden = task === 'colour'; $('#edit-bio').parentElement.hidden = task === 'colour'; $('#edit-colour').parentElement.hidden = task !== 'colour';
  $('.editor-upload').hidden = task !== 'details';
}
$('#edit-profile').onclick = () => desktopControls?.openProfileSettings();
$('#theme-browser-profile').onclick = () => { $('#profile-dialog').close(); desktopControls?.openThemeBrowser(); };
$('#personalize').onclick = () => { $('#profile-dialog').close(); desktopControls?.openThemeSettings(); };
document.querySelectorAll('[data-profile-task]').forEach(button => button.onclick = () => openProfileTask(button.dataset.profileTask));
$('#profile-back').onclick = () => openProfileTask(); $('#profile-cancel').onclick = () => $('#profile-editor').close();
desktopControls?.onProfileChanged(user => { if (!user?.id || user.id !== me?.id) return; setLoggedIn(user); renderList(); });
$('#edit-avatar').onclick = () => $('#edit-avatar-file').click(); $('#edit-banner').onclick = () => $('#edit-banner-file').click();
$('#edit-avatar-file').onchange = async event => { try { await uploadProfileImage('/users/me/avatar', event.target.files[0]); } catch (error) { alert(error.message); } event.target.value = ''; };
$('#edit-banner-file').onchange = async event => { try { await uploadProfileImage('/users/me/banner', event.target.files[0]); } catch (error) { alert(error.message); } event.target.value = ''; };
$('#profile-form').onsubmit = async event => { event.preventDefault(); try { me = await api('/users/me/profile', { method: 'PUT', body: JSON.stringify({ status: $('#edit-status').value.trim(), bio: $('#edit-bio').value.trim(), profile_color: $('#edit-colour').value }) }); setLoggedIn(me); renderList(); $('#profile-editor').close(); } catch (error) { alert(error.message); } };
async function renderThemeList(selected) {
  if (!desktopControls) throw new Error(t('themeElectronOnly'));
  const themes = await desktopControls.listThemes();
  $('#theme-list').innerHTML = themes.map(theme => `<option value="${esc(theme.id)}">${esc(theme.name)}</option>`).join('');
  if (selected) $('#theme-list').value = selected;
}
function refreshWindowTheme(revision) { parent.postMessage({ type: 'xp-window-theme', revision }, '*'); }
const themeSettingsButton = $('#theme-settings'); if (themeSettingsButton) themeSettingsButton.onclick = () => desktopControls?.openThemeSettings();
$('#theme-apply').onclick = async () => { try { $('#theme-error').textContent = ''; const result = await desktopControls.applyTheme($('#theme-list').value); refreshWindowTheme(result.revision); $('#theme-dialog').close(); } catch (error) { $('#theme-error').textContent = ''; showSystemDialog(error.message, 'error', t('themeApply')); } };
$('#theme-import').onclick = async () => { try { $('#theme-error').textContent = t('importingTheme'); const result = await desktopControls.importTheme(); if (!result) { $('#theme-error').textContent = ''; return; } await renderThemeList(); refreshWindowTheme(result.revision); $('#theme-error').textContent = t('themeInstalled'); } catch (error) { $('#theme-error').textContent = ''; showSystemDialog(error.message, 'error', t('themeImport')); } };
fitXpLogonBackground();
window.addEventListener('resize', fitXpLogonBackground);
window.addEventListener('message', event => {
  if (event.data?.type === 'xp-display-settings') applyDisplaySettings(event.data.settings || {});
  if (event.data?.type === 'xp-theme-refresh') { const link = document.querySelector('#nekochat-style'); if (link) link.href = `assets/css/nekochat.css?theme=${event.data.revision}`; const theme = document.querySelector('#nekochat-theme'); if (theme && event.data.cssUrl) theme.href = event.data.cssUrl; }
});
desktopControls?.getActiveTheme().then(theme => {
  const link = document.querySelector('#nekochat-theme');
  if (link && theme?.cssUrl) link.href = theme.cssUrl;
});
desktopControls?.getDisplaySettings().then(applyDisplaySettings);
if (token) boot(); else showAuthScreen();
