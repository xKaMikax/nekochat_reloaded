// About box, like Windows XP's (ShellAbout): the banner with the orange stripe, the program,
// its version and copyright, who it is "licensed to" (the signed-in account) and the server.
// ?app=minesweeper shows the game's About box.
const controls = window.windowControls;
const $ = selector => document.querySelector(selector);
const app = new URLSearchParams(location.search).get('app') === 'minesweeper' ? 'minesweeper' : 'nekochat';
const words = {
  ru: { title: 'О программе Nekochat Reloaded', titleMines: 'О программе «Сапёр»', name: 'Nekochat Reloaded', nameMines: 'Сапёр', version: 'Версия {version} ({platform})', copyright: '© 2026 KaMika', credits: 'При участии VASHYAN-CMD', creditsMines: 'Из Windows XP: Robert Donner и Curt Johnson', license: 'Это неофициальный клиент Nekochat в стиле Windows XP. Выполнен вход:', nobody: '(вход не выполнен)', server: 'Сервер Nekochat: {server}', edition: '{platform} Edition', close: 'Закрыть' },
  en: { title: 'About Nekochat Reloaded', titleMines: 'About Minesweeper', name: 'Nekochat Reloaded', nameMines: 'Minesweeper', version: 'Version {version} ({platform})', copyright: 'Copyright © 2026 KaMika', credits: 'With VASHYAN-CMD', creditsMines: 'From Windows XP, by Robert Donner and Curt Johnson', license: 'This is an unofficial Nekochat client in the style of Windows XP. Logged on as:', nobody: '(not logged on)', server: 'Nekochat server: {server}', edition: '{platform} Edition', close: 'Close' },
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
  const mines = app === 'minesweeper'; const { user, server } = signedIn();
  document.documentElement.lang = language;
  document.title = t(mines ? 'titleMines' : 'title'); $('#about-title').textContent = document.title;
  const icon = mines ? 'assets/games/minesweeper/icon-32.png' : 'assets/images/nekochat_icon.png';
  $('#about-icon').src = icon; $('#about-titleicon').style.backgroundImage = `url('${mines ? 'assets/games/minesweeper/icon.png' : icon}')`;
  $('#about-banner-copy').textContent = t('copyright');
  $('#about-edition').textContent = t('edition', { platform });
  $('#about-name').textContent = t(mines ? 'nameMines' : 'name');
  $('#about-version').textContent = t('version', { version: window.NEKOCHAT_RELOADED_VERSION || '', platform });
  $('#about-copyright').textContent = t('copyright');
  $('#about-credits').textContent = t(mines ? 'creditsMines' : 'credits');
  $('#about-license').textContent = t('license');
  $('#about-user').textContent = user ? `${user.display_name || user.username} (@${user.username})` : t('nobody');
  $('#about-server').textContent = t('server', { server });
  $('#close').setAttribute('aria-label', t('close'));
}
$('#about-ok').onclick = () => controls.close();
$('#close').onclick = () => controls.close();
document.addEventListener('keydown', event => { if (event.key === 'Escape' || event.key === 'Enter') controls.close(); });
controls.getActiveTheme().then(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; });
controls.onThemeChanged(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; });
Promise.resolve(controls.getUpdateInfo?.()).then(info => { platform = PLATFORMS[info?.platform] || (info?.mode === 'reload' ? 'Web' : 'Desktop'); render(); }).catch(() => {});
controls.getDisplaySettings().then(display => { language = display?.language === 'en' ? 'en' : 'ru'; render(); });
render();
