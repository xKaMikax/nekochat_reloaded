// About box, like Windows XP's (ShellAbout): the banner with the orange stripe, the program,
// its version and copyright, who it is "licensed to" (the signed-in account) and the server.
// ?app=catalog or ?app=addon:<id> shows the About box of the Catalog or of an add-on.
const controls = window.windowControls;
const $ = selector => document.querySelector(selector);
// ?app=nekochat | catalog | addon:<id> (an add-on from the Catalog: its name, icon, author).
const app = new URLSearchParams(location.search || location.hash.slice(1)).get('app') || 'nekochat';
let addon = null;
const words = {
  ru: { title: 'О программе Nekochat Reloaded', titleOf: 'О программе «{name}»', catalog: 'Обновление Nekochat Reloaded', catalogCredits: 'Новые версии приложения, темы, пакеты и дополнения из коллекции Nekochat Reloaded Themes', addonBy: 'Автор: {author}', name: 'Nekochat Reloaded', version: 'Версия {version} ({platform})', copyright: '© 2026 KaMika', credits: 'При участии VASHYAN-CMD', creditsMines: 'Из Windows XP: Robert Donner и Curt Johnson', license: 'Это неофициальный клиент Nekochat в стиле Windows XP. Выполнен вход:', nobody: '(вход не выполнен)', server: 'Сервер Nekochat: {server}', edition: '{platform} Edition', close: 'Закрыть' },
  en: { title: 'About Nekochat Reloaded', titleOf: 'About {name}', catalog: 'Nekochat Reloaded Update', catalogCredits: 'New versions of the app, themes, packs and add-ons from the Nekochat Reloaded Themes collection', addonBy: 'By {author}', name: 'Nekochat Reloaded', version: 'Version {version} ({platform})', copyright: 'Copyright © 2026 KaMika', credits: 'With VASHYAN-CMD', creditsMines: 'From Windows XP, by Robert Donner and Curt Johnson', license: 'This is an unofficial Nekochat client in the style of Windows XP. Logged on as:', nobody: '(not logged on)', server: 'Nekochat server: {server}', edition: '{platform} Edition', close: 'Close' },
};
const PLATFORMS = { win32: 'Windows', linux: 'Linux', darwin: 'macOS', android: 'Android', ios: 'iPhone', web: 'Web' };
let language = 'ru', platform = 'Desktop';
const t = (key, values = {}) => String(words[language][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
function signedIn() {
  try {
    const server = localStorage.getItem('nk_server_url') || '', token = localStorage.getItem('nk_token') || '';
    const session = (JSON.parse(localStorage.getItem('nk_saved_sessions') || '[]') || []).find(item => item?.token && item.token === token && String(item.server).replace(/\/$/, '') === server.replace(/\/$/, ''));
    return { user: token ? session?.user : null, server: server || 'https://nekochat.komdu.is-cool.dev' };
  } catch { return { user: null, server: '' }; }
}
function render() {
  const { user, server } = signedIn();
  const addonName = addon ? (addon.name?.[language] || addon.name?.en || addon.id) : '';
  const name = app === 'catalog' ? t('catalog') : app.startsWith('addon:') ? addonName || app.slice(6) : t('name');
  document.documentElement.lang = language;
  document.title = app === 'nekochat' ? t('title') : t('titleOf', { name }); $('#about-title').textContent = document.title;
  const icon = app === 'catalog' ? 'assets/images/control-panel/catalog.png' : addon?.icon32 || 'assets/images/nekochat_icon.png';
  $('#about-icon').src = icon; $('#about-titleicon').style.backgroundImage = `url('${addon?.icon || icon}')`;
  $('#about-banner-copy').textContent = t('copyright');
  $('#about-edition').textContent = t('edition', { platform });
  $('#about-name').textContent = app === 'nekochat' ? t('name') : `${name} — Nekochat Reloaded`;
  $('#about-version').textContent = t('version', { version: addon?.version || window.NEKOCHAT_RELOADED_VERSION || '', platform });
  $('#about-copyright').textContent = addon?.about?.[language]?.copyright || addon?.about?.en?.copyright || t('copyright');
  $('#about-credits').textContent = app === 'catalog' ? t('catalogCredits') : addon ? (addon.about?.[language]?.credits || addon.about?.en?.credits || t('addonBy', { author: addon.author || 'KaMika' })) : t('credits');
  $('#about-license').textContent = t('license');
  $('#about-user').textContent = user ? `${user.display_name || user.username} (@${user.username})` : t('nobody');
  $('#about-server').textContent = t('server', { server });
  $('#close').setAttribute('aria-label', t('close'));
}
if (app.startsWith('addon:')) window.nkAddons?.().then(list => { addon = list.find(item => item.id === app.slice(6)) || null; render(); });
$('#about-ok').onclick = () => controls.close();
$('#close').onclick = () => controls.close();
document.addEventListener('keydown', event => { if (event.key === 'Escape' || event.key === 'Enter') controls.close(); });
controls.getActiveTheme().then(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; });
controls.onThemeChanged(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; });
Promise.resolve(controls.getUpdateInfo?.()).then(info => { platform = PLATFORMS[info?.platform] || (info?.mode === 'reload' ? 'Web' : 'Desktop'); render(); }).catch(() => {});
controls.getDisplaySettings().then(display => { language = display?.language === 'en' ? 'en' : 'ru'; render(); });
render();
