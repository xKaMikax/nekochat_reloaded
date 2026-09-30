// XP's "Installing Update" window: a window of its own that installs what the Update window handed
// over (catalog packs and themes, or the client update): status log, MB counter, the theme's
// progress bar and Cancel; at the end "Installation complete" (with Restart Now after a client update).
const controls = window.windowControls;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const words = {
  ru: { dlTitle:'Установка обновления', dlTitleMany:'Установка обновлений: {n}', dlHeading:'Обновления загружаются и устанавливаются', dlStatus:'Состояние установки:', dlDownloading:'Загрузка:', dlInstalling:'Установка:', dlCancel:'Отмена', dlDownload:'Загрузка: {name} (обновление {index} из {count})...', dlInit:'Подготовка установки...', dlInstall:'Установка: {name} (обновление {index} из {count})...', dlDone:'выполнено!', dlCancelled:'Отменено.', dlFailed:'Ошибка: {error}', dlClose:'Закрыть', dlMb:'{a} МБ из {b} МБ', dlComplete:'Установка завершена', dlConfigure:'История установки', dlRestartText:'Чтобы обновление вступило в силу, нужно перезапустить Nekochat Reloaded.', dlRestart:'Перезапустить сейчас', dlOpened:'Загрузка открыта в браузере.', dlSome:'Некоторые обновления не установлены', dlNotInstalled:'Не установлены следующие обновления:' },
  en: { dlTitle:'Installing Update', dlTitleMany:'Installing {n} Updates', dlHeading:'The updates are being downloaded and installed', dlStatus:'Installation status:', dlDownloading:'Downloading:', dlInstalling:'Installing:', dlCancel:'Cancel', dlDownload:'Downloading {name} (update {index} of {count})...', dlInit:'Initializing installation...', dlInstall:'Installing {name} (update {index} of {count})...', dlDone:'done!', dlCancelled:'Cancelled.', dlFailed:'Error: {error}', dlClose:'Close', dlMb:'{a} MB of {b} MB', dlComplete:'Installation complete', dlConfigure:'Update history', dlRestartText:'You must restart Nekochat Reloaded for the update to take effect.', dlRestart:'Restart Now', dlOpened:'The download was opened in your browser.', dlSome:'Some updates were not installed', dlNotInstalled:'The following updates were not installed:' },
};
let language = 'ru';
const t = key => words[language][key];
const fill = (text, values = {}) => String(text).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
const applyFrame = theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; };
const summary = { ok: [], failed: [], go: '' };
let started = false;

async function run(items) {
  started = true;
  const count = items.length;
  $('#dl-title').textContent = count > 1 ? fill(t('dlTitleMany'), { n: count }) : t('dlTitle'); document.title = $('#dl-title').textContent;
  $('#dl-panel').innerHTML = `<div class="dl-head"><img src="assets/images/windows-update-48.png" alt=""><span>${esc(t('dlHeading'))}</span></div><div class="dl-label">${esc(t('dlStatus'))}</div><div class="dl-log"></div><div class="dl-row"><span class="dl-label dl-phase">${esc(t('dlDownloading'))}</span><span class="dl-size"></span></div><div class="dl-bar"><i></i></div><div class="dl-buttons"><button type="button" class="dl-cancel">${esc(t('dlCancel'))}</button></div>`;
  const log = $('.dl-log'), bar = $('.dl-bar i'), size = $('.dl-size'), phase = $('.dl-phase'), cancel = $('.dl-cancel');
  $('.dl-dialog').classList.toggle('classic', getComputedStyle(document.documentElement).getPropertyValue('--classic-raised').trim() !== '');
  const line = text => { const row = document.createElement('div'); row.textContent = text; log.append(row); log.scrollTop = log.scrollHeight; return row; };
  const mb = bytes => (bytes / 1048576).toFixed(2);
  // Whole blocks only, like XP's progress bar.
  const setBar = fraction => { const room = bar.parentElement.clientWidth - 6; bar.style.width = `${Math.max(0, Math.floor(Math.min(1, fraction) * room / 10) * 10)}px`; };
  const busy = on => bar.parentElement.classList.toggle('busy', on);
  let current = null, index = 0, last = null, cancelled = false, restart = false, clientWait = null;
  const installing = () => { if (last) last.textContent += ` ${t('dlDone')}`; line(`${t('dlInit')} ${t('dlDone')}`); setBar(1); phase.textContent = t('dlInstalling'); size.textContent = ''; busy(true); last = line(fill(t('dlInstall'), { name: current.name, index, count })); };
  const stopPack = controls.onPackProgress?.(data => {
    if (!current || current.kind !== 'pack' || data.id !== current.id) return;
    if (data.step === 'bytes') { const total = data.total || 0; setBar(total ? data.received / total : .3); size.textContent = total ? fill(t('dlMb'), { a: mb(data.received), b: mb(total) }) : `${mb(data.received)} MB`; }
    if (data.step === 'installing') installing();
  });
  // The client update reports percent (electron-updater); it ends with "downloaded" or "error".
  controls.onUpdateStatus?.(status => {
    if (!clientWait || current?.kind !== 'client') return;
    if (status.state === 'progress') { setBar((status.percent || 0) / 100); size.textContent = `${status.percent || 0}%`; }
    if (status.state === 'downloaded') { clientWait.resolve('downloaded'); }
    if (status.state === 'error') clientWait.reject(new Error(status.message || 'Update failed'));
  });
  const finish = () => { stopPack?.(); controls.finishInstall(summary); };
  cancel.onclick = () => { if (cancelled) return; cancelled = true; cancel.disabled = true; if (current?.kind === 'pack') controls.cancelPackInstall?.(current.id); if (current?.kind === 'client') clientWait?.reject(new Error('Cancelled')); };
  $('#close').onclick = () => { if (done) finish(); else cancel.click(); };
  let done = false;
  for (const item of items) {
    if (cancelled) break;
    current = item; index += 1; setBar(0); size.textContent = ''; phase.textContent = t('dlDownloading'); busy(false);
    last = line(fill(t('dlDownload'), { name: item.name, index, count }));
    try {
      if (item.kind === 'pack') await controls.installCatalogPack(item.id);
      else if (item.kind === 'theme') { busy(true); await controls.installCatalogTheme(item.id); installing(); }
      else {
        // The client itself: the Windows installer and the AppImage update themselves; the others open the download.
        const result = await controls.installUpdate?.(item.release, {});
        if (result?.mode === 'install' && controls.onUpdateStatus) { await new Promise((resolve, reject) => { clientWait = { resolve, reject }; }); installing(); restart = true; }
        else if (result?.mode === 'download') { line(t('dlOpened')); }
        else if (result?.state === 'permission') throw new Error('Permission denied');
        else { busy(true); installing(); }
      }
      if (last) last.textContent += ` ${t('dlDone')}`; busy(false);
      summary.ok.push(item);
    } catch (error) {
      const stopped = cancelled || /Cancelled/i.test(String(error?.message)); busy(false);
      const message = String(error?.message || error).replace(/^Error invoking remote method '[^']*': (Error: )?/, '');
      line(stopped ? t('dlCancelled') : fill(t('dlFailed'), { error: message }));
      if (!stopped) summary.failed.push({ item, error: message });
    }
    clientWait = null;
  }
  // XP ends with "Installation complete", a link to what was done and Close (Restart Now after a client update).
  done = true; summary.restart = restart;
  // Whatever was cancelled or failed is listed as not installed.
  const missed = items.filter(item => !summary.ok.some(ok => ok.id === item.id));
  for (const item of missed) if (!summary.failed.some(entry => entry.item.id === item.id)) summary.failed.push({ item, error: t('dlCancelled') });
  if (missed.length) {
    window.nkPlaySound?.('exclamation');
    $('#dl-panel').innerHTML = `<div class="dl-head done"><img src="assets/images/windows-update-48.png" alt=""><div><b>${esc(t('dlSome'))}</b>${restart ? `<p>${esc(t('dlRestartText'))}</p>` : ''}</div></div><div class="dl-label dl-missed-title"><b>${esc(t('dlNotInstalled'))}</b></div><div class="dl-missed">${missed.map(item => `<div>${esc(item.name)}</div>`).join('')}</div><div class="dl-buttons end"><a href="#" class="dl-link">${esc(t('dlConfigure'))}</a><span class="dl-buttons two">${restart ? `<button type="button" class="dl-cancel" data-do="restart">${esc(t('dlRestart'))}</button>` : ''}<button type="button" class="dl-cancel" data-do="close">${esc(t('dlClose'))}</button></span></div>`;
    $('[data-do="close"]').onclick = finish; $('[data-do="close"]').focus();
    $('[data-do="restart"]')?.addEventListener('click', () => controls.restartToUpdate?.());
    $('.dl-link').onclick = event => { event.preventDefault(); summary.go = 'history'; finish(); };
    return;
  }
  window.nkPlaySound?.('notify');
  $('#dl-panel').innerHTML = `<div class="dl-head done"><img src="assets/images/windows-update-48.png" alt=""><div><b>${esc(t('dlComplete'))}</b>${restart ? `<p>${esc(t('dlRestartText'))}</p>` : ''}</div></div><div class="dl-buttons end"><a href="#" class="dl-link">${esc(t('dlConfigure'))}</a><span class="dl-buttons two">${restart ? `<button type="button" class="dl-cancel" data-do="restart">${esc(t('dlRestart'))}</button>` : ''}<button type="button" class="dl-cancel" data-do="close">${esc(t('dlClose'))}</button></span></div>`;
  $('[data-do="close"]').onclick = finish; $('[data-do="close"]').focus();
  $('[data-do="restart"]')?.addEventListener('click', () => controls.restartToUpdate?.());
  $('.dl-link').onclick = event => { event.preventDefault(); summary.go = 'history'; finish(); };
}
Promise.all([controls.getActiveTheme(), controls.getDisplaySettings(), controls.getInstallJob()]).then(([theme, display, items]) => { applyFrame(theme); language = display?.language === 'en' ? 'en' : 'ru'; controls.onThemeChanged?.(applyFrame); if (items.length) run(items); else controls.finishInstall(summary); });

window.nkClickSounds?.();
