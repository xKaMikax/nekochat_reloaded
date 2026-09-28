// Server admin panel: statistics, users (ban, edit, password reset, delete), rooms and
// messages. Requests go through the main process (windowControls.adminRequest), which keeps
// the admin session cookie of this server.
const $ = selector => document.querySelector(selector);
const controls = window.windowControls;
const server = new URLSearchParams(location.search).get('server') || '';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
const words = {
  ru: { title: 'Администрирование Nekochat', loginTitle: 'Вход в админ-панель', loginHint: 'Хеш печатается в консоль сервера при запуске и меняется при каждом перезапуске.', hash: 'Хеш', signIn: 'Войти', stats: 'Статистика', users: 'Пользователи', rooms: 'Комнаты', messages: 'Сообщения', refresh: 'Обновить', logout: 'Выйти', search: 'Имя или логин…', find: 'Найти', roomMessages: 'Сообщения в комнатах', directMessages: 'Личные сообщения', displayName: 'Отображаемое имя', status: 'Статус', bio: 'О себе', colour: 'Цвет профиля', save: 'Сохранить', cancel: 'Отмена', close: 'Закрыть', minimize: 'Свернуть', maximize: 'Развернуть',
    wrongHash: 'Неверный хеш.', sessionLost: 'Сессия админки закончилась (сервер перезапускали?). Войдите снова.', loading: 'Загрузка…', done: 'Готово.', user: 'Пользователь', login: 'Логин', state: 'Состояние', activity: 'Активность', actions: 'Действия', online: 'в сети', banned: 'заблокирован', ban: 'Бан', unban: 'Разбан', edit: 'Изменить', resetPassword: 'Сброс пароля', remove: 'Удалить', name: 'Название', membersCount: 'Участники', messagesCount: 'Сообщения', created: 'Создана', author: 'Автор', text: 'Текст', time: 'Время', where: 'Где', room: 'Комната', conversation: 'Диалог',
    statUsers: 'Пользователи', statOnline: 'В сети', statBanned: 'Заблокированы', statRooms: 'Комнаты', statRoomMessages: 'Сообщения в комнатах', statDirect: 'Личные сообщения', statSockets: 'Подключения',
    confirmDeleteUser: 'Удалить пользователя {name} со всеми его сообщениями? Это нельзя отменить.', confirmDeleteRoom: 'Удалить комнату {name} со всеми сообщениями?', confirmDeleteMessage: 'Удалить это сообщение?', confirmReset: 'Сбросить пароль пользователю {name}?', tempPassword: 'Временный пароль для {name}: {password}', editTitle: 'Изменить: {name}', activityText: 'комнат: {rooms}, в комнатах: {room}, в ЛС: {direct}' },
  en: { title: 'Nekochat Administration', loginTitle: 'Admin panel sign-in', loginHint: 'The server prints the hash to its console at start; it changes on every restart.', hash: 'Hash', signIn: 'Sign in', stats: 'Statistics', users: 'Users', rooms: 'Rooms', messages: 'Messages', refresh: 'Refresh', logout: 'Sign out', search: 'Name or user name…', find: 'Find', roomMessages: 'Room messages', directMessages: 'Direct messages', displayName: 'Display name', status: 'Status', bio: 'About', colour: 'Profile colour', save: 'Save', cancel: 'Cancel', close: 'Close', minimize: 'Minimize', maximize: 'Maximize',
    wrongHash: 'Wrong hash.', sessionLost: 'The admin session ended (was the server restarted?). Sign in again.', loading: 'Loading…', done: 'Done.', user: 'User', login: 'User name', state: 'State', activity: 'Activity', actions: 'Actions', online: 'online', banned: 'banned', ban: 'Ban', unban: 'Unban', edit: 'Edit', resetPassword: 'Reset password', remove: 'Delete', name: 'Name', membersCount: 'Members', messagesCount: 'Messages', created: 'Created', author: 'Author', text: 'Text', time: 'Time', where: 'Where', room: 'Room', conversation: 'Conversation',
    statUsers: 'Users', statOnline: 'Online', statBanned: 'Banned', statRooms: 'Rooms', statRoomMessages: 'Room messages', statDirect: 'Direct messages', statSockets: 'Connections',
    confirmDeleteUser: 'Delete user {name} with all their messages? This cannot be undone.', confirmDeleteRoom: 'Delete room {name} with all messages?', confirmDeleteMessage: 'Delete this message?', confirmReset: 'Reset the password of {name}?', tempPassword: 'Temporary password for {name}: {password}', editTitle: 'Edit: {name}', activityText: 'rooms: {rooms}, room messages: {room}, DMs: {direct}' },
};
let language = 'ru';
const t = (key, values = {}) => String(words[language][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
const time = value => value ? new Date(value).toLocaleString(language === 'en' ? 'en-GB' : 'ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '';
function applyText() {
  document.documentElement.lang = language; document.title = t('title'); $('#admin-title').textContent = t('title');
  document.querySelectorAll('[data-t]').forEach(node => { node.textContent = t(node.dataset.t); });
  document.querySelectorAll('[data-tp]').forEach(node => { node.placeholder = t(node.dataset.tp); });
  $('#close').setAttribute('aria-label', t('close')); $('#minimize').setAttribute('aria-label', t('minimize')); $('#maximize').setAttribute('aria-label', t('maximize'));
}

async function request(method, path, body) {
  const result = await controls.adminRequest({ server, method, path, body });
  if (result.status === 401 && path !== '/login') { showLogin(t('sessionLost')); throw new Error(t('sessionLost')); }
  if (!result.ok) throw new Error(typeof result.data?.detail === 'string' ? result.data.detail : `HTTP ${result.status}`);
  return result.data;
}
const status = text => { $('#admin-status').textContent = text || ''; };
function showLogin(error = '') { $('#admin-login').hidden = false; $('#admin-panel').hidden = true; $('#admin-login-error').textContent = error; $('#admin-hash').focus(); }
function showPanel() { $('#admin-login').hidden = true; $('#admin-panel').hidden = false; openPage('stats'); }

// ---- pages ------------------------------------------------------------------------------------
let page = 'stats';
function openPage(name) {
  page = name;
  document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.page === name));
  document.querySelectorAll('.admin-page').forEach(node => { node.hidden = node.id !== `page-${name}`; });
  load().catch(error => status(error.message));
}
async function load() {
  status(t('loading'));
  if (page === 'stats') {
    const data = await request('GET', '/stats');
    const items = [['statUsers', data.users], ['statOnline', data.online], ['statBanned', data.banned], ['statRooms', data.rooms], ['statRoomMessages', data.room_messages], ['statDirect', data.direct_messages], ['statSockets', data.ws_connections]];
    $('#admin-stats').innerHTML = items.map(([key, value]) => `<div class="admin-stat"><b>${esc(value ?? 0)}</b>${esc(t(key))}</div>`).join('');
  } else if (page === 'users') {
    const query = $('#admin-user-search').value.trim();
    const users = await request('GET', `/users${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    $('#admin-users').innerHTML = `<tr><th>ID</th><th>${esc(t('user'))}</th><th>${esc(t('login'))}</th><th>${esc(t('state'))}</th><th>${esc(t('activity'))}</th><th>${esc(t('actions'))}</th></tr>` + users.map(user => `<tr data-id="${user.id}"><td>${user.id}</td><td>${esc(user.display_name)}</td><td>@${esc(user.username)}</td><td>${user.is_banned ? `<span class="badge-banned">${esc(t('banned'))}</span>` : user.is_online ? `<span class="badge-online">● ${esc(t('online'))}</span>` : ''}</td><td>${esc(t('activityText', { rooms: user.stats?.rooms ?? 0, room: user.stats?.room_messages ?? 0, direct: user.stats?.direct_messages ?? 0 }))}</td><td><div class="row-actions"><button type="button" data-action="${user.is_banned ? 'unban' : 'ban'}">${esc(t(user.is_banned ? 'unban' : 'ban'))}</button><button type="button" data-action="edit">${esc(t('edit'))}</button><button type="button" data-action="reset">${esc(t('resetPassword'))}</button><button type="button" data-action="delete">${esc(t('remove'))}</button></div></td></tr>`).join('');
    usersById = new Map(users.map(user => [user.id, user]));
  } else if (page === 'rooms') {
    const rooms = await request('GET', '/rooms');
    $('#admin-rooms').innerHTML = `<tr><th>ID</th><th>${esc(t('name'))}</th><th>${esc(t('membersCount'))}</th><th>${esc(t('messagesCount'))}</th><th>${esc(t('created'))}</th><th>${esc(t('actions'))}</th></tr>` + rooms.map(room => `<tr data-id="${room.id}" data-name="${esc(room.name)}"><td>${room.id}</td><td>${esc(room.name)}</td><td>${room.member_count}</td><td>${room.message_count}</td><td>${esc(time(room.created_at))}</td><td><div class="row-actions"><button type="button" data-action="delete-room">${esc(t('remove'))}</button></div></td></tr>`).join('');
  } else if (page === 'messages') {
    const kind = $('#admin-message-kind').value;
    const messages = await request('GET', `/${kind}?limit=200`);
    $('#admin-messages').innerHTML = `<tr><th>${esc(t('time'))}</th><th>${esc(t('author'))}</th><th>${esc(t('where'))}</th><th>${esc(t('text'))}</th><th></th></tr>` + messages.map(message => `<tr data-id="${message.id}"><td>${esc(time(message.created_at))}</td><td>${esc(message.user?.display_name || message.user?.username || message.user_id || message.sender_id)}</td><td>${kind === 'messages' ? `${esc(t('room'))} #${message.room_id}` : `${esc(t('conversation'))} ${message.conversation_id}`}</td><td class="content">${esc(message.content)}</td><td><div class="row-actions"><button type="button" data-action="delete-message">${esc(t('remove'))}</button></div></td></tr>`).join('');
  }
  status('');
}
let usersById = new Map();

// ---- actions ----------------------------------------------------------------------------------
async function act(event) {
  const button = event.target.closest('button[data-action]'); if (!button) return;
  const row = button.closest('tr'); const id = Number(row.dataset.id);
  const user = usersById.get(id); const name = user ? `${user.display_name} (@${user.username})` : row.dataset.name || String(id);
  try {
    switch (button.dataset.action) {
      case 'ban': await request('POST', `/users/${id}/ban`); break;
      case 'unban': await request('POST', `/users/${id}/unban`); break;
      case 'reset': if (!confirm(t('confirmReset', { name }))) return; { const data = await request('POST', `/users/${id}/reset-password`); alert(t('tempPassword', { name, password: data.temp_password })); } break;
      case 'delete': if (!confirm(t('confirmDeleteUser', { name }))) return; await request('DELETE', `/users/${id}`); break;
      case 'edit': editUser(user); return;
      case 'delete-room': if (!confirm(t('confirmDeleteRoom', { name }))) return; await request('DELETE', `/rooms/${id}`); break;
      case 'delete-message': if (!confirm(t('confirmDeleteMessage'))) return; await request('DELETE', `/${$('#admin-message-kind').value}/${id}`); break;
      default: return;
    }
    status(t('done')); await load();
  } catch (error) { status(error.message); }
}
function editUser(user) {
  if (!user) return;
  $('#admin-edit-title').textContent = t('editTitle', { name: `${user.display_name} (@${user.username})` });
  $('#edit-display-name').value = user.display_name || ''; $('#edit-status').value = user.status || ''; $('#edit-bio').value = user.bio || ''; $('#edit-colour').value = user.profile_color || '';
  $('#admin-edit').onclose = async () => {
    if ($('#admin-edit').returnValue !== 'save') return;
    try { await request('POST', `/users/${user.id}/edit`, { display_name: $('#edit-display-name').value, status: $('#edit-status').value, bio: $('#edit-bio').value, profile_color: $('#edit-colour').value.trim() }); status(t('done')); await load(); }
    catch (error) { status(error.message); }
  };
  $('#admin-edit').showModal();
}

$('#admin-server').textContent = server;
$('#admin-login').onsubmit = async event => {
  event.preventDefault();
  const result = await controls.adminRequest({ server, method: 'POST', path: '/login', body: { hash: $('#admin-hash').value.trim() } }).catch(error => ({ ok: false, data: { detail: error.message } }));
  if (result.ok) { $('#admin-hash').value = ''; showPanel(); } else showLogin(result.status === 401 ? t('wrongHash') : (result.data?.detail || `HTTP ${result.status}`));
};
document.querySelectorAll('.admin-tab').forEach(tab => { tab.onclick = () => openPage(tab.dataset.page); });
$('#admin-refresh').onclick = () => load().catch(error => status(error.message));
$('#admin-logout').onclick = async () => { await controls.adminRequest({ server, method: 'POST', path: '/logout' }).catch(() => {}); showLogin(); };
$('#admin-user-find').onclick = () => load().catch(error => status(error.message));
$('#admin-user-search').onkeydown = event => { if (event.key === 'Enter') load().catch(error => status(error.message)); };
$('#admin-message-kind').onchange = () => load().catch(error => status(error.message));
document.querySelectorAll('.admin-table').forEach(table => table.addEventListener('click', act));
$('#close').onclick = () => controls.close(); $('#minimize').onclick = () => controls.minimize(); $('#maximize').onclick = () => controls.maximize();
controls.getActiveTheme().then(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; }); controls.onThemeChanged(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; });
controls.getDisplaySettings().then(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); }); controls.onDisplayChanged(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); });
// Already signed in to this server during this app session?
controls.adminRequest({ server, method: 'GET', path: '/auth' }).then(result => { if (result.data?.ok) showPanel(); else showLogin(); }).catch(() => showLogin());
// XP click sound on buttons, like in the chat window.
document.addEventListener('click', event => { if (!event.target.closest?.('button')) return; let scheme = 'xp', volume = 72; try { scheme = localStorage.getItem('nk_sound_scheme') || 'xp'; volume = Number(localStorage.getItem('nk_sound_volume') ?? 72); } catch {} if (scheme === 'none' || !(volume > 0)) return; const audio = new Audio(window.nkSoundUrl ? window.nkSoundUrl('navigation') : 'assets/sounds/navigation.wav'); audio.volume = Math.min(1, volume / 100); audio.play().catch(() => {}); });
