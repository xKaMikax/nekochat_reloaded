// Minesweeper, like Windows XP's (pictures and sounds from winmine.exe). ?level=&seed= plays a
// challenge from a chat: the same seed gives everyone the same field, and a win sends the time
// back to that chat (?chat=room:1) through localStorage (nk_game_result, read by nekochat.js).
const controls = window.windowControls;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const LEVELS = { beginner: [9, 9, 10], intermediate: [16, 16, 40], expert: [30, 16, 99] };
const words = {
  ru: { title: 'Сапёр', game: 'Игра', help: 'Справка', new: 'Новая игра', beginner: 'Новичок', intermediate: 'Любитель', expert: 'Профессионал', sound: 'Звук', best: 'Чемпионы...', exit: 'Выход', about: 'О программе «Сапёр»', rules: 'Вызов справки',
    rulesText: 'Откройте все клетки без мин. Цифра — сколько мин рядом. Правая кнопка ставит флажок, повторно — «?». Двойной щелчок или средняя кнопка по цифре открывает соседние клетки, если флажков вокруг столько же.',
    bestTitle: 'Чемпионы', none: 'ещё никого', seconds: '{time} с', challenge: 'Вызов из чата: у всех одно и то же поле. Кто пройдёт быстрее?', won: '💣 Сапёр ({level}): прошёл за {time} с', lost: '💥 Сапёр ({level}): подорвался на {time} с', sent: 'Результат отправлен в чат.', close: 'Закрыть' },
  en: { title: 'Minesweeper', game: 'Game', help: 'Help', new: 'New', beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert', sound: 'Sound', best: 'Best Times...', exit: 'Exit', about: 'About Minesweeper', rules: 'Contents',
    rulesText: 'Open every square that has no mine. A number tells how many mines touch it. Right-click flags a square, again for "?". Double-click or middle-click a number to open its neighbours when as many flags are around it.',
    bestTitle: 'Fastest Mine Sweepers', none: 'nobody yet', seconds: '{time} seconds', challenge: 'Challenge from a chat: everyone gets the same field. Who is fastest?', won: '💣 Minesweeper ({level}): cleared in {time} s', lost: '💥 Minesweeper ({level}): blew up at {time} s', sent: 'The result was sent to the chat.', close: 'Close' },
};
let language = 'ru';
const t = (key, values = {}) => String(words[language][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
const params = new URLSearchParams(location.search);
const challenge = { level: LEVELS[params.get('level')] ? params.get('level') : '', seed: Number(params.get('seed')) || 0, chat: /^(room|dm):\d+$/.test(params.get('chat') || '') ? params.get('chat') : '' };
let level = challenge.level || (() => { try { return localStorage.getItem('nk_mine_level') || 'beginner'; } catch { return 'beginner'; } })();
if (!LEVELS[level]) level = 'beginner';
// Like XP's, the game is silent until Game → Sound is turned on.
let soundOn = (() => { try { return localStorage.getItem('nk_mine_sound') === '1'; } catch { return false; } })();

// Pictures: cells.png (16 × 16 each, top to bottom), digits.png (13 × 23), faces.png (24 × 24).
const CELL = { hidden: 0, flag: 1, question: 2, exploded: 3, wrong: 4, mine: 5, questionOpen: 6, open: 15 };
const cellOffset = index => `0 -${index * 16}px`;
const numberCell = count => (count === 0 ? 15 : 15 - count);
const FACE = { down: 0, win: 1, dead: 2, ooh: 3, smile: 4 };
const DIGIT = { '-': 0, ' ': 1 }; for (let n = 0; n <= 9; n += 1) DIGIT[String(n)] = 11 - n;

// Seeded random numbers (mulberry32) so a challenge's field is the same for everyone.
function random(seed) { let state = seed >>> 0; return () => { state += 0x6D2B79F5; let value = state; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; }; }
let cols, rows, mines, field, state, timer, seconds, started, finished, flags;
function newGame() {
  [cols, rows, mines] = LEVELS[level];
  const next = random(challenge.seed && level === challenge.level ? challenge.seed : Math.floor(Math.random() * 2 ** 31));
  field = Array(cols * rows).fill(false);
  for (let placed = 0; placed < mines;) { const index = Math.floor(next() * field.length); if (!field[index]) { field[index] = true; placed += 1; } }
  state = Array(cols * rows).fill('hidden'); flags = 0; seconds = 0; started = false; finished = false;
  clearInterval(timer); renderGrid(); renderStatus(); setFace('smile');
  document.title = t('title');
  requestAnimationFrame(fitWindow);
}
const neighbours = index => { const x = index % cols, y = Math.floor(index / cols), list = []; for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) list.push(ny * cols + nx); } return list; };
const around = index => neighbours(index).filter(i => field[i]).length;
function play(name) { if (!soundOn) return; let volume = 72; try { volume = Number(localStorage.getItem('nk_sound_volume') ?? 72); if (localStorage.getItem('nk_sound_scheme') === 'none') return; } catch {} const audio = new Audio(`assets/games/minesweeper/${name}.wav`); audio.volume = Math.min(1, volume / 100); audio.play().catch(() => {}); }
function start(index) {
  // Like XP, the first square is never a mine: the mine moves to the first free square.
  if (field[index]) { field[index] = false; field[field.findIndex((mine, i) => !mine && i !== index)] = true; }
  started = true; seconds = 1; renderStatus(); play('tick');
  timer = setInterval(() => { if (seconds < 999) { seconds += 1; renderStatus(); if (soundOn) play('tick'); } }, 1000);
}
function open(index) {
  if (finished || state[index] !== 'hidden' && state[index] !== 'question') return;
  if (!started) start(index);
  if (field[index]) { lose(index); return; }
  const queue = [index];
  while (queue.length) {
    const cell = queue.pop(); if (state[cell] === 'open' || state[cell] === 'flag') continue;
    state[cell] = 'open';
    if (around(cell) === 0) queue.push(...neighbours(cell).filter(i => state[i] !== 'open'));
  }
  renderGrid();
  if (state.filter(value => value !== 'open').length === mines) win();
}
function chord(index) {
  if (finished || state[index] !== 'open') return;
  const count = around(index); if (!count || neighbours(index).filter(i => state[i] === 'flag').length !== count) return;
  neighbours(index).forEach(i => { if (state[i] === 'hidden' || state[i] === 'question') open(i); });
}
function mark(index) {
  if (finished || state[index] === 'open') return;
  state[index] = { hidden: 'flag', flag: 'question', question: 'hidden' }[state[index]];
  flags = state.filter(value => value === 'flag').length; renderGrid(); renderStatus();
}
function lose(index) {
  finished = true; clearInterval(timer); play('lose'); setFace('dead');
  state = state.map((value, i) => field[i] ? (i === index ? 'exploded' : value === 'flag' ? 'flag' : 'mine') : value === 'flag' ? 'wrong' : value);
  renderGrid(); report(false);
}
function win() {
  finished = true; clearInterval(timer); play('win'); setFace('win');
  state = state.map((value, i) => field[i] ? 'flag' : value); flags = mines; renderGrid(); renderStatus();
  const best = (() => { try { return JSON.parse(localStorage.getItem('nk_mine_best') || '{}'); } catch { return {}; } })();
  if (!best[level] || seconds < best[level]) { best[level] = seconds; try { localStorage.setItem('nk_mine_best', JSON.stringify(best)); } catch {} }
  report(true);
}
// A challenge sends its result to the chat it came from.
function report(won) {
  if (!challenge.chat || level !== challenge.level) return;
  try { localStorage.setItem('nk_game_result', JSON.stringify({ chat: challenge.chat, text: t(won ? 'won' : 'lost', { level: t(level), time: seconds }), at: Date.now() })); } catch {}
  const note = $('#mine-challenge'); note.hidden = false; note.textContent = t('sent');
}

// The window fits the board exactly, like XP's (it changes with the level).
function fitWindow() {
  const main = document.querySelector('.mine-app'), menu = $('#mine-menu'), board = document.querySelector('.mine-board-frame'), note = $('#mine-challenge');
  const width = board.offsetWidth + 12, height = menu.offsetHeight + board.offsetHeight + 12 + (note.hidden ? 0 : note.offsetHeight + 8);
  const dx = width - main.clientWidth, dy = height - main.clientHeight;
  if (dx || dy) controls.resize?.('se', dx, dy);
}
function renderGrid() {
  const grid = $('#mine-grid');
  grid.style.gridTemplateColumns = `repeat(${cols}, 16px)`;
  grid.innerHTML = state.map((value, index) => {
    const picture = value === 'open' ? numberCell(around(index)) : CELL[value];
    return `<i class="mine-cell" data-index="${index}" style="background-position:${cellOffset(picture)}"></i>`;
  }).join('');
}
function led(node, value) { const text = String(Math.max(-99, Math.min(999, value))).padStart(3, '0').replace(/^0(-)/, '-$1'); node.innerHTML = [...text].map(char => `<i style="background-position:0 -${(DIGIT[char] ?? 1) * 23}px"></i>`).join(''); }
function renderStatus() { led($('#mine-count'), mines - flags); led($('#mine-time'), seconds); }
function setFace(name) { $('#mine-face').style.backgroundPosition = `0 -${FACE[name] * 24}px`; }

// Mouse: left opens, right marks, double-click or middle-click or both buttons chords.
let buttons = 0;
$('#mine-grid').addEventListener('contextmenu', event => event.preventDefault());
$('#mine-grid').addEventListener('pointerdown', event => {
  const cell = event.target.closest('.mine-cell'); if (!cell || finished) return;
  buttons = event.buttons;
  if (event.button === 2 && !(event.buttons & 1)) { mark(Number(cell.dataset.index)); return; }
  setFace('ooh');
});
$('#mine-grid').addEventListener('pointerup', event => {
  const cell = event.target.closest('.mine-cell'); if (!finished) setFace('smile'); if (!cell) return;
  const index = Number(cell.dataset.index);
  if (event.button === 1 || (buttons & 3) === 3) chord(index); else if (event.button === 0) open(index);
  buttons = 0;
});
$('#mine-grid').addEventListener('dblclick', event => { const cell = event.target.closest('.mine-cell'); if (cell) chord(Number(cell.dataset.index)); });
$('#mine-face').addEventListener('pointerdown', () => setFace('down'));
$('#mine-face').addEventListener('click', () => newGame());

// Game and Help menus, like Explorer's in the Control Panel.
const MENUS = { game: [['new', 'new'], null, ['beginner', 'level:beginner'], ['intermediate', 'level:intermediate'], ['expert', 'level:expert'], null, ['sound', 'sound'], null, ['best', 'best'], null, ['exit', 'exit']], help: [['rules', 'rules'], null, ['about', 'about']] };
function closeMenu() { document.querySelector('.cp-menu-popup')?.remove(); document.querySelectorAll('[data-menu].open').forEach(button => button.classList.remove('open')); }
$('#mine-menu').addEventListener('click', event => {
  const button = event.target.closest('[data-menu]'); if (!button) return; event.stopPropagation();
  const wasOpen = button.classList.contains('open'); closeMenu(); if (wasOpen) return;
  const popup = document.createElement('div'); popup.className = 'cp-menu-popup';
  popup.innerHTML = MENUS[button.dataset.menu].map(item => item ? `<button type="button" data-command="${item[1]}"${item[1] === `level:${level}` || (item[1] === 'sound' && soundOn) ? ' class="checked"' : ''}>${esc(t(item[0]))}</button>` : '<hr>').join('');
  const rect = button.getBoundingClientRect(); popup.style.left = `${rect.left}px`; popup.style.top = `${rect.bottom}px`; document.body.append(popup); button.classList.add('open');
});
document.addEventListener('click', event => {
  const command = event.target.closest('.cp-menu-popup [data-command]')?.dataset.command; closeMenu(); if (!command) return;
  if (command === 'new') newGame();
  if (command.startsWith('level:')) { level = command.slice(6); try { localStorage.setItem('nk_mine_level', level); } catch {} newGame(); }
  if (command === 'sound') { soundOn = !soundOn; try { localStorage.setItem('nk_mine_sound', soundOn ? '1' : '0'); } catch {} }
  if (command === 'best') { const best = (() => { try { return JSON.parse(localStorage.getItem('nk_mine_best') || '{}'); } catch { return {}; } })(); alert(`${t('bestTitle')}\n\n${['beginner', 'intermediate', 'expert'].map(name => `${t(name)}: ${best[name] ? t('seconds', { time: best[name] }) : t('none')}`).join('\n')}`); }
  if (command === 'rules') { if (controls.openHelpViewer) controls.openHelpViewer('minesweeper'); else alert(t('rulesText')); }
  if (command === 'about') { if (controls.openAbout) controls.openAbout('minesweeper'); else alert('Minesweeper — Windows XP. Nekochat Reloaded.'); }
  if (command === 'exit') controls.close();
});
document.addEventListener('keydown', event => { if (event.key === 'F2') newGame(); if (event.key === 'Escape') closeMenu(); });
$('#close').onclick = () => controls.close();
// Minimize works; Maximize is greyed out, as in XP's Minesweeper.
document.querySelector('.xp-window-controls').insertAdjacentHTML('afterbegin', '<button id="minimize" aria-label="Свернуть"></button><button id="maximize" aria-label="Развернуть" disabled></button>');
$('#minimize').onclick = () => controls.minimize();

function applyText() {
  document.documentElement.lang = language; document.title = t('title'); $('.xp-title').textContent = t('title');
  document.querySelectorAll('[data-menu]').forEach(button => { button.textContent = t(button.dataset.menu); });
  $('#minimize')?.setAttribute('aria-label', language === 'en' ? 'Minimize' : 'Свернуть');
  $('#close').setAttribute('aria-label', t('close'));
  if (challenge.chat) { const note = $('#mine-challenge'); note.hidden = false; note.textContent = t('challenge'); }
}
const checkClassic = () => document.documentElement.classList.toggle('cp-classic-look', getComputedStyle(document.documentElement).getPropertyValue('--classic-raised').trim() !== '');
$('#frame-theme').addEventListener('load', checkClassic);
controls.getActiveTheme().then(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; });
controls.onThemeChanged(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; });
controls.getDisplaySettings().then(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); });
applyText(); newGame();
