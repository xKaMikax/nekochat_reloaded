// Control Panel, like Windows XP's: a category view (pick a category, then a task) and a classic
// view with every icon, with Explorer's menu, toolbar, address bar and task pane. Each item opens
// its applet (a Display Properties window with only that applet's pages) or another window.
const controls = window.windowControls;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const words = {
  ru: {
    title: 'Панель управления', back: 'Назад', search: 'Поиск', folders: 'Папки', address: 'Адрес', go: 'Переход', pickCategory: 'Выберите категорию', pickTask: 'Выберите задание...', orIcon: 'или выберите значок панели управления',
    toClassic: 'Переключение к классическому виду', toCategory: 'Переключение к виду по категориям', seeAlso: 'См. также', troubleshooters: 'Устранение неполадок', update: 'Windows Update', help: 'Справка и поддержка', close: 'Закрыть',
    menus: { file: 'Файл', edit: 'Правка', view: 'Вид', favorites: 'Избранное', tools: 'Сервис', help: 'Справка' },
    menuItems: { close: 'Закрыть', category: 'Вид по категориям', classic: 'Классический вид', refresh: 'Обновить', about: 'О программе Nekochat Reloaded', catalog: 'Каталог...', helpTopics: 'Справка и поддержка' },
    categories: {
      appearance: 'Оформление и темы', network: 'Сеть и подключения к серверу', programs: 'Установка и удаление тем и пакетов', sounds: 'Звук и аудиоустройства',
      performance: 'Производительность и обслуживание', users: 'Учётные записи пользователей', regional: 'Язык и региональные стандарты',
    },
    tasks: {
      theme: 'Изменить тему', colours: 'Изменить цветовую схему', wallpaper: 'Изменить фон чата', cursors: 'Изменить указатели мыши', server: 'Выбрать сервер Nekochat Reloaded',
      catalogInstall: 'Установить темы, курсоры, звуки и обои из каталога', catalogRemove: 'Удалить установленные темы и пакеты', soundScheme: 'Изменить звуковую схему', microphone: 'Настроить микрофон',
      backup: 'Сделать резервную копию настроек', updates: 'Проверить обновления', profile: 'Изменить профиль', privacy: 'Настроить конфиденциальность', language: 'Изменить язык интерфейса', assistant: 'Выбрать помощника',
    },
    icons: {
      display: 'Экран', mouse: 'Мышь', catalog: 'Каталог', editor: 'Редактор тем', sounds: 'Звуки и аудиоустройства', network: 'Сетевые подключения', backups: 'Архивация',
      updates: 'Автоматическое обновление', users: 'Учётные записи пользователей', admin: 'Администрирование', regional: 'Язык и региональные стандарты', assistant: 'Помощник',
    },
    troubles: { display: 'Экран', sound: 'Звук', network: 'Сеть', updates: 'Обновления' },
  },
  en: {
    title: 'Control Panel', back: 'Back', search: 'Search', folders: 'Folders', address: 'Address', go: 'Go', pickCategory: 'Pick a category', pickTask: 'Pick a task...', orIcon: 'or pick a Control Panel icon',
    toClassic: 'Switch to Classic View', toCategory: 'Switch to Category View', seeAlso: 'See Also', troubleshooters: 'Troubleshooters', update: 'Windows Update', help: 'Help and Support', close: 'Close',
    menus: { file: 'File', edit: 'Edit', view: 'View', favorites: 'Favorites', tools: 'Tools', help: 'Help' },
    menuItems: { close: 'Close', category: 'Category View', classic: 'Classic View', refresh: 'Refresh', about: 'About Nekochat Reloaded', catalog: 'Catalog...', helpTopics: 'Help and Support' },
    categories: {
      appearance: 'Appearance and Themes', network: 'Network and Server Connections', programs: 'Add or Remove Themes and Packs', sounds: 'Sounds and Audio Devices',
      performance: 'Performance and Maintenance', users: 'User Accounts', regional: 'Language and Regional Options',
    },
    tasks: {
      theme: 'Change the theme', colours: 'Change the colour scheme', wallpaper: 'Change the chat background', cursors: 'Change the mouse pointers', server: 'Choose the Nekochat Reloaded server',
      catalogInstall: 'Install themes, cursors, sounds and wallpapers from the catalog', catalogRemove: 'Remove installed themes and packs', soundScheme: 'Change the sound scheme', microphone: 'Set up the microphone',
      backup: 'Back up your settings', updates: 'Check for updates', profile: 'Change your profile', privacy: 'Change privacy options', language: 'Change the display language', assistant: 'Choose an assistant',
    },
    icons: {
      display: 'Display', mouse: 'Mouse', catalog: 'Catalog', editor: 'Theme Editor', sounds: 'Sounds and Audio Devices', network: 'Network Connections', backups: 'Backup',
      updates: 'Automatic Updates', users: 'User Accounts', admin: 'Administrative Tools', regional: 'Regional and Language Options', assistant: 'Assistant',
    },
    troubles: { display: 'Display', sound: 'Sound', network: 'Networking', updates: 'Updates' },
  },
};
let language = 'ru';
const t = key => words[language][key];
const stored = key => { try { return localStorage.getItem(key); } catch { return null; } };

// Each applet opens in its own window with only its pages, like Windows XP's .cpl files.
const applet = (name, tab) => (window.nkPlaySound?.('navigation'), controls.openApplet ? controls.openApplet(name, tab) : controls.openThemeSettings());
const ACTIONS = {
  themes: () => applet('display', 'themes'), appearance: () => applet('display', 'appearance'), desktop: () => applet('display', 'desktop'),
  sounds: () => applet('sounds', 'sounds'), audio: () => applet('sounds', 'audio'), mouse: () => applet('mouse'), regional: () => applet('regional'),
  network: () => applet('network'), assistant: () => applet('assistant'), backups: () => applet('backups'), updates: () => applet('updates'), privacy: () => applet('privacy'),
  catalog: () => controls.openThemeBrowser(), editor: () => controls.openThemeEditor(), profile: () => controls.openProfileSettings(),
  admin: () => controls.openAdminPanel(stored('nk_server_url') || 'https://nekochat.komdu.is-cool.dev'),
  update: () => { try { localStorage.setItem('nk_update_check', String(Date.now())); } catch {} applet('updates'); },
  help: () => (controls.openHelp ? controls.openHelp('control') : window.open('https://github.com/xKaMikax/nekochat_reloaded', '_blank', 'noopener')),
  close: () => controls.close(),
  about: () => (controls.openAbout ? controls.openAbout('nekochat') : ACTIONS.help()),
};
// Icons missing on this platform (the theme editor needs the desktop app; the admin panel is off
// unless turned on in Display Properties) are left out.
const ICONS = [
  { id: 'display', icon: 'display', action: 'themes' },
  { id: 'mouse', icon: 'mouse', action: 'mouse' },
  { id: 'catalog', icon: 'catalog', action: 'catalog' },
  { id: 'editor', icon: 'theme-editor', action: 'editor', available: () => Boolean(controls.openThemeEditor) && Boolean(window.nkAddonInstalled?.('theme-editor')) },
  { id: 'sounds', icon: 'sounds', action: 'sounds' },
  { id: 'network', icon: 'network-connections', action: 'network' },
  { id: 'backups', icon: 'backups', action: 'backups' },
  { id: 'updates', icon: 'updates', action: 'updates' },
  { id: 'users', icon: 'users', action: 'profile' },
  { id: 'admin', icon: 'admin', action: 'admin', available: () => Boolean(controls.openAdminPanel) && stored('nk_show_admin_button') === '1' && Boolean(window.nkAddonInstalled?.('admin')) },
  { id: 'regional', icon: 'regional', action: 'regional' },
  { id: 'assistant', icon: 'assistant', action: 'assistant' },
];
// A category page's task pane: See Also ([icon, icon name, action]) and Troubleshooters (help topics).
const CATEGORIES = [
  { id: 'appearance', icon: 'appearance', tasks: [['theme', 'themes'], ['colours', 'appearance'], ['wallpaper', 'desktop'], ['cursors', 'mouse'], ['assistant', 'assistant']], icons: ['display', 'mouse', 'assistant', 'catalog', 'editor'], seeAlso: [['mouse', 'mouse', 'mouse'], ['catalog', 'catalog', 'catalog']], troubles: ['display', 'sound'] },
  { id: 'network', icon: 'network', tasks: [['server', 'network']], icons: ['network'], seeAlso: [['users', 'users', 'profile']], troubles: ['network'] },
  { id: 'programs', icon: 'programs', tasks: [['catalogInstall', 'catalog'], ['catalogRemove', 'catalog']], icons: ['catalog'], seeAlso: [['updates', 'updates', 'update']], troubles: [] },
  { id: 'users', icon: 'users', tasks: [['profile', 'profile'], ['privacy', 'privacy']], icons: ['users', 'admin'], seeAlso: [['network-connections', 'network', 'network']], troubles: [] },
  { id: 'sounds', icon: 'sounds', tasks: [['soundScheme', 'sounds'], ['microphone', 'audio']], icons: ['sounds'], seeAlso: [['display', 'display', 'themes']], troubles: ['sound'] },
  { id: 'regional', icon: 'regional', tasks: [['language', 'regional']], icons: ['regional'], seeAlso: [], troubles: [] },
  { id: 'performance', icon: 'performance', tasks: [['backup', 'backups'], ['updates', 'update']], icons: ['backups', 'updates'], seeAlso: [['catalog', 'catalog', 'catalog']], troubles: ['updates'] },
];
const iconUrl = name => `assets/images/control-panel/${name}.png`;
const available = id => { const item = ICONS.find(icon => icon.id === id); return item && (!item.available || item.available()); };

// Where the window is: the view ('category' | 'classic') and, on the category view, a category.
// Back and Forward walk this history, like Explorer's.
let view = stored('nk_control_panel_view') === 'classic' ? 'classic' : 'category';
let page = null;
const back = [], forward = [];
function go(next) {
  window.nkPlaySound?.('navigation');
  back.push({ view, page }); forward.length = 0;
  ({ view, page } = next);
  try { localStorage.setItem('nk_control_panel_view', view); } catch {}
  render();
}
function step(from, to) { if (!from.length) return; window.nkPlaySound?.('navigation'); to.push({ view, page }); ({ view, page } = from.pop()); render(); }

function iconButton(item) {
  return `<button class="cp-icon" type="button" data-action="${item.action}"><img src="${iconUrl(item.icon)}" alt=""><span>${esc(t('icons')[item.id])}</span></button>`;
}
function box(title, links, main) {
  return `<section class="cp-box${main ? ' cp-box-main' : ''}"><h2>${main ? `<img src="${iconUrl('control-panel')}" alt="">` : ''}<span>${esc(title)}</span><i class="cp-chevron"></i></h2><div class="cp-box-body">`
    + links.map(([icon, text, action]) => `<button class="cp-link" type="button" data-action="${action}"><img src="${iconUrl(icon)}" alt=""><span>${esc(text)}</span></button>`).join('') + '</div></section>';
}
function renderPane(category) {
  const pane = $('#cp-taskpane');
  if (category) {
    const seeAlso = category.seeAlso.filter(([, id]) => available(id)).map(([icon, id, action]) => [icon, t('icons')[id], action]);
    seeAlso.push(['help-16', t('help'), 'help']);
    pane.innerHTML = box(t('seeAlso'), seeAlso) + (category.troubles.length ? box(t('troubleshooters'), category.troubles.map(topic => ['help-16', t('troubles')[topic], 'help'])) : '');
  } else {
    pane.innerHTML = box(t('title'), [['control-panel-16', view === 'classic' ? t('toCategory') : t('toClassic'), 'switch']], true)
      + box(t('seeAlso'), [['updates-16', t('update'), 'update'], ['help-16', t('help'), 'help']]);
  }
}
function render() {
  const content = $('#cp-content');
  const category = view === 'category' && page && CATEGORIES.find(item => item.id === page);
  content.className = `cp-content cp-view-${category ? 'page' : view}`;
  if (view === 'classic') {
    const icons = ICONS.filter(item => available(item.id)).sort((a, b) => t('icons')[a.id].localeCompare(t('icons')[b.id], language));
    content.innerHTML = `<div class="cp-icons">${icons.map(iconButton).join('')}</div>`;
  } else if (category) {
    const icons = category.icons.filter(available).map(id => ICONS.find(item => item.id === id));
    content.innerHTML = `<div class="cp-page-header"><img src="${iconUrl(category.icon)}" alt=""><h1>${esc(t('categories')[category.id])}</h1></div><div class="cp-page-body">`
      + `<h2 class="cp-section">${esc(t('pickTask'))}</h2><div class="cp-tasks">${category.tasks.map(([task, action]) => `<button class="cp-task" type="button" data-action="${action}"><img src="${iconUrl('task-bullet')}" alt="">${esc(t('tasks')[task])}</button>`).join('')}</div>`
      + (icons.length ? `<h2 class="cp-section">${esc(t('orIcon'))}</h2><div class="cp-icons cp-icons-row">${icons.map(iconButton).join('')}</div>` : '') + '</div>';
  } else {
    content.innerHTML = `<h1 class="cp-pick">${esc(t('pickCategory'))}</h1><div class="cp-categories">${CATEGORIES.map(item => `<button class="cp-category" type="button" data-category="${item.id}"><img src="${iconUrl(`${item.icon}-48`)}" alt=""><span>${esc(t('categories')[item.id])}</span></button>`).join('')}</div>`;
  }
  renderPane(category);
  const title = category ? t('categories')[category.id] : t('title');
  $('#cp-address').textContent = title; document.title = title; $('.xp-title').textContent = title;
  $('#cp-address-icon').src = category ? iconUrl(category.icon) : iconUrl('control-panel-16');
  $('#cp-back').disabled = !back.length; $('#cp-forward').disabled = !forward.length; $('#cp-up').disabled = !category;
}
function applyText() {
  document.documentElement.lang = language;
  $('#close').setAttribute('aria-label', t('close')); $('#cp-back-text').textContent = t('back'); $('#cp-search-text').textContent = t('search'); $('#cp-folders-text').textContent = t('folders');
  $('#cp-address-label').textContent = t('address'); $('#cp-go-text').textContent = t('go');
  document.querySelectorAll('[data-menu]').forEach(button => { button.textContent = t('menus')[button.dataset.menu]; });
  render();
}
// Classic keeps the grey Windows look: the theme defines --classic-raised.
const checkClassic = () => document.documentElement.classList.toggle('cp-classic-look', getComputedStyle(document.documentElement).getPropertyValue('--classic-raised').trim() !== '');
$('#frame-theme').addEventListener('load', checkClassic);
function applyFrame(theme) {
  if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl;
  requestAnimationFrame(checkClassic);
}

// Menus: File, View, Tools and Help do what Explorer's would here; Edit and Favorites are empty.
const MENUS = {
  file: [['close', 'close']],
  view: [['category', 'view-category'], ['classic', 'view-classic'], null, ['refresh', 'refresh']],
  tools: [['catalog', 'catalog']],
  help: [['helpTopics', 'help'], null, ['about', 'about']],
};
function closeMenu() { document.querySelector('.cp-menu-popup')?.remove(); document.querySelectorAll('[data-menu].open').forEach(button => button.classList.remove('open')); }
$('#cp-menu').addEventListener('click', event => {
  const button = event.target.closest('[data-menu]'); if (!button) return;
  event.stopPropagation();
  const wasOpen = button.classList.contains('open'); closeMenu(); if (wasOpen) return;
  const items = MENUS[button.dataset.menu] || [];
  const popup = document.createElement('div'); popup.className = 'cp-menu-popup';
  popup.innerHTML = items.length ? items.map(item => item ? `<button type="button" data-command="${item[1]}"${item[1] === `view-${view}` ? ' class="checked"' : ''}>${esc(t('menuItems')[item[0]])}</button>` : '<hr>').join('') : '<button type="button" disabled>(—)</button>';
  const rect = button.getBoundingClientRect(); popup.style.left = `${rect.left}px`; popup.style.top = `${rect.bottom}px`;
  document.body.append(popup); button.classList.add('open');
});
document.addEventListener('click', event => {
  const command = event.target.closest('.cp-menu-popup [data-command]')?.dataset.command;
  closeMenu();
  if (command === 'view-category' || command === 'view-classic') { const next = command.slice(5); if (next !== view) go({ view: next, page: null }); return; }
  if (command === 'refresh') { render(); return; }
  if (command) { ACTIONS[command]?.(); return; }
  const category = event.target.closest('.cp-content [data-category]');
  if (category) { go({ view, page: category.dataset.category }); return; }
  // A click on a box's header folds it, like Explorer's task pane.
  const header = event.target.closest('.cp-box h2');
  if (header) { header.parentElement.classList.toggle('collapsed'); return; }
  const action = event.target.closest('.cp-content [data-action], .cp-taskpane [data-action]')?.dataset.action;
  if (action === 'switch') go({ view: view === 'classic' ? 'category' : 'classic', page: null });
  else if (action) ACTIONS[action]?.();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMenu();
  if (event.altKey && event.key === 'ArrowLeft') step(back, forward);
  if (event.altKey && event.key === 'ArrowRight') step(forward, back);
});
$('#cp-back').onclick = () => step(back, forward);
$('#cp-forward').onclick = () => step(forward, back);
$('#cp-up').onclick = () => go({ view, page: null });
$('#cp-views').onclick = () => go({ view: view === 'classic' ? 'category' : 'classic', page: null });
$('#cp-go').onclick = () => render();
$('#close').onclick = () => controls.close();
window.addEventListener('storage', event => { if (event.key === 'nk_show_admin_button') render(); });
controls.onThemeChanged(applyFrame);
controls.onDisplayChanged(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); });
Promise.all([controls.getActiveTheme(), controls.getDisplaySettings()]).then(([theme, display]) => { language = display?.language === 'en' ? 'en' : 'ru'; applyFrame(theme); applyText(); });
applyText();
// The Theme Editor and the Admin Panel are add-ons from the Catalog: their icons come and go with them.
window.addEventListener('nk-addons-ready', () => render());
window.nkAddons?.().catch(() => {});
