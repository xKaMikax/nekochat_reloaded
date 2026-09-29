// The Catalog, in the style of Windows Update / Microsoft Update: a banner, a plain side panel
// (Home, Install Items, Select by Type, Options), a Welcome page (Express / Custom), "Customize your
// results" lists with check boxes, "Review and Install Items", XP's "Installing Update" window and
// "Review Your Installation Results". What was installed stays under "Update History" (apply a theme,
// open an add-on, remove).
const controls = window.windowControls;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const words = {
  ru: { title:'Обновление Nekochat Reloaded', tag:'Новые версии, темы, игры, звуки и многое другое для вашего Nekochat Reloaded', loadingInstalled:'Загрузка установленного…', loadingCatalog:'Загрузка каталога…', noThemes:'Установленных тем пока нет.', noCatalog:'В каталоге пока нет доступных элементов.', apply:'Применить', using:'Используется', applying:'Применение…', remove:'Удалить', removing:'Удаление…', removed:'Удалено', builtIn:'Встроена', byAuthor:'Автор: ', schemes:'Схемы: ', contains:'Внутри: ', open:'Открыть', close:'Закрыть', types:{ '':'Все', client:'Обновления клиента', theme:'Темы', cursors:'Курсоры', sounds:'Звуки', icons:'Значки', wallpapers:'Обои для чата', assistants:'Помощники', addons:'Дополнения', combo:'Комбо' }, parts:{ theme:'тема', cursors:'курсоры', sounds:'звуки', icons:'значки', wallpapers:'обои', assistant:'помощник', assistants:'помощник', addon:'дополнение', addons:'дополнение' }, help:'Справка', helpTopics:'Вызов справки', about:'О программе «Обновление»',
    home:'Главная', installItems:'Установить ({n})', byType:'Выбор по типу', byAuthor2:'Выбор по автору', options:'Параметры', history:'История установки', sortBy:'Сортировка:', sortDate:'По дате добавления', sortName:'По имени', sortAuthor:'По автору', allTypes:'Все элементы',
    welcome:'Добро пожаловать', welcomeTo:'в Обновление Nekochat Reloaded', keepUp:'Пополните свой Nekochat Reloaded', homeIntro:'Посмотрите, что нового: обновления приложения, темы, курсоры, звуки, значки, обои для чата, помощники и дополнения (игры, Редактор тем).', express:'Экспресс', expressText:'Показать самое новое (рекомендуется)', custom:'Выборочно', customText:'Выбрать из тем, курсоров, звуков, значков, обоев, помощников и дополнений', privacy:'Вопросы о конфиденциальности?', privacyText:'При просмотре каталога приложение только загружает список с GitHub. Сведения о вашем компьютере не отправляются.',
    boxInstalled:'Установлено: {n}', boxInstalledText:'На этом компьютере установлено элементов каталога: {n}.', boxHistory:'Открыть историю установки.', clientAvailable:'Доступно обновление приложения: {name}', installNow:'Установить сейчас', news:'Новинки',
    customize:'Настройте результаты', selectTitle:'Выберите: {type}', selectIntro:'Отметьте то, что хотите установить, и выберите «Просмотреть и установить».', reviewLink:'Просмотреть и установить', total:'Всего: {n}', clearAll:'Снять все', selectAll:'Выбрать все', installedMark:'установлено', added:'Добавлено:', version:'Версия:', type:'Тип:', noDescription:'Описание пока не добавлено.',
    reviewTitle:'Просмотр и установка', installBtn:'Установить', noneSelected:'Ничего не отмечено. Вернитесь к списку и отметьте нужное.', reviewNote:'Проверьте список и нажмите «Установить».',
    yourResults:'Ваши результаты', resultsTitle:'Итоги установки', restartTitle:'Перезапустите, чтобы завершить установку', restartText:'Приложение не будет обновлено, пока вы его не перезапустите. Сохраните открытые черновики и перезапустите сейчас.', restartNow:'Перезапустить сейчас', moreAvailable:'Доступны ещё элементы', moreAvailableText:'Загляните в каталог и установите то, что вам нужно.', summary:'Сводка установки', successful:'Успешно:', failed:'Ошибки:', remaining:'Осталось:', successfulItems:'Успешно установлено', failedItems:'Не удалось установить', historyTitle:'История установки', historyHeading:'Просмотр истории установки', colName:'Название', colType:'Тип', colStatus:'Состояние', historyIntro:'Установленные на этом компьютере темы и элементы каталога. Luna и Classic встроены в клиент.',
  },
  en: { title:'Nekochat Reloaded Update', tag:'Get new versions, themes, games, sounds and more for your Nekochat Reloaded', loadingInstalled:'Loading what is installed…', loadingCatalog:'Loading catalog…', noThemes:'No installed themes yet.', noCatalog:'There is nothing in the catalog yet.', apply:'Apply', using:'In use', applying:'Applying…', remove:'Remove', removing:'Removing…', removed:'Removed', builtIn:'Built-in', byAuthor:'By ', schemes:'Schemes: ', contains:'Contains: ', open:'Open', close:'Close', types:{ '':'All', client:'Client updates', theme:'Themes', cursors:'Cursors', sounds:'Sounds', icons:'Icons', wallpapers:'Chat wallpapers', assistants:'Assistants', addons:'Add-ons', combo:'Combos' }, parts:{ theme:'theme', cursors:'cursors', sounds:'sounds', icons:'icons', wallpapers:'wallpapers', assistant:'assistant', assistants:'assistant', addon:'add-on', addons:'add-on' }, help:'Help', helpTopics:'Help Topics', about:'About Update',
    home:'Update Home', installItems:'Install Items ({n})', byType:'Select by Type', byAuthor2:'Select by Author', options:'Options', history:'Review your update history', sortBy:'Sort by:', sortDate:'Date added', sortName:'Name', sortAuthor:'Author', allTypes:'All items',
    welcome:'Welcome', welcomeTo:'to Nekochat Reloaded Update', keepUp:'Keep your Nekochat Reloaded up to date', homeIntro:'Check what is new: app updates, themes, cursors, sounds, icons, chat wallpapers, assistants and add-ons (games, the Theme Editor).', express:'Express', expressText:'Get the newest items (recommended)', custom:'Custom', customText:'Select from themes, cursors, sounds, icons, wallpapers, assistants and add-ons', privacy:'Concerned about privacy?', privacyText:'When you browse the catalog, the app only downloads the list from GitHub. Nothing about your computer is sent.',
    boxInstalled:'Installed items: {n}', boxInstalledText:'Catalog items installed on this computer: {n}.', boxHistory:'View your update history.', clientAvailable:'An update for the app is available: {name}', installNow:'Install now', news:'News',
    customize:'Customize your results', selectTitle:'Select {type}', selectIntro:'Check what you want to install, then choose Review and install items.', reviewLink:'Review and install items', total:'Total: {n} items', clearAll:'Clear All', selectAll:'Select All', installedMark:'installed', added:'Added:', version:'Version:', type:'Type:', noDescription:'No description has been added yet.',
    reviewTitle:'Review and Install Items', installBtn:'Install Items', noneSelected:'Nothing is selected. Go back to the list and check what you need.', reviewNote:'Check the list and choose Install Items.',
    yourResults:'Your results', resultsTitle:'Review Your Installation Results', restartTitle:'Restart now to finish installing updates', restartText:'Nekochat Reloaded will not be up to date until you restart it. Please save any unsent messages and restart now.', restartNow:'Restart now', moreAvailable:'More items are available', moreAvailableText:'Look through the catalog and install what you need.', summary:'Installation Summary', successful:'Successful:', failed:'Failed:', remaining:'Remaining:', successfulItems:'Successful Items', failedItems:'Failed Items', historyTitle:'Update History', historyHeading:'Review Your Update History', colName:'Name', colType:'Type', colStatus:'Status', historyIntro:'Themes and catalog items installed on this computer. Luna and Classic are built into the client.',
  },
};
let language = 'ru'; let activeTheme;
const t = key => words[language][key];
const fill = (text, values = {}) => String(text).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
const TYPES = ['client', 'theme', 'cursors', 'sounds', 'icons', 'wallpapers', 'assistants', 'addons', 'combo'];
const state = { page: 'home', type: '', author: '', sort: 'date', items: [], installedThemes: [], installedPacks: [], selected: new Set(), expanded: new Set(), results: null, loaded: false };
const descriptions = new Map();
function applyFrame(theme) { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; }
// Add-ons made for the desktop app ("Platforms": ["desktop"]) are hidden on phones and the web.
let platform = 'desktop';
Promise.resolve(controls.getUpdateInfo?.()).then(info => { platform = ['android', 'ios'].includes(info?.platform) ? info.platform : info?.mode === 'reload' ? 'web' : 'desktop'; }).catch(() => {});
const fitsPlatform = item => !Array.isArray(item.platforms) || !item.platforms.length || item.platforms.includes(platform);
// Tells the other windows that add-ons changed, so their buttons appear or go away.
function packsChanged() { try { localStorage.setItem('nk_packs_changed', String(Date.now())); } catch {} window.nkAddons?.(true); }
const plainDescription = value => String(value || '').replace(/^#+\s*/gm, '').replace(/[*`_]/g, '').trim();
const itemName = item => String(item.displayName || item.name || item.id);
const itemAuthor = item => (item.author && item.author !== 'Unknown' ? item.author : '');
const isInstalled = item => item.kind === 'pack' ? state.installedPacks.some(pack => pack.catalogId === item.id) : state.installedThemes.some(theme => theme.catalogId === item.id);
const available = () => state.items.filter(item => !isInstalled(item));

// ---- data ------------------------------------------------------------------------------------
async function loadCatalog() {
  const [themes, installedThemes, catalogPacks, installedPacks] = await Promise.all([controls.listCatalogThemes(), controls.listThemes(), controls.listCatalogPacks ? controls.listCatalogPacks().catch(() => []) : [], controls.listPacks ? controls.listPacks().catch(() => []) : []]);
  // Newest first by the catalog's "Added" date; entries without one keep their order (appended = newer).
  state.items = [...themes.filter(theme => !['luna', 'classic'].includes(String(theme.id).toLowerCase())).map(theme => ({ ...theme, kind: 'theme', type: 'theme' })), ...catalogPacks.map(pack => ({ ...pack, kind: 'pack' }))].map((item, position) => ({ ...item, position })).filter(fitsPlatform);
  state.installedThemes = installedThemes; state.installedPacks = installedPacks; state.loaded = true;
  const client = await findClientUpdate(); if (client) state.items.unshift(client);
  for (const id of [...state.selected]) if (!state.items.some(item => item.id === id) || isInstalled(state.items.find(item => item.id === id))) state.selected.delete(id);
}
// ---- client updates: a newer release on GitHub is the first item of the list --------------------
function versionParts(text) {
  const match = String(text || '').match(/(\d+(?:\.\d+)*)(?:[-.]?beta[-.]?(\d+))?/i); if (!match) return null;
  return { numbers: match[1].split('.').map(Number), beta: match[2] === undefined ? null : Number(match[2]) };
}
function compareVersions(a, b) {
  for (let i = 0; i < Math.max(a.numbers.length, b.numbers.length); i += 1) { const diff = (a.numbers[i] || 0) - (b.numbers[i] || 0); if (diff) return diff; }
  if (a.beta === b.beta) return 0; if (a.beta === null) return 1; if (b.beta === null) return -1; return a.beta - b.beta;
}
async function findClientUpdate() {
  try {
    const info = await controls.getUpdateInfo?.(); const mode = info?.mode || 'download';
    if (mode === 'reload' || !controls.openInstallWindow) return null;
    const current = versionParts(window.NEKOCHAT_RELOADED_VERSION); if (!current) return null;
    const releases = await (await fetch('https://api.github.com/repos/xKaMikax/nekochat_reloaded/releases?per_page=20', { headers: { Accept: 'application/vnd.github+json' } })).json();
    let beta = false; try { beta = localStorage.getItem('nk_update_beta') === '1'; } catch {}
    let found = null;
    for (const release of Array.isArray(releases) ? releases : []) {
      if (release.draft || (release.prerelease && !beta)) continue;
      const parts = versionParts(release.tag_name); if (!parts || compareVersions(parts, current) <= 0) continue;
      if (!found || compareVersions(parts, versionParts(found.tag_name)) > 0) found = release;
    }
    if (!found) return null;
    const version = found.tag_name.replace(/^build_v/i, '');
    const notes = String(found.body || '').replace(/^\s*#[^\n]*\n+/, '');
    descriptions.set('client-update', plainDescription(notes).slice(0, 900));
    return { id: 'client-update', kind: 'client', type: 'client', displayName: `Nekochat Reloaded ${version}${found.prerelease ? ' (preview)' : ''}`, author: 'Nekochat Reloaded Team', version, added: String(found.published_at || '').slice(0, 10), previewUrl: '', position: -1, sortFirst: true,
      release: { tag: found.tag_name, version, page: found.html_url, assets: (found.assets || []).map(asset => ({ name: asset.name, url: asset.browser_download_url, size: asset.size })) } };
  } catch { return null; }
}
async function describe(item) {
  if (descriptions.has(item.id)) return descriptions.get(item.id);
  let text = '';
  try { text = item.kind === 'pack' ? (controls.getCatalogPackDetails ? (await controls.getCatalogPackDetails(item.id)).description : await (await fetch(item.descriptionUrl)).text()) : (await controls.getCatalogThemeDetails(item.id)).description; } catch {}
  const plain = plainDescription(String(text).replace(/^\s*#[^\n]*\n+/, '')); descriptions.set(item.id, plain); return plain;
}
function sorted(list) {
  const by = { name: (a, b) => itemName(a).localeCompare(itemName(b)), author: (a, b) => itemAuthor(a).localeCompare(itemAuthor(b)) || itemName(a).localeCompare(itemName(b)), date: (a, b) => String(b.added || '').localeCompare(String(a.added || '')) || b.position - a.position }[state.sort];
  return [...list].sort((a, b) => (b.sortFirst ? 1 : 0) - (a.sortFirst ? 1 : 0) || by(a, b));
}
const visible = () => sorted(available().filter(item => (!state.type || item.type === state.type) && (!state.author || itemAuthor(item) === state.author)));

// ---- side panel -----------------------------------------------------------------------------
function renderSide() {
  const counts = Object.fromEntries(TYPES.map(type => [type, available().filter(item => item.type === type).length]));
  const authors = [...new Set(available().map(itemAuthor).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const link = (go, label, extra = '', active = false) => `<a href="#" class="wu-link${active ? ' on' : ''}" data-go="${go}" ${extra}>${label}</a>`;
  $('#wu-side').innerHTML = `${link('home', esc(t('home')), '', state.page === 'home')}
    ${state.selected.size ? `<a href="#" class="wu-install" data-go="review"><img src="assets/images/wu/arrow.png" alt="">${esc(fill(t('installItems'), { n: state.selected.size }))}</a>` : ''}
    <h4>${esc(t('byType'))}</h4>
    ${TYPES.filter(type => counts[type]).map(type => link('type', `${esc(t('types')[type])} (${counts[type]})`, `data-type="${type}"`, state.page === 'select' && state.type === type && !state.author)).join('')}
    ${authors.length > 1 ? `<h4>${esc(t('byAuthor2'))}</h4>${authors.map(author => link('author', `${esc(author)} (${available().filter(item => itemAuthor(item) === author).length})`, `data-author="${esc(author)}"`, state.page === 'select' && state.author === author)).join('')}` : ''}
    <h4>${esc(t('options'))}</h4>
    ${link('history', esc(t('history')), '', state.page === 'history')}
    <label class="wu-sort">${esc(t('sortBy'))}<select id="wu-sort"><option value="date">${esc(t('sortDate'))}</option><option value="name">${esc(t('sortName'))}</option><option value="author">${esc(t('sortAuthor'))}</option></select></label>`;
  $('#wu-sort').value = state.sort;
}

// ---- pages -----------------------------------------------------------------------------------
const strip = (title, sub = '') => `<div class="wu-strip"><img src="assets/images/wu/tablet.png" alt=""><div class="wu-strip-text"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div></div>`;
const rowHTML = (item, open = false) => {
  const checked = state.selected.has(item.id), expanded = open || state.expanded.has(item.id);
  const preview = item.previewUrl ? `<img class="wu-thumb" src="${esc(item.previewUrl)}" alt="" onerror="this.remove()">` : '';
  return `<div class="wu-row" data-id="${esc(item.id)}"><label class="wu-checkline"><input type="checkbox" class="wu-check" data-id="${esc(item.id)}"${checked ? ' checked' : ''}></label><button type="button" class="wu-plus" data-expand="${esc(item.id)}" aria-label="+">${expanded ? '−' : '+'}</button><a href="#" class="wu-name" data-expand="${esc(item.id)}">${esc(itemName(item))}</a><span class="wu-by">${itemAuthor(item) ? `(${esc(itemAuthor(item))})` : ''}</span>
    <div class="wu-detail"${expanded ? '' : ' hidden'}>${preview}<div class="wu-detail-text"><p data-desc="${esc(item.id)}">${esc(descriptions.get(item.id) ?? '…')}</p><p class="wu-meta">${esc(t('type'))} ${esc(t('types')[item.type] || item.type)}${item.version && item.version !== 'Unknown' ? ` · ${esc(t('version'))} ${esc(item.version)}` : ''}${item.added ? ` · ${esc(t('added'))} ${esc(item.added)}` : ''}</p></div></div></div>`;
};
const clientItem = () => state.items.find(item => item.kind === 'client');
function clientNotice() { const item = clientItem(); return item ? `<div class="wu-notice"><b>${esc(fill(t('clientAvailable'), { name: itemName(item) }))}</b><p><button type="button" class="wu-btn" data-act="client">${esc(t('installNow'))}</button></p></div>` : ''; }
function homePage() {
  const news = sorted(available()).slice(0, 3);
  return `${strip(t('welcome'), t('welcomeTo'))}<div class="wu-two"><div class="wu-content">
    <h2 class="wu-h">${esc(t('keepUp'))}</h2>${clientNotice()}<p>${esc(t('homeIntro'))}</p>
    <div class="wu-choice"><button type="button" class="wu-btn" data-go="express">${esc(t('express'))}</button><span><b>${esc(t('expressText'))}</b></span></div>
    <div class="wu-choice"><button type="button" class="wu-btn" data-go="custom">${esc(t('custom'))}</button><span>${esc(t('customText'))}</span></div>
    <p><b>${esc(t('privacy'))}</b> ${esc(t('privacyText'))}</p></div>
    <div class="wu-boxes"><div class="wu-box ok"><header><img src="assets/images/wu/shield-3-32.png" alt=""><b>${esc(fill(t('boxInstalled'), { n: state.installedPacks.filter(pack => pack.catalogId).length + state.installedThemes.filter(theme => theme.catalogId).length }))}</b></header><p>${esc(fill(t('boxInstalledText'), { n: state.installedPacks.filter(pack => pack.catalogId).length + state.installedThemes.filter(theme => theme.catalogId).length }))}</p><p><a href="#" data-go="history">${esc(t('boxHistory'))}</a></p></div>
    <div class="wu-box news"><header><img src="assets/images/wu/info.png" alt=""><b>${esc(t('news'))}</b></header>${news.map(item => `<p><a href="#" data-open="${esc(item.id)}">${esc(itemName(item))}</a></p>`).join('')}</div></div></div>`;
}
function selectPage() {
  const list = visible(), typeLabel = state.author ? state.author : t('types')[state.type] || t('allTypes');
  const groups = new Map();
  for (const item of list) { const key = state.type || state.author ? (state.author ? t('types')[item.type] : itemAuthor(item) || t('types')[item.type]) : t('types')[item.type]; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); }
  return `${strip(t('customize'))}<div class="wu-content full"><h2 class="wu-h">${esc(fill(t('selectTitle'), { type: typeLabel }))}</h2><p>${esc(t('selectIntro'))}</p>
    <div class="wu-actionline"><a href="#" class="wu-go" data-go="review"><img src="assets/images/wu/arrow.png" alt="">${esc(t('reviewLink'))}</a><span>${esc(fill(t('total'), { n: state.selected.size }))}</span></div>
    ${list.length ? `<div class="wu-group-box"><div class="wu-tools"><button type="button" class="wu-btn small" data-act="clear">${esc(t('clearAll'))}</button> <button type="button" class="wu-btn small" data-act="all">${esc(t('selectAll'))}</button></div>${[...groups].map(([name, items]) => `<div class="wu-groupbar">${esc(name)}</div>${items.map(item => rowHTML(item)).join('')}`).join('')}</div>` : `<p class="wu-empty">${esc(state.loaded ? t('noCatalog') : t('loadingCatalog'))}</p>`}</div>`;
}
function reviewPage() {
  const items = sorted(state.items.filter(item => state.selected.has(item.id)));
  return `${strip(t('customize'))}<div class="wu-content full"><h2 class="wu-h">${esc(t('reviewTitle'))}</h2>
    ${items.length ? `<p>${esc(t('reviewNote'))}</p><p><button type="button" class="wu-btn" data-act="install">${esc(t('installBtn'))}</button> <span class="wu-meta">${esc(fill(t('total'), { n: items.length }))}</span></p><div class="wu-group-box">${items.map(item => rowHTML(item, true)).join('')}</div>` : `<p>${esc(t('noneSelected'))}</p>`}</div>`;
}
function resultsPage() {
  const r = state.results || { ok: [], failed: [] }, remaining = available().length;
  const list = items => items.map(entry => `<div class="wu-plain">${esc(itemName(entry.item || entry))}${entry.error ? ` — ${esc(entry.error)}` : ''}</div>`).join('');
  return `${strip(t('yourResults'))}<div class="wu-content full"><h2 class="wu-h">${esc(t('resultsTitle'))}</h2>
    ${r.restart ? `<div class="wu-notice"><b>${esc(t('restartTitle'))}</b><p>${esc(t('restartText'))}</p><button type="button" class="wu-btn" data-act="restart">${esc(t('restartNow'))}</button></div>` : ''}
    ${remaining ? `<div class="wu-notice"><b>${esc(t('moreAvailable'))}</b><p>${esc(t('moreAvailableText'))}</p><button type="button" class="wu-btn" data-go="custom">${esc(t('custom'))}</button></div>` : ''}
    <div class="wu-groupbar">${esc(t('summary'))}</div><table class="wu-summary"><tr><td><img src="assets/images/wu/shield-3-16.png" alt=""> ${esc(t('successful'))}</td><td>${r.ok.length}</td></tr><tr><td><img src="assets/images/wu/shield-5-16.png" alt=""> ${esc(t('failed'))}</td><td>${r.failed.length}</td></tr><tr><td><img src="assets/images/wu/shield-4-16.png" alt=""> ${esc(t('remaining'))}</td><td>${remaining}</td></tr></table>
    ${r.ok.length ? `<h3 class="wu-h3"><img src="assets/images/wu/shield-3-32.png" alt="">${esc(t('successfulItems'))}</h3><div class="wu-groupbar">${esc(t('title'))}</div>${list(r.ok)}` : ''}
    ${r.failed.length ? `<h3 class="wu-h3"><img src="assets/images/wu/shield-5-32.png" alt="">${esc(t('failedItems'))}</h3>${list(r.failed)}` : ''}</div>`;
}
// The history: what is installed, with its actions (apply a theme, open an add-on, remove).
function historyPage() { return `${strip(t('historyTitle'))}<div class="wu-content full"><h2 class="wu-h">${esc(t('historyHeading'))}</h2><p>${esc(t('historyIntro'))}</p><table class="wu-history"><thead><tr><th>${esc(t('colName'))}</th><th>${esc(t('colType'))}</th><th>${esc(t('colStatus'))}</th><th></th></tr></thead><tbody id="history-body"><tr><td colspan="4">${esc(t('loadingInstalled'))}</td></tr></tbody></table></div>`; }
async function fillHistory() {
  const body = $('#history-body'); if (!body) return;
  try {
    activeTheme = await controls.getActiveTheme(); const themes = await controls.listThemes();
    const packs = controls.listPacks ? await controls.listPacks().catch(() => []) : [];
    const addons = packs.some(pack => (pack.contains || []).includes('addon')) ? await (window.nkAddons?.(true) || []).catch?.(() => []) || [] : [];
    const rows = [];
    for (const theme of themes) rows.push({ name: theme.name || theme.displayName || theme.id, type: t('types').theme, status: theme.builtIn === true || !theme.removable ? (theme.id === activeTheme?.id ? t('using') : t('builtIn')) : (theme.id === activeTheme?.id ? t('using') : t('installedMark')), actions: [...(theme.removable ? [] : theme.id === activeTheme?.id ? [] : [[t('apply'), async () => { activeTheme = await controls.applyTheme(theme.id); applyFrame(activeTheme); await fillHistory(); }]]), ...(theme.removable ? [[t('remove'), () => controls.removeTheme(theme.id)]] : [])] });
    for (const pack of packs) {
      const addon = addons.find(item => item.packId === pack.id);
      rows.push({ name: pack.name || pack.id, type: (pack.contains || []).map(part => t('parts')[part] || part).join(', '), status: t('installedMark'), actions: [...(addon && controls.openAddon ? [[t('open'), () => controls.openAddon(addon.id)]] : []), [t('remove'), async () => { await controls.removePack(pack.id); packsChanged(); }]] });
    }
    body.innerHTML = rows.length ? '' : `<tr><td colspan="4">${esc(t('noThemes'))}</td></tr>`;
    for (const row of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><b>${esc(row.name)}</b></td><td>${esc(row.type)}</td><td>${esc(row.status)}</td><td class="wu-actions"></td>`;
      for (const [label, action] of row.actions) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'wu-btn small'; button.textContent = label;
        button.onclick = async () => { button.disabled = true; try { await action(); await loadCatalog(); render(); } catch (error) { button.disabled = false; button.textContent = error.message; } };
        tr.lastElementChild.append(button);
      }
      body.append(tr);
    }
  } catch (error) { body.innerHTML = `<tr><td colspan="4" class="browser-status error">${esc(error.message)}</td></tr>`; }
}
// ---- rendering and navigation ---------------------------------------------------------------
function render() {
  const page = { home: homePage, select: selectPage, review: reviewPage, results: resultsPage, history: historyPage }[state.page]();
  const main = $('#wu-main'); const scroll = main.scrollTop; main.innerHTML = page; main.scrollTop = scroll; renderSide();
  main.querySelectorAll('.wu-detail:not([hidden]) [data-desc]').forEach(async element => { const item = state.items.find(entry => entry.id === element.dataset.desc); if (!item) return; const text = await describe(item); const node = main.querySelector(`[data-desc="${CSS.escape(item.id)}"]`); if (node) node.textContent = text || t('noDescription'); });
  if (state.page === 'history') fillHistory();
}
function go(page, options = {}) { Object.assign(state, { page }, options); $('#wu-main').scrollTop = 0; render(); }
async function refresh() { await loadCatalog(); render(); }
document.addEventListener('click', event => {
  const target = event.target.closest('[data-go], [data-expand], [data-open], [data-act]');
  if (event.target.closest('a[href="#"]')) event.preventDefault();
  if (!target) return;
  if (target.dataset.go) {
    const g = target.dataset.go;
    if (g === 'home') go('home', { type: '', author: '' });
    else if (g === 'type') go('select', { type: target.dataset.type, author: '' });
    else if (g === 'author') go('select', { author: target.dataset.author, type: '' });
    else if (g === 'express') go('select', { type: '', author: '', sort: 'date' });
    else if (g === 'custom') go('select', { type: '', author: '' });
    else go(g);
    return;
  }
  if (target.dataset.open) { state.expanded.add(target.dataset.open); go('select', { type: '', author: '' }); return; }
  if (target.dataset.expand) {
    const id = target.dataset.expand; if (state.expanded.has(id)) state.expanded.delete(id); else state.expanded.add(id);
    const row = target.closest('.wu-row'), detail = row.querySelector('.wu-detail'), open = state.expanded.has(id) || state.page === 'review';
    detail.hidden = !open; row.querySelector('.wu-plus').textContent = open ? '−' : '+';
    if (open) { const item = state.items.find(entry => entry.id === id); describe(item).then(text => { const node = row.querySelector('[data-desc]'); if (node) node.textContent = text || t('noDescription'); }); }
    return;
  }
  if (target.dataset.act === 'clear') { state.selected.clear(); render(); }
  if (target.dataset.act === 'all') { visible().forEach(item => state.selected.add(item.id)); render(); }
  if (target.dataset.act === 'install') installSelected();
  if (target.dataset.act === 'restart') controls.restartToUpdate?.();
  if (target.dataset.act === 'client') { const item = clientItem(); if (item) { state.selected.add(item.id); go('review'); } }
});
document.addEventListener('change', event => {
  if (event.target.classList?.contains('wu-check')) { const id = event.target.dataset.id; if (event.target.checked) state.selected.add(id); else state.selected.delete(id); renderSide(); const total = document.querySelector('.wu-actionline span'); if (total) total.textContent = fill(t('total'), { n: state.selected.size }); if (state.page === 'review') render(); }
  if (event.target.id === 'wu-sort') { state.sort = event.target.value; render(); }
});

// ---- installing ------------------------------------------------------------------------------
async function installSelected() {
  const items = sorted(state.items.filter(item => state.selected.has(item.id)));
  if (!items.length) return;
  // The install runs in a window of its own (Installing Update); it answers with what was done.
  const job = items.map(item => ({ id: item.id, kind: item.kind, name: itemName(item), ...(item.kind === 'client' ? { release: item.release } : {}) }));
  const answer = await controls.openInstallWindow(job);
  const byId = id => state.items.find(item => item.id === id);
  const summary = { ok: (answer?.ok || []).map(entry => byId(entry.id)).filter(Boolean), failed: (answer?.failed || []).map(entry => ({ item: byId(entry.item?.id) || entry.item, error: entry.error })), go: answer?.go || '', restart: Boolean(answer?.restart) };
  if (!summary.ok.length && !summary.failed.length) return; // the window was closed at once
  if (summary.ok.some(item => item.kind === 'pack')) packsChanged();
  summary.ok.forEach(item => state.selected.delete(item.id));
  state.results = summary; await loadCatalog(); render();
  go(summary.go === 'history' ? 'history' : 'results');
}

// ---- Help menu, sounds and start ------------------------------------------------------------
function closeMenu() { document.querySelector('.cp-menu-popup')?.remove(); document.querySelectorAll('[data-menu].open').forEach(button => button.classList.remove('open')); }
$('#catalog-menu').addEventListener('click', event => {
  const button = event.target.closest('[data-menu]'); if (!button) return; event.stopPropagation();
  const wasOpen = button.classList.contains('open'); closeMenu(); if (wasOpen) return;
  const popup = document.createElement('div'); popup.className = 'cp-menu-popup';
  popup.innerHTML = `<button type="button" data-command="help">${esc(t('helpTopics'))}</button><hr><button type="button" data-command="about">${esc(t('about'))}</button>`;
  const rect = button.getBoundingClientRect(); popup.style.left = `${rect.left}px`; popup.style.top = `${rect.bottom}px`; document.body.append(popup); button.classList.add('open');
});
document.addEventListener('click', event => {
  const command = event.target.closest('.cp-menu-popup [data-command]')?.dataset.command; if (!event.target.closest('#catalog-menu')) closeMenu();
  if (command === 'help') controls.openHelpViewer?.('catalog'); else if (command === 'about') controls.openAbout?.('catalog');
});
document.addEventListener('keydown', event => { if (event.key === 'F1') { event.preventDefault(); controls.openHelpViewer?.('catalog'); } else if (event.key === 'Escape') closeMenu(); });
// XP click sound on buttons, like in the chat window.
document.addEventListener('click', event => { if (!event.target.closest?.('button')) return; let scheme = 'xp', volume = 72; try { scheme = localStorage.getItem('nk_sound_scheme') || 'xp'; volume = Number(localStorage.getItem('nk_sound_volume') ?? 72); } catch {} if (scheme === 'none' || !(volume > 0)) return; const audio = new Audio(window.nkSoundUrl ? window.nkSoundUrl('navigation') : 'assets/sounds/navigation.wav'); audio.volume = Math.min(1, volume / 100); audio.play().catch(() => {}); });
function applyText() {
  document.documentElement.lang = language; document.title = t('title'); $('.xp-title').textContent = t('title'); $('#close').setAttribute('aria-label', t('close'));
  $('#wu-brand').textContent = t('title'); $('#wu-tag').textContent = t('tag'); $('[data-menu="help"]').textContent = t('help');
}
$('#close').onclick = () => controls.close();
controls.onThemeChanged(theme => { activeTheme = theme; applyFrame(theme); if (state.page === 'history') fillHistory(); });
controls.onDisplayChanged(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); render(); });
Promise.all([controls.getActiveTheme(), controls.getDisplaySettings()]).then(([theme, display]) => { activeTheme = theme; language = display?.language === 'en' ? 'en' : 'ru'; applyFrame(theme); applyText(); render(); return loadCatalog(); }).then(render).catch(error => { $('#wu-main').innerHTML = `<p class="browser-status error">${esc(error.message)}</p>`; });
