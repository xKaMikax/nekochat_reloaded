// The Catalog, in the style of Windows Update / Microsoft Update: a banner, a plain side panel
// (Home, Install Items, Select by Type, Options), a Welcome page (Express / Custom), "Customize your
// results" lists with check boxes, "Review and Install Items", XP's "Installing Update" window and
// "Review Your Installation Results". What was installed stays under "Update History" (apply a theme,
// open an add-on, remove).
const controls = window.windowControls;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const words = {
  ru: { title:'Каталог Nekochat Reloaded', tag:'Темы, игры, звуки и многое другое для вашего Nekochat Reloaded', loadingInstalled:'Загрузка установленного…', loadingCatalog:'Загрузка каталога…', noThemes:'Установленных тем пока нет.', noCatalog:'В каталоге пока нет доступных элементов.', apply:'Применить', using:'Используется', applying:'Применение…', remove:'Удалить', removing:'Удаление…', removed:'Удалено', builtIn:'Встроена', byAuthor:'Автор: ', schemes:'Схемы: ', contains:'Внутри: ', open:'Открыть', close:'Закрыть', types:{ '':'Все', theme:'Темы', cursors:'Курсоры', sounds:'Звуки', icons:'Значки', wallpapers:'Обои для чата', assistants:'Помощники', addons:'Дополнения', combo:'Комбо' }, parts:{ theme:'тема', cursors:'курсоры', sounds:'звуки', icons:'значки', wallpapers:'обои', assistant:'помощник', assistants:'помощник', addon:'дополнение', addons:'дополнение' }, help:'Справка', helpTopics:'Вызов справки', about:'О программе «Каталог»',
    home:'Главная каталога', installItems:'Установить ({n})', byType:'Выбор по типу', byAuthor2:'Выбор по автору', options:'Параметры', history:'История установки', sortBy:'Сортировка:', sortDate:'По дате добавления', sortName:'По имени', sortAuthor:'По автору', allTypes:'Все элементы',
    welcome:'Добро пожаловать', welcomeTo:'в Каталог Nekochat Reloaded', keepUp:'Пополните свой Nekochat Reloaded', homeIntro:'Посмотрите, что нового в каталоге: темы, курсоры, звуки, значки, обои для чата, помощники и дополнения (игры, Редактор тем).', express:'Экспресс', expressText:'Показать самое новое (рекомендуется)', custom:'Выборочно', customText:'Выбрать из тем, курсоров, звуков, значков, обоев, помощников и дополнений', privacy:'Вопросы о конфиденциальности?', privacyText:'При просмотре каталога приложение только загружает список с GitHub. Сведения о вашем компьютере не отправляются.',
    boxInstalled:'Установлено: {n}', boxInstalledText:'На этом компьютере установлено элементов каталога: {n}.', boxHistory:'Открыть историю установки.', news:'Новинки',
    customize:'Настройте результаты', selectTitle:'Выберите: {type}', selectIntro:'Отметьте то, что хотите установить, и выберите «Просмотреть и установить».', reviewLink:'Просмотреть и установить', total:'Всего: {n}', clearAll:'Снять все', selectAll:'Выбрать все', installedMark:'установлено', added:'Добавлено:', version:'Версия:', type:'Тип:', noDescription:'Описание пока не добавлено.',
    reviewTitle:'Просмотр и установка', installBtn:'Установить', noneSelected:'Ничего не отмечено. Вернитесь к списку и отметьте нужное.', reviewNote:'Проверьте список и нажмите «Установить».',
    yourResults:'Ваши результаты', resultsTitle:'Итоги установки', moreAvailable:'Доступны ещё элементы', moreAvailableText:'Загляните в каталог и установите то, что вам нужно.', summary:'Сводка установки', successful:'Успешно:', failed:'Ошибки:', remaining:'Осталось:', successfulItems:'Успешно установлено', failedItems:'Не удалось установить', historyTitle:'История установки', historyIntro:'Установленные на этом компьютере темы и элементы каталога. Luna и Classic встроены в клиент.',
    dlTitle:'Установка обновления', dlTitleMany:'Установка обновлений: {n}', dlHeading:'Обновления загружаются и устанавливаются', dlStatus:'Состояние установки:', dlDownloading:'Загрузка:', dlInstalling:'Установка:', dlCancel:'Отмена', dlDownload:'Загрузка: {name} (обновление {index} из {count})...', dlInit:'Подготовка установки...', dlInstall:'Установка: {name} (обновление {index} из {count})...', dlDone:'выполнено!', dlCancelled:'Отменено.', dlFailed:'Ошибка: {error}', dlClose:'Закрыть', dlMb:'{a} МБ из {b} МБ', dlComplete:'Установка завершена', dlConfigure:'История установки' },
  en: { title:'Nekochat Reloaded Catalog', tag:'Get themes, games, sounds and more for your Nekochat Reloaded', loadingInstalled:'Loading what is installed…', loadingCatalog:'Loading catalog…', noThemes:'No installed themes yet.', noCatalog:'There is nothing in the catalog yet.', apply:'Apply', using:'In use', applying:'Applying…', remove:'Remove', removing:'Removing…', removed:'Removed', builtIn:'Built-in', byAuthor:'By ', schemes:'Schemes: ', contains:'Contains: ', open:'Open', close:'Close', types:{ '':'All', theme:'Themes', cursors:'Cursors', sounds:'Sounds', icons:'Icons', wallpapers:'Chat wallpapers', assistants:'Assistants', addons:'Add-ons', combo:'Combos' }, parts:{ theme:'theme', cursors:'cursors', sounds:'sounds', icons:'icons', wallpapers:'wallpapers', assistant:'assistant', assistants:'assistant', addon:'add-on', addons:'add-on' }, help:'Help', helpTopics:'Help Topics', about:'About Catalog',
    home:'Catalog Home', installItems:'Install Items ({n})', byType:'Select by Type', byAuthor2:'Select by Author', options:'Options', history:'Review your update history', sortBy:'Sort by:', sortDate:'Date added', sortName:'Name', sortAuthor:'Author', allTypes:'All items',
    welcome:'Welcome', welcomeTo:'to the Nekochat Reloaded Catalog', keepUp:'Keep your Nekochat Reloaded up to date', homeIntro:'Check what is new in the catalog: themes, cursors, sounds, icons, chat wallpapers, assistants and add-ons (games, the Theme Editor).', express:'Express', expressText:'Get the newest items (recommended)', custom:'Custom', customText:'Select from themes, cursors, sounds, icons, wallpapers, assistants and add-ons', privacy:'Concerned about privacy?', privacyText:'When you browse the catalog, the app only downloads the list from GitHub. Nothing about your computer is sent.',
    boxInstalled:'Installed items: {n}', boxInstalledText:'Catalog items installed on this computer: {n}.', boxHistory:'View your update history.', news:'News',
    customize:'Customize your results', selectTitle:'Select {type}', selectIntro:'Check what you want to install, then choose Review and install items.', reviewLink:'Review and install items', total:'Total: {n} items', clearAll:'Clear All', selectAll:'Select All', installedMark:'installed', added:'Added:', version:'Version:', type:'Type:', noDescription:'No description has been added yet.',
    reviewTitle:'Review and Install Items', installBtn:'Install Items', noneSelected:'Nothing is selected. Go back to the list and check what you need.', reviewNote:'Check the list and choose Install Items.',
    yourResults:'Your results', resultsTitle:'Review Your Installation Results', moreAvailable:'More items are available', moreAvailableText:'Look through the catalog and install what you need.', summary:'Installation Summary', successful:'Successful:', failed:'Failed:', remaining:'Remaining:', successfulItems:'Successful Items', failedItems:'Failed Items', historyTitle:'Update History', historyIntro:'Themes and catalog items installed on this computer. Luna and Classic are built into the client.',
    dlTitle:'Installing Update', dlTitleMany:'Installing {n} Updates', dlHeading:'The updates are being downloaded and installed', dlStatus:'Installation status:', dlDownloading:'Downloading:', dlInstalling:'Installing:', dlCancel:'Cancel', dlDownload:'Downloading {name} (update {index} of {count})...', dlInit:'Initializing installation...', dlInstall:'Installing {name} (update {index} of {count})...', dlDone:'done!', dlCancelled:'Cancelled.', dlFailed:'Error: {error}', dlClose:'Close', dlMb:'{a} MB of {b} MB', dlComplete:'Installation complete', dlConfigure:'Update history' },
};
let language = 'ru'; let activeTheme;
const t = key => words[language][key];
const fill = (text, values = {}) => String(text).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
const TYPES = ['theme', 'cursors', 'sounds', 'icons', 'wallpapers', 'assistants', 'addons', 'combo'];
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
  for (const id of [...state.selected]) if (!state.items.some(item => item.id === id) || isInstalled(state.items.find(item => item.id === id))) state.selected.delete(id);
}
async function describe(item) {
  if (descriptions.has(item.id)) return descriptions.get(item.id);
  let text = '';
  try { text = item.kind === 'pack' ? (controls.getCatalogPackDetails ? (await controls.getCatalogPackDetails(item.id)).description : await (await fetch(item.descriptionUrl)).text()) : (await controls.getCatalogThemeDetails(item.id)).description; } catch {}
  const plain = plainDescription(String(text).replace(/^\s*#[^\n]*\n+/, '')); descriptions.set(item.id, plain); return plain;
}
function sorted(list) {
  const by = { name: (a, b) => itemName(a).localeCompare(itemName(b)), author: (a, b) => itemAuthor(a).localeCompare(itemAuthor(b)) || itemName(a).localeCompare(itemName(b)), date: (a, b) => String(b.added || '').localeCompare(String(a.added || '')) || b.position - a.position }[state.sort];
  return [...list].sort(by);
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
function homePage() {
  const news = sorted(available()).slice(0, 3);
  return `${strip(t('welcome'), t('welcomeTo'))}<div class="wu-two"><div class="wu-content">
    <h2 class="wu-h">${esc(t('keepUp'))}</h2><p>${esc(t('homeIntro'))}</p>
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
    ${remaining ? `<div class="wu-notice"><b>${esc(t('moreAvailable'))}</b><p>${esc(t('moreAvailableText'))}</p><button type="button" class="wu-btn" data-go="custom">${esc(t('custom'))}</button></div>` : ''}
    <div class="wu-groupbar">${esc(t('summary'))}</div><table class="wu-summary"><tr><td><img src="assets/images/wu/shield-3-16.png" alt=""> ${esc(t('successful'))}</td><td>${r.ok.length}</td></tr><tr><td><img src="assets/images/wu/shield-5-16.png" alt=""> ${esc(t('failed'))}</td><td>${r.failed.length}</td></tr><tr><td><img src="assets/images/wu/shield-4-16.png" alt=""> ${esc(t('remaining'))}</td><td>${remaining}</td></tr></table>
    ${r.ok.length ? `<h3 class="wu-h3"><img src="assets/images/wu/shield-3-32.png" alt="">${esc(t('successfulItems'))}</h3><div class="wu-groupbar">${esc(t('title'))}</div>${list(r.ok)}` : ''}
    ${r.failed.length ? `<h3 class="wu-h3"><img src="assets/images/wu/shield-5-32.png" alt="">${esc(t('failedItems'))}</h3>${list(r.failed)}` : ''}</div>`;
}
// One card of the history (an installed theme or pack): apply, open, remove.
function themeCard(theme, label) {
  const schemeList = (theme.schemes || theme.colorSchemes || []).map(item => typeof item === 'string' ? item : item.name || item.id).filter(Boolean); const schemes = schemeList.length > 1 ? t('schemes') + schemeList.join(', ') : '';
  const author = theme.author && theme.author !== 'Unknown' ? theme.author : '';
  const inside = theme.kind === 'pack' ? t('contains') + (theme.contains || []).map(part => t('parts')[part] || part).join(', ') : '';
  const preview = theme.previewUrl ? `<img class="theme-preview" src="${esc(theme.previewUrl)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'theme-preview placeholder',textContent:'Theme'}))">` : '<span class="theme-preview placeholder">Theme</span>';
  return `<article class="theme-card${theme.id === activeTheme?.id ? ' active' : ''}">${preview}<div class="theme-info"><h2>${esc(theme.name || theme.displayName || theme.id)}</h2>${author ? `<p class="theme-author">${esc(t('byAuthor') + author)}</p>` : ''}${schemes ? `<p>${esc(schemes)}</p>` : ''}${inside ? `<p>${esc(inside)}</p>` : ''}<button type="button" data-theme="${esc(theme.id)}">${esc(label)}</button></div></article>`;
}
function historyPage() { return `${strip(t('historyTitle'))}<div class="wu-content full"><h2 class="wu-h">${esc(t('historyTitle'))}</h2><p>${esc(t('historyIntro'))}</p><div class="theme-grid" id="installed-list"><p class="browser-status">${esc(t('loadingInstalled'))}</p></div></div>`; }
async function fillHistory() {
  const list = $('#installed-list'); if (!list) return;
  try {
    activeTheme = await controls.getActiveTheme(); const themes = await controls.listThemes();
    list.innerHTML = themes.length ? themes.map(theme => themeCard(theme, theme.removable ? t('remove') : theme.id === activeTheme?.id ? t('using') : t('apply'))).join('') : `<p class="empty-list">${t('noThemes')}</p>`;
    list.querySelectorAll('button[data-theme]').forEach(button => {
      const theme = themes.find(item => item.id === button.dataset.theme);
      if (theme.removable) button.onclick = () => removeInstalled(button, () => controls.removeTheme(theme.id));
      else if (theme.id === activeTheme?.id) button.disabled = true;
      else button.onclick = async () => { button.disabled = true; button.textContent = t('applying'); try { activeTheme = await controls.applyTheme(theme.id); applyFrame(activeTheme); await fillHistory(); } catch (error) { button.disabled = false; button.textContent = error.message; } };
    });
    // Installed packs follow the themes; they are chosen in Display Properties.
    const packs = controls.listPacks ? await controls.listPacks().catch(() => []) : [];
    if (packs.length) {
      list.insertAdjacentHTML('beforeend', packs.map(pack => themeCard({ ...pack, kind: 'pack', displayName: pack.name, contains: pack.contains, previewUrl: pack.files?.['addon/Preview.png'] || '' }, t('remove')).replace('data-theme=', 'data-pack=')).join(''));
      list.querySelectorAll('button[data-pack]').forEach(button => { button.onclick = () => removeInstalled(button, async () => { await controls.removePack(button.dataset.pack); packsChanged(); }); });
      // An installed add-on (a game, the Theme Editor…) can be opened right here.
      const addons = await (window.nkAddons?.(true) || []).catch?.(() => []) || [];
      for (const addon of addons) { const remove = list.querySelector(`button[data-pack="${CSS.escape(addon.packId)}"]`); if (!remove || !controls.openAddon) continue; const open = document.createElement('button'); open.type = 'button'; open.textContent = t('open'); open.onclick = () => controls.openAddon(addon.id); remove.before(open); }
    }
  } catch (error) { list.innerHTML = `<p class="browser-status error">${esc(error.message)}</p>`; }
}
async function removeInstalled(button, action) {
  button.disabled = true; button.textContent = t('removing');
  try { await action(); button.textContent = t('removed'); await loadCatalog(); render(); } catch (error) { button.disabled = false; button.textContent = error.message; }
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
});
document.addEventListener('change', event => {
  if (event.target.classList?.contains('wu-check')) { const id = event.target.dataset.id; if (event.target.checked) state.selected.add(id); else state.selected.delete(id); renderSide(); const total = document.querySelector('.wu-actionline span'); if (total) total.textContent = fill(t('total'), { n: state.selected.size }); if (state.page === 'review') render(); }
  if (event.target.id === 'wu-sort') { state.sort = event.target.value; render(); }
});

// ---- installing ------------------------------------------------------------------------------
async function installSelected() {
  const items = sorted(state.items.filter(item => state.selected.has(item.id)));
  if (!items.length) return;
  const summary = await installQueue(items);
  if (summary.ok.some(item => item.kind === 'pack')) packsChanged();
  summary.ok.forEach(item => state.selected.delete(item.id));
  state.results = summary; await loadCatalog();
  go(summary.go === 'history' ? 'history' : 'results');
}
// XP's "Installing Update" window: status log, MB counter, the theme's progress bar, Cancel; at the
// end "Installation complete" with a Close button. Several items are "update 1 of N".
function installQueue(items) {
  return new Promise(resolve => {
    const count = items.length, summary = { ok: [], failed: [], go: '' };
    const veil = document.createElement('div'); veil.className = 'dl-veil';
    veil.innerHTML = `<div class="xp-window dl-dialog" role="dialog"><header class="xp-titlebar"><span class="xp-app-icon has-icon dl-titleicon" style="background-image:url('assets/images/windows-update-16.png')"></span><span class="xp-title">${esc(count > 1 ? fill(t('dlTitleMany'), { n: count }) : t('dlTitle'))}</span></header><div class="xp-body-frame"><i class="xp-side xp-side-left"></i><div class="dl-inner"><div class="dl-panel"><div class="dl-head"><img src="assets/images/windows-update-48.png" alt=""><span>${esc(t('dlHeading'))}</span></div><div class="dl-label">${esc(t('dlStatus'))}</div><div class="dl-log"></div><div class="dl-row"><span class="dl-label dl-phase">${esc(t('dlDownloading'))}</span><span class="dl-size"></span></div><div class="dl-bar"><i></i></div><div class="dl-buttons"><button type="button" class="dl-cancel">${esc(t('dlCancel'))}</button></div></div></div><i class="xp-side xp-side-right"></i></div><i class="xp-bottom"></i></div>`;
    document.body.append(veil);
    const log = veil.querySelector('.dl-log'), bar = veil.querySelector('.dl-bar i'), size = veil.querySelector('.dl-size'), phase = veil.querySelector('.dl-phase'), cancel = veil.querySelector('.dl-cancel');
    veil.querySelector('.dl-dialog').classList.toggle('classic', getComputedStyle(document.documentElement).getPropertyValue('--classic-raised').trim() !== '');
    const line = text => { const row = document.createElement('div'); row.textContent = text; log.append(row); log.scrollTop = log.scrollHeight; return row; };
    const mb = bytes => (bytes / 1048576).toFixed(2);
    // Whole blocks only, like XP's progress bar.
    const setBar = fraction => { const room = bar.parentElement.clientWidth - 6; bar.style.width = `${Math.max(0, Math.floor(Math.min(1, fraction) * room / 10) * 10)}px`; };
    let current = null, index = 0, last = null, cancelled = false;
    const stop = controls.onPackProgress?.(data => {
      if (!current || data.id !== current.id) return;
      if (data.step === 'bytes') { const total = data.total || 0; setBar(total ? data.received / total : .3); size.textContent = total ? fill(t('dlMb'), { a: mb(data.received), b: mb(total) }) : `${mb(data.received)} MB`; }
      if (data.step === 'installing') installing();
    });
    const installing = () => { if (last) last.textContent += ` ${t('dlDone')}`; line(`${t('dlInit')} ${t('dlDone')}`); setBar(1); phase.textContent = t('dlInstalling'); size.textContent = ''; bar.parentElement.classList.add('busy'); last = line(fill(t('dlInstall'), { name: itemName(current), index, count })); };
    const close = () => { stop?.(); veil.remove(); resolve(summary); };
    cancel.onclick = () => { if (cancelled) return; cancelled = true; cancel.disabled = true; if (current?.kind === 'pack') controls.cancelPackInstall?.(current.id); };
    (async () => {
      for (const item of items) {
        if (cancelled) break;
        current = item; index += 1; setBar(0); size.textContent = ''; phase.textContent = t('dlDownloading'); bar.parentElement.classList.remove('busy');
        last = line(fill(t('dlDownload'), { name: itemName(item), index, count }));
        try {
          if (item.kind === 'pack') await controls.installCatalogPack(item.id);
          else { bar.parentElement.classList.add('busy'); await controls.installCatalogTheme(item.id); installing(); }
          if (last) last.textContent += ` ${t('dlDone')}`; bar.parentElement.classList.remove('busy');
          summary.ok.push(item);
        } catch (error) {
          const stopped = /Cancelled/i.test(String(error?.message)); bar.parentElement.classList.remove('busy');
          const message = String(error?.message || error).replace(/^Error invoking remote method '[^']*': (Error: )?/, '');
          line(stopped ? t('dlCancelled') : fill(t('dlFailed'), { error: message }));
          if (!stopped) summary.failed.push({ item, error: message });
        }
      }
      // XP ends with "Installation complete", a link to what was done and Close.
      veil.querySelector('.dl-panel').innerHTML = `<div class="dl-head done"><img src="assets/images/windows-update-48.png" alt=""><div><b>${esc(t('dlComplete'))}</b></div></div><div class="dl-buttons end"><a href="#" class="dl-link">${esc(t('dlConfigure'))}</a><button type="button" class="dl-cancel">${esc(t('dlClose'))}</button></div>`;
      const ok = veil.querySelector('.dl-cancel'); ok.onclick = close; ok.focus();
      veil.querySelector('.dl-link').onclick = event => { event.preventDefault(); summary.go = 'history'; close(); };
    })();
  });
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
