// Theme editor: loads a theme's theme.css, lets you change its colours, sizes and pictures
// (the --xp-* variables) with a live preview, and saves it as a new user theme.
const controls = window.windowControls;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const words = {
  ru: { title: 'Редактор тем', base: 'Основа:', load: 'Загрузить', name: 'Имя темы:', save: 'Сохранить', saveApply: 'Сохранить и применить', close: 'Закрыть',
    colours: 'Цвета', sizes: 'Размеры', title_: 'Заголовок', frame: 'Рамка окна', caption: 'Кнопки окна', buttons: 'Кнопки', checks: 'Флажки и группы', sliders: 'Ползунки', scroll: 'Полосы прокрутки', other: 'Другое',
    replace: 'Заменить…', reset: 'Вернуть', loading: 'Загрузка темы…', loaded: 'Тема загружена. Изменения сразу видны справа.', saving: 'Сохранение…', saved: name => `Тема «${name}» сохранена. Она есть в «Свойствах экрана».`, applied: name => `Тема «${name}» сохранена и применена.`,
    sizeWarn: (w, h, ow, oh) => `Картинка ${w}×${h}, а в теме была ${ow}×${oh}. У картинок с несколькими состояниями раскладка должна совпадать.`, unsaved: 'Есть несохранённые изменения. Закрыть?', copyOf: name => `${name} (моя)`, empty: 'В этой группе нечего менять.' },
  en: { title: 'Theme Editor', base: 'Based on:', load: 'Load', name: 'Theme name:', save: 'Save', saveApply: 'Save and apply', close: 'Close',
    colours: 'Colours', sizes: 'Sizes', title_: 'Title bar', frame: 'Window frame', caption: 'Caption buttons', buttons: 'Buttons', checks: 'Check boxes and groups', sliders: 'Sliders', scroll: 'Scroll bars', other: 'Other',
    replace: 'Replace…', reset: 'Reset', loading: 'Loading the theme…', loaded: 'Theme loaded. Changes show on the right at once.', saving: 'Saving…', saved: name => `Theme “${name}” saved. It is listed in Display Properties.`, applied: name => `Theme “${name}” saved and applied.`,
    sizeWarn: (w, h, ow, oh) => `The picture is ${w}×${h}; the theme's was ${ow}×${oh}. Pictures with several states must keep the same layout.`, unsaved: 'You have unsaved changes. Close anyway?', copyOf: name => `${name} (mine)`, empty: 'Nothing to change in this group.' },
};
let language = 'ru';
const t = (key, ...args) => { const value = words[language][key]; return typeof value === 'function' ? value(...args) : value; };
// Picture groups by variable name; "frame-states" describes the artwork layout and is not edited.
const GROUPS = [
  ['colours', null], ['title_', /^--xp-title-/], ['frame', /^--xp-(frame|bottom)-/], ['caption', /^--xp-(caption|close|minimize|maximize)-/],
  ['buttons', /^--xp-button-/], ['checks', /^--xp-(checkbox|groupbox|field)/], ['sliders', /^--xp-slider-/], ['scroll', /^--xp-scroll-/], ['sizes', null], ['other', null],
];
const LOCKED = new Set(['--xp-frame-states']);
let themes = []; let css = ''; let declarations = []; let edits = new Map(); let images = new Map(); let group = 'colours'; let dirty = false; let loadedFrom = null; let previewUrl = '';

function status(text, error = false) { $('#editor-status').textContent = text; $('#editor-status').classList.toggle('error', error); }
const kindOf = value => /url\(/i.test(value) ? 'image' : /^#[0-9a-f]{3,8}$/i.test(value.trim()) ? 'colour' : /^-?\d+(\.\d+)?(px)?$/.test(value.trim()) ? 'size' : 'other';
const groupOf = item => item.kind === 'colour' ? 'colours' : item.kind === 'size' ? 'sizes' : item.kind === 'image' ? (GROUPS.find(([, pattern]) => pattern?.test(item.name))?.[0] || 'other') : 'other';
const urlOf = value => value.match(/url\((["']?)([^"')]+)\1\)/)?.[2] || '';
const label = name => name.replace(/^--xp-/, '').replace(/-/g, ' ');
const fullHex = value => { const hex = value.trim().slice(1); return `#${hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex.slice(0, 6)}`.toLowerCase(); };

// Every custom property, first declaration of each name only (that is the one :root sets).
function parse(text) {
  const seen = new Set(); const found = [];
  for (const match of text.matchAll(/(--xp-[\w-]+)\s*:\s*([^;}]+)/g)) {
    if (seen.has(match[1]) || LOCKED.has(match[1])) continue; seen.add(match[1]);
    const start = match.index + match[0].length - match[2].length;
    found.push({ name: match[1], value: match[2].trim(), start, end: start + match[2].length, kind: kindOf(match[2]) });
  }
  return found;
}
function valueFor(item, forSave) {
  if (images.has(item.name)) return forSave ? `url("edited:${item.name.slice(2)}.png")` : `url("${images.get(item.name).dataUrl}")`;
  return edits.has(item.name) ? edits.get(item.name) : item.value;
}
function build(forSave = false) {
  let output = ''; let at = 0;
  for (const item of [...declarations].sort((a, b) => a.start - b.start)) { output += css.slice(at, item.start) + valueFor(item, forSave); at = item.end; }
  return output + css.slice(at);
}
let previewTimer = null;
function updatePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(new Blob([build()], { type: 'text/css' }));
    $('#editor-preview').contentWindow?.postMessage({ type: 'theme-editor-preview', cssUrl: previewUrl }, '*');
  }, 60);
}
$('#editor-preview').addEventListener('load', updatePreview);

function renderGroups() {
  const counts = new Map(); declarations.forEach(item => counts.set(groupOf(item), (counts.get(groupOf(item)) || 0) + 1));
  $('#editor-groups').innerHTML = GROUPS.filter(([id]) => counts.get(id)).map(([id]) => `<button type="button" class="editor-group${id === group ? ' active' : ''}" data-group="${id}">${esc(t(id))} <small>${counts.get(id)}</small></button>`).join('');
}
function renderList() {
  const items = declarations.filter(item => groupOf(item) === group);
  $('#editor-list').innerHTML = items.length ? items.map(item => {
    const changed = images.has(item.name) || edits.has(item.name); const value = valueFor(item);
    let control = '';
    if (item.kind === 'colour') control = `<input type="color" value="${esc(fullHex(value))}" data-colour="${esc(item.name)}"><code>${esc(value)}</code>`;
    else if (item.kind === 'size') control = `<input type="number" value="${esc(parseFloat(value))}" step="1" data-size="${esc(item.name)}" data-unit="${/px$/.test(item.value) ? 'px' : ''}"><code>${/px$/.test(item.value) ? 'px' : ''}</code>`;
    else if (item.kind === 'image') control = `<span class="editor-thumb"><img src="${esc(urlOf(value))}" alt="" data-thumb="${esc(item.name)}"></span><span class="editor-size" data-dims="${esc(item.name)}"></span><button type="button" data-replace="${esc(item.name)}">${esc(t('replace'))}</button>`;
    else control = `<input type="text" value="${esc(value)}" data-text-value="${esc(item.name)}">`;
    return `<div class="editor-row${changed ? ' changed' : ''}"><span class="editor-label" title="${esc(item.name)}">${esc(label(item.name))}</span><span class="editor-control">${control}${changed ? `<button type="button" class="editor-reset" data-reset="${esc(item.name)}">${esc(t('reset'))}</button>` : ''}</span></div>`;
  }).join('') : `<p class="editor-empty">${esc(t('empty'))}</p>`;
  // Picture sizes: shown so a replacement can keep the layout of multi-state sprites.
  $('#editor-list').querySelectorAll('img[data-thumb]').forEach(img => img.addEventListener('load', () => { const dims = $('#editor-list').querySelector(`[data-dims="${CSS.escape(img.dataset.thumb)}"]`); if (dims) dims.textContent = `${img.naturalWidth}×${img.naturalHeight}`; }, { once: true }));
}
function changed() { dirty = true; renderGroups(); updatePreview(); }
$('#editor-groups').onclick = event => { const button = event.target.closest('[data-group]'); if (!button) return; group = button.dataset.group; renderGroups(); renderList(); };
$('#editor-list').addEventListener('input', event => {
  const target = event.target;
  if (target.dataset.colour) { edits.set(target.dataset.colour, target.value); target.nextElementSibling.textContent = target.value; target.closest('.editor-row').classList.add('changed'); changed(); }
  else if (target.dataset.size && target.value !== '') { edits.set(target.dataset.size, `${Number(target.value)}${target.dataset.unit}`); target.closest('.editor-row').classList.add('changed'); changed(); }
  else if (target.dataset.textValue) { edits.set(target.dataset.textValue, target.value.replace(/[;{}]/g, '')); changed(); }
});
$('#editor-list').addEventListener('change', event => { if (event.target.matches('input[type="color"], input[type="number"], input[data-text-value]')) renderList(); });
let replacing = null;
$('#editor-list').addEventListener('click', event => {
  const replace = event.target.closest('[data-replace]'); const reset = event.target.closest('[data-reset]');
  if (replace) { replacing = replace.dataset.replace; $('#image-file').click(); }
  if (reset) { edits.delete(reset.dataset.reset); images.delete(reset.dataset.reset); changed(); renderList(); }
});
$('#image-file').onchange = async () => {
  const file = $('#image-file').files[0]; $('#image-file').value = ''; if (!file || !replacing) return;
  const name = replacing; replacing = null;
  // Stored as PNG whatever the source format, so saved themes only hold PNG pictures.
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; canvas.getContext('2d').drawImage(bitmap, 0, 0);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const data = new Uint8Array(await blob.arrayBuffer()); const dataUrl = canvas.toDataURL('image/png');
  const original = declarations.find(item => item.name === name);
  const old = await new Promise(resolve => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = urlOf(original.value); });
  images.set(name, { data, dataUrl }); changed(); renderList();
  status(old && (old.naturalWidth !== bitmap.width || old.naturalHeight !== bitmap.height) ? t('sizeWarn', bitmap.width, bitmap.height, old.naturalWidth, old.naturalHeight) : '', Boolean(old && (old.naturalWidth !== bitmap.width || old.naturalHeight !== bitmap.height)));
};

function fillSchemes(selected) {
  const theme = themes.find(item => item.id === $('#base-theme').value);
  const schemes = theme?.schemes?.length ? theme.schemes : [{ id: '', name: 'Default' }];
  $('#base-scheme').innerHTML = schemes.map(scheme => `<option value="${esc(scheme.id)}">${esc(scheme.name)}</option>`).join('');
  if (selected && schemes.some(scheme => scheme.id === selected)) $('#base-scheme').value = selected;
  $('#base-scheme').hidden = schemes.length < 2;
}
async function loadBase() {
  if (dirty && !confirm(t('unsaved'))) return;
  status(t('loading'));
  try {
    const theme = themes.find(item => item.id === $('#base-theme').value);
    const loaded = await controls.loadThemeForEditor($('#base-theme').value, $('#base-scheme').value || undefined);
    css = loaded.css; declarations = parse(css); edits = new Map(); images = new Map(); dirty = false;
    loadedFrom = { id: loaded.id, scheme: loaded.scheme };
    // Editing a theme made here keeps its name; anything else starts as a copy.
    $('#theme-name').value = theme?.editable ? theme.id : t('copyOf', theme?.name || loaded.id);
    if (!declarations.some(item => groupOf(item) === group)) group = 'colours';
    renderGroups(); renderList(); updatePreview(); status(t('loaded'));
  } catch (error) { status(error.message, true); }
}
$('#base-theme').onchange = () => fillSchemes();
$('#load-base').onclick = loadBase;

async function save(apply) {
  status(t('saving'));
  try {
    const payload = { name: $('#theme-name').value, css: build(true), base: loadedFrom, images: Object.fromEntries([...images].map(([name, image]) => [`${name.slice(2)}.png`, image.data])) };
    const result = await controls.saveEditedTheme(payload);
    themes = result.themes; dirty = false;
    const selected = result.id;
    $('#base-theme').innerHTML = themes.map(theme => `<option value="${esc(theme.id)}">${esc(theme.name)}</option>`).join(''); $('#base-theme').value = selected; fillSchemes();
    if (apply) { await controls.applyTheme(selected); try { localStorage.setItem('nk_active_theme', selected); localStorage.setItem('nk_active_scheme', ''); } catch {} }
    status(t(apply ? 'applied' : 'saved', selected));
  } catch (error) { status(error.message, true); }
}
$('#save').onclick = () => save(false);
$('#save-apply').onclick = () => save(true);
const close = () => { if (!dirty || confirm(t('unsaved'))) controls.close(); };
$('#close').onclick = close; $('#cancel').onclick = close;

function applyText() {
  document.documentElement.lang = language; document.title = t('title');
  document.querySelectorAll('[data-text]').forEach(node => { node.textContent = t(node.dataset.text); });
}
controls.onThemeChanged?.(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; });
Promise.all([controls.getDisplaySettings().catch(() => ({})), controls.getActiveTheme(), controls.listThemes()]).then(async ([settings, active, list]) => {
  language = settings?.language === 'en' ? 'en' : 'ru'; applyText();
  if (active?.cssUrl) $('#frame-theme').href = active.cssUrl;
  themes = list;
  $('#base-theme').innerHTML = themes.map(theme => `<option value="${esc(theme.id)}">${esc(theme.name)}</option>`).join('');
  const start = themes.some(theme => theme.id === active?.id) ? active.id : themes.find(theme => theme.id === 'Luna')?.id || themes[0]?.id;
  if (start) { $('#base-theme').value = start; fillSchemes(active?.id === start ? active.scheme : undefined); await loadBase(); }
}).catch(error => status(error.message, true));
// XP click sound on buttons, like in the other windows.
document.addEventListener('click', event => { if (!event.target.closest?.('button')) return; let scheme = 'xp', volume = 72; try { scheme = localStorage.getItem('nk_sound_scheme') || 'xp'; volume = Number(localStorage.getItem('nk_sound_volume') ?? 72); } catch {} if (scheme === 'none' || !(volume > 0)) return; const audio = new Audio(window.nkSoundUrl ? window.nkSoundUrl('navigation') : 'assets/sounds/navigation.wav'); audio.volume = Math.min(1, volume / 100); audio.play().catch(() => {}); });
