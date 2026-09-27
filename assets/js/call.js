const $ = selector => document.querySelector(selector);
const controls = window.windowControls;
const words = {
  ru: { window: 'Nekochat Reloaded — звонок', call: 'Звонок', connecting: 'Подключение…', you: 'Вы', user: 'Пользователь', connection: 'Подключение', screen: 'Демонстрация экрана', yourScreen: 'Ваш экран', remoteScreen: 'Экран собеседника', accept: 'Принять', decline: 'Отклонить', share: 'Демонстрация', stopShare: 'Остановить демо', mute: 'Заглушить', unmute: 'Включить звук', hangup: 'Завершить', close: 'Закрыть', connectionMenu: 'Соединение', transportWs: 'WebSocket', transportSse: 'SSE / HTTP2', watchScreen: 'Демонстрация', muteUser: 'Заглушить собеседника', unmuteUser: 'Включить звук собеседника', join: 'Войти', dismiss: 'Скрыть', leave: 'Выйти' },
  en: { window: 'Nekochat Reloaded — Call', call: 'Call', connecting: 'Connecting…', you: 'You', user: 'User', connection: 'Connecting', screen: 'Screen sharing', yourScreen: 'Your screen', remoteScreen: "Caller’s screen", accept: 'Accept', decline: 'Decline', share: 'Share screen', stopShare: 'Stop sharing', mute: 'Mute', unmute: 'Unmute', hangup: 'End call', close: 'Close', connectionMenu: 'Connection', transportWs: 'WebSocket', transportSse: 'SSE / HTTP2', watchScreen: 'Screen', muteUser: 'Mute participant', unmuteUser: 'Unmute participant', join: 'Join', dismiss: 'Dismiss', leave: 'Leave' }
};
let language = 'ru'; let currentState = {};
const t = key => words[language][key];
function applyText() { document.documentElement.lang = language; document.title = t('window'); $('.xp-title').textContent = t('window'); $('#close').setAttribute('aria-label', t('close')); $('#call-connection').setAttribute('aria-label', t('connection')); $('.screen-empty').textContent = t('screen'); $('#accept').textContent = t('accept'); $('#decline').textContent = t('decline'); $('#hangup').textContent = t('hangup'); $('#transport-menu-button').textContent = t('connectionMenu'); render(currentState); }
function render(state = {}) {
  currentState = state; $('#call-title').textContent = state.title || t('call'); $('#call-status').textContent = state.status || t('connecting');
  const selfAvatar = state.self?.avatar || state.selfAvatar || '☺'; const remoteAvatar = state.remote?.avatar || state.avatar || '☎';
  // A muted person gets a red frame crossed by a red line; clicking an avatar toggles it.
  ['#self-avatar', '#screen-self-avatar'].forEach(selector => { const node = $(selector); node.innerHTML = selfAvatar; node.classList.toggle('muted', Boolean(state.muted)); node.style.borderColor = state.muted ? '#d0141b' : state.self?.speaking ? '#62b77c' : state.self?.frame || '#5f93d2'; node.title = state.muted ? t('unmute') : t('mute'); }); ['#remote-avatar', '#screen-remote-avatar'].forEach(selector => { const node = $(selector); node.innerHTML = remoteAvatar; node.classList.toggle('muted', Boolean(state.remoteMuted)); node.style.borderColor = state.remoteMuted ? '#d0141b' : state.remote?.speaking ? '#62b77c' : state.remote?.frame || '#5f93d2'; node.title = state.remoteMuted ? t('unmuteUser') : t('muteUser'); });
  // With two screen shares, the button under a person switches the stage to that person's screen.
  document.querySelectorAll('[data-screen-side]').forEach(button => { const side = button.dataset.screenSide; button.hidden = !(side === 'self' ? state.selfSharing : state.remoteSharing); button.textContent = t('watchScreen'); button.classList.toggle('active', state.sharing === side); button.setAttribute('aria-pressed', String(state.sharing === side)); });
  ['#self-name', '#screen-self-name'].forEach(selector => { $(selector).textContent = state.self?.name || state.selfName || t('you'); }); ['#remote-name', '#screen-remote-name'].forEach(selector => { $(selector).textContent = state.remote?.name || state.personName || state.title?.replace(/^.*?:\s*/, '') || t('user'); });
  $('#accept').hidden = !state.incoming; $('#decline').hidden = !state.incoming; $('#hangup').hidden = Boolean(state.incoming); $('#mute').hidden = Boolean(state.incoming); $('#share').hidden = Boolean(state.incoming) || !(state.direct || state.room);
  // A room voice channel: join/dismiss an invite, leave instead of hanging up.
  $('#accept').textContent = state.room ? t('join') : t('accept'); $('#decline').textContent = state.room ? t('dismiss') : t('decline'); $('#hangup').textContent = state.room ? t('leave') : t('hangup');
  $('#mute').textContent = state.muted ? t('unmute') : t('mute'); $('#share').textContent = (state.selfSharing ?? state.sharing === 'self') ? t('stopShare') : t('share'); $('#call-connection').hidden = Boolean(state.connected);
  const screen = state.sharing === 'self' || state.sharing === 'remote'; $('#call-stage').classList.toggle('sharing', screen);
  renderRoom(state, screen); $('#screen-stage').hidden = !screen; $('#screen-preview').hidden = !state.screenPreview; $('#screen-preview').src = state.screenPreview || ''; $('#screen-preview').alt = state.sharing === 'self' ? t('yourScreen') : t('remoteScreen');
  const transport = state.transport === 'sse' ? 'sse' : 'ws'; document.querySelectorAll('[data-transport]').forEach(item => item.setAttribute('aria-checked', String(item.dataset.transport === transport))); $('#call-transport').textContent = transport === 'sse' ? t('transportSse') : t('transportWs');
  const note = $('#call-note'); if (note) note.hidden = state.audioAvailable !== false;
}
function action(name, extra = {}) { controls.callAction({ action: name, ...extra }); }
// Everyone in a room voice channel, you first. Clicking a person mutes them for you.
function renderRoom(state, screen) {
  const room = $('#call-room');
  const show = Boolean(state.room) && !screen;
  room.hidden = !show; $('.call-participants').hidden = Boolean(state.room) || screen;
  if (!show) return;
  const people = [{ id: 'self', avatar: state.self?.avatar || '☺', name: state.self?.name || t('you'), frame: state.self?.frame, speaking: state.self?.speaking, muted: state.muted }, ...(state.participants || [])];
  room.replaceChildren(...people.map(person => {
    const tile = document.createElement('article'); tile.className = 'call-person';
    const picture = document.createElement('span'); picture.className = 'call-avatar'; picture.innerHTML = person.avatar;
    picture.classList.toggle('muted', Boolean(person.muted));
    picture.style.borderColor = person.muted ? '#d0141b' : person.speaking ? '#62b77c' : person.frame || '#5f93d2';
    picture.title = person.id === 'self' ? (person.muted ? t('unmute') : t('mute')) : (person.muted ? t('unmuteUser') : t('muteUser'));
    picture.onclick = () => { if (!currentState.connected) return; if (person.id === 'self') action('mute'); else action('mute-remote', { id: person.id }); };
    const name = document.createElement('b'); name.textContent = person.name;
    tile.append(picture, name); return tile;
  }));
}
['#self-avatar', '#screen-self-avatar'].forEach(selector => { $(selector).onclick = () => { if (currentState.connected) action('mute'); }; });
['#remote-avatar', '#screen-remote-avatar'].forEach(selector => { $(selector).onclick = () => { if (currentState.connected) action('mute-remote'); }; });
document.querySelectorAll('[data-screen-side]').forEach(button => { button.onclick = () => action('screen-view', { side: button.dataset.screenSide }); });
$('#accept').onclick = () => action('accept'); $('#decline').onclick = () => action('decline'); $('#mute').onclick = () => action('mute'); $('#share').onclick = () => action('share'); $('#hangup').onclick = () => action('hangup'); $('#close').onclick = () => { action('dismiss'); controls.close(); };
function setTransportMenu(open) { $('#transport-menu').hidden = !open; $('#transport-menu-button').setAttribute('aria-expanded', String(open)); if (open) $('#transport-menu [aria-checked="true"]')?.focus(); }
$('#transport-menu-button').onclick = () => setTransportMenu($('#transport-menu').hidden);
$('#transport-menu').onclick = event => { const item = event.target.closest('[data-transport]'); if (!item) return; setTransportMenu(false); controls.callAction({ action: 'transport', transport: item.dataset.transport }); };
document.addEventListener('click', event => { if (!event.target.closest('.call-menu')) setTransportMenu(false); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') setTransportMenu(false); });
controls.onCallUpdate(render); controls.onDisplayChanged(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); }); controls.getDisplaySettings().then(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); }); controls.getActiveTheme().then(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; }); controls.onThemeChanged(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; });
// XP click sound on buttons, like in the chat window.
document.addEventListener('click', event => { if (!event.target.closest?.('button')) return; const audio = new Audio('assets/sounds/navigation.wav'); audio.volume = .72; audio.play().catch(() => {}); });
