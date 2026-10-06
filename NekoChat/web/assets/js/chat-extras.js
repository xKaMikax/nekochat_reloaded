// Chat extras on top of nekochat.js: replies, reactions, pinned messages, "typing…", read
// receipts, drafts, search in the chat, favourite chats and keyboard shortcuts.
// Reactions, pins, typing and receipts live on the Nekochat Reloaded companion server (0.7+) and
// arrive through its /events stream; without it, replies, drafts, search, favourites and the
// shortcuts still work.
(() => {
  Object.assign(translations.ru, {
    reply: 'Ответить', react: 'Реакция', pin: 'Закрепить', unpin: 'Открепить', copy: 'Копировать текст', replyingTo: 'Ответ на',
    cancelReply: 'Отменить ответ', pinned: 'Закреплено', typingOne: '{name} печатает…', typingMany: '{names} печатают…', typingDm: 'печатает…',
    playGame: 'Играть: {game}…', challengeGame: 'Вызвать на «{game}»…', challengeMine: 'Вызвать на «Сапёр»…', challengeTitle: 'Вызов на «Сапёр»', challengeText: 'У всех будет одно и то же поле. Выберите уровень:', levels: { beginner: 'Новичок', intermediate: 'Любитель', expert: 'Профессионал' }, challengeSend: 'Отправить вызов',
    chatSound: 'Звук уведомлений…', watchGames: 'Смотреть игры…', chatSoundTitle: 'Звук уведомлений: {name}', chatSoundLabel: 'Звук:', chatVolume: 'Громкость:', soundNames: { notify: 'Новое сообщение (по умолчанию)', default: 'Уведомление', exclamation: 'Восклицание', navigation: 'Щелчок', logon: 'Вход в систему', ringin: 'Звонок', none: '(Нет)' }, play: 'Прослушать', ok: 'ОК', cancel: 'Отмена',
    searchChat: 'Поиск в чате', searchNone: 'Ничего не найдено', searchOf: '{n} из {total}', favoriteAdd: 'В избранное', favoriteRemove: 'Убрать из избранного',
    quickSwitch: 'Перейти к чату', quickHint: 'Имя чата или человека…', read: 'Прочитано', sent: 'Отправлено', messageActions: 'Действия',
    newMessagesLine: 'Новые сообщения', note: 'Заметка', notePlaceholder: 'Ваша заметка об этом человеке — её видите только вы', archive: 'В архив', unarchive: 'Вернуть из архива', mentionHint: 'Упомянуть',
    searchIn: 'Поиск: {name}', pinnedMessages: 'Закреплённые сообщения', noPinsDm: 'В этой переписке пока нет закреплённых сообщений.', noPinsRoom: 'В этой комнате пока нет закреплённых сообщений.', pinsHint: 'Закрепить сообщение можно через его меню (⋯ или правая кнопка мыши).', openChat: 'Открыть', close: 'Закрыть',
  });
  Object.assign(translations.en, {
    reply: 'Reply', react: 'React', pin: 'Pin', unpin: 'Unpin', copy: 'Copy text', replyingTo: 'Replying to',
    cancelReply: 'Cancel reply', pinned: 'Pinned', typingOne: '{name} is typing…', typingMany: '{names} are typing…', typingDm: 'typing…',
    playGame: 'Play {game}…', challengeGame: 'Challenge to {game}…', challengeMine: 'Challenge to Minesweeper…', challengeTitle: 'Minesweeper challenge', challengeText: 'Everyone gets the same field. Choose the level:', levels: { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' }, challengeSend: 'Send challenge',
    chatSound: 'Notification sound…', watchGames: 'Watch games…', chatSoundTitle: 'Notification sound: {name}', chatSoundLabel: 'Sound:', chatVolume: 'Volume:', soundNames: { notify: 'New message (default)', default: 'Notification', exclamation: 'Exclamation', navigation: 'Click', logon: 'Windows Logon', ringin: 'Ring', none: '(None)' }, play: 'Play', ok: 'OK', cancel: 'Cancel',
    searchChat: 'Search in chat', searchNone: 'Nothing found', searchOf: '{n} of {total}', favoriteAdd: 'Add to favourites', favoriteRemove: 'Remove from favourites',
    quickSwitch: 'Go to chat', quickHint: 'Chat or person name…', read: 'Read', sent: 'Sent', messageActions: 'Actions',
    newMessagesLine: 'New messages', note: 'Note', notePlaceholder: 'Your note about this person — only you can see it', archive: 'Archive', unarchive: 'Unarchive', mentionHint: 'Mention',
    searchIn: 'Search {name}', pinnedMessages: 'Pinned messages', noPinsDm: 'This conversation has no pinned messages yet.', noPinsRoom: 'This room has no pinned messages yet.', pinsHint: 'Pin a message from its menu (⋯ or right click).', openChat: 'Open', close: 'Close',
  });
  const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
  const svg = path => `<svg viewBox="0 0 16 16" aria-hidden="true">${path}</svg>`;
  const ICONS = {
    more: svg('<circle cx="3" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="13" cy="8" r="1.5"/>'),
    reply: svg('<path d="M6.5 3.5 2 7.5l4.5 4v-2.6c3.3 0 5.6 1 7.5 3.6-.6-3.9-3-6.7-7.5-7.1z"/>'),
    pin: svg('<path d="M10.2 1.5 14.5 5.8l-1 1-.9-.4-2.7 2.7.3 2.6-1 1-2.8-2.8-3.7 3.7-.7-.7 3.7-3.7-2.8-2.8 1-1 2.6.3 2.7-2.7-.4-.9z"/>'),
    unpin: svg('<path d="M10.2 1.5 14.5 5.8l-1 1-.9-.4-2.7 2.7.3 2.6-1 1-2.8-2.8-3.7 3.7-.7-.7 3.7-3.7-2.8-2.8 1-1 2.6.3 2.7-2.7-.4-.9z" opacity=".45"/><path d="M2 2.7 2.7 2l11.3 11.3-.7.7z"/>'),
    search: svg('<path d="M6.5 1.5a5 5 0 0 1 4 8l3.6 3.6-1 1-3.6-3.6a5 5 0 1 1-3-9zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/>'),
    star: svg('<path d="m8 1.3 2 4.3 4.7.5-3.5 3.2 1 4.6L8 11.5l-4.2 2.4 1-4.6L1.3 6.1 6 5.6z"/>'),
    starOff: svg('<path d="m8 1.3 2 4.3 4.7.5-3.5 3.2 1 4.6L8 11.5l-4.2 2.4 1-4.6L1.3 6.1 6 5.6zm0 3.3-1 2.2-2.4.3 1.8 1.6-.5 2.4L8 9.9l2.1 1.2-.5-2.4 1.8-1.6-2.4-.3z"/>'),
    pinBig: '<svg viewBox="0 0 16 16" class="pins-empty-icon" aria-hidden="true"><path d="M10.2 1.5 14.5 5.8l-1 1-.9-.4-2.7 2.7.3 2.6-1 1-2.8-2.8-3.7 3.7-.7-.7 3.7-3.7-2.8-2.8 1-1 2.6.3 2.7-2.7-.4-.9z"/></svg>',
    archive: svg('<path d="M1.5 2.5h13v3h-13zm1 4h11v7h-11zm3.5 2v1h4v-1z"/>'),
    open: svg('<path d="M2 3h5v1.5H3.5v8h8V9H13v5H2zm7-1h5v5h-1.5V4.6L7.8 9.3 6.7 8.2l4.7-4.7H9z"/>'),
    bell: svg('<path d="M8 1.5a4 4 0 0 1 4 4v3l1.5 2.5h-11L4 8.5v-3a4 4 0 0 1 4-4zM6.3 12.5h3.4a1.7 1.7 0 0 1-3.4 0z"/>'),
    bellOff: svg('<path d="M8 1.5a4 4 0 0 1 4 4v3l1.5 2.5H5.6zM4 6.2l6.9 6.3H2.5L4 8.5zM6.3 13h3.4a1.7 1.7 0 0 1-3.4 0zM1.5 2.5l1-1 12 12-1 1z"/>'),
    copy: svg('<path d="M5 1.5h6.5L14 4v8.5H5zm1 1v9h7V4.5h-2V2.5zM2 4.5h2v1H3v8h6v-1h1v2H2z"/>'),
  };
  const state = { chat: '', reactions: {}, pins: [], pinIndex: 0, read: null, typing: new Map(), replyTo: null, lastTyping: 0, search: { hits: [], index: -1 } };
  const currentKey = () => current ? chatKey(current.kind, current.data.id) : '';
  const nameOf = id => { const user = userFor?.(id) || users.find(item => Number(item.id) === Number(id)); return user ? displayName(user) : `#${id}`; };

  // ---- message decoration: actions, reactions, receipts ----------------------------------------
  function decorate(article) {
    if (!article || article.tagName !== 'ARTICLE') return;
    // In the name/time line, after the time, so it never covers the text or the time.
    if (!article.querySelector('.message-actions')) article.querySelector('.message-meta')?.insertAdjacentHTML('beforeend', `<button class="message-actions" type="button" title="${esc(t('messageActions'))}" aria-label="${esc(t('messageActions'))}">${ICONS.more}</button>`);
    renderReactions(article); renderReceipt(article);
    article.classList.toggle('mentions-me', Boolean(article.querySelector('.message-body > p .mention.me')));
    addPreview(article);
  }
  // ---- link previews (the companion reads the page; cached per link) ----------------------------
  const previews = new Map();
  async function addPreview(article) {
    const link = article.querySelector('.message-body > p a[href]'); if (!link || article.querySelector('.link-preview') || !companion.token) return;
    const url = link.href;
    if (!previews.has(url)) previews.set(url, companionFetch('GET', `/preview?url=${encodeURIComponent(url)}`, undefined, true));
    const data = await previews.get(url);
    if (!data || (!data.title && !data.description) || article.querySelector('.link-preview') || !article.isConnected) return;
    const card = `<a class="link-preview" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${data.image ? `<img src="${esc(data.image)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<span><small>${esc(data.site || '')}</small><b>${esc(data.title || url)}</b>${data.description ? `<span>${esc(data.description)}</span>` : ''}</span></a>`;
    article.querySelector('.message-body > p').insertAdjacentHTML('afterend', card);
  }
  function renderReactions(article) {
    const holder = article.querySelector('.reactions'); if (!holder) return;
    const set = state.reactions[article.dataset.id] || {};
    holder.innerHTML = Object.entries(set).filter(([, people]) => people.length).map(([emoji, people]) => {
      const mine = people.map(Number).includes(Number(me?.id));
      return `<button type="button" class="reaction${mine ? ' mine' : ''}" data-emoji="${esc(emoji)}" title="${esc(people.map(nameOf).join(', '))}">${esc(emoji)} <b>${people.length}</b></button>`;
    }).join('');
  }
  function renderReceipt(article) {
    const receipt = article.querySelector('.receipt'); if (!receipt) return;
    const id = article.dataset.id;
    const read = id && state.read !== null && Number(id) <= Number(state.read);
    receipt.textContent = id ? (read ? '✓✓' : '✓') : ''; receipt.classList.toggle('read', Boolean(read)); receipt.title = id ? t(read ? 'read' : 'sent') : '';
  }
  const articles = () => [...document.querySelectorAll('#messages article')];
  const redecorate = () => articles().forEach(decorate);

  // ---- per-chat data from the companion ----------------------------------------------------------
  async function loadChat() {
    const key = currentKey(); state.chat = key; state.reactions = {}; state.pins = []; state.pinIndex = 0; state.read = null; state.typing.clear(); renderTyping();
    renderPins(); redecorate();
    if (!key) return;
    const data = await companionFetch('GET', `/chat?chat=${encodeURIComponent(key)}`, undefined, true);
    if (!data || state.chat !== key) return;
    state.reactions = data.reactions || {}; state.pins = data.pins || []; state.read = data.read ?? null;
    renderPins(); redecorate();
  }
  function toggleReaction(messageId, emoji) {
    if (!messageId || !companion.token) return;
    const people = (state.reactions[messageId] ||= {})[emoji] ||= [];
    const on = !people.map(Number).includes(Number(me?.id));
    applyReaction({ chat: state.chat, message: messageId, emoji, user: me?.id, on });
    companionFetch('PUT', '/reactions', { chat: state.chat, message: messageId, emoji, on });
  }
  function applyReaction(change) {
    if (change.chat !== state.chat) return;
    const set = (state.reactions[change.message] ||= {}); const people = (set[change.emoji] ||= []);
    const index = people.map(Number).indexOf(Number(change.user));
    if (change.on && index < 0) people.push(Number(change.user)); if (!change.on && index >= 0) people.splice(index, 1);
    const article = document.querySelector(`#messages article[data-id="${CSS.escape(String(change.message))}"]`); if (article) renderReactions(article);
  }

  // "New messages" line above the first unread message, which the chat opens at.
  function markFirstUnread({ count, lastRead }) {
    $('#messages .unread-separator')?.remove();
    const others = articles().filter(article => !article.classList.contains('mine'));
    let first = null;
    if (lastRead !== undefined && lastRead !== null) first = others.find(article => Number(article.dataset.id) > Number(lastRead));
    else if (count) first = others[others.length - count];
    if (!first || (!count && lastRead === undefined)) return;
    first.insertAdjacentHTML('beforebegin', `<div class="unread-separator"><span>${esc(t('newMessagesLine'))}</span></div>`);
    first.previousElementSibling.scrollIntoView({ block: 'start' });
  }

  // ---- pinned messages: a button in the header opens the list, like Discord ------------------
  function renderPins() {
    const button = $('#pins-button'); if (button) { button.classList.toggle('has-pins', state.pins.length > 0); button.title = `${t('pinnedMessages')}${state.pins.length ? ` (${state.pins.length})` : ''}`; }
    if ($('#pins-popover')) fillPins($('#pins-popover'));
  }
  function fillPins(popover) {
    popover.querySelector('.pins-list').innerHTML = state.pins.length ? state.pins.map(pin => `<div class="pin-item" data-message="${esc(pin.message)}"><button type="button" class="pin-open"><b>${esc(pin.author || '')}</b><span>${esc(pin.content)}</span></button><button type="button" class="pin-remove" title="${esc(t('unpin'))}" aria-label="${esc(t('unpin'))}">×</button></div>`).join('')
      : `<div class="pins-empty">${ICONS.pinBig}<p>${esc(t(current?.kind === 'dm' ? 'noPinsDm' : 'noPinsRoom'))}</p><small>${esc(t('pinsHint'))}</small></div>`;
  }
  function togglePinsPopover() {
    if ($('#pins-popover')) { closePins(); return; }
    const popover = document.createElement('div'); popover.id = 'pins-popover'; popover.className = 'pins-popover';
    popover.innerHTML = `<div class="pins-title">${ICONS.pin}<span>${esc(t('pinnedMessages'))}</span><button type="button" class="pins-close" aria-label="${esc(t('close'))}">×</button></div><div class="pins-list"></div>`;
    document.body.append(popover); fillPins(popover);
    const box = $('#pins-button').getBoundingClientRect();
    popover.style.top = `${box.bottom + 6}px`; popover.style.left = `${Math.max(6, Math.min(box.right - popover.offsetWidth, innerWidth - popover.offsetWidth - 6))}px`;
    popover.onclick = event => {
      const item = event.target.closest('.pin-item');
      if (event.target.closest('.pins-close')) closePins();
      else if (event.target.closest('.pin-remove') && item) setPin(item.dataset.message, false);
      else if (item) { closePins(); jumpTo(item.dataset.message); }
    };
  }
  function closePins() { $('#pins-popover')?.remove(); }
  function setPin(messageId, on) {
    const article = document.querySelector(`#messages article[data-id="${CSS.escape(String(messageId))}"]`);
    const content = article ? (article.querySelector('.message-body > p')?.textContent || '').slice(0, 300) : '';
    const author = article?.dataset.author || '';
    applyPin({ chat: state.chat, message: String(messageId), content, author, on });
    companionFetch('PUT', '/pins', { chat: state.chat, message: String(messageId), content, author, on });
  }
  function applyPin(change) {
    if (change.chat !== state.chat) return;
    state.pins = state.pins.filter(pin => String(pin.message) !== String(change.message));
    if (change.on) state.pins.unshift({ message: String(change.message), content: change.content || '', author: change.author || '' });
    state.pinIndex = 0; renderPins();
  }
  function jumpTo(messageId) {
    const article = document.querySelector(`#messages article[data-id="${CSS.escape(String(messageId))}"]`); if (!article) return;
    article.scrollIntoView({ block: 'center', behavior: 'smooth' }); article.classList.add('flash'); setTimeout(() => article.classList.remove('flash'), 1600);
  }

  // ---- typing ---------------------------------------------------------------------------------
  function renderTyping() {
    const small = document.querySelector('#conversation-header small'); if (!small) return;
    small.dataset.base ??= small.textContent;
    const now = Date.now(); for (const [id, until] of state.typing) if (until < now) state.typing.delete(id);
    const ids = [...state.typing.keys()];
    small.classList.toggle('typing', ids.length > 0);
    small.textContent = !ids.length ? small.dataset.base : current?.kind === 'dm' ? t('typingDm') : ids.length === 1 ? t('typingOne', { name: nameOf(ids[0]) }) : t('typingMany', { names: ids.slice(0, 3).map(nameOf).join(', ') });
  }
  setInterval(() => { if (state.typing.size) renderTyping(); }, 1000);

  // ---- reply ----------------------------------------------------------------------------------
  function replyBar() {
    let bar = $('#reply-bar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'reply-bar'; bar.className = 'reply-bar'; bar.hidden = true; $('#composer').before(bar); }
    return bar;
  }
  function startReply(article) {
    const text = (article.querySelector('.message-body > p')?.textContent || '').split('\n')[0].slice(0, 120);
    state.replyTo = { author: article.dataset.author || '', text };
    const bar = replyBar(); bar.hidden = false;
    bar.innerHTML = `<span><b>${esc(t('replyingTo'))} ${esc(state.replyTo.author)}:</b> ${esc(text)}</span><button type="button" title="${esc(t('cancelReply'))}" aria-label="${esc(t('cancelReply'))}">×</button>`;
    bar.querySelector('button').onclick = cancelReply;
    $('#message-input').focus();
  }
  function cancelReply() { state.replyTo = null; replyBar().hidden = true; }

  // ---- menu -----------------------------------------------------------------------------------
  function closeMenu() { $('#message-menu')?.remove(); }
  function openMenu(article, x, y) {
    closeMenu();
    const id = article.dataset.id; const pinnedNow = state.pins.some(pin => String(pin.message) === String(id));
    const menu = document.createElement('div'); menu.id = 'message-menu'; menu.className = 'message-menu'; menu.setAttribute('role', 'menu');
    menu.innerHTML = `${companion.token && id ? `<div class="quick-reactions">${QUICK_REACTIONS.map(emoji => `<button type="button" data-react="${emoji}">${emoji}</button>`).join('')}</div>` : ''}
      <button type="button" data-action="reply">${ICONS.reply}${esc(t('reply'))}</button>
      ${companion.token && id ? `<button type="button" data-action="pin">${pinnedNow ? ICONS.unpin : ICONS.pin}${esc(t(pinnedNow ? 'unpin' : 'pin'))}</button>` : ''}
      <button type="button" data-action="copy">${ICONS.copy}${esc(t('copy'))}</button>`;
    document.body.append(menu);
    const box = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(x, innerWidth - box.width - 4))}px`; menu.style.top = `${Math.max(4, Math.min(y, innerHeight - box.height - 4))}px`;
    menu.onclick = event => {
      const react = event.target.closest('[data-react]')?.dataset.react; const action = event.target.closest('[data-action]')?.dataset.action;
      if (react) toggleReaction(id, react);
      if (action === 'reply') startReply(article);
      if (action === 'pin') setPin(id, !pinnedNow);
      if (action === 'copy') navigator.clipboard?.writeText(article.querySelector('.message-body > p')?.textContent || '').catch(() => {});
      if (react || action) closeMenu();
    };
  }
  $('#messages').addEventListener('click', event => {
    const reaction = event.target.closest('.reaction');
    if (reaction) { toggleReaction(reaction.closest('article')?.dataset.id, reaction.dataset.emoji); return; }
    const actions = event.target.closest('.message-actions');
    if (actions) { event.stopPropagation(); const box = actions.getBoundingClientRect(); openMenu(actions.closest('article'), box.left, box.bottom); return; }
    const quote = event.target.closest('.reply-quote');
    if (quote) { const text = quote.textContent.split('\n')[0].replace(/^[^:]*:\s*/, ''); const target = articles().find(item => item.querySelector('.message-body > p')?.textContent.startsWith(text.slice(0, 40))); if (target?.dataset.id) jumpTo(target.dataset.id); }
  }, true);
  $('#messages').addEventListener('contextmenu', event => { const article = event.target.closest('article'); if (!article || article.dataset.pending) return; event.preventDefault(); openMenu(article, event.clientX, event.clientY); });
  document.addEventListener('click', event => { if (!event.target.closest('#message-menu')) closeMenu(); if (!event.target.closest('#pins-popover, #pins-button')) closePins(); });

  // ---- search in the chat: a field in the header, like Discord ------------------------------
  // Highlighting works on the plain text; the formatted text comes back when the search ends.
  function clearMarks() { document.querySelectorAll('#messages .message-body > p[data-html]').forEach(p => { p.innerHTML = p.dataset.html; delete p.dataset.html; }); }
  function runSearch(query) {
    clearMarks(); state.search = { hits: [], index: -1 };
    const needle = query.trim().toLowerCase();
    if (needle) for (const p of document.querySelectorAll('#messages .message-body > p')) {
      const text = p.textContent; const lower = text.toLowerCase(); if (!lower.includes(needle)) continue;
      p.dataset.html ??= p.innerHTML;
      const parts = []; let at = 0, found;
      while ((found = lower.indexOf(needle, at)) >= 0) { parts.push(document.createTextNode(text.slice(at, found))); const mark = document.createElement('mark'); mark.className = 'search-hit'; mark.textContent = text.slice(found, found + needle.length); parts.push(mark); state.search.hits.push(mark); at = found + needle.length; }
      parts.push(document.createTextNode(text.slice(at))); p.replaceChildren(...parts);
    }
    state.search.index = state.search.hits.length ? state.search.hits.length - 1 : -1; showSearchHit();
  }
  function stepSearch(step) { const total = state.search.hits.length; if (!total) return; state.search.index = (state.search.index + step + total) % total; showSearchHit(); }
  function showSearchHit() {
    const total = state.search.hits.length; const count = $('#header-search .search-count'); const query = $('#header-search input')?.value.trim();
    state.search.hits.forEach((mark, index) => mark.classList.toggle('current', index === state.search.index));
    if (count) count.textContent = query ? (total ? `${state.search.index + 1}/${total}` : '0') : '';
    $('#header-search')?.classList.toggle('active', Boolean(query));
    state.search.hits[state.search.index]?.scrollIntoView({ block: 'center' });
  }
  function openSearch() { const input = $('#header-search input'); if (!input) return; input.focus(); input.select(); }
  function closeSearch() { const input = $('#header-search input'); if (input) input.value = ''; clearMarks(); state.search = { hits: [], index: -1 }; showSearchHit(); }

  // ---- quick switcher (Ctrl+K) ----------------------------------------------------------------
  function openQuickSwitch() {
    let dialog = $('#quick-switch');
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.id = 'quick-switch'; dialog.className = 'xp-dialog quick-switch';
      dialog.innerHTML = `<div class="dialog-title">${esc(t('quickSwitch'))}</div><input type="search" placeholder="${esc(t('quickHint'))}"><div class="quick-list" role="listbox"></div>`;
      document.body.append(dialog);
      const input = dialog.querySelector('input');
      input.oninput = () => fillQuick(dialog, input.value);
      input.onkeydown = event => {
        const items = [...dialog.querySelectorAll('.quick-item')]; let index = items.findIndex(item => item.classList.contains('selected'));
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); index = (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items.forEach((item, i) => item.classList.toggle('selected', i === index)); items[index]?.scrollIntoView({ block: 'nearest' }); }
        if (event.key === 'Enter') { event.preventDefault(); items[Math.max(0, index)]?.click(); }
      };
      dialog.addEventListener('click', event => { const item = event.target.closest('.quick-item'); if (event.target === dialog) dialog.close(); if (!item) return; dialog.close(); const kind = item.dataset.kind; if (activeTab !== (kind === 'room' ? 'rooms' : 'people')) document.querySelector(`[data-tab="${kind === 'room' ? 'rooms' : 'people'}"]`)?.click(); openChat(kind, Number(item.dataset.id)); });
    }
    dialog.querySelector('input').value = ''; fillQuick(dialog, ''); dialog.showModal(); dialog.querySelector('input').focus();
  }
  function fillQuick(dialog, query) {
    const needle = query.trim().toLowerCase();
    const all = [...rooms.map(room => ({ kind: 'room', id: room.id, name: `# ${room.name ?? ''}` })), ...users.filter(user => user.id !== me?.id).map(user => ({ kind: 'dm', id: user.id, name: displayName(user), sub: `@${user.username}` }))];
    const found = all.filter(item => `${item.name} ${item.sub || ''}`.toLowerCase().includes(needle)).sort((a, b) => Number(isFavorite(chatKey(b.kind, b.id))) - Number(isFavorite(chatKey(a.kind, a.id)))).slice(0, 30);
    dialog.querySelector('.quick-list').innerHTML = found.map((item, index) => `<button type="button" class="quick-item${index === 0 ? ' selected' : ''}" data-kind="${item.kind}" data-id="${item.id}">${isFavorite(chatKey(item.kind, item.id)) ? '★ ' : ''}${esc(item.name)}${item.sub ? ` <small>${esc(item.sub)}</small>` : ''}</button>`).join('') || `<p>${esc(t('nothingFound'))}</p>`;
  }

  // ---- keyboard shortcuts ---------------------------------------------------------------------
  document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'k') { event.preventDefault(); openQuickSwitch(); return; }
    if ((event.ctrlKey || event.metaKey) && key === 'f' && current) { event.preventDefault(); openSearch(); return; }
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault(); const items = [...document.querySelectorAll('#chat-list .chat-item')]; if (!items.length) return;
      const index = items.findIndex(item => item.classList.contains('active')); items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.click(); return;
    }
    if (event.key === 'Escape') {
      if ($('#message-menu')) { closeMenu(); return; }
      if ($('#pins-popover')) { closePins(); return; }
      if ($('#header-search input')?.value) { closeSearch(); return; }
      if (state.replyTo) { cancelReply(); }
    }
  });

  // ---- hooks into nekochat.js ------------------------------------------------------------------
  const originalOpenChat = openChat;
  openChat = async (kind, id, options) => {
    const before = currentKey(); if (before) setDraft(before, $('#message-input').value);
    cancelReply(); closeSearch(); closeMenu(); closePins();
    const target = chatKey(kind, id);
    if (target !== before) $('#message-input').value = drafts[target] || '';
    const unreadBefore = { count: unread.get(target) || 0, lastRead: companion.readState?.[target] };
    const result = await originalOpenChat(kind, id, options);
    const after = currentKey();
    if (after && after !== before) { loadChat(); markFirstUnread(unreadBefore); }
    return result;
  };
  const originalSend = sendChatMessage;
  sendChatMessage = content => {
    let text = content;
    if (state.replyTo) { text = `> ${state.replyTo.author}: ${state.replyTo.text}\n${content}`; cancelReply(); }
    const result = originalSend(text);
    const key = currentKey(); if (key) setDraft(key, '');
    return result;
  };
  const originalDelivered = markDelivered;
  markDelivered = (node, key) => { originalDelivered(node, key); const id = String(key).split(':')[0]; if (/^\d+$/.test(id)) { node.dataset.id = id; decorate(node); } };
  const originalHeader = renderConversationHeader;
  renderConversationHeader = () => {
    const query = $('#header-search input')?.value || '';
    originalHeader();
    const actions = document.querySelector('#conversation-header .header-actions'); if (!actions || !current) return;
    const name = current.kind === 'room' ? `# ${current.data.name ?? ''}` : displayName(current.data);
    // Like Discord: call, pinned messages, members (rooms only), then the search field; the
    // buttons keep the app's round XP style.
    actions.insertAdjacentHTML('beforeend', `${companion.token ? `<button class="call-button pins-button" id="pins-button" type="button" aria-label="${esc(t('pinnedMessages'))}">${ICONS.pin}</button>` : ''}<label class="header-search" id="header-search" title="Ctrl+F"><input type="search" placeholder="${esc(t('searchIn', { name }))}" aria-label="${esc(t('searchChat'))}"><span class="search-count"></span>${ICONS.search}</label>`);
    const call = $('#start-call'), members = $('#room-members'), pins = $('#pins-button'), search = $('#header-search');
    [call, pins, members, search].filter(Boolean).forEach(node => actions.append(node));
    const input = $('#header-search input'); input.value = query;
    // Narrow windows show the field as a round button; a click opens it over the header.
    $('#header-search').addEventListener('click', () => { $('#header-search').classList.add('open'); input.focus(); });
    input.addEventListener('blur', () => { if (!input.value) $('#header-search')?.classList.remove('open'); });
    input.oninput = () => runSearch(input.value);
    input.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); stepSearch(event.shiftKey ? 1 : -1); } if (event.key === 'Escape') { event.stopPropagation(); closeSearch(); input.blur(); } };
    $('#pins-button')?.addEventListener('click', event => { event.stopPropagation(); togglePinsPopover(); });
    renderPins(); renderTyping();
  };
  // Right click (long press on phones) on a chat: favourite and mute, which left the header.
  $('#chat-list').addEventListener('contextmenu', event => {
    const item = event.target.closest('.chat-item[data-kind]'); if (!item) return; event.preventDefault(); closeMenu();
    const key = chatKey(item.dataset.kind, item.dataset.id);
    const menu = document.createElement('div'); menu.id = 'message-menu'; menu.className = 'message-menu'; menu.setAttribute('role', 'menu');
    menu.innerHTML = `<button type="button" data-action="open">${ICONS.open}${esc(t('openChat'))}</button><button type="button" data-action="favorite">${isFavorite(key) ? ICONS.starOff : ICONS.star}${esc(t(isFavorite(key) ? 'favoriteRemove' : 'favoriteAdd'))}</button><button type="button" data-action="mute">${isMuted(key) ? ICONS.bell : ICONS.bellOff}${esc(t(isMuted(key) ? 'unmuteChat' : 'muteChat'))}</button><button type="button" data-action="sound">${ICONS.bell}${esc(t('chatSound'))}</button>${desktopControls?.openGame && window.nkAddonInstalled?.('minesweeper') ? `<button type="button" data-action="game"><img class="menu-picture" src="assets/images/games/minesweeper.png" alt="">${esc(t('challengeMine'))}</button>` : ''}${desktopControls?.openAddon ? (window.nkAddonList?.() || []).filter(addon => addon.challenge).map(addon => `<button type="button" data-action="challenge:${esc(addon.id)}"><img class="menu-picture" src="${esc(addon.icon32 || addon.icon)}" alt="">${esc(t('challengeGame', { game: gameName(addon.id) }))}</button>`).join('') : ''}${companion?.token && desktopControls?.openAddon ? (window.nkAddonList?.() || []).filter(addon => addon.multiplayer).map(addon => `<button type="button" data-action="play:${esc(addon.id)}"><img class="menu-picture" src="${esc(addon.icon32 || addon.icon)}" alt="">${esc(t('playGame', { game: gameName(addon.id) }))}</button>`).join('') : ''}${companion?.token && desktopControls?.openAddon ? `<button type="button" data-action="watch">${esc(t('watchGames'))}</button>` : ''}<button type="button" data-action="archive">${ICONS.archive}${esc(t(isArchived(key) ? 'unarchive' : 'archive'))}</button>`;
    document.body.append(menu);
    const box = menu.getBoundingClientRect(); menu.style.left = `${Math.min(event.clientX, innerWidth - box.width - 4)}px`; menu.style.top = `${Math.min(event.clientY, innerHeight - box.height - 4)}px`;
    menu.onclick = click => {
      const action = click.target.closest('[data-action]')?.dataset.action; if (!action) return; closeMenu();
      if (action === 'open') item.click();
      if (action === 'favorite') toggleFavorite(key);
      if (action === 'mute') toggleMuted(key);
      if (action === 'archive') toggleArchived(key);
      if (action === 'sound') openChatSound(key, item.querySelector('.chat-name b')?.textContent?.trim() || '');
      if (action === 'game') openChallenge(key);
      if (action.startsWith('play:')) startGame(key, action.slice(5));
      if (action === 'watch') watchGames();
      if (action.startsWith('challenge:')) openGameChallenge(key, (window.nkAddonList?.() || []).find(addon => addon.id === action.slice(10)));
    };
  });
  // A challenge for a card game: everyone gets the same deal (the seed); the winner's result comes back to the chat.
  function openGameChallenge(key, addon) {
    if (!addon?.challenge) return;
    const send = option => {
      const seed = 1 + Math.floor(Math.random() * ((addon.challenge.maxSeed || 2 ** 31) - 1));
      sendToChat(key, `${t('gameChallenge2', { name: displayName(me), game: gameName(addon.id) })} [nkchallenge:${addon.id}:${seed}${option ? `:${option}` : ''}]`);
      desktopControls?.openAddon?.(addon.id, { seed: String(seed), level: option, chat: key });
    };
    const options = addon.challenge.options || [];
    if (!options.length) { send(''); return; }
    const language = displaySettings?.language === 'en' ? 'en' : 'ru';
    let dialog = $('#challenge-dialog');
    if (!dialog) { dialog = document.createElement('dialog'); dialog.id = 'challenge-dialog'; dialog.className = 'xp-dialog chat-sound-dialog'; document.body.append(dialog); }
    dialog.innerHTML = `<div class="dialog-title">${esc(t('challengeGame', { game: gameName(addon.id) }).replace('…', ''))}</div><div class="chat-sound-body"><p>${esc(t('challengeText'))}</p>${options.map((option, index) => `<label class="challenge-level"><input type="radio" name="challenge-level" value="${esc(option.id)}"${index ? '' : ' checked'}> ${esc(option.name?.[language] || option.name?.en || option.id)}</label>`).join('')}<div class="chat-sound-actions"><button type="button" class="xp-button" id="challenge-send">${esc(t('challengeSend'))}</button><button type="button" class="xp-button" id="challenge-cancel">${esc(t('cancel'))}</button></div></div>`;
    dialog.querySelector('#challenge-cancel').onclick = () => dialog.close();
    dialog.querySelector('#challenge-send').onclick = () => { const option = dialog.querySelector('[name="challenge-level"]:checked').value; dialog.close(); send(option); };
    dialog.showModal();
  }
  // Minesweeper challenge: the level, then a message with the field's seed ([minesweeper:…]).
  function openChallenge(key) {
    let dialog = $('#challenge-dialog');
    if (!dialog) { dialog = document.createElement('dialog'); dialog.id = 'challenge-dialog'; dialog.className = 'xp-dialog chat-sound-dialog'; document.body.append(dialog); }
    const levels = (translations[displaySettings?.language === 'en' ? 'en' : 'ru'] || translations.ru).levels;
    dialog.innerHTML = `<div class="dialog-title">${esc(t('challengeTitle'))}</div><div class="chat-sound-body"><p>${esc(t('challengeText'))}</p>${Object.entries(levels).map(([value, label], index) => `<label class="challenge-level"><input type="radio" name="challenge-level" value="${value}"${index ? '' : ' checked'}> ${esc(label)}</label>`).join('')}<div class="chat-sound-actions"><button type="button" class="xp-button" id="challenge-send">${esc(t('challengeSend'))}</button><button type="button" class="xp-button" id="challenge-cancel">${esc(t('cancel'))}</button></div></div>`;
    dialog.querySelector('#challenge-cancel').onclick = () => dialog.close();
    dialog.querySelector('#challenge-send').onclick = () => {
      const level = dialog.querySelector('[name="challenge-level"]:checked').value; const seed = Math.floor(Math.random() * 2 ** 31);
      sendToChat(key, `${t('gameChallenge', { name: displayName(me), level: levels[level] })} [minesweeper:${level}:${seed}]`);
      dialog.close(); desktopControls?.openGame?.({ game: 'minesweeper', level, seed, chat: key });
    };
    dialog.showModal();
  }
  // Notification sound of one chat: a small XP dialog with the sound, Play and the volume.
  function openChatSound(key, name) {
    let dialog = $('#chat-sound-dialog');
    if (!dialog) { dialog = document.createElement('dialog'); dialog.id = 'chat-sound-dialog'; dialog.className = 'xp-dialog chat-sound-dialog'; document.body.append(dialog); }
    const own = chatSoundSettings()[key] || {};
    const names = (translations[displaySettings?.language === 'en' ? 'en' : 'ru'] || translations.ru).soundNames;
    dialog.innerHTML = `<div class="dialog-title">${esc(t('chatSoundTitle', { name }))}</div><div class="chat-sound-body"><label>${esc(t('chatSoundLabel'))}<span class="chat-sound-row"><select id="chat-sound-choice">${Object.entries(names).map(([value, label]) => `<option value="${value}"${(own.sound || 'notify') === value ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select><button type="button" class="xp-button" id="chat-sound-play">▶ ${esc(t('play'))}</button></span></label><label>${esc(t('chatVolume'))}<span class="chat-sound-row"><input id="chat-sound-volume" type="range" min="0" max="100" step="5" value="${Number.isFinite(Number(own.volume)) ? Number(own.volume) : 100}"><span id="chat-sound-volume-value"></span></span></label><div class="chat-sound-actions"><button type="button" class="xp-button" id="chat-sound-ok">${esc(t('ok'))}</button><button type="button" class="xp-button" id="chat-sound-cancel">${esc(t('cancel'))}</button></div></div>`;
    const volume = dialog.querySelector('#chat-sound-volume'), value = dialog.querySelector('#chat-sound-volume-value');
    const show = () => { value.textContent = `${volume.value}%`; }; show(); volume.oninput = show;
    dialog.querySelector('#chat-sound-play').onclick = () => { const sound = dialog.querySelector('#chat-sound-choice').value; if (sound === 'none') return; const audio = playSound(sound); audio.volume = Math.min(1, audio.volume * Number(volume.value) / 100); };
    dialog.querySelector('#chat-sound-cancel').onclick = () => dialog.close();
    dialog.querySelector('#chat-sound-ok').onclick = () => {
      const all = chatSoundSettings(); const sound = dialog.querySelector('#chat-sound-choice').value; const level = Number(volume.value);
      if (sound === 'notify' && level === 100) delete all[key]; else all[key] = { sound, volume: level };
      try { localStorage.setItem('nk_chat_sounds', JSON.stringify(all)); } catch {}
      pushCompanionSettings(); dialog.close();
    };
    dialog.showModal();
  }
  const originalEvents = openCompanionEvents;
  openCompanionEvents = () => {
    originalEvents();
    const source = companion.events; if (!source) return;
    const parse = event => { try { return JSON.parse(event.data); } catch { return null; } };
    source.addEventListener('typing', event => { const change = parse(event); if (!change || change.chat !== state.chat || Number(change.user) === Number(me?.id)) return; state.typing.set(Number(change.user), Date.now() + 6000); renderTyping(); });
    source.addEventListener('reaction', event => { const change = parse(event); if (change && Number(change.user) !== Number(me?.id)) applyReaction(change); });
    source.addEventListener('pin', event => { const change = parse(event); if (change && Number(change.user) !== Number(me?.id)) applyPin(change); });
    source.addEventListener('read', event => { const change = parse(event); if (!change || change.chat !== state.chat) return; state.read = change.last_read; articles().forEach(renderReceipt); });
  };
  // A message from someone ends their "typing…".
  const originalAppend = appendMessage;
  appendMessage = (message, mine, ...rest) => { const sender = Number(message.user?.id || message.sender?.id || message.user_id || message.sender_id); if (state.typing.delete(sender)) renderTyping(); return originalAppend(message, mine, ...rest); };

  // ---- @mention suggestions ----------------------------------------------------------------------
  let mentionIndex = 0;
  function mentionQuery() { const input = $('#message-input'); const before = input.value.slice(0, input.selectionStart ?? input.value.length); return before.match(/(^|\s)@([\w.-]{0,32})$/)?.[2] ?? null; }
  function mentionCandidates(query) {
    const people = current?.kind === 'room' ? (Array.isArray(current.data.members) && current.data.members.length ? current.data.members.map(member => userFor?.(member.id) || member) : users) : current ? [current.data] : [];
    const needle = query.toLowerCase();
    return people.filter(user => user && user.id !== me?.id && user.username && `${user.username} ${user.display_name || ''}`.toLowerCase().includes(needle)).slice(0, 8);
  }
  function renderMentions() {
    const query = mentionQuery(); let box = $('#mention-box');
    const people = query === null ? [] : mentionCandidates(query);
    if (!people.length) { box?.remove(); return; }
    if (!box) { box = document.createElement('div'); box.id = 'mention-box'; box.className = 'mention-box'; $('#composer').before(box); }
    mentionIndex = Math.min(mentionIndex, people.length - 1);
    box.innerHTML = people.map((user, index) => `<button type="button" class="mention-item${index === mentionIndex ? ' selected' : ''}" data-username="${esc(user.username)}"><b>${esc(displayName(user))}</b> <small>@${esc(user.username)}</small></button>`).join('');
    box.onmousedown = event => { const item = event.target.closest('[data-username]'); if (item) { event.preventDefault(); insertMention(item.dataset.username); } };
  }
  function insertMention(username) {
    const input = $('#message-input'); const caret = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, caret).replace(/@[\w.-]*$/, `@${username} `);
    input.value = before + input.value.slice(caret); input.setSelectionRange(before.length, before.length); input.focus();
    $('#mention-box')?.remove(); input.dispatchEvent(new Event('input'));
  }
  $('#message-input').addEventListener('keydown', event => {
    const box = $('#mention-box'); if (!box) return;
    const items = [...box.querySelectorAll('.mention-item')];
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); mentionIndex = (mentionIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; renderMentions(); }
    else if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); insertMention(items[mentionIndex]?.dataset.username); }
    else if (event.key === 'Escape') { event.stopPropagation(); box.remove(); }
  }, true);
  $('#message-input').addEventListener('input', () => { mentionIndex = 0; renderMentions(); });
  $('#message-input').addEventListener('blur', () => setTimeout(() => $('#mention-box')?.remove(), 150));

  // ---- notes about people (in their profile, only you see them) ----------------------------------
  const originalProfile = showUserProfile;
  showUserProfile = user => {
    originalProfile(user); if (!user) return;
    let note = $('#user-profile-note');
    if (!note) { $('#user-profile-bio').insertAdjacentHTML('afterend', `<label class="profile-note"><span>${esc(t('note'))}</span><textarea id="user-profile-note" rows="2" maxlength="1000"></textarea></label>`); note = $('#user-profile-note'); }
    note.placeholder = t('notePlaceholder'); note.value = userNotes[String(user.id)] || ''; note.dataset.user = String(user.id);
    note.oninput = () => { clearTimeout(note.timer); note.timer = setTimeout(() => setUserNote(note.dataset.user, note.value), 600); };
  };
  // Last seen in the header, refreshed with the statuses without redrawing the header.
  const originalStatuses = refreshStatuses;
  refreshStatuses = async (...args) => {
    const result = await originalStatuses(...args);
    const small = document.querySelector('#conversation-header small');
    if (small && current?.kind === 'dm') { small.dataset.base = !userOnline(current.data) ? lastSeenText(current.data.id) || `@${current.data.username}` : `@${current.data.username}`; renderTyping(); }
    return result;
  };

  // Typing notice at most every 3 s, and the draft of the open chat.
  $('#message-input').addEventListener('input', () => {
    const key = currentKey(); if (!key) return;
    setDraft(key, $('#message-input').value);
    if ($('#message-input').value.trim() && companion.token && Date.now() - state.lastTyping > 3000) { state.lastTyping = Date.now(); companionFetch('POST', '/typing', { chat: key }); }
  });
  window.chatExtras = { decorate, reload: loadChat };
})();
