// The HTML Help viewer of Windows XP (hh.exe), for a program's own Help: Hide/Show, Back,
// Forward and Options; the Contents, Index and Search tabs; the topic on the right. The
// Minesweeper book and "Using the Help Viewer" are the texts of winmine.chm and nthelp.chm
// from Windows XP (English as they are, and in Russian).
const controls = window.windowControls;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const words = {
  ru: { title: 'Сапёр', hide: 'Скрыть', show: 'Показать', back: 'Назад', forward: 'Вперёд', options: 'Параметры', contents: 'Содержание', index: 'Указатель', search: 'Поиск', keyword: 'Введите ключевое слово для поиска:', display: 'Показать', words: 'Введите слова для поиска:', list: 'Разделы', found: 'Найдено разделов: {count}', related: 'См. также', close: 'Закрыть', menuHide: 'Скрыть вкладки', menuShow: 'Показать вкладки', menuBack: 'Назад', menuForward: 'Вперёд', menuPrint: 'Печать...' },
  en: { title: 'Minesweeper', hide: 'Hide', show: 'Show', back: 'Back', forward: 'Forward', options: 'Options', contents: 'Contents', index: 'Index', search: 'Search', keyword: 'Type in the keyword to find:', display: 'Display', words: 'Type in the word(s) to search for:', list: 'List Topics', found: 'Found: {count}', related: 'Related Topics', close: 'Close', menuHide: 'Hide Tabs', menuShow: 'Show Tabs', menuBack: 'Back', menuForward: 'Forward', menuPrint: 'Print...' },
};
const expand = (title, body) => `<p class="hh-expand"><a href="#" data-expand><img src="assets/images/hh/plus.png" alt="">${title}</a></p><div class="hh-expanded" hidden>${body}</div>`;
const BOOKS = {
  en: [
    { title: 'Minesweeper', topics: [
      { id: 'object', title: 'Minesweeper overview', keys: ['Minesweeper', 'games'], html: '<h1>Minesweeper overview</h1><p>The object of Minesweeper is to locate all the mines as quickly as possible without uncovering any of them. If you uncover a mine, you lose the game.</p>', related: ['customize', 'play', 'tips'] },
      { id: 'play', title: 'Play Minesweeper', keys: ['playing Minesweeper', 'timer', 'mine counter'], html: '<p class="hh-proc">To play Minesweeper</p><ol><li>On the <b>Game</b> menu, click <b>New</b>.</li><li>To start the timer, click any square on the playing field.</li></ol><p class="hh-note">Notes</p><ul><li>You can uncover a square by clicking it. If you uncover a mine, you lose the game.</li><li>If a number appears on a square, it indicates how many mines are in the eight squares that surround the numbered one.</li><li>To mark a square you suspect contains a mine, right-click it.</li><li>The game area consists of the playing field, a mine counter, and a timer.</li></ul>', related: ['customize', 'object', 'tips'] },
      { id: 'customize', title: 'Customize the playing field', keys: ['playing field', 'levels'], html: '<p class="hh-proc">To customize the playing field</p><ol><li>On the <b>Game</b> menu, click <b>Beginner</b>, <b>Intermediate</b> or <b>Expert</b>.</li><li>Beginner is 9 × 9 squares with 10 mines, Intermediate 16 × 16 with 40, Expert 30 × 16 with 99.</li></ol>', related: ['play', 'object', 'tips'] },
      { id: 'tips', title: 'Strategies and tips', keys: ['strategies', 'question mark', 'tips'], html: '<h1>Strategies and tips</h1><ul><li>If you are uncertain about a square, right-click it twice to mark it with a question mark (?). Later, you can either mark the square as a mine or remove the markings by right-clicking the square again once or twice.</li><li>If you have marked all the mines around a numbered square, you can uncover the remaining squares around it by clicking the numbered square with the left and right mouse buttons simultaneously.</li><li>Look for common patterns in numbers, which often indicate a corresponding pattern of mines. For example, the pattern 2-3-2 at the edge of a group of uncovered squares indicates a row of three mines next to the three numbers.</li></ul>', related: ['customize', 'object', 'play'] },
    ] },
    { title: 'Using the Help Viewer', topics: [
      { id: 'hh-overview', title: 'Help viewer overview', keys: ['Help viewer'], html: '<h1>Help viewer overview</h1><p>The Help viewer is the window you are looking at now. It is used to provide Help that is specific to certain programs and features, such as Minesweeper.</p><p>You can adjust the size of the Help viewer or hide the navigation pane if you need to place the Help viewer beside the program you are using.</p><p>For more comprehensive Help about Nekochat Reloaded, open <b>Help and Support</b> in the Control Panel.</p>', related: ['hh-use', 'hh-modify', 'hh-keys'] },
      { id: 'hh-use', title: 'Getting Help', keys: ['Contents tab', 'Index tab', 'Search tab'], html: '<h1>Getting Help</h1><p>The Help viewer makes it easy for you to find information about the feature you are using. The <b>Contents</b>, <b>Index</b>, and <b>Search</b> tabs display helpful information. Click a heading below for detailed information.</p>' + expand('Contents tab', '<p>To browse the table of contents, click the <b>Contents</b> tab. Click the book icons to reveal topic entries. Click a table of contents entry to display the corresponding topic.</p>') + expand('Index tab', '<p>To see a list of index entries, click the <b>Index</b> tab, and then either type a word or scroll through the list. Double-click an index entry to display the corresponding topic.</p>') + expand('Search tab', '<p>To search for a word or phrase, click the <b>Search</b> tab, type the word or phrase, and then click <b>List Topics</b>. Double-click a search results entry to display the corresponding topic.</p>'), related: ['hh-overview', 'hh-modify', 'hh-keys'] },
      { id: 'hh-modify', title: 'Modifying the Help viewer', keys: ['Hide button', 'Show button'], html: '<h1>Modifying the Help viewer</h1><p>You can hide the left (navigation) pane of the Help viewer to make the window smaller, and adjust the size of the window from any side or corner.</p>' + expand('Hide or show the Help navigation pane', '<ul><li>On the Help toolbar, click <b>Hide</b> (<img src="assets/images/hh/hide.png" alt="">) to hide the navigation pane, which includes the <b>Contents</b>, <b>Index</b>, and <b>Search</b> tabs.</li><li>On the Help toolbar, click <b>Show</b> (<img src="assets/images/hh/show.png" alt="">) to display the navigation pane.</li></ul>'), related: ['hh-overview', 'hh-use', 'hh-keys'] },
      { id: 'hh-keys', title: 'Using Help viewer keyboard shortcuts', keys: ['keyboard shortcuts'], html: '<h1>Using Help viewer keyboard shortcuts</h1><p>If you prefer to use your keyboard, you can use the following keyboard commands in the Help viewer.</p>' + expand('Help Viewer keyboard shortcuts', '<table class="hh-table"><tr><th>Press</th><th>To</th></tr><tr><td>ALT+LEFT ARROW</td><td>Move back to the previously viewed topic.</td></tr><tr><td>ALT+RIGHT ARROW</td><td>Move forward to the next (previously viewed) topic.</td></tr><tr><td>CTRL+TAB</td><td>Switch to the next tab in the navigation pane.</td></tr><tr><td>CTRL+P</td><td>Print a topic.</td></tr><tr><td>ESC</td><td>Close the Help viewer.</td></tr></table>'), related: ['hh-overview', 'hh-use', 'hh-modify'] },
    ] },
  ],
  ru: [
    { title: 'Сапёр', topics: [
      { id: 'object', title: 'Общие сведения о «Сапёре»', keys: ['Сапёр', 'игры'], html: '<h1>Общие сведения о «Сапёре»</h1><p>Цель игры «Сапёр» — как можно быстрее найти все мины, не открыв ни одной из них. Если открыть мину, игра проиграна.</p>', related: ['customize', 'play', 'tips'] },
      { id: 'play', title: 'Как играть в «Сапёр»', keys: ['игра в Сапёр', 'таймер', 'счётчик мин'], html: '<p class="hh-proc">Как играть в «Сапёр»</p><ol><li>В меню <b>Игра</b> выберите <b>Новая игра</b>.</li><li>Чтобы запустить таймер, щёлкните любую клетку игрового поля.</li></ol><p class="hh-note">Примечания</p><ul><li>Клетка открывается щелчком. Если открыть мину, игра проиграна.</li><li>Цифра на клетке показывает, сколько мин в восьми соседних клетках.</li><li>Чтобы пометить клетку, в которой, по-вашему, мина, щёлкните её правой кнопкой.</li><li>Игровое поле состоит из клеток, счётчика мин и таймера.</li></ul>', related: ['customize', 'object', 'tips'] },
      { id: 'customize', title: 'Настройка игрового поля', keys: ['игровое поле', 'уровни'], html: '<p class="hh-proc">Как настроить игровое поле</p><ol><li>В меню <b>Игра</b> выберите <b>Новичок</b>, <b>Любитель</b> или <b>Профессионал</b>.</li><li>Новичок — поле 9 × 9 и 10 мин, Любитель — 16 × 16 и 40 мин, Профессионал — 30 × 16 и 99 мин.</li></ol>', related: ['play', 'object', 'tips'] },
      { id: 'tips', title: 'Стратегии и советы', keys: ['стратегия', 'вопросительный знак', 'советы'], html: '<h1>Стратегии и советы</h1><ul><li>Если вы не уверены насчёт клетки, дважды щёлкните её правой кнопкой, чтобы пометить вопросительным знаком (?). Потом можно пометить клетку как мину или снять пометку, щёлкнув её правой кнопкой ещё раз или два.</li><li>Если вокруг клетки с цифрой помечены все мины, остальные соседние клетки можно открыть, щёлкнув цифру левой и правой кнопками одновременно (или дважды щёлкнув её).</li><li>Ищите знакомые сочетания цифр — они подсказывают, где мины. Например, 2-3-2 у края открытой области означает три мины подряд рядом с этими цифрами.</li></ul>', related: ['customize', 'object', 'play'] },
    ] },
    { title: 'Использование средства просмотра справки', topics: [
      { id: 'hh-overview', title: 'Средство просмотра справки', keys: ['средство просмотра справки'], html: '<h1>Средство просмотра справки</h1><p>Средство просмотра справки — это окно, которое вы сейчас видите. В нём показывается справка по отдельным программам, например по «Сапёру».</p><p>Можно изменить размер окна или скрыть левую панель, чтобы разместить справку рядом с программой.</p><p>Полная справка по Nekochat Reloaded — в <b>Справке и поддержке</b> (Панель управления).</p>', related: ['hh-use', 'hh-modify', 'hh-keys'] },
      { id: 'hh-use', title: 'Получение справки', keys: ['вкладка Содержание', 'вкладка Указатель', 'вкладка Поиск'], html: '<h1>Получение справки</h1><p>Вкладки <b>Содержание</b>, <b>Указатель</b> и <b>Поиск</b> помогают быстро найти нужные сведения. Щёлкните заголовок ниже, чтобы узнать подробнее.</p>' + expand('Вкладка «Содержание»', '<p>Щёлкайте значки книг, чтобы раскрыть разделы. Щелчок по разделу открывает его справа.</p>') + expand('Вкладка «Указатель»', '<p>Введите слово или прокрутите список ключевых слов. Двойной щелчок по слову открывает раздел.</p>') + expand('Вкладка «Поиск»', '<p>Введите слово или фразу и нажмите <b>Разделы</b>. Двойной щелчок по найденному разделу открывает его.</p>'), related: ['hh-overview', 'hh-modify', 'hh-keys'] },
      { id: 'hh-modify', title: 'Настройка средства просмотра справки', keys: ['кнопка Скрыть', 'кнопка Показать'], html: '<h1>Настройка средства просмотра справки</h1><p>Левую панель можно скрыть, чтобы окно стало меньше, а размер окна менять за любой край или угол.</p>' + expand('Скрытие и отображение панели навигации', '<ul><li>Нажмите <b>Скрыть</b> (<img src="assets/images/hh/hide.png" alt="">) на панели инструментов, чтобы скрыть вкладки <b>Содержание</b>, <b>Указатель</b> и <b>Поиск</b>.</li><li>Нажмите <b>Показать</b> (<img src="assets/images/hh/show.png" alt="">), чтобы снова их показать.</li></ul>'), related: ['hh-overview', 'hh-use', 'hh-keys'] },
      { id: 'hh-keys', title: 'Сочетания клавиш в справке', keys: ['сочетания клавиш'], html: '<h1>Сочетания клавиш в справке</h1><p>В средстве просмотра справки можно пользоваться клавиатурой.</p>' + expand('Сочетания клавиш', '<table class="hh-table"><tr><th>Клавиши</th><th>Действие</th></tr><tr><td>ALT+СТРЕЛКА ВЛЕВО</td><td>Вернуться к предыдущему разделу.</td></tr><tr><td>ALT+СТРЕЛКА ВПРАВО</td><td>Перейти к следующему просмотренному разделу.</td></tr><tr><td>CTRL+TAB</td><td>Перейти на следующую вкладку.</td></tr><tr><td>CTRL+P</td><td>Напечатать раздел.</td></tr><tr><td>ESC</td><td>Закрыть справку.</td></tr></table>'), related: ['hh-overview', 'hh-use', 'hh-modify'] },
    ] },
  ],
};
let language = 'ru';
const t = (key, values = {}) => String(words[language][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
const books = () => BOOKS[language];
const topics = () => books().flatMap(book => book.topics);
const topicById = id => topics().find(topic => topic.id === id);
let current = 'object', tab = 'contents';
const openBooks = new Set([0]);
const back = [], forward = [];
function show(id, remember = true) { if (!topicById(id)) return; if (remember && id !== current) { back.push(current); forward.length = 0; } current = id; render(); }
function renderPanel() {
  const panel = $('#hh-panel');
  document.querySelectorAll('.hh-tabs button').forEach(button => { button.classList.toggle('active', button.dataset.tab === tab); button.textContent = t(button.dataset.tab); });
  if (tab === 'contents') {
    panel.innerHTML = `<div class="hh-tree">${books().map((book, index) => `<a href="#" class="hh-node" data-book="${index}"><img src="assets/images/hh/${openBooks.has(index) ? 'book-open' : 'book'}.png" alt="">${esc(book.title)}</a>${openBooks.has(index) ? `<div class="hh-children">${book.topics.map(topic => `<a href="#" class="hh-node${topic.id === current ? ' selected' : ''}" data-topic="${topic.id}"><img src="assets/images/hh/page.png" alt="">${esc(topic.title)}</a>`).join('')}</div>` : ''}`).join('')}</div>`;
  } else if (tab === 'index') {
    const entries = topics().flatMap(topic => topic.keys.map(key => [key, topic.id])).sort((a, b) => a[0].localeCompare(b[0], language));
    panel.innerHTML = `<label class="hh-label">${esc(t('keyword'))}<input id="hh-key" type="search"></label><div class="hh-list" id="hh-index">${entries.map(([key, id]) => `<a href="#" data-topic="${id}" data-key="${esc(key.toLowerCase())}">${esc(key)}</a>`).join('')}</div><div class="hh-panel-buttons"><button type="button" id="hh-display">${esc(t('display'))}</button></div>`;
    $('#hh-key').oninput = () => { const value = $('#hh-key').value.toLowerCase(); const first = [...panel.querySelectorAll('#hh-index a')].find(link => link.dataset.key.startsWith(value)); panel.querySelectorAll('#hh-index a').forEach(link => link.classList.toggle('selected', link === first)); first?.scrollIntoView({ block: 'nearest' }); };
    $('#hh-display').onclick = () => { const selected = panel.querySelector('#hh-index a.selected'); if (selected) show(selected.dataset.topic); };
  } else {
    panel.innerHTML = `<label class="hh-label">${esc(t('words'))}<input id="hh-words" type="search"></label><div class="hh-panel-buttons"><button type="button" id="hh-list">${esc(t('list'))}</button></div><p class="hh-count" id="hh-count"></p><div class="hh-list" id="hh-results"></div>`;
    const run = () => { const value = $('#hh-words').value.trim().toLowerCase(); if (!value) return; const hits = topics().filter(topic => (topic.title + ' ' + topic.html.replace(/<[^>]+>/g, ' ')).toLowerCase().includes(value)); $('#hh-count').textContent = t('found', { count: hits.length }); $('#hh-results').innerHTML = hits.map(topic => `<a href="#" data-topic="${topic.id}">${esc(topic.title)}</a>`).join(''); };
    $('#hh-list').onclick = run; $('#hh-words').onkeydown = event => { if (event.key === 'Enter') run(); };
  }
}
function render() {
  const topic = topicById(current);
  $('#hh-topic').innerHTML = `${topic.html}${topic.related?.length ? `<p class="hh-related"><a href="#" data-related>${esc(t('related'))}</a></p><ul class="hh-related-list" hidden>${topic.related.map(id => `<li><a href="#" data-topic="${id}">${esc(topicById(id)?.title || id)}</a></li>`).join('')}</ul>` : ''}`;
  renderPanel();
  $('#hh-back').disabled = !back.length; $('#hh-forward').disabled = !forward.length;
}
document.addEventListener('click', event => {
  const book = event.target.closest('[data-book]'); if (book) { event.preventDefault(); const index = Number(book.dataset.book); if (openBooks.has(index)) openBooks.delete(index); else openBooks.add(index); renderPanel(); return; }
  const topic = event.target.closest('[data-topic]'); if (topic) { event.preventDefault(); if (topic.closest('#hh-index')) { $('#hh-panel').querySelectorAll('#hh-index a').forEach(link => link.classList.toggle('selected', link === topic)); if (event.detail < 2) return; } show(topic.dataset.topic); return; }
  const expander = event.target.closest('[data-expand]'); if (expander) { event.preventDefault(); const body = expander.parentElement.nextElementSibling; body.hidden = !body.hidden; expander.querySelector('img').src = `assets/images/hh/${body.hidden ? 'plus' : 'minus'}.png`; return; }
  const related = event.target.closest('[data-related]'); if (related) { event.preventDefault(); const list = related.parentElement.nextElementSibling; list.hidden = !list.hidden; return; }
  const tabButton = event.target.closest('.hh-tabs [data-tab]'); if (tabButton) { tab = tabButton.dataset.tab; renderPanel(); }
});
document.addEventListener('dblclick', event => { const topic = event.target.closest('#hh-index [data-topic]'); if (topic) show(topic.dataset.topic); });
$('#hh-back').onclick = () => { if (!back.length) return; forward.push(current); current = back.pop(); render(); };
$('#hh-forward').onclick = () => { if (!forward.length) return; back.push(current); current = forward.pop(); render(); };
$('#hh-hide').onclick = () => { const hidden = document.querySelector('.hh').classList.toggle('hh-nav-hidden'); $('#hh-hide img').src = `assets/images/hh/${hidden ? 'show' : 'hide'}.png`; $('#hh-hide span').textContent = t(hidden ? 'show' : 'hide'); };
// Options: a small menu, like the viewer's.
$('#hh-options').onclick = event => {
  event.stopPropagation(); document.querySelector('.hh-menu')?.remove();
  const menu = document.createElement('div'); menu.className = 'hh-menu';
  const hidden = document.querySelector('.hh').classList.contains('hh-nav-hidden');
  menu.innerHTML = `<button type="button" data-command="hide">${esc(t(hidden ? 'menuShow' : 'menuHide'))}</button><button type="button" data-command="back"${back.length ? '' : ' disabled'}>${esc(t('menuBack'))}</button><button type="button" data-command="forward"${forward.length ? '' : ' disabled'}>${esc(t('menuForward'))}</button><hr><button type="button" data-command="print">${esc(t('menuPrint'))}</button>`;
  const rect = $('#hh-options').getBoundingClientRect(); menu.style.left = `${rect.left}px`; menu.style.top = `${rect.bottom}px`; document.body.append(menu);
  menu.onclick = click => { const command = click.target.closest('[data-command]')?.dataset.command; menu.remove(); if (command === 'hide') $('#hh-hide').click(); if (command === 'back') $('#hh-back').click(); if (command === 'forward') $('#hh-forward').click(); if (command === 'print') window.print(); };
};
document.addEventListener('click', () => document.querySelector('.hh-menu')?.remove());
document.addEventListener('keydown', event => {
  if (event.altKey && event.key === 'ArrowLeft') $('#hh-back').click();
  if (event.altKey && event.key === 'ArrowRight') $('#hh-forward').click();
  if (event.ctrlKey && event.key === 'Tab') { event.preventDefault(); const order = ['contents', 'index', 'search']; tab = order[(order.indexOf(tab) + 1) % 3]; renderPanel(); }
  if (event.key === 'Escape') controls.close();
});
$('#close').onclick = () => controls.close();
function applyText() {
  document.documentElement.lang = language; document.title = t('title'); $('#hh-title').textContent = t('title');
  const hidden = document.querySelector('.hh').classList.contains('hh-nav-hidden');
  $('#hh-hide span').textContent = t(hidden ? 'show' : 'hide'); $('#hh-back span').textContent = t('back'); $('#hh-forward span').textContent = t('forward'); $('#hh-options span').textContent = t('options');
  $('#close').setAttribute('aria-label', t('close'));
  render();
}
controls.getActiveTheme().then(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; });
controls.onThemeChanged(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; });
controls.getDisplaySettings().then(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); });
applyText();
