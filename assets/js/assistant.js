// The assistant: Rover, the search companion of Windows XP, by default — the original Microsoft
// Agent character (rover.acs from Windows XP, unpacked into assets/agent/rover: agent.json with
// the animations, frames.png and sound<N>.wav) — or an assistant pack from the Catalog, whose
// assistant/ folder has the same files. He shows up in the chat window, idles, searches while you
// search, reacts to mentions, and a click opens a balloon with shortcuts.
// nk_assistant: 'rover' (default), 'none' or 'pack:<id>' with the files in nk_assistant_pack.
(() => {
  const BUILT_IN = { json: 'assets/agent/rover/agent.json', frames: 'assets/agent/rover/frames.png', sound: index => `assets/agent/rover/sound${index}.wav` };
  function source() {
    let choice = 'rover', pack = null; try { choice = localStorage.getItem('nk_assistant') || 'rover'; pack = JSON.parse(localStorage.getItem('nk_assistant_pack') || 'null'); } catch {}
    if (choice.startsWith('pack:') && pack?.json && pack?.frames) return { key: choice, json: pack.json, frames: pack.frames, sound: index => pack.sounds?.[index] || '' };
    return { key: 'rover', ...BUILT_IN };
  }
  let files = source();
  const words = {
    ru: { hello: 'Что вы хотите сделать?', searchAll: 'Найти сообщения во всех чатах', search: 'Найти в этом чате', go: 'Перейти к другому чату', unread: 'Непрочитанные ({count})', noUnread: 'Непрочитанных сообщений нет.', status: 'Сменить статус', tip: 'Дайте совет', hide: 'Скрыть {name}', back: 'Назад',
      searchPrompt: 'Что вы хотите найти? Я поищу во всех ваших чатах.', find: 'Найти', searching: 'Ищу во всех чатах…', found: 'Нашёл: {count}. Щёлкните, чтобы открыть.', notFound: 'Ничего не нашёл. Попробуйте другое слово.', searchAgain: 'Искать ещё',
      mention: '{name} упомянул(а) вас в {chat}', open: 'Открыть', unreadIn: 'Непрочитанные чаты:',
      statuses: { online: 'В сети', away: 'Отошёл', dnd: 'Не беспокоить', invisible: 'Невидимка' },
      tips: ['Ctrl+K — быстрый переход к любому чату.', 'Ctrl+F ищет в открытом чате, а я — во всех сразу.', 'Alt+↑ и Alt+↓ листают список чатов.', 'Ответить на сообщение можно из меню ⋯ рядом со временем.', '**жирный**, *курсив*, ~~зачёркнутый~~ и `код` работают в сообщениях.', 'Щёлкните по чату правой кнопкой: избранное, звук, архив.', 'Шапку чата можно вытащить мышью — чат откроется в своём окне.', 'Темы, курсоры, звуки, обои и помощники — в Каталоге.', 'В Панели управления → Мышь можно выбрать другие указатели.', 'Черновики сохраняются и переходят на другие устройства.'] },
    en: { hello: 'What would you like to do?', searchAll: 'Search messages in all chats', search: 'Search this chat', go: 'Go to another chat', unread: 'Unread ({count})', noUnread: 'There are no unread messages.', status: 'Change my status', tip: 'Give me a tip', hide: 'Hide {name}', back: 'Back',
      searchPrompt: 'What do you want to find? I will look in all your chats.', find: 'Search', searching: 'Searching all chats…', found: 'Found {count}. Click one to open it.', notFound: 'I could not find anything. Try another word.', searchAgain: 'Search again',
      mention: '{name} mentioned you in {chat}', open: 'Open', unreadIn: 'Chats with unread messages:',
      statuses: { online: 'Online', away: 'Away', dnd: 'Do not disturb', invisible: 'Invisible' },
      tips: ['Ctrl+K goes to any chat.', 'Ctrl+F searches the open chat; I search all of them.', 'Alt+↑ and Alt+↓ move through the chat list.', 'Reply to a message from the ⋯ menu next to its time.', '**bold**, *italic*, ~~strikethrough~~ and `code` work in messages.', 'Right-click a chat: favourite, mute, archive.', 'Drag the chat header out to open the chat in its own window.', 'Themes, cursors, sounds, wallpapers and assistants are in the Catalog.', 'Control Panel → Mouse changes the pointers.', 'Drafts are saved and follow you to your other devices.'] },
  };
  const language = () => (document.documentElement.lang === 'en' ? 'en' : 'ru');
  const t = key => words[language()][key];
  const enabled = () => { try { return (localStorage.getItem('nk_assistant') || 'rover') !== 'none'; } catch { return true; } };

  let data = null, atlas = null, host = null, canvas = null, balloon = null;
  let current = null, frameIndex = 0, timer = 0, stopping = false, queue = [], idleTimer = 0;

  function load() {
    if (data) return Promise.resolve();
    atlas = new Image(); atlas.src = files.frames;
    return Promise.all([fetch(files.json).then(response => response.json()).then(json => { data = json; }), atlas.decode()]);
  }
  function draw(frame) {
    const context = canvas.getContext('2d'); context.clearRect(0, 0, canvas.width, canvas.height);
    // Images are listed top layer first; draw from the bottom up.
    for (const [index, x, y] of [...frame.images].reverse()) {
      const column = index % data.columns, row = Math.floor(index / data.columns);
      context.drawImage(atlas, column * data.width, row * data.height, data.width, data.height, x, y, data.width, data.height);
    }
  }
  function playSound(index) {
    if (index === 65535) return;
    let scheme = 'xp', volume = 72; try { scheme = localStorage.getItem('nk_sound_scheme') || 'xp'; volume = Number(localStorage.getItem('nk_sound_volume') ?? 72); } catch {}
    if (scheme === 'none' || !(volume > 0)) return;
    const url = files.sound(index); if (!url) return;
    const audio = new Audio(url); audio.volume = Math.min(1, volume / 100); audio.play().catch(() => {});
  }
  // Frames follow the character's branches (random loops in Idle) and, when asked to stop, the
  // exit branches, the way Microsoft Agent plays them.
  function step() {
    const frames = current.frames; const frame = frames[frameIndex];
    if (!frame) { finish(); return; }
    if (frame.images.length) draw(frame);
    playSound(frame.audio);
    timer = setTimeout(() => {
      let next = frameIndex + 1;
      if (stopping && frame.exit >= 0) next = frame.exit;
      else if (!stopping && frame.branches.length) {
        let roll = Math.random() * 100;
        for (const [target, chance] of frame.branches) { if (roll < chance) { next = target; break; } roll -= chance; }
      }
      frameIndex = next; step();
    }, Math.max(10, frame.duration * 10));
  }
  function finish() {
    clearTimeout(timer); const done = current; current = null; stopping = false;
    done?.resolve?.();
    if (queue.length) { const next = queue.shift(); start(next.name, next.resolve); } else scheduleIdle();
  }
  // Characters name their animations differently (Merlin has no "Searching", Courtney spells
  // "Embarassed"): take the first one the character has.
  const SIMILAR = {
    Searching: ['Searching', 'Processing', 'Search', 'CheckingSomething', 'Thinking', 'Think'], Thinking: ['Thinking', 'Think', 'Processing'],
    ClickedOn: ['ClickedOn', 'Surprised', 'Acknowledge', 'Greet'], GetAttention: ['GetAttention', 'Alert', 'GetAttentionMinor', 'Announce'],
    CharacterSucceeds: ['CharacterSucceeds', 'Congratulate', 'Pleased'], Embarrassed: ['Embarrassed', 'Embarassed', 'Confused', 'Uncertain', 'Decline', 'Sad'],
    Pleased: ['Pleased', 'Congratulate', 'Acknowledge'], Acknowledge: ['Acknowledge', 'Pleased'], LookUp: ['LookUp'], LookUpLeft: ['LookUpLeft', 'LookLeft'],
    Show: ['Show', 'Greet'], Hide: ['Hide', 'Disappear'], RestPose: ['RestPose'],
  };
  function resolveName(name) {
    if (name === 'Idle') { const idles = Object.keys(data.animations).filter(key => /^idle/i.test(key)); return idles[Math.floor(Math.random() * idles.length)]; }
    return (SIMILAR[name] || [name]).find(key => data.animations[key]);
  }
  function start(name, resolve) {
    const animation = data?.animations[resolveName(name)]; if (!animation) { resolve?.(); return; }
    clearTimeout(idleTimer);
    current = { ...animation, name, resolve }; frameIndex = 0; stopping = false; step();
  }
  // Play now: the current animation leaves through its exit frames first.
  function play(name) {
    if (!host) return Promise.resolve();
    return new Promise(resolve => {
      if (!current) { start(name, resolve); return; }
      queue = [{ name, resolve }]; stopping = true;
      if (current.name === 'Idle' || current.name === 'RestPose') { clearTimeout(timer); finish(); }
    });
  }
  function scheduleIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (host && !current) start(Math.random() < .8 ? 'Idle' : ['LookUp', 'LookUpLeft', 'Thinking'][Math.floor(Math.random() * 3)]); }, 6000 + Math.random() * 12000);
  }

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
  let balloonTimer = 0;
  // actions: [label, action, data] — buttons with a blue bullet; extra: HTML under the text.
  function say(text, actions = [], extra = '') {
    closeBalloon();
    balloon = document.createElement('div'); balloon.className = 'assistant-balloon';
    balloon.innerHTML = `<p>${esc(text)}</p>${extra}` + actions.map(([label, action, value]) => `<button type="button" data-assistant="${action}"${value !== undefined ? ` data-value="${esc(value)}"` : ''}><i></i>${esc(label)}</button>`).join('');
    host.append(balloon);
    clearTimeout(balloonTimer); if (!actions.length && !extra) balloonTimer = setTimeout(() => closeBalloon(), 4500);
  }

  // What Rover can do. The chat window's own functions and lists (nekochat.js) are shared globals.
  const chatName = (kind, id) => { try { if (kind === 'room') return `# ${rooms.find(room => room.id === id)?.name ?? ''}`; return displayName(users.find(user => user.id === id)); } catch { return ''; } };
  function menu() {
    let count = 0; try { count = unread.size; } catch {}
    say(t('hello'), [[t('searchAll'), 'search-all'], [fill(t('unread'), { count }), 'unread'], [t('go'), 'go'], [t('search'), 'search'], [t('status'), 'status'], [t('tip'), 'tip'], [fill(t('hide'), { name: data.name || 'Rover' }), 'hide']]);
  }
  function askSearch() {
    say(t('searchPrompt'), [[t('back'), 'menu']], `<form class="assistant-search"><input type="search" maxlength="80" autocomplete="off"><button type="submit">${esc(t('find'))}</button></form>`);
    setTimeout(() => balloon?.querySelector('input')?.focus(), 30);
  }
  // Every room and every person you talk to, a few at a time; the newest matches first.
  const histories = new Map();
  async function searchAll(query) {
    const needle = query.toLowerCase(); play('Searching'); say(t('searching'));
    let chats = []; try { chats = [...rooms.map(room => ({ kind: 'room', data: room })), ...users.filter(user => conversationOrder.has(Number(user.id))).map(user => ({ kind: 'dm', data: user }))]; } catch {}
    const hits = [];
    for (let i = 0; i < chats.length; i += 4) {
      await Promise.all(chats.slice(i, i + 4).map(async chat => {
        const key = `${chat.kind}:${chat.data.id}`; let history = histories.get(key);
        if (!history || Date.now() - history.time > 60000) { try { history = { time: Date.now(), items: await fetchHistory(chat) }; histories.set(key, history); } catch { return; } }
        for (const message of history.items) if (String(message.content || '').toLowerCase().includes(needle)) hits.push({ kind: chat.kind, id: chat.data.id, message });
      }));
    }
    hits.sort((a, b) => String(b.message.created_at).localeCompare(String(a.message.created_at)));
    await play(hits.length ? 'CharacterSucceeds' : 'Embarrassed');
    if (!hits.length) { say(t('notFound'), [[t('searchAgain'), 'search-all'], [t('back'), 'menu']]); return; }
    const list = hits.slice(0, 30).map((hit, index) => {
      const text = String(hit.message.content || ''); const at = text.toLowerCase().indexOf(needle); const start = Math.max(0, at - 30);
      const snippet = (start ? '…' : '') + text.slice(start, at + needle.length + 50);
      return `<button type="button" class="assistant-hit" data-assistant="open-hit" data-value="${index}"><b>${esc(chatName(hit.kind, hit.id))}</b><span>${esc(snippet)}</span></button>`;
    }).join('');
    lastHits = hits; lastQuery = query;
    say(fill(t('found'), { count: hits.length }), [[t('searchAgain'), 'search-all'], [t('back'), 'menu']], `<div class="assistant-hits">${list}</div>`);
  }
  let lastHits = [], lastQuery = '';
  // Open the chat and find the words there, with the chat header's search.
  async function openHit(index) {
    const hit = lastHits[Number(index)]; if (!hit) return;
    closeBalloon();
    try { await openChat(hit.kind, hit.id); } catch { return; }
    setTimeout(() => { const input = document.querySelector('#header-search input'); if (!input) return; input.value = lastQuery; input.dispatchEvent(new Event('input', { bubbles: true })); }, 400);
  }
  function showUnread() {
    let keys = []; try { keys = [...unread.keys()]; } catch {}
    if (!keys.length) { play('Pleased'); say(t('noUnread'), [[t('back'), 'menu']]); return; }
    say(t('unreadIn'), [...keys.slice(0, 10).map(key => { const [kind, id] = key.split(':'); return [`${chatName(kind, Number(id))} (${unread.get(key)})`, 'open-chat', key]; }), [t('back'), 'menu']]);
  }
  function closeBalloon() { balloon?.remove(); balloon = null; }
  const key = (keyName, options) => document.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true, ...options }));

  async function show() {
    if (host || !enabled() || !document.querySelector('#chat-app')) return;
    await load();
    host = document.createElement('div'); host.className = 'assistant-host'; host.title = data.name || 'Rover';
    canvas = document.createElement('canvas'); canvas.width = data.width; canvas.height = data.height;
    Object.assign(host.style, { width: `${data.width}px`, height: `${data.height}px` }); Object.assign(canvas.style, { width: `${data.width}px`, height: `${data.height}px` });
    host.append(canvas); document.body.append(host);
    host.addEventListener('click', event => {
      const button = event.target.closest('[data-assistant]'); const action = button?.dataset.assistant; const value = button?.dataset.value;
      if (action === 'menu') { menu(); return; }
      if (action === 'search-all') { askSearch(); return; }
      if (action === 'open-hit') { openHit(value); return; }
      if (action === 'unread') { showUnread(); return; }
      if (action === 'open-chat') { closeBalloon(); const [kind, id] = value.split(':'); try { openChat(kind, Number(id)); } catch {} return; }
      if (action === 'status') { say(t('status'), [...Object.entries(t('statuses')).map(([status, label]) => [label, 'set-status', status]), [t('back'), 'menu']]); return; }
      if (action === 'set-status') { try { chooseStatus(value); } catch {} play('Acknowledge'); say(t('statuses')[value]); return; }
      if (action === 'tip') { const tips = t('tips'); play('Thinking'); say(tips[Math.floor(Math.random() * tips.length)], [[t('tip'), 'tip'], [t('back'), 'menu']]); return; }
      if (action === 'search') { closeBalloon(); key('f', { ctrlKey: true }); return; }
      if (action === 'go') { closeBalloon(); key('k', { ctrlKey: true }); return; }
      if (action === 'hide') { closeBalloon(); hide(true); return; }
      if (event.target === canvas && !moved) { if (balloon) { closeBalloon(); return; } play('ClickedOn'); menu(); }
    });
    host.addEventListener('submit', event => {
      event.preventDefault(); const query = event.target.querySelector('input')?.value.trim(); if (query) searchAll(query);
    });
    // Drag him anywhere; the place is remembered.
    let moved = false;
    canvas.addEventListener('pointerdown', event => {
      moved = false; const startX = event.clientX, startY = event.clientY, rect = host.getBoundingClientRect(); canvas.setPointerCapture(event.pointerId);
      canvas.onpointermove = move => { if (Math.abs(move.clientX - startX) + Math.abs(move.clientY - startY) > 4) moved = true; if (!moved) return; host.style.left = `${Math.max(0, Math.min(innerWidth - rect.width, rect.left + move.clientX - startX))}px`; host.style.top = `${Math.max(0, Math.min(innerHeight - rect.height, rect.top + move.clientY - startY))}px`; host.style.right = host.style.bottom = 'auto'; };
      canvas.onpointerup = () => { canvas.onpointermove = null; if (moved) try { localStorage.setItem('nk_assistant_place', JSON.stringify([host.style.left, host.style.top])); } catch {} };
    });
    try { const [left, top] = JSON.parse(localStorage.getItem('nk_assistant_place') || 'null') || []; if (left) Object.assign(host.style, { left, top, right: 'auto', bottom: 'auto' }); } catch {}
    play('Show');
  }
  async function hide(remember) {
    if (!host) return;
    if (remember) try { localStorage.setItem('nk_assistant', 'none'); } catch {}
    closeBalloon(); await play('Hide');
    clearTimeout(timer); clearTimeout(idleTimer); host?.remove(); host = null; current = null; queue = [];
  }
  // Another assistant chosen: the old one leaves, the new one comes.
  async function change() {
    const next = source(); if (next.key === files.key && host) return;
    await hide(false); files = next; data = null; if (enabled()) show();
  }

  // Searching in the chat header: Rover searches too.
  let searchTimer = 0;
  document.addEventListener('input', event => {
    if (!host || !event.target.closest?.('#header-search')) return;
    clearTimeout(searchTimer);
    if (event.target.value.trim()) { if (current?.name !== 'Searching') play('Searching'); searchTimer = setTimeout(() => play('Pleased'), 2500); }
  });
  // A message that mentions you, or yours sent: a short reaction.
  new MutationObserver(records => {
    if (!host) return;
    for (const record of records) for (const node of record.addedNodes) {
      if (!(node instanceof HTMLElement) || !node.classList.contains('message')) continue;
      if (node.classList.contains('mentions-me')) {
        const name = node.querySelector('.message-meta b, .message-meta strong, .message-author')?.textContent?.trim() || '@';
        let chat = ''; let key = ''; try { chat = chatName(current.kind, current.data.id); key = `${current.kind}:${current.data.id}`; } catch {}
        play('GetAttention'); say(fill(t('mention'), { name, chat }), key && document.hidden ? [[t('open'), 'open-chat', key]] : []); return;
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  // Turned on or off in the Control Panel (other windows write the setting).
  window.addEventListener('storage', event => { if (event.key === 'nk_assistant' || event.key === 'nk_assistant_pack') { if (enabled()) change(); else hide(false); } });
  // After sign-in the chat app appears; wait for it.
  const ready = setInterval(() => { const app = document.querySelector('#chat-app'); if (app && !app.hidden) { clearInterval(ready); show(); } }, 1500);
  window.nkAssistant = { show, hide, play, change };
})();
