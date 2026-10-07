// Files in chats: attach with the paperclip, by dragging a file into the window or by pasting it.
// The file goes to the other side live over the Nekochat server's /ws/transfer socket (frames of
// kind 3, the first one starts with the file's name, size and type, see the server's files.ts) and,
// with "Infinity Memory" ticked, is also kept on our own server (up to 50 MB) with a link in the
// message, so a friend who is offline can still get it.
// This script runs after nekochat.js and uses its globals (API, token, me, current, companion...).
(() => {
  const words = {
    ru: {
      attach: 'Прикрепить файл', infinity: 'Infinity Memory', infinityHint: 'Ещё и сохранить на сервере Nekochat Reloaded (до {max}): получатель скачает файл и позже, по ссылке',
      remove: 'Убрать', sendFiles: 'Файлов: {count}', tooBig: 'Файл «{name}» больше {max}', tooBigInfinity: 'Файл «{name}» больше {max}: Infinity Memory его не возьмёт, он уйдёт только напрямую',
      noChat: 'Сначала откройте чат', sending: 'Отправка…', sent: 'Отправлено', notConfirmed: 'Получатель не подтвердил', failed: 'Не удалось отправить: {error}',
      receiving: 'Получение…', received: 'Получено', save: 'Сохранить', close: 'Закрыть', from: 'от {name}', to: 'для {name}', transfers: 'Передача файлов',
      saved: 'Сохранить файл', infinityCard: 'Infinity Memory', download: 'Скачать', dropHere: 'Отпустите файл, чтобы прикрепить', noServer: 'Подключитесь к серверу Nekochat Reloaded, чтобы использовать Infinity Memory',
      uploadFailed: 'Infinity Memory: не удалось сохранить на сервере ({error})', channel: 'канал передачи файлов не открылся',
      myFiles: 'Мои файлы', myFilesTitle: 'Мои файлы (Infinity Memory)', colName: 'Имя', colSize: 'Размер', colDate: 'Дата', copyLink: 'Копировать ссылку', copied: 'Скопировано', open: 'Открыть', delete: 'Удалить',
      usedOf: 'Занято {used} из {total}', noFiles: 'Пока нет сохранённых файлов. Отправьте файл с галкой Infinity Memory.', confirmDelete: 'Удалить файл «{name}» с сервера? Ссылка в чате перестанет работать.', listFailed: 'Не удалось получить список файлов ({error})',
      decline: 'Отклонить', incomingFile: 'Файл от {name}: {file}', updateTitle: 'Нужно обновить Nekochat Reloaded', updateText: 'Сервер просит версию {min} или новее, а у вас {version}. Обновите клиент: Панель управления → Windows Update.',
    },
    en: {
      attach: 'Attach a file', infinity: 'Infinity Memory', infinityHint: 'Also keep it on the Nekochat Reloaded server (up to {max}): the receiver can download it later from a link',
      remove: 'Remove', sendFiles: 'Files: {count}', tooBig: 'The file "{name}" is larger than {max}', tooBigInfinity: 'The file "{name}" is larger than {max}: Infinity Memory will not take it, it goes directly only',
      noChat: 'Open a chat first', sending: 'Sending…', sent: 'Sent', notConfirmed: 'The receiver did not confirm', failed: 'Could not send: {error}',
      receiving: 'Receiving…', received: 'Received', save: 'Save', close: 'Close', from: 'from {name}', to: 'to {name}', transfers: 'File transfers',
      saved: 'Save the file', infinityCard: 'Infinity Memory', download: 'Download', dropHere: 'Drop the file to attach it', noServer: 'Connect to the Nekochat Reloaded server to use Infinity Memory',
      uploadFailed: 'Infinity Memory: could not store it on the server ({error})', channel: 'the file channel did not open',
      myFiles: 'My files', myFilesTitle: 'My files (Infinity Memory)', colName: 'Name', colSize: 'Size', colDate: 'Date', copyLink: 'Copy link', copied: 'Copied', open: 'Open', delete: 'Delete',
      usedOf: '{used} of {total} used', noFiles: 'No stored files yet. Send a file with Infinity Memory ticked.', confirmDelete: 'Delete the file "{name}" from the server? The link in the chat will stop working.', listFailed: 'Could not get the list of files ({error})',
      decline: 'Decline', incomingFile: 'File from {name}: {file}', updateTitle: 'Nekochat Reloaded needs an update', updateText: 'The server asks for version {min} or newer, and you have {version}. Update the client: Control Panel → Windows Update.',
    },
  };
  const tr = (key, values = {}) => String((words[displaySettings?.language === 'en' ? 'en' : 'ru'] || words.ru)[key] || key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
  const MAX_LIVE = 512 * 1024 * 1024;       // the official server's ceiling for a live transfer
  const MAX_INFINITY = 50 * 1024 * 1024;    // what our server keeps
  const CHUNK = 64 * 1024;
  const size = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0)} MB`;
  const $$ = selector => document.querySelector(selector);
  const isImage = (name, type = '') => /^image\/(png|jpe?g|gif|webp|bmp)/i.test(type) || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name || '');
  const dateText = seconds => new Date(seconds * 1000).toLocaleString(displaySettings?.language === 'en' ? 'en-GB' : 'ru-RU', { dateStyle: 'short', timeStyle: 'short' });

  // ---- attachments waiting for Send ----------------------------------------------------------
  const pending = [];
  let infinity = false; try { infinity = localStorage.getItem('nk_infinity') === '1'; } catch {}
  function renderAttachments() {
    const bar = $$('#attach-bar'); if (!bar) return;
    bar.hidden = !pending.length;
    if (!pending.length) { bar.innerHTML = ''; return; }
    bar.innerHTML = pending.map((item, index) => `<span class="attach-chip" title="${esc(item.file.name)}"><img class="${item.preview ? 'attach-thumb' : ''}" src="${esc(item.preview || 'assets/images/file.png')}" alt=""><b>${esc(item.file.name)}</b><small>${esc(size(item.file.size))}</small><button type="button" class="attach-remove" data-index="${index}" aria-label="${esc(tr('remove'))}">×</button></span>`).join('')
      + `<button type="button" class="attach-link" id="attach-myfiles">${esc(tr('myFiles'))}</button><label class="attach-infinity" title="${esc(tr('infinityHint', { max: size(MAX_INFINITY) }))}"><input type="checkbox" id="attach-infinity"${infinity ? ' checked' : ''}> ${esc(tr('infinity'))}</label>`;
  }
  function addFiles(files) {
    if (!current) { showSystemDialog(tr('noChat'), 'info', 'Nekochat Reloaded'); return; }
    for (const file of files) {
      if (!file || !file.size && !file.name) continue;
      if (file.size > MAX_LIVE) { showSystemDialog(tr('tooBig', { name: file.name, max: size(MAX_LIVE) }), 'error', 'Nekochat Reloaded'); continue; }
      pending.push({ file, preview: isImage(file.name, file.type) ? URL.createObjectURL(file) : '' });
    }
    renderAttachments();
    $$('#message-input')?.focus();
  }
  document.addEventListener('click', event => {
    const remove = event.target.closest?.('.attach-remove'); if (remove) { const [gone] = pending.splice(Number(remove.dataset.index), 1); if (gone?.preview) URL.revokeObjectURL(gone.preview); renderAttachments(); }
    if (event.target.closest?.('#attach-myfiles')) openMyFiles();
    if (event.target.closest?.('#attach-button')) $$('#attach-file')?.click();
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'attach-file') { addFiles([...event.target.files]); event.target.value = ''; }
    if (event.target.id === 'attach-infinity') { infinity = event.target.checked; try { localStorage.setItem('nk_infinity', infinity ? '1' : '0'); } catch {} }
  });
  $$('#attach-button')?.addEventListener('contextmenu', event => { event.preventDefault(); openMyFiles(); });
  // Drag a file into the window: it attaches by itself.
  let dragDepth = 0;
  const hasFiles = event => [...(event.dataTransfer?.types || [])].includes('Files');
  document.addEventListener('dragenter', event => { if (!hasFiles(event)) return; dragDepth++; $$('.conversation')?.classList.add('drop-target'); });
  document.addEventListener('dragleave', event => { if (!hasFiles(event)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $$('.conversation')?.classList.remove('drop-target'); });
  document.addEventListener('dragover', event => { if (hasFiles(event)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
  document.addEventListener('drop', event => {
    if (!hasFiles(event)) return;
    event.preventDefault(); dragDepth = 0; $$('.conversation')?.classList.remove('drop-target');
    addFiles([...event.dataTransfer.files]);
  });
  // Paste a file (a screenshot, a copied file) into the message box.
  document.addEventListener('paste', event => {
    if (event.target?.id !== 'message-input') return;
    const files = [...(event.clipboardData?.files || [])]; if (!files.length) return;
    event.preventDefault(); addFiles(files);
  });

  // ---- the /ws/transfer socket -----------------------------------------------------------------
  let channel = null, channelOpening = null;
  const transferUrl = () => { const url = new URL(websocketUrl()); url.pathname = url.pathname.replace(/\/ws$/, '/ws/transfer'); return url.href; };
  function openChannel() {
    if (channel && channel.readyState === WebSocket.OPEN) return Promise.resolve(channel);
    if (channelOpening) return channelOpening;
    channelOpening = new Promise((resolve, reject) => {
      let socket; try { socket = new WebSocket(transferUrl()); } catch (error) { channelOpening = null; reject(error); return; }
      socket.binaryType = 'arraybuffer';
      const timer = setTimeout(() => { try { socket.close(); } catch {} channelOpening = null; reject(Error(tr('channel'))); }, 5000);
      socket.onopen = () => { clearTimeout(timer); channel = socket; channelOpening = null; resolve(socket); };
      socket.onmessage = event => { if (event.data instanceof ArrayBuffer) receiveFrame(event.data); };
      socket.onclose = () => { if (channel === socket) channel = null; channelOpening = null; for (const waiter of acks.values()) waiter(false); };
      socket.onerror = () => {};
    });
    return channelOpening;
  }
  function frame(flags, target, payload) {
    const out = new Uint8Array(12 + payload.length); const view = new DataView(out.buffer);
    view.setUint8(0, 1); view.setUint8(1, 3); view.setUint16(2, flags, true); view.setUint32(4, target, true); view.setUint32(8, payload.length, true);
    out.set(payload, 12); return out;
  }
  const FLAG_ROOM = 1, FLAG_LAST = 2, STREAM_SHIFT = 2, STREAM_MASK = 0x3fff;

  // ---- the tray: every transfer with its progress -------------------------------------------------
  const transfers = new Map();
  function renderTray() {
    let tray = $$('#transfer-tray');
    if (!transfers.size) { tray?.remove(); return; }
    if (!tray) { tray = document.createElement('aside'); tray.id = 'transfer-tray'; tray.className = 'transfer-tray'; const bar = $$('#attach-bar'); if (bar) bar.before(tray); else (document.querySelector('.conversation') || document.body).append(tray); }
    tray.innerHTML = [...transfers.entries()].map(([key, item]) => {
      const percent = item.state === 'done' && !item.error ? 100 : item.size ? Math.min(100, Math.round(item.done * 100 / item.size)) : 0;
      const state = item.error ? item.error : item.state === 'done' ? (item.dir === 'in' ? tr('received') : item.unconfirmed ? tr('notConfirmed') : tr('sent')) : `${item.dir === 'in' ? tr('receiving') : tr('sending')} ${percent}%`;
      return `<div class="transfer-row ${item.error ? 'error' : ''}" data-key="${esc(key)}"><img class="transfer-icon${item.image && item.url ? ' transfer-thumb' : ''}" src="${esc(item.image && item.url ? item.url : 'assets/images/file.png')}" alt="">`
        + `<div class="transfer-main"><div class="transfer-line"><b class="transfer-name" title="${esc(item.name)}">${esc(item.name)}</b><small>${esc(size(item.size))} · ${esc(item.dir === 'in' ? tr('from', { name: item.peer }) : tr('to', { name: item.peer }))}</small></div>`
        + `<div class="transfer-progress"><div class="transfer-bar"><i style="width:${percent}%"></i></div><small class="transfer-state">${esc(state)}</small></div></div>`
        + `<div class="transfer-actions">${item.url ? `<button type="button" class="transfer-save xp-button" data-key="${esc(key)}">${esc(tr('save'))}</button><button type="button" class="transfer-decline xp-button" data-key="${esc(key)}">${esc(tr('decline'))}</button>` : ''}<button type="button" class="transfer-close" data-key="${esc(key)}" aria-label="${esc(tr('close'))}">×</button></div></div>`;
    }).join('');
  }
  document.addEventListener('click', event => {
    const close = event.target.closest?.('.transfer-close'); if (close) { const item = transfers.get(close.dataset.key); if (item?.url) URL.revokeObjectURL(item.url); transfers.delete(close.dataset.key); renderTray(); return; }
    const decline = event.target.closest?.('.transfer-decline'); if (decline) { const item = transfers.get(decline.dataset.key); if (item?.url) URL.revokeObjectURL(item.url); transfers.delete(decline.dataset.key); renderTray(); return; }
    const save = event.target.closest?.('.transfer-save'); if (save) {
      const item = transfers.get(save.dataset.key); if (!item?.url) return;
      const link = document.createElement('a'); link.href = item.url; link.download = item.name; document.body.append(link); link.click(); link.remove();
    }
  });
  const peerName = target => target.kind === 'room' ? (target.data.name || `#${target.data.id}`) : displayName(target.data);

  // ---- sending --------------------------------------------------------------------------------------
  const acks = new Map();
  let queue = Promise.resolve();
  function sendLive(file, target) {
    // One file at a time: the server gives each user one transfer slot.
    const run = async () => {
      const stream = 1 + Math.floor(Math.random() * STREAM_MASK);
      const key = `out-${stream}`;
      const item = { dir: 'out', name: file.name || 'file', size: file.size, done: 0, state: 'sending', peer: peerName(target) };
      transfers.set(key, item); renderTray();
      try {
        const socket = await openChannel();
        const json = new TextEncoder().encode(JSON.stringify({ n: item.name, s: file.size, t: file.type || 'application/octet-stream' }));
        const flagsBase = (target.kind === 'room' ? FLAG_ROOM : 0) | (stream << STREAM_SHIFT);
        const address = Number(target.data.id);
        let offset = 0, first = true;
        const ack = new Promise(resolve => { const timer = setTimeout(() => { acks.delete(stream); resolve(false); }, 8000); acks.set(stream, ok => { clearTimeout(timer); acks.delete(stream); resolve(ok); }); });
        if (file.size === 0) { socket.send(frame(flagsBase | FLAG_LAST, address, joinFirst(json, new Uint8Array(0)))); }
        while (offset < file.size) {
          const end = Math.min(offset + CHUNK, file.size);
          const slice = new Uint8Array(await file.slice(offset, end).arrayBuffer());
          offset = end;
          const payload = first ? joinFirst(json, slice) : slice; first = false;
          if (socket.readyState !== WebSocket.OPEN) throw Error(tr('channel'));
          socket.send(frame(flagsBase | (offset >= file.size ? FLAG_LAST : 0), address, payload));
          item.done = offset; renderTray();
          while (socket.bufferedAmount > 1048576) await new Promise(resolve => setTimeout(resolve, 20));
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        item.unconfirmed = !(await ack);
        item.state = 'done'; item.done = file.size; renderTray();
        setTimeout(() => { if (transfers.get(key) === item && !item.error) { transfers.delete(key); renderTray(); } }, 8000);
      } catch (error) {
        acks.delete(stream); item.error = tr('failed', { error: error.message || error }); item.state = 'done'; renderTray();
      }
    };
    queue = queue.then(run, run);
    return queue;
  }
  const joinFirst = (json, head) => { const out = new Uint8Array(4 + json.length + head.length); new DataView(out.buffer).setUint32(0, json.length, true); out.set(json, 4); out.set(head, 4 + json.length); return out; };

  async function storeInfinity(file) {
    if (!companion.url || !companion.token) throw Error(tr('noServer'));
    const response = await fetch(`${companion.url}/files?name=${encodeURIComponent(file.name || 'file')}&mime=${encodeURIComponent(file.type || 'application/octet-stream')}`, { method: 'POST', headers: { Authorization: `Bearer ${companion.token}`, 'Content-Type': 'application/octet-stream' }, body: file });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(typeof data.detail === 'string' ? data.detail : String(response.status));
    return `${companion.url}${data.path}`;
  }
  // A message with a link the receiver's Reloaded shows as a file card; other clients see the text.
  const infinityMessage = (file, link) => `📎 ${file.name || 'file'} (${size(file.size)}) ∞ ${link}`;

  async function sendAttachments() {
    const target = current; const items = pending.splice(0); renderAttachments();
    for (const { file, preview } of items) {
      if (preview) setTimeout(() => URL.revokeObjectURL(preview), 60000);
      const wantInfinity = infinity;
      if (wantInfinity && file.size <= MAX_INFINITY) {
        try {
          const link = await storeInfinity(file);
          sendToChat(chatKey(target.kind, target.data.id), infinityMessage(file, link));
        } catch (error) { showSystemDialog(tr('uploadFailed', { error: error.message }), 'error', 'Nekochat Reloaded'); }
      } else if (wantInfinity) showSystemDialog(tr('tooBigInfinity', { name: file.name, max: size(MAX_INFINITY) }), 'info', 'Nekochat Reloaded');
      sendLive(file, target);
    }
  }
  // Send with attachments: the files go first, then the text as usual.
  $$('#composer')?.addEventListener('submit', event => {
    if (!pending.length || !current) return;
    if (!$$('#message-input').value.trim()) { event.preventDefault(); event.stopImmediatePropagation(); }
    sendAttachments();
  }, true);

  // ---- receiving ------------------------------------------------------------------------------------
  const incoming = new Map();
  function senderName(id) { const user = users.find(item => Number(item.id) === Number(id)); return user ? displayName(user) : `#${id}`; }
  function receiveFrame(buffer) {
    if (buffer.byteLength < 12) return;
    const view = new DataView(buffer);
    if (view.getUint8(0) !== 1 || view.getUint8(1) !== 3) return;
    const flags = view.getUint16(2, true), from = view.getUint32(4, true), length = view.getUint32(8, true);
    if (12 + length > buffer.byteLength) return;
    const payload = new Uint8Array(buffer, 12, length);
    const stream = (flags >> STREAM_SHIFT) & STREAM_MASK, last = Boolean(flags & FLAG_LAST);
    if (length === 1 && payload[0] === 0x41) { acks.get(stream)?.(true); return; }
    const key = `in-${from}-${stream}`;
    let record = incoming.get(key);
    if (!record) {
      if (length < 4) return;
      const jsonLength = new DataView(buffer, 12, length).getUint32(0, true);
      if (jsonLength < 4 || jsonLength > 4096 || length < 4 + jsonLength) return;
      let meta; try { meta = JSON.parse(new TextDecoder().decode(payload.subarray(4, 4 + jsonLength))); } catch { return; }
      if (typeof meta?.n !== 'string' || typeof meta?.s !== 'number' || meta.s > MAX_LIVE) return;
      if (length - 4 - jsonLength > meta.s) return;   // the first frame must not carry more than the declared size
      record = { meta, parts: [], got: 0, item: { dir: 'in', name: meta.n.replace(/[\\/\0]/g, '_').slice(0, 200) || 'file', size: meta.s, done: 0, state: 'receiving', peer: senderName(from) } };
      record.item.image = isImage(record.item.name, meta.t);
      incoming.set(key, record); transfers.set(key, record.item);
      try { playSound('notify'); desktopControls?.notifyMessage?.({ sender: senderName(from), content: tr('incomingFile', { name: senderName(from), file: record.item.name }), avatarUrl: '' }); } catch {}
      const head = payload.slice(4 + jsonLength); if (head.length) { record.parts.push(head); record.got += head.length; }
    } else {
      // More than the declared size is cut off, as in the official client.
      if (record.got + length > record.meta.s) { incoming.delete(key); record.item.error = tr('failed', { error: 'size' }); record.item.state = 'done'; renderTray(); return; }
      record.parts.push(payload.slice()); record.got += length;
    }
    record.item.done = record.got;
    if (last) {
      incoming.delete(key);
      const blob = new Blob(record.parts, { type: record.meta.t || 'application/octet-stream' });
      record.item.url = URL.createObjectURL(blob); record.item.state = 'done'; record.item.done = record.item.size;
      if (channel?.readyState === WebSocket.OPEN) channel.send(frame(FLAG_LAST | (stream << STREAM_SHIFT), from, new Uint8Array([0x41])));
    }
    renderTray();
  }
  // The socket opens with the chat window, so a file sent to us arrives at once.
  const watch = setInterval(() => { if (typeof token === 'string' && token && typeof me !== 'undefined' && me) { clearInterval(watch); openChannel().catch(() => {}); } }, 2000);
  window.addEventListener('nk-transfer-reopen', () => openChannel().catch(() => {}));

  // ---- a message with an Infinity Memory link is a file card --------------------------------------
  const INFINITY = /📎 (.{1,120}?) \(([\d.,]+ ?[KMG]?B)\) ∞ (https?:\/\/[^\s]+\/f\/[0-9a-f]{16}\/[\w-]{10,40})/;
  window.nkFileCard = content => {
    const match = INFINITY.exec(String(content || '')); if (!match) return null;
    return { name: match[1], size: match[2], url: match[3], rest: String(content).replace(match[0], '').trim() };
  };
  window.nkFileCardHtml = card => `<div class="file-card-box"><div class="file-card"><img class="file-card-icon" src="assets/images/file.png" alt=""><div class="file-card-text"><b>${esc(card.name)}</b><small>${esc(card.size)} · ∞ ${esc(tr('infinityCard'))}</small></div><a class="file-card-download xp-button" href="${esc(card.url)}" target="_blank" rel="noopener">${esc(tr('download'))}</a></div>${isImage(card.name) ? `<a href="${esc(card.url)}" target="_blank" rel="noopener"><img class="file-card-preview" src="${esc(card.url)}" alt="${esc(card.name)}" loading="lazy"></a>` : ''}</div>`;
  const relabel = () => { const button = $$('#attach-button'); if (button) { button.title = tr('attach'); button.setAttribute('aria-label', tr('attach')); } };
  relabel(); setInterval(relabel, 3000);

  // ---- My files: what Infinity Memory keeps for you -------------------------------------------------
  async function openMyFiles() {
    $$('#my-files-dialog')?.remove();
    const dialog = document.createElement('dialog'); dialog.id = 'my-files-dialog'; dialog.className = 'xp-dialog my-files-dialog';
    dialog.innerHTML = `<button class="dialog-close" type="button" aria-label="${esc(tr('close'))}">×</button><div class="dialog-title">${esc(tr('myFilesTitle'))}</div><div class="my-files-body"><div class="my-files-list" id="my-files-list"></div><p class="my-files-used" id="my-files-used"></p></div><div class="my-files-buttons"><button class="xp-button my-files-close" type="button">${esc(tr('close'))}</button></div>`;
    document.body.append(dialog);
    const close = () => { dialog.close(); dialog.remove(); };
    dialog.querySelector('.dialog-close').onclick = close; dialog.querySelector('.my-files-close').onclick = close;
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.showModal();
    const list = dialog.querySelector('#my-files-list'), used = dialog.querySelector('#my-files-used');
    if (!companion.url || !companion.token) { list.innerHTML = `<p class="my-files-empty">${esc(tr('noServer'))}</p>`; return; }
    const load = async () => {
      let data;
      try {
        const response = await fetch(`${companion.url}/files`, { headers: { Authorization: `Bearer ${companion.token}` } });
        if (!response.ok) throw Error(String(response.status)); data = await response.json();
      } catch (error) { list.innerHTML = `<p class="my-files-empty">${esc(tr('listFailed', { error: error.message }))}</p>`; return; }
      used.textContent = tr('usedOf', { used: size(data.used_bytes || 0), total: size(data.total_bytes || 0) });
      if (!data.files.length) { list.innerHTML = `<p class="my-files-empty">${esc(tr('noFiles'))}</p>`; return; }
      list.innerHTML = `<table class="my-files-table"><thead><tr><th>${esc(tr('colName'))}</th><th>${esc(tr('colSize'))}</th><th>${esc(tr('colDate'))}</th><th></th></tr></thead><tbody>${data.files.map(file => `<tr data-id="${esc(file.id)}" data-name="${esc(file.name)}"><td title="${esc(file.name)}"><img src="assets/images/file.png" alt=""> ${esc(file.name)}</td><td>${esc(size(file.size))}</td><td>${esc(dateText(file.created_at))}</td><td><button type="button" class="xp-button my-files-delete">${esc(tr('delete'))}</button></td></tr>`).join('')}</tbody></table>`;
    };
    dialog.addEventListener('click', async event => {
      const button = event.target.closest('.my-files-delete'); if (!button) return;
      const row = button.closest('tr');
      if (!confirm(tr('confirmDelete', { name: row.dataset.name }))) return;
      try { await fetch(`${companion.url}/files/${row.dataset.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${companion.token}` } }); } catch {}
      load();
    });
    load();
  }
  window.nkOpenMyFiles = openMyFiles;

  // ---- the server can ask for a newer client (min_version from /api/me) ------------------------------------
  const versionParts = text => { const [main, pre = ''] = String(text || '0').split('-'); return { nums: main.split('.').map(part => parseInt(part, 10) || 0), pre }; };
  const older = (a, b) => {
    const x = versionParts(a), y = versionParts(b);
    for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i++) { const d = (x.nums[i] || 0) - (y.nums[i] || 0); if (d) return d < 0; }
    return Boolean(x.pre) && !y.pre;
  };
  let versionNagged = false;
  window.nkCheckVersion = user => {
    const min = String(user?.min_version || '').trim(), mine = String(window.NEKOCHAT_RELOADED_VERSION || '');
    if (!min || !mine || versionNagged || !older(mine, min)) return;
    versionNagged = true;
    showSystemDialog(tr('updateText', { min, version: mine }), 'warning', tr('updateTitle'));
  };

  // ---- a long press is a right click on a touch screen (chat list, messages, the paperclip) ---------------------
  let lastNative = 0, suppressClick = 0, pressTimer = 0, pressFrom = null;
  document.addEventListener('contextmenu', () => { lastNative = Date.now(); }, true);
  const stopPress = () => { clearTimeout(pressTimer); pressTimer = 0; pressFrom = null; };
  document.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || !event.target.closest?.('.chat-item, #messages article, #attach-button')) return;
    stopPress(); pressFrom = { x: event.clientX, y: event.clientY, target: event.target };
    pressTimer = setTimeout(() => {
      const from = pressFrom; stopPress(); if (!from) return;
      if (Date.now() - lastNative < 1500) { suppressClick = Date.now() + 700; return; }
      from.target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: from.x, clientY: from.y, button: 2 }));
      suppressClick = Date.now() + 700;
    }, 550);
  }, true);
  document.addEventListener('pointermove', event => { if (pressFrom && Math.hypot(event.clientX - pressFrom.x, event.clientY - pressFrom.y) > 10) stopPress(); }, true);
  for (const name of ['pointerup', 'pointercancel']) document.addEventListener(name, stopPress, true);
  document.addEventListener('click', event => { if (Date.now() < suppressClick) { event.preventDefault(); event.stopPropagation(); } }, true);
})();
