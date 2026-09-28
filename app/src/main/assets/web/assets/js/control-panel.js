// Control Panel, like Windows XP's: a category view (pick a category, then a task) and a classic
// view with every icon. Each item opens a tab of Display Properties or another window.
const controls = window.windowControls;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const words = {
  ru: {
    title: 'Панель управления', back: 'Назад', address: 'Адрес', pickCategory: 'Выберите категорию', pickTask: 'Выберите задание...', orIcon: 'или выберите значок панели управления',
    toClassic: 'Переключение к классическому виду', toCategory: 'Переключение к виду по категориям', seeAlso: 'См. также', update: 'Проверить обновления', help: 'Справка и поддержка', close: 'Закрыть',
    categories: {
      appearance: 'Оформление и темы', network: 'Сеть и подключения к серверу', programs: 'Установка и удаление тем и пакетов', sounds: 'Звук и аудиоустройства',
      performance: 'Производительность и обслуживание', users: 'Учётные записи пользователей', regional: 'Язык и региональные стандарты',
    },
    tasks: {
      theme: 'Изменить тему', colours: 'Изменить цветовую схему', wallpaper: 'Изменить фон чата', cursors: 'Изменить курсоры и значки', server: 'Выбрать сервер Nekochat Reloaded',
      catalogInstall: 'Установить темы, курсоры, звуки и обои из каталога', catalogRemove: 'Удалить установленные темы и пакеты', soundScheme: 'Изменить звуковую схему', microphone: 'Настроить микрофон',
      backup: 'Сделать резервную копию настроек', updates: 'Проверить обновления', profile: 'Изменить профиль', language: 'Изменить язык интерфейса',
    },
    icons: {
      display: 'Экран', mouse: 'Мышь', catalog: 'Каталог', editor: 'Редактор тем', sounds: 'Звуки и аудиоустройства', network: 'Сетевые подключения', backups: 'Архивация',
      updates: 'Автоматическое обновление', users: 'Учётные записи пользователей', admin: 'Администрирование', regional: 'Язык и региональные стандарты',
    },
  },
  en: {
    title: 'Control Panel', back: 'Back', address: 'Address', pickCategory: 'Pick a category', pickTask: 'Pick a task...', orIcon: 'or pick a Control Panel icon',
    toClassic: 'Switch to Classic View', toCategory: 'Switch to Category View', seeAlso: 'See Also', update: 'Check for updates', help: 'Help and Support', close: 'Close',
    categories: {
      appearance: 'Appearance and Themes', network: 'Network and Server Connections', programs: 'Add or Remove Themes and Packs', sounds: 'Sounds and Audio Devices',
      performance: 'Performance and Maintenance', users: 'User Accounts', regional: 'Language and Regional Options',
    },
    tasks: {
      theme: 'Change the theme', colours: 'Change the colour scheme', wallpaper: 'Change the chat background', cursors: 'Change cursors and icons', server: 'Choose the Nekochat Reloaded server',
      catalogInstall: 'Install themes, cursors, sounds and wallpapers from the catalog', catalogRemove: 'Remove installed themes and packs', soundScheme: 'Change the sound scheme', microphone: 'Set up the microphone',
      backup: 'Back up your settings', updates: 'Check for updates', profile: 'Change your profile', language: 'Change the display language',
    },
    icons: {
      display: 'Display', mouse: 'Mouse', catalog: 'Catalog', editor: 'Theme Editor', sounds: 'Sounds and Audio Devices', network: 'Network Connections', backups: 'Backup',
      updates: 'Automatic Updates', users: 'User Accounts', admin: 'Administrative Tools', regional: 'Regional and Language Options',
    },
  },
};
let language = 'ru';
const t = key => words[language][key];
const stored = key => { try { return localStorage.getItem(key); } catch { return null; } };

// What each task and icon does. Icons missing on this platform (the theme editor needs the
// desktop app; the admin panel is off unless turned on in Display Properties) are left out.
const ACTIONS = {
  themes: () => controls.openThemeSettings('themes'), appearance: () => controls.openThemeSettings('appearance'), display: () => controls.openThemeSettings('display'),
  sounds: () => controls.openThemeSettings('sounds'), settings: () => controls.openThemeSettings('settings'), backups: () => controls.openThemeSettings('backups'),
  catalog: () => controls.openThemeBrowser(), editor: () => controls.openThemeEditor(), profile: () => controls.openProfileSettings(),
  admin: () => controls.openAdminPanel(stored('nk_server_url') || 'https://nekochat.komdu.is-cool.dev'),
  update: () => { try { localStorage.setItem('nk_update_check', String(Date.now())); } catch {} controls.openThemeSettings('settings'); },
  help: () => window.open('https://github.com/xKaMikax/nekochat_reloaded', '_blank', 'noopener'),
};
const ICONS = [
  { id: 'display', icon: 'display', action: 'themes' },
  { id: 'mouse', icon: 'mouse', action: 'display' },
  { id: 'catalog', icon: 'catalog', action: 'catalog' },
  { id: 'editor', icon: 'theme-editor', action: 'editor', available: () => Boolean(controls.openThemeEditor) },
  { id: 'sounds', icon: 'sounds', action: 'sounds' },
  { id: 'network', icon: 'network-connections', action: 'settings' },
  { id: 'backups', icon: 'backups', action: 'backups' },
  { id: 'updates', icon: 'updates', action: 'update' },
  { id: 'users', icon: 'users', action: 'profile' },
  { id: 'admin', icon: 'admin', action: 'admin', available: () => Boolean(controls.openAdminPanel) && stored('nk_show_admin_button') === '1' },
  { id: 'regional', icon: 'regional', action: 'display' },
];
const CATEGORIES = [
  { id: 'appearance', icon: 'appearance', tasks: [['theme', 'themes'], ['colours', 'appearance'], ['wallpaper', 'display'], ['cursors', 'display']], icons: ['display', 'mouse', 'catalog', 'editor'] },
  { id: 'network', icon: 'network', tasks: [['server', 'settings']], icons: ['network'] },
  { id: 'programs', icon: 'programs', tasks: [['catalogInstall', 'catalog'], ['catalogRemove', 'catalog']], icons: ['catalog'] },
  { id: 'users', icon: 'users', tasks: [['profile', 'profile']], icons: ['users', 'admin'] },
  { id: 'sounds', icon: 'sounds', tasks: [['soundScheme', 'sounds'], ['microphone', 'settings']], icons: ['sounds'] },
  { id: 'regional', icon: 'regional', tasks: [['language', 'display']], icons: ['regional'] },
  { id: 'performance', icon: 'performance', tasks: [['backup', 'backups'], ['updates', 'update']], icons: ['backups', 'updates'] },
];
const iconUrl = name => `assets/images/control-panel/${name}.png`;
const available = id => { const item = ICONS.find(icon => icon.id === id); return item && (!item.available || item.available()); };

// view: 'category' | 'classic'; page: a category id on the category view.
let view = stored('nk_control_panel_view') === 'classic' ? 'classic' : 'category';
let page = null;
function iconButton(item) {
  return `<button class="cp-icon" type="button" data-action="${item.action}"><img src="${iconUrl(item.icon)}" alt=""><span>${esc(t('icons')[item.id])}</span></button>`;
}
function render() {
  const content = $('#cp-content');
  content.className = `cp-content cp-view-${page ? 'page' : view}`;
  const category = page && CATEGORIES.find(item => item.id === page);
  if (view === 'classic') {
    const icons = ICONS.filter(item => available(item.id)).sort((a, b) => t('icons')[a.id].localeCompare(t('icons')[b.id], language));
    content.innerHTML = `<div class="cp-icons">${icons.map(iconButton).join('')}</div>`;
  } else if (category) {
    const icons = category.icons.filter(available).map(id => ICONS.find(item => item.id === id));
    content.innerHTML = `<div class="cp-page-header"><img src="${iconUrl(`${category.icon}-48`)}" alt=""><h1>${esc(t('categories')[category.id])}</h1></div>`
      + `<h2 class="cp-section">${esc(t('pickTask'))}</h2><div class="cp-tasks">${category.tasks.map(([task, action]) => `<button class="cp-task" type="button" data-action="${action}"><span class="cp-task-arrow"></span>${esc(t('tasks')[task])}</button>`).join('')}</div>`
      + (icons.length ? `<h2 class="cp-section">${esc(t('orIcon'))}</h2><div class="cp-icons cp-icons-row">${icons.map(iconButton).join('')}</div>` : '');
  } else {
    content.innerHTML = `<h1 class="cp-pick">${esc(t('pickCategory'))}</h1><div class="cp-categories">${CATEGORIES.map(item => `<button class="cp-category" type="button" data-category="${item.id}"><img src="${iconUrl(`${item.icon}-48`)}" alt=""><span>${esc(t('categories')[item.id])}</span></button>`).join('')}</div>`;
  }
  $('#cp-address').textContent = category ? `${t('title')} › ${t('categories')[category.id]}` : t('title');
  $('#cp-back').disabled = !category;
  $('#cp-switch span').textContent = view === 'classic' ? t('toCategory') : t('toClassic');
}
function applyText() {
  document.documentElement.lang = language; document.title = t('title'); $('.xp-title').textContent = t('title');
  $('#close').setAttribute('aria-label', t('close')); $('#cp-back-text').textContent = t('back'); $('#cp-address-label').textContent = t('address');
  $('#cp-pane-title').textContent = t('title'); $('#cp-see-also').textContent = t('seeAlso');
  $('#cp-update span').textContent = t('update'); $('#cp-help span').textContent = t('help');
  render();
}
// Classic keeps the grey Windows look: the theme defines --classic-raised.
function applyFrame(theme) {
  if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl;
  requestAnimationFrame(() => document.documentElement.classList.toggle('cp-classic-look', getComputedStyle(document.documentElement).getPropertyValue('--classic-raised').trim() !== ''));
}

$('#cp-content').addEventListener('click', event => {
  const category = event.target.closest('[data-category]');
  if (category) { page = category.dataset.category; render(); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action) ACTIONS[action]?.();
});
// A click on a box's header folds it, like Explorer's task pane.
document.querySelectorAll('.cp-box h2').forEach(header => header.onclick = () => header.parentElement.classList.toggle('collapsed'));
$('#cp-back').onclick = () => { page = null; render(); };
$('#cp-switch').onclick = () => { view = view === 'classic' ? 'category' : 'classic'; page = null; try { localStorage.setItem('nk_control_panel_view', view); } catch {} render(); };
$('#cp-update').onclick = () => ACTIONS.update();
$('#cp-help').onclick = () => ACTIONS.help();
$('#close').onclick = () => controls.close();
window.addEventListener('storage', event => { if (event.key === 'nk_show_admin_button') render(); });
controls.onThemeChanged(applyFrame);
controls.onDisplayChanged(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); });
Promise.all([controls.getActiveTheme(), controls.getDisplaySettings()]).then(([theme, display]) => { language = display?.language === 'en' ? 'en' : 'ru'; applyFrame(theme); applyText(); });
applyText();
