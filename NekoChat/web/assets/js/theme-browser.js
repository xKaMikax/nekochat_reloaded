const controls = window.windowControls;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const words = {
  ru: { title:'Каталог Nekochat Reloaded', installed:'Установленные', discovery:'Каталог', installedIntro:'Темы, установленные на этом компьютере. Luna и Classic встроены в клиент.', discoveryIntro:'Темы, курсоры, звуки, иконки, обои для чата, помощники и дополнения (игры, Редактор тем) из каталога Nekochat Reloaded Themes. Их можно скачать и установить.', loadingInstalled:'Загрузка установленных тем…', loadingCatalog:'Загрузка каталога…', noThemes:'Установленных тем пока нет.', noCatalog:'В каталоге пока нет доступных тем.', found:'Найдено: ', apply:'Применить', using:'Используется', applying:'Применение…', download:'Установить', downloading:'Установка…', installedDone:'Установлено', remove:'Удалить', removing:'Удаление…', removed:'Удалено', builtIn:'Встроена', defaultScheme:'Стандартная', installedType:'Установлена', back:'← Назад', close:'Закрыть', sort:'Сортировка:', sortDate:'По дате добавления', sortName:'По имени', sortAuthor:'По автору', author:'Автор:', allAuthors:'Все', byAuthor:'Автор: ', schemes:'Схемы: ', type:'Тип:', types:{ '':'Все', theme:'Темы', cursors:'Курсоры', sounds:'Звуки', icons:'Иконки', wallpapers:'Обои для чата', assistants:'Помощники', addons:'Дополнения', combo:'Комбо' }, parts:{ theme:'тема', cursors:'курсоры', sounds:'звуки', icons:'иконки', wallpapers:'обои', assistant:'помощник', assistants:'помощник', addon:'дополнение', addons:'дополнение' }, contains:'Внутри: ', noPacks:'Здесь пока пусто.', help:'Справка', helpTopics:'Вызов справки', about:'О программе «Каталог»', open:'Открыть' },
  en: { title:'Nekochat Reloaded Catalog', installed:'Installed', discovery:'Discovery', installedIntro:'Themes installed on this computer. Luna and Classic are built into the client.', discoveryIntro:'Themes, cursors, sounds, icons, chat wallpapers, assistants and add-ons (games, the Theme Editor) from the Nekochat Reloaded Themes catalog. Download and install them here.', loadingInstalled:'Loading installed themes…', loadingCatalog:'Loading catalog…', noThemes:'No installed themes yet.', noCatalog:'There are no available themes in the catalog yet.', found:'Found: ', apply:'Apply', using:'In use', applying:'Applying…', download:'Install', downloading:'Installing…', installedDone:'Installed', remove:'Remove', removing:'Removing…', removed:'Removed', builtIn:'Built-in', defaultScheme:'Default', installedType:'Installed', back:'← Back', close:'Close', sort:'Sort by:', sortDate:'Date added', sortName:'Name', sortAuthor:'Author', author:'Author:', allAuthors:'All', byAuthor:'By ', schemes:'Schemes: ', type:'Type:', types:{ '':'All', theme:'Themes', cursors:'Cursors', sounds:'Sounds', icons:'Icons', wallpapers:'Chat wallpapers', assistants:'Assistants', addons:'Add-ons', combo:'Combos' }, parts:{ theme:'theme', cursors:'cursors', sounds:'sounds', icons:'icons', wallpapers:'wallpapers', assistant:'assistant', assistants:'assistant', addon:'add-on', addons:'add-on' }, contains:'Contains: ', noPacks:'Nothing here yet.', help:'Help', helpTopics:'Help Topics', about:'About Catalog', open:'Open' }
};
Object.assign(words.ru, { dlTitle: 'Установка обновления', dlHeading: 'Обновления загружаются и устанавливаются', dlStatus: 'Состояние установки:', dlDownloading: 'Загрузка:', dlInstalling: 'Установка:', dlCancel: 'Отмена', dlDownload: 'Загрузка: {name} (обновление {index} из {count})...', dlInit: 'Подготовка установки...', dlInstall: 'Установка: {name} (обновление {index} из {count})...', dlDone: 'выполнено!', dlCancelled: 'Отменено.', dlFailed: 'Ошибка: {error}', dlClose: 'Закрыть', dlMb: '{a} МБ из {b} МБ', dlComplete: 'Установка завершена', dlCompleteText: '{name}: установка выполнена.' });
Object.assign(words.en, { dlTitle: 'Installing Update', dlHeading: 'The updates are being downloaded and installed', dlStatus: 'Installation status:', dlDownloading: 'Downloading:', dlInstalling: 'Installing:', dlCancel: 'Cancel', dlDownload: 'Downloading {name} (update {index} of {count})...', dlInit: 'Initializing installation...', dlInstall: 'Installing {name} (update {index} of {count})...', dlDone: 'done!', dlCancelled: 'Cancelled.', dlFailed: 'Error: {error}', dlClose: 'Close', dlMb: '{a} MB of {b} MB', dlComplete: 'Installation complete', dlCompleteText: '{name} has been installed.' });
let language = 'ru'; let activeTheme;
let selectedCatalogTheme;
const authorsByCatalog = new Map();
const t = key => words[language][key];
function applyFrame(theme) { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; }
function applyText() { document.documentElement.lang = language; document.title = t('title'); $('.xp-title').textContent = t('title'); $('#installed-tab').textContent = t('installed'); $('#discovery-tab').textContent = t('discovery'); $('[data-panel="installed"]').textContent = t('installedIntro'); $('[data-panel="discovery"]').textContent = t('discoveryIntro'); $('#detail-back').textContent = t('back'); $('#close').setAttribute('aria-label', t('close')); $('#sort-label').textContent = t('sort'); $('#author-label').textContent = t('author'); $('#type-label').textContent = t('type'); $('[data-menu="help"]').textContent = t('help'); [...$('#catalog-type').options].forEach(option => { option.textContent = t('types')[option.value]; }); [['date', 'sortDate'], ['name', 'sortName'], ['author', 'sortAuthor']].forEach(([value, key]) => { $(`#catalog-sort option[value="${value}"]`).textContent = t(key); }); }
function switchTab(tab) { const installed = tab === 'installed'; $('#installed-tab').classList.toggle('active', installed); $('#discovery-tab').classList.toggle('active', !installed); $('#installed-panel').hidden = !installed; $('#discovery-panel').hidden = installed; }
// The card names the author (a click filters the catalog by them) and lists colour schemes only
// when there are several; the theme's file type and a lone "Default" scheme mean nothing to people.
function themeCard(theme, label) { const schemeList = (theme.schemes || theme.colorSchemes || []).map(item => typeof item === 'string' ? item : item.name || item.id).filter(Boolean); const schemes = schemeList.length > 1 ? t('schemes') + schemeList.join(', ') : ''; const author = theme.author && theme.author !== 'Unknown' ? theme.author : authorsByCatalog.get(theme.catalogId) || ''; const inside = theme.kind === 'pack' ? t('contains') + (theme.contains || []).map(part => t('parts')[part] || part).join(', ') : ''; const preview = theme.previewUrl ? `<img class="theme-preview" src="${esc(theme.previewUrl)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'theme-preview placeholder',textContent:'Theme'}))">` : '<span class="theme-preview placeholder">Theme</span>'; return `<article class="theme-card${theme.id === activeTheme?.id ? ' active' : ''}">${preview}<div class="theme-info"><h2>${esc(theme.name || theme.displayName || theme.id)}</h2>${author ? `<p class="theme-author" data-author="${esc(author)}" title="${esc(t('byAuthor') + author)}">${esc(t('byAuthor') + author)}</p>` : ''}${schemes ? `<p>${esc(schemes)}</p>` : ''}${inside ? `<p>${esc(inside)}</p>` : ''}<button type="button" data-theme="${esc(theme.id)}">${esc(label)}</button></div></article>`; }
async function showInstalled() { const list = $('#installed-list'); list.innerHTML = `<p class="browser-status">${t('loadingInstalled')}</p>`; try { activeTheme = await controls.getActiveTheme(); const themes = await controls.listThemes(); list.innerHTML = themes.length ? themes.map(theme => themeCard(theme, theme.id === activeTheme?.id ? t('using') : t('apply'))).join('') : `<p class="empty-list">${t('noThemes')}</p>`; list.querySelectorAll('button[data-theme]').forEach(button => { const theme = themes.find(item => item.id === button.dataset.theme); if (theme?.id === activeTheme?.id) { button.disabled = true; return; } button.onclick = async () => { button.disabled = true; button.textContent = t('applying'); try { activeTheme = await controls.applyTheme(theme.id); applyFrame(activeTheme); await showInstalled(); } catch (error) { button.disabled = false; button.textContent = error.message; } }; }); } catch (error) { list.innerHTML = `<p class="browser-status error">${esc(error.message)}</p>`; } }
async function showDiscovery() { const status = $('#discovery-status'), list = $('#discovery-list'); status.textContent = t('loadingCatalog'); status.classList.remove('error'); list.innerHTML = ''; try { const themes = (await controls.listCatalogThemes()).filter(theme => !['luna','classic'].includes(String(theme.id).toLowerCase())); status.textContent = themes.length ? `${t('found')}${themes.length}` : t('noCatalog'); list.innerHTML = themes.map(theme => themeCard(theme, t('download'))).join(''); list.querySelectorAll('button[data-theme]').forEach(button => button.onclick = async () => { button.disabled = true; button.textContent = t('downloading'); try { await controls.installCatalogTheme(button.dataset.theme); button.textContent = t('installedDone'); await showInstalled(); } catch (error) { button.disabled = false; button.textContent = error.message; } }); } catch (error) { status.textContent = error.message; status.classList.add('error'); } }
$('#installed-tab').onclick = () => switchTab('installed'); $('#discovery-tab').onclick = () => { switchTab('discovery'); showDiscovery(); }; $('#close').onclick = () => controls.close(); controls.onThemeChanged(theme => { activeTheme = theme; applyFrame(theme); showInstalled(); }); controls.onDisplayChanged(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); showInstalled(); if (!$('#discovery-panel').hidden) showDiscovery(); }); Promise.all([controls.getActiveTheme(), controls.getDisplaySettings()]).then(([theme, display]) => { activeTheme = theme; language = display?.language === 'en' ? 'en' : 'ru'; applyFrame(theme); applyText(); return showInstalled(); });

function plainDescription(value) { return String(value || '').replace(/^#+\s*/gm, '').replace(/[*`_]/g, '').trim(); }

// Installing a pack shows XP's "Installing Update" window: status log, MB counter, green bar, Cancel.
const fill = (text, values = {}) => String(text).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
function installPackDialog(id, name) {
  return new Promise((resolve, reject) => {
    const veil = document.createElement('div'); veil.className = 'dl-veil';
    veil.innerHTML = `<div class="xp-window dl-dialog" role="dialog"><header class="xp-titlebar"><span class="xp-app-icon has-icon dl-titleicon" style="background-image:url('assets/images/windows-update-16.png')"></span><span class="xp-title">${esc(t('dlTitle'))}</span></header><div class="xp-body-frame"><i class="xp-side xp-side-left"></i><div class="dl-inner"><div class="dl-panel"><div class="dl-head"><img src="assets/images/windows-update-48.png" alt=""><span>${esc(t('dlHeading'))}</span></div><div class="dl-label">${esc(t('dlStatus'))}</div><div class="dl-log"></div><div class="dl-row"><span class="dl-label dl-phase">${esc(t('dlDownloading'))}</span><span class="dl-size"></span></div><div class="dl-bar"><i></i></div><div class="dl-buttons"><button type="button" class="dl-cancel">${esc(t('dlCancel'))}</button></div></div></div><i class="xp-side xp-side-right"></i></div><i class="xp-bottom"></i></div>`;
    document.body.append(veil);
    const log = veil.querySelector('.dl-log'), bar = veil.querySelector('.dl-bar i'), size = veil.querySelector('.dl-size'), phase = veil.querySelector('.dl-phase'), cancel = veil.querySelector('.dl-cancel');
    veil.querySelector('.dl-dialog').classList.toggle('classic', getComputedStyle(document.documentElement).getPropertyValue('--classic-raised').trim() !== '');
    const line = text => { const row = document.createElement('div'); row.textContent = text; log.append(row); log.scrollTop = log.scrollHeight; return row; };
    const mb = bytes => (bytes / 1048576).toFixed(2);
    let last = null, finished = false;
    // Whole blocks only, like XP's progress bar.
    const setBar = fraction => { const room = bar.parentElement.clientWidth - 6; bar.style.width = `${Math.max(0, Math.floor(Math.min(1, fraction) * room / 10) * 10)}px`; };
    let index = 0, count = 1, phaseStep = 'download';
    if (!controls.onPackProgress) veil.querySelector('.dl-bar').classList.add('busy');
    const stop = controls.onPackProgress?.(data => {
      if (data.id !== id) return;
      if (data.step === 'plan') count = data.count;
      if (data.step === 'start') { index += 1; phaseStep = 'download'; phase.textContent = t('dlDownloading'); last = line(fill(t('dlDownload'), { name: data.name || name, index, count })); }
      if (data.step === 'bytes') { const total = data.total || 0; setBar(total ? data.received / total : .3); size.textContent = total ? fill(t('dlMb'), { a: mb(data.received), b: mb(total) }) : `${mb(data.received)} MB`; }
      if (data.step === 'installing') { if (last) last.textContent += ` ${t('dlDone')}`; line(`${t('dlInit')} ${t('dlDone')}`); setBar(1); phase.textContent = t('dlInstalling'); size.textContent = ''; bar.parentElement.classList.add('busy'); last = line(fill(t('dlInstall'), { name: data.name || name, index, count })); }
    });
    const close = () => { finished = true; stop?.(); veil.remove(); };
    cancel.onclick = () => { if (finished) return; cancel.disabled = true; controls.cancelPackInstall?.(id); };
    controls.installCatalogPack(id).then(result => {
      if (last) last.textContent += ` ${t('dlDone')}`;
      // XP ends with "Installation complete" and a Close button.
      veil.querySelector('.dl-panel').innerHTML = `<div class="dl-head done"><img src="assets/images/windows-update-48.png" alt=""><div><b>${esc(t('dlComplete'))}</b><p>${esc(fill(t('dlCompleteText'), { name }))}</p></div></div><div class="dl-buttons end"><button type="button" class="dl-cancel">${esc(t('dlClose'))}</button></div>`;
      const ok = veil.querySelector('.dl-cancel'); ok.onclick = close; ok.focus(); finished = true; stop?.();
      resolve(result);
    }, error => {
      const cancelled = /Cancelled/i.test(String(error?.message));
      line(cancelled ? t('dlCancelled') : fill(t('dlFailed'), { error: String(error?.message || error).replace(/^Error invoking remote method '[^']*': (Error: )?/, '') }));
      bar.parentElement.classList.remove('busy'); cancel.disabled = false; cancel.textContent = t('dlClose'); cancel.onclick = () => { close(); reject(error); };
    });
  });
}
function fillDetails(details) {
  selectedCatalogTheme = details;
  $('#detail-name').textContent = details.displayName || details.id;
  $('#detail-meta').textContent = [details.author && details.author !== 'Unknown' ? t('byAuthor') + details.author : '', details.version && details.version !== 'Unknown' ? details.version : ''].filter(Boolean).join(' • ');
  $('#detail-preview').src = details.previewUrl; $('#detail-preview').alt = details.displayName || details.id;
  $('#detail-description').textContent = plainDescription(details.description) || (language === 'ru' ? 'Описание для этой темы пока не добавлено.' : 'No description has been added for this theme yet.');
  $('#detail-install').disabled = false; $('#detail-install').textContent = details.installedId ? t('remove') : t('download'); $('#theme-details').hidden = false;
  $('#theme-details').scrollIntoView({ block: 'nearest' });
}
async function openCatalogDetails(id) {
  const details = await controls.getCatalogThemeDetails(id);
  const installed = await controls.listThemes();
  details.installedId = installed.find(theme => theme.catalogId === details.id)?.id || null;
  fillDetails(details);
}
// A pack (cursors, sounds, icons, wallpapers, assistants, add-ons, combos) opens the same details.
const catalogIndex = new Map();
async function openPackDetails(id) {
  const item = catalogIndex.get(id); if (!item) return;
  let description = '';
  try { description = controls.getCatalogPackDetails ? (await controls.getCatalogPackDetails(id)).description : await (await fetch(item.descriptionUrl)).text(); } catch {}
  const installedPack = ((controls.listPacks ? await controls.listPacks().catch(() => []) : []) || []).find(pack => pack.catalogId === id);
  fillDetails({ ...item, kind: 'pack', description, installedId: installedPack?.id || null });
}
$('#discovery-list').addEventListener('click', event => {
  if (event.target.closest('button')) return;
  const card = event.target.closest('.theme-card'); const button = card?.querySelector('[data-theme]'); const id = button?.dataset.theme;
  if (id && button.dataset.kind === 'pack') { openPackDetails(id).catch(error => { $('#discovery-status').textContent = error.message; $('#discovery-status').classList.add('error'); }); return; }
  if (id) openCatalogDetails(id).catch(error => { $('#discovery-status').textContent = error.message; $('#discovery-status').classList.add('error'); });
});
$('#detail-back').onclick = () => { $('#theme-details').hidden = true; };
$('#detail-install').onclick = async () => {
  if (!selectedCatalogTheme) return;
  const button = $('#detail-install'); button.disabled = true; button.textContent = t('downloading');
  const pack = selectedCatalogTheme.kind === 'pack';
  try { if (selectedCatalogTheme.installedId) { if (pack) await controls.removePack(selectedCatalogTheme.installedId); else await controls.removeTheme(selectedCatalogTheme.installedId); button.textContent = t('removed'); } else { if (pack) await installPackDialog(selectedCatalogTheme.id, selectedCatalogTheme.displayName || selectedCatalogTheme.id); else await controls.installCatalogTheme(selectedCatalogTheme.id); button.textContent = t('installedDone'); } if (pack) packsChanged(); await showInstalled(); await showDiscovery(); }
  catch (error) { button.disabled = false; button.textContent = error.message; }
};

async function removeInstalledTheme(id, button) {
  button.disabled = true; button.textContent = t('removing');
  try { await controls.removeTheme(id); button.textContent = t('removed'); await showInstalled(); await showDiscovery(); }
  catch (error) { button.disabled = false; button.textContent = error.message; }
}
async function removeInstalledPack(id, button) {
  button.disabled = true; button.textContent = t('removing');
  try { await controls.removePack(id); packsChanged(); button.textContent = t('removed'); await showInstalled(); await showDiscovery(); }
  catch (error) { button.disabled = false; button.textContent = error.message; }
}
async function showInstalled() {
  const list = $('#installed-list'); list.innerHTML = `<p class="browser-status">${t('loadingInstalled')}</p>`;
  try {
    activeTheme = await controls.getActiveTheme(); const themes = await controls.listThemes();
    list.innerHTML = themes.length ? themes.map(theme => themeCard(theme, theme.removable ? t('remove') : theme.id === activeTheme?.id ? t('using') : t('apply'))).join('') : `<p class="empty-list">${t('noThemes')}</p>`;
    list.querySelectorAll('button[data-theme]').forEach(button => {
      const theme = themes.find(item => item.id === button.dataset.theme);
      if (theme.removable) button.onclick = () => removeInstalledTheme(theme.id, button);
      else if (theme.id === activeTheme?.id) button.disabled = true;
      else button.onclick = async () => { button.disabled = true; button.textContent = t('applying'); try { activeTheme = await controls.applyTheme(theme.id); applyFrame(activeTheme); await showInstalled(); } catch (error) { button.disabled = false; button.textContent = error.message; } };
    });
    // Installed packs follow the themes; they are chosen in Display Properties.
    const packs = controls.listPacks ? await controls.listPacks().catch(() => []) : [];
    if (packs.length) {
      list.insertAdjacentHTML('beforeend', packs.map(pack => themeCard({ ...pack, kind: 'pack', displayName: pack.name, contains: pack.contains, previewUrl: pack.files?.['addon/Preview.png'] || '' }, t('remove')).replace('data-theme=', 'data-pack=')).join(''));
      list.querySelectorAll('button[data-pack]').forEach(button => { button.onclick = () => removeInstalledPack(button.dataset.pack, button); });
      // An installed add-on (a game, the Theme Editor…) can be opened right here.
      const addons = await (window.nkAddons?.(true) || []).catch?.(() => []) || [];
      for (const addon of addons) { const remove = list.querySelector(`button[data-pack="${CSS.escape(addon.packId)}"]`); if (!remove || !controls.openAddon) continue; const open = document.createElement('button'); open.type = 'button'; open.textContent = t('open'); open.onclick = () => controls.openAddon(addon.id); remove.before(open); }
    }
  } catch (error) { list.innerHTML = `<p class="browser-status error">${esc(error.message)}</p>`; }
}
async function showDiscovery() {
  const status = $('#discovery-status'), list = $('#discovery-list'); status.textContent = t('loadingCatalog'); status.classList.remove('error'); list.innerHTML = '';
  try {
    const [themes, installed, catalogPacks, installedPacks] = await Promise.all([controls.listCatalogThemes(), controls.listThemes(), controls.listCatalogPacks ? controls.listCatalogPacks().catch(() => []) : [], controls.listPacks ? controls.listPacks().catch(() => []) : []]);
    // Newest first by the catalog's "Added" date; entries without one keep their order (appended = newer).
    const all = [...themes.filter(theme => !['luna','classic'].includes(String(theme.id).toLowerCase())).map(theme => ({ ...theme, kind: 'theme', type: 'theme' })), ...catalogPacks.map(pack => ({ ...pack, kind: 'pack' }))].map((theme, index) => ({ ...theme, position: index }));
    const packsByCatalog = new Map(installedPacks.filter(pack => pack.catalogId).map(pack => [pack.catalogId, pack]));
    all.forEach(theme => { if (theme.author) authorsByCatalog.set(theme.id, theme.author); });
    catalogIndex.clear(); all.forEach(theme => catalogIndex.set(theme.id, theme));
    const authors = [...new Set(all.map(theme => theme.author).filter(author => author && author !== 'Unknown'))].sort((a, b) => a.localeCompare(b));
    const chosenAuthor = $('#catalog-author').value;
    $('#catalog-author').innerHTML = `<option value="">${esc(t('allAuthors'))}</option>` + authors.map(author => `<option value="${esc(author)}">${esc(author)}</option>`).join('');
    $('#catalog-author').value = authors.includes(chosenAuthor) ? chosenAuthor : '';
    const sort = $('#catalog-sort').value; const name = theme => String(theme.displayName || theme.id);
    const type = $('#catalog-type').value;
    const catalog = all.filter(theme => fitsPlatform(theme) && (!type || theme.type === type) && (!$('#catalog-author').value || theme.author === $('#catalog-author').value)).sort((a, b) =>
      sort === 'name' ? name(a).localeCompare(name(b)) :
      sort === 'author' ? String(a.author).localeCompare(String(b.author)) || name(a).localeCompare(name(b)) :
      String(b.added || '').localeCompare(String(a.added || '')) || b.position - a.position);
    const installedByCatalog = new Map(installed.filter(theme => theme.catalogId).map(theme => [theme.catalogId, theme]));
    status.textContent = catalog.length ? `${t('found')}${catalog.length}` : type && type !== 'theme' ? t('noPacks') : t('noCatalog');
    const isInstalled = theme => theme.kind === 'pack' ? packsByCatalog.has(theme.id) : installedByCatalog.has(theme.id);
    list.innerHTML = catalog.map(theme => themeCard({ ...theme, cardKind: theme.kind }, isInstalled(theme) ? t('remove') : t('download')).replace('data-theme=', `data-kind="${theme.kind}" data-theme=`)).join('');
    list.querySelectorAll('button[data-theme]').forEach(button => button.onclick = async () => {
      const pack = button.dataset.kind === 'pack';
      const existing = pack ? packsByCatalog.get(button.dataset.theme) : installedByCatalog.get(button.dataset.theme);
      if (existing) return pack ? removeInstalledPack(existing.id, button) : removeInstalledTheme(existing.id, button);
      button.disabled = true; button.textContent = t('downloading');
      try { if (pack) { await installPackDialog(button.dataset.theme, catalogIndex.get(button.dataset.theme)?.displayName || button.dataset.theme); packsChanged(); } else await controls.installCatalogTheme(button.dataset.theme); button.textContent = t('installedDone'); await showInstalled(); await showDiscovery(); }
      catch (error) { button.disabled = false; button.textContent = error.message; }
    });
  } catch (error) { status.textContent = error.message; status.classList.add('error'); }
}
// XP click sound on buttons, like in the chat window.
document.addEventListener('click', event => { if (!event.target.closest?.('button')) return; let scheme = 'xp', volume = 72; try { scheme = localStorage.getItem('nk_sound_scheme') || 'xp'; volume = Number(localStorage.getItem('nk_sound_volume') ?? 72); } catch {} if (scheme === 'none' || !(volume > 0)) return; const audio = new Audio(window.nkSoundUrl ? window.nkSoundUrl('navigation') : 'assets/sounds/navigation.wav'); audio.volume = Math.min(1, volume / 100); audio.play().catch(() => {}); });
$('#catalog-sort').onchange = () => showDiscovery();
$('#catalog-type').onchange = () => showDiscovery();
$('#catalog-author').onchange = () => showDiscovery();
// A click on the author of a card shows only that author's themes.
document.addEventListener('click', event => { const author = event.target.closest?.('.theme-author')?.dataset.author; if (!author || $('#discovery-panel').hidden) return; event.stopPropagation(); $('#catalog-author').value = author; showDiscovery(); }, true);

// Add-ons made for the desktop app ("Platforms": ["desktop"]) are hidden on phones and the web.
let platform = 'desktop';
Promise.resolve(controls.getUpdateInfo?.()).then(info => { platform = ['android', 'ios'].includes(info?.platform) ? info.platform : info?.mode === 'reload' ? 'web' : 'desktop'; }).catch(() => {});
const fitsPlatform = item => !Array.isArray(item.platforms) || !item.platforms.length || item.platforms.includes(platform);
// Tells the other windows that add-ons changed, so their buttons appear or go away.
function packsChanged() { try { localStorage.setItem('nk_packs_changed', String(Date.now())); } catch {} window.nkAddons?.(true); }
// Help menu: the Catalog's Help and its About box, like any XP program.
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
