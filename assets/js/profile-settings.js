// User Accounts, like Windows XP's (nusrmgr.cpl): a home page ("Pick a task…" and the account),
// the account page ("What do you want to change about your account?") and one page per task:
// status and bio, picture (Windows XP's account pictures or your own), banner, colour, logon.
const controls = window.windowControls;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
// Every account signed in on this client (nk_saved_sessions, written by nekochat.js): each has
// its server and token, so any of them can be changed here, like XP's "pick an account to change".
const currentServer = (localStorage.getItem('nk_server_url') || 'https://nekochat.komdu.is-cool.dev').replace(/\/$/, '');
const currentToken = localStorage.getItem('nk_token');
function savedSessions() { try { const list = JSON.parse(localStorage.getItem('nk_saved_sessions') || '[]'); return Array.isArray(list) ? list.filter(item => item?.server && item?.user) : []; } catch { return []; } }
const isCurrent = session => session && session.server.replace(/\/$/, '') === currentServer && session.token === currentToken;
let account = null; // the session being changed: { key, server, token, user }
const PICTURES = ['airplane', 'astronaut', 'beach', 'butterfly', 'car', 'cat', 'chess', 'dirt-bike', 'dog', 'drip', 'duck', 'fish', 'frog', 'guitar', 'horses', 'kick', 'lift-off', 'palm-tree', 'pink-flower', 'red-flower', 'skater', 'snowflake', 'soccer-ball'];
const words = {
  ru: {
    title: 'Учётные записи пользователей', back: 'Назад', home: 'Домой', close: 'Закрыть', minimize: 'Свернуть', maximize: 'Развернуть',
    pickTask: 'Выберите задание...', orPick: 'или выберите учётную запись для изменения', changeAccount: 'Изменить учётную запись', changeLogon: 'Изменить параметры входа в систему',
    learnAbout: 'См. также', relatedTasks: 'Связанные задачи', currentPicture: 'Текущий рисунок', helpAccounts: 'Учётные записи Nekochat', helpPictures: 'Использование своего рисунка', helpLogon: 'Параметры входа', changeTheme: 'Изменить тему компьютера',
    whatChange: 'Что вы хотите изменить в своей учётной записи?', whatChangeOther: 'Что вы хотите изменить в учётной записи «{name}»?', editStatus: 'Изменить статус и описание', changePicture: 'Изменить рисунок', changeBanner: 'Изменить баннер', changeColour: 'Изменить цвет профиля',
    accountNote: 'Эти сведения видят другие пользователи Nekochat в вашем профиле.', online: 'Учётная запись Nekochat',
    statusTitle: 'Измените статус и описание', status: 'Введите статус:', bio: 'Расскажите о себе:', apply: 'Изменить', cancel: 'Отмена',
    pictureTitle: 'Выберите новый рисунок для учётной записи', pictureNote: 'Выбранный рисунок увидят все в вашем профиле и в чатах.', browse: 'Обзор других рисунков', changePictureButton: 'Изменить рисунок',
    colourTitle: 'Выберите цвет профиля', colour: 'Цвет профиля:', bannerTitle: 'Выберите баннер профиля', bannerNote: 'Баннер показывается сверху вашего профиля.', bannerButton: 'Выбрать рисунок...',
    logonTitle: 'Выберите параметры входа и выхода', welcome: 'Использовать страницу приветствия', welcomeText: 'На странице приветствия достаточно щёлкнуть учётную запись. Если отключить её, будет классическое окно входа, в котором нужно ввести имя пользователя.', applyOptions: 'Применить параметры',
    saving: 'Сохранение...', error: 'Ошибка сервера', signedIn: 'Выполнен вход', signInFirst: 'Войдите в эту учётную запись на экране входа',
  },
  en: {
    title: 'User Accounts', back: 'Back', home: 'Home', close: 'Close', minimize: 'Minimize', maximize: 'Maximize',
    pickTask: 'Pick a task...', orPick: 'or pick an account to change', changeAccount: 'Change an account', changeLogon: 'Change the way users log on or off',
    learnAbout: 'Learn About', relatedTasks: 'Related Tasks', currentPicture: 'Current Picture', helpAccounts: 'Nekochat accounts', helpPictures: 'Using your own picture', helpLogon: 'Logon options', changeTheme: 'Change the computer theme',
    whatChange: 'What do you want to change about your account?', whatChangeOther: 'What do you want to change about {name}\'s account?', editStatus: 'Change my status and bio', changePicture: 'Change my picture', changeBanner: 'Change my banner', changeColour: 'Change my profile colour',
    accountNote: 'Other Nekochat users see these details in your profile.', online: 'Nekochat account',
    statusTitle: 'Change your status and bio', status: 'Type your status:', bio: 'Tell others about yourself:', apply: 'Change', cancel: 'Cancel',
    pictureTitle: 'Pick a new picture for your account', pictureNote: 'The picture you choose appears in your profile and in chats.', browse: 'Browse for more pictures', changePictureButton: 'Change Picture',
    colourTitle: 'Pick your profile colour', colour: 'Profile colour:', bannerTitle: 'Pick your profile banner', bannerNote: 'The banner is shown at the top of your profile.', bannerButton: 'Choose a picture...',
    logonTitle: 'Select logon and logoff options', welcome: 'Use the Welcome screen', welcomeText: 'By using the Welcome screen, you can simply click your account name to log on. Turn it off to use the classic logon prompt, which requires you to type a user name.', applyOptions: 'Apply Options',
    saving: 'Saving...', error: 'Server error', signedIn: 'Logged on', signInFirst: 'Log on to this account on the logon screen first',
  },
};
let language = 'ru';
const t = key => words[language][key];
let me = null, display = {};
const call = async (path, options = {}, session = account) => {
  const response = await fetch(session.server.replace(/\/$/, '') + path, { ...options, headers: { Authorization: `Bearer ${session.token}`, ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(typeof data.detail === 'string' ? data.detail : Array.isArray(data.detail) ? data.detail.map(item => item.msg).filter(Boolean).join('; ') : `${t('error')} (${response.status})`);
  return data;
};
const avatarOf = (user, server) => user?.avatar ? `${server.replace(/\/$/, '')}/avatars/${encodeURIComponent(user.avatar)}` : 'assets/images/nekochat_icon.png';
const avatarUrl = () => avatarOf(me, account?.server || currentServer);
const icon = name => `assets/images/control-panel/${name}.png`;
// A change is kept in the saved session too (the logon screen shows it); the chat window hears
// about changes of the account it is signed in with.
function changed(user) {
  me = user; account = { ...account, user };
  try { localStorage.setItem('nk_saved_sessions', JSON.stringify(JSON.parse(localStorage.getItem('nk_saved_sessions') || '[]').map(item => item?.key === account.key ? { ...item, user } : item))); } catch {}
  if (isCurrent(account)) controls.profileChanged?.(me);
  render();
}
function pickAccount(key) {
  const session = savedSessions().find(item => item.key === key); if (!session) return;
  if (!session.token) { alert(t('signInFirst')); return; }
  account = session; me = session.user; go('account');
  call('/api/me').then(user => { if (account?.key === session.key) changed(user); }).catch(() => {});
}

// Pages and Explorer-like history (Back, Forward, Home).
let page = 'home', selectedPicture = '';
const back = [], forward = [];
function go(next) { if (next === page) return; back.push(page); forward.length = 0; page = next; selectedPicture = ''; render(); }
function step(from, to) { if (!from.length) return; to.push(page); page = from.pop(); render(); }

function box(title, links, pictureBox) {
  return `<section class="cp-box"><h2><span>${esc(title)}</span></h2><div class="cp-box-body">${pictureBox || ''}`
    + links.map(([iconName, text, action]) => `<button class="cp-link" type="button" data-action="${action}">${iconName ? `<img src="${icon(iconName)}" alt="">` : ''}<span>${esc(text)}</span></button>`).join('') + '</div></section>';
}
function tile(session, clickable) {
  const user = session?.user; if (!user) return '';
  const host = (() => { try { return new URL(session.server).host; } catch { return session.server; } })();
  const note = !session.token ? t('signInFirst') : isCurrent(session) ? t('signedIn') : host;
  return `<button class="ua-tile" type="button"${clickable ? ` data-account="${esc(session.key)}"` : ' disabled'}><img src="${esc(avatarOf(user, session.server))}" alt=""><span><b>${esc(user.display_name || user.username)}</b><small>@${esc(user.username)}</small><small>${esc(note)}</small></span></button>`;
}
// Every saved account, the current one first; the current one also when nothing is saved yet.
function allAccounts() {
  const list = savedSessions();
  if (me && account && !list.some(item => item.key === account.key)) list.unshift(account);
  return list.sort((a, b) => Number(isCurrent(b)) - Number(isCurrent(a)));
}
const task = (text, target) => `<button class="cp-task" type="button" ${target.startsWith('action:') ? `data-action="${target.slice(7)}"` : `data-go="${target}"`}><img src="${icon('task-bullet')}" alt="">${esc(text)}</button>`;
const buttons = (okKey, okAction) => `<hr class="ua-rule"><div class="ua-buttons"><button type="button" class="ua-button" data-action="${okAction}">${esc(t(okKey))}</button><button type="button" class="ua-button" data-go="account">${esc(t('cancel'))}</button></div>`;
function render() {
  const content = $('#ua-content'), pane = $('#ua-pane');
  content.className = `cp-content accounts-content ${page === 'home' ? 'cp-view-page' : 'ua-white'}`;
  if (page === 'home') {
    content.innerHTML = `<div class="cp-page-header"><img src="${icon('users')}" alt=""><h1>${esc(t('title'))}</h1></div><div class="cp-page-body">`
      + `<h2 class="cp-section">${esc(t('pickTask'))}</h2><div class="cp-tasks">${task(t('changeAccount'), 'action:current')}${task(t('changeLogon'), 'logon')}</div>`
      + `<h2 class="cp-section">${esc(t('orPick'))}</h2><div class="ua-tiles">${allAccounts().map(session => tile(session, true)).join('')}</div></div>`;
    pane.innerHTML = box(t('learnAbout'), [['help-16', t('helpAccounts'), 'help'], ['help-16', t('helpLogon'), 'help']]);
  } else if (page === 'account') {
    content.innerHTML = `<div class="ua-page"><h1 class="ua-heading">${esc(isCurrent(account) || !me ? t('whatChange') : t('whatChangeOther').replace('{name}', me.display_name || me.username))}</h1><div class="ua-split"><div class="cp-tasks">${task(t('editStatus'), 'status')}${task(t('changePicture'), 'picture')}${task(t('changeBanner'), 'banner')}${task(t('changeColour'), 'colour')}</div>${tile({ ...account, user: me }, false)}</div><p class="ua-note">${esc(t('accountNote'))}</p></div>`;
    pane.innerHTML = box(t('relatedTasks'), [['', t('changeLogon'), 'go:logon'], ['', t('changeTheme'), 'theme']]) + box(t('learnAbout'), [['help-16', t('helpAccounts'), 'help']]);
  } else if (page === 'status') {
    content.innerHTML = `<div class="ua-page"><h1 class="ua-heading">${esc(t('statusTitle'))}</h1><label class="ua-field">${esc(t('status'))}<input id="ua-status" maxlength="80" value="${esc(me?.status || '')}"></label><label class="ua-field">${esc(t('bio'))}<textarea id="ua-bio" maxlength="500">${esc(me?.bio || '')}</textarea></label><p class="ua-error" id="ua-error"></p>${buttons('apply', 'save-status')}</div>`;
    pane.innerHTML = box(t('learnAbout'), [['help-16', t('helpAccounts'), 'help']]);
  } else if (page === 'picture') {
    content.innerHTML = `<div class="ua-page"><h1 class="ua-heading">${esc(t('pictureTitle'))}</h1><p>${esc(t('pictureNote'))}</p><div class="ua-pictures" id="ua-pictures">${PICTURES.map(name => `<button type="button" class="ua-picture${name === selectedPicture ? ' selected' : ''}" data-picture="${name}"><img src="assets/images/account-pictures/${name}.png" alt="${name}"></button>`).join('')}</div>`
      + `<button class="cp-link ua-browse" type="button" data-action="browse"><img src="${icon('tb-search')}" alt=""><span>${esc(t('browse'))}</span></button><p class="ua-error" id="ua-error"></p>${buttons('changePictureButton', 'save-picture')}</div>`;
    pane.innerHTML = box(t('currentPicture'), [], `<img class="ua-current" src="${esc(avatarUrl())}" alt="">`) + box(t('relatedTasks'), [['', t('changeTheme'), 'theme']]) + box(t('learnAbout'), [['help-16', t('helpPictures'), 'help']]);
    content.querySelector('[data-action="save-picture"]').disabled = !selectedPicture;
  } else if (page === 'banner') {
    content.innerHTML = `<div class="ua-page"><h1 class="ua-heading">${esc(t('bannerTitle'))}</h1><p>${esc(t('bannerNote'))}</p><div class="ua-banner"${me?.banner ? ` style="background-image:url('${esc(`${account.server.replace(/\/$/, "")}/avatars/${encodeURIComponent(me.banner)}`)}')"` : ''}></div><p class="ua-error" id="ua-error"></p>${buttons('bannerButton', 'browse-banner')}</div>`;
    pane.innerHTML = box(t('learnAbout'), [['help-16', t('helpPictures'), 'help']]);
  } else if (page === 'colour') {
    content.innerHTML = `<div class="ua-page"><h1 class="ua-heading">${esc(t('colourTitle'))}</h1><label class="ua-field ua-colour">${esc(t('colour'))}<input id="ua-colour" type="color" value="${esc(me?.profile_color || '#316ac5')}"></label><p class="ua-error" id="ua-error"></p>${buttons('apply', 'save-colour')}</div>`;
    pane.innerHTML = box(t('learnAbout'), [['help-16', t('helpAccounts'), 'help']]);
  } else if (page === 'logon') {
    content.innerHTML = `<div class="ua-page"><h1 class="ua-heading">${esc(t('logonTitle'))}</h1><label class="ua-option"><span class="xp-check"><input id="ua-welcome" type="checkbox"${display.loginUi !== 'classic' ? ' checked' : ''}></span><span><b>${esc(t('welcome'))}</b><br>${esc(t('welcomeText'))}</span></label>${buttons('applyOptions', 'save-logon')}</div>`;
    pane.innerHTML = box(t('relatedTasks'), [['', t('changeAccount'), 'go:account']]) + box(t('learnAbout'), [['help-16', t('helpLogon'), 'help']]);
  }
  // Cancel on the logon page goes home, like XP.
  if (page === 'logon') content.querySelector('.ua-buttons [data-go="account"]').dataset.go = 'home';
  $('#ua-back').disabled = !back.length; $('#ua-forward').disabled = !forward.length;
}
function fail(error) { const node = $('#ua-error'); if (node) node.textContent = error.message; else alert(error.message); }
async function upload(path, blob, name) { const form = new FormData(); form.append('file', blob, name); changed({ ...me, ...await call(path, { method: 'POST', body: form }) }); }
const ACTIONS = {
  current: () => { const session = savedSessions().find(isCurrent); if (session) pickAccount(session.key); else go('account'); },
  help: () => (controls.openHelp ? controls.openHelp('privacy') : window.open('https://github.com/xKaMikax/nekochat_reloaded', '_blank', 'noopener')),
  theme: () => (controls.openApplet ? controls.openApplet('display', 'themes') : controls.openThemeSettings?.()),
  browse: () => $('#avatar-file').click(),
  'browse-banner': () => $('#banner-file').click(),
  'save-status': async () => { try { changed(await call('/users/me/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: $('#ua-status').value.trim(), bio: $('#ua-bio').value.trim(), profile_color: me?.profile_color || '#316ac5' }) })); go('account'); } catch (error) { fail(error); } },
  'save-colour': async () => { try { changed(await call('/users/me/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: me?.status || '', bio: me?.bio || '', profile_color: $('#ua-colour').value }) })); go('account'); } catch (error) { fail(error); } },
  'save-picture': async () => { if (!selectedPicture) return; try { const blob = await (await fetch(`assets/images/account-pictures/${selectedPicture}.png`)).blob(); await upload('/users/me/avatar', blob, `${selectedPicture}.png`); go('account'); } catch (error) { fail(error); } },
  'save-logon': async () => { try { display = await controls.applyDisplaySettings({ ...display, loginUi: $('#ua-welcome').checked ? 'xp' : 'classic' }) || display; go('home'); } catch (error) { fail(error); } },
};
document.addEventListener('click', event => {
  const header = event.target.closest('.cp-box h2'); if (header) { header.parentElement.classList.toggle('collapsed'); return; }
  const pick = event.target.closest('[data-account]'); if (pick) { pickAccount(pick.dataset.account); return; }
  const picture = event.target.closest('[data-picture]'); if (picture) { selectedPicture = picture.dataset.picture; render(); return; }
  const target = event.target.closest('[data-go]')?.dataset.go; if (target) { go(target); return; }
  const action = event.target.closest('[data-action]')?.dataset.action; if (!action) return;
  if (action.startsWith('go:')) go(action.slice(3)); else ACTIONS[action]?.();
});
$('#avatar-file').onchange = async event => { const file = event.target.files[0]; event.target.value = ''; if (!file) return; try { await upload('/users/me/avatar', file, file.name); go('account'); } catch (error) { fail(error); } };
$('#banner-file').onchange = async event => { const file = event.target.files[0]; event.target.value = ''; if (!file) return; try { await upload('/users/me/banner', file, file.name); render(); } catch (error) { fail(error); } };
$('#ua-back').onclick = () => step(back, forward);
$('#ua-forward').onclick = () => step(forward, back);
$('#ua-home').onclick = () => go('home');

function applyText() {
  document.documentElement.lang = language; document.title = t('title'); $('.xp-title').textContent = t('title');
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
  $('#close').setAttribute('aria-label', t('close')); $('#minimize')?.setAttribute('aria-label', t('minimize')); $('#maximize')?.setAttribute('aria-label', t('maximize'));
  render();
}
const checkClassic = () => document.documentElement.classList.toggle('cp-classic-look', getComputedStyle(document.documentElement).getPropertyValue('--classic-raised').trim() !== '');
$('#frame-theme').addEventListener('load', checkClassic);
function applyFrame(theme) { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; requestAnimationFrame(checkClassic); }
controls.getActiveTheme().then(applyFrame); controls.onThemeChanged(applyFrame);
controls.onDisplayChanged(settings => { display = settings || display; language = display.language === 'en' ? 'en' : 'ru'; applyText(); });
controls.getDisplaySettings().then(settings => { display = settings || {}; language = display.language === 'en' ? 'en' : 'ru'; applyText(); });
// Start with the account the client is signed in with.
account = savedSessions().find(isCurrent) || { key: `${currentServer}|current`, server: currentServer, token: currentToken, user: null };
me = account.user;
call('/api/me').then(user => { account = { ...account, key: account.key.endsWith('|current') ? `${currentServer}|${user.id}` : account.key }; changed(user); }).catch(error => { if (!me) alert(error.message); });
applyText();

// Window buttons and resizing, and the XP click sound, like the other windows.
document.querySelector('.xp-window-controls').insertAdjacentHTML('afterbegin', '<button id="minimize" aria-label="Свернуть"></button><button id="maximize" aria-label="Развернуть"></button>');
$('#minimize').onclick = () => controls.minimize();
$('#maximize').onclick = () => controls.maximize();
$('#close').onclick = () => controls.close();
['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].forEach(direction => {
  const handle = document.createElement('i');
  Object.assign(handle.style, { position: 'fixed', zIndex: 99, display: 'block', ...(direction === 'n' || direction === 's' ? { left: '6px', right: '6px', height: '5px', [direction === 'n' ? 'top' : 'bottom']: '0' } : direction === 'e' || direction === 'w' ? { top: '6px', bottom: '6px', width: '5px', [direction === 'e' ? 'right' : 'left']: '0' } : { width: '10px', height: '10px', [direction.includes('n') ? 'top' : 'bottom']: '0', [direction.includes('w') ? 'left' : 'right']: '0' }) });
  handle.style.cursor = `${direction}-resize`;
  handle.onpointerdown = event => { let x = event.screenX, y = event.screenY; handle.setPointerCapture(event.pointerId); handle.onpointermove = move => { controls.resize(direction, move.screenX - x, move.screenY - y); x = move.screenX; y = move.screenY; }; handle.onpointerup = () => { handle.onpointermove = null; }; };
  document.body.append(handle);
});
window.nkClickSounds?.();
