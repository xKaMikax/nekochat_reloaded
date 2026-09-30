// Files in chats: attach with the paperclip, by dragging a file into the window or by pasting it.
// The file goes to the other side live over the Nekochat server's /ws/transfer socket (frames of
// kind 3, the first one starts with the file's name, size and type, see the server's files.ts) and,
// with "Infinity Memory" ticked, is also kept on our own server (up to 20 MB) with a link in the
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
    },
    en: {
      attach: 'Attach a file', infinity: 'Infinity Memory', infinityHint: 'Also keep it on the Nekochat Reloaded server (up to {max}): the receiver can download it later from a link',
      remove: 'Remove', sendFiles: 'Files: {count}', tooBig: 'The file "{name}" is larger than {max}', tooBigInfinity: 'The file "{name}" is larger than {max}: Infinity Memory will not take it, it goes directly only',
      noChat: 'Open a chat first', sending: 'Sending…', sent: 'Sent', notConfirmed: 'The receiver did not confirm', failed: 'Could not send: {error}',
      receiving: 'Receiving…', received: 'Received', save: 'Save', close: 'Close', from: 'from {name}', to: 'to {name}', transfers: 'File transfers',
      saved: 'Save the file', infinityCard: 'Infinity Memory', download: 'Download', dropHere: 'Drop the file to attach it', noServer: 'Connect to the Nekochat Reloaded server to use Infinity Memory',
      uploadFailed: 'Infinity Memory: could not store it on the server ({error})', channel: 'the file channel did not open',
    },
  };
  const tr = (key, values = {}) => String((words[displaySettings?.language === 'en' ? 'en' : 'ru'] || words.ru)[key] || key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
  const MAX_LIVE = 512 * 1024 * 1024;       // the official server's ceiling for a live transfer
  const MAX_INFINITY = 50 * 1024 * 1024;    // what our server keeps
  const CHUNK = 64 * 1024;
  const size = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0)} MB`;
  const $$ = selector => document.querySelector(selector);

  // ---- attachments waiting for Send ----------------------------------------------------------
  const pending = [];
  let infinity = false; try { infinity = localStorage.getItem('nk_infinity') === '1'; } catch {}
  function renderAttachments() {
    const bar = $$('#attach-bar'); if (!bar) return;
    bar.hidden = !pending.length;
    if (!pending.length) { bar.innerHTML = ''; return; }
    bar.innerHTML = pending.map((item, index) => `<span class="attach-chip" title="${esc(item.file.name)}"><b>📎 ${esc(item.file.name)}</b><small>${esc(size(item.file.size))}</small><button type="button" class="attach-remove" data-index="${index}" aria-label="${esc(tr('remove'))}">×</button></span>`).join('')
      + `<label class="attach-infinity" title="${esc(tr('infinityHint', { max: size(MAX_INFINITY) }))}"><input type="checkbox" id="attach-infinity"${infinity ? ' checked' : ''}> ${esc(tr('infinity'))}</label>`;
  }
  function addFiles(files) {
    if (!current) { showSystemDialog(tr('noChat'), 'info', 'Nekochat Reloaded'); return; }
    for (const file of files) {
      if (!file || !file.size && !file.name) continue;
      if (file.size > MAX_LIVE) { showSystemDialog(tr('tooBig', { name: file.name, max: size(MAX_LIVE) }), 'error', 'Nekochat Reloaded'); continue; }
      pending.push({ file });
    }
    renderAttachments();
    $$('#message-input')?.focus();
  }
  document.addEventListener('click', event => {
    const remove = event.target.closest?.('.attach-remove'); if (remove) { pending.splice(Number(remove.dataset.index), 1); renderAttachments(); }
    if (event.target.closest?.('#attach-button')) $$('#attach-file')?.click();
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'attach-file') { addFiles([...event.target.files]); event.target.value = ''; }
    if (event.target.id === 'attach-infinity') { infinity = event.target.checked; try { localStorage.setItem('nk_infinity', infinity ? '1' : '0'); } catch {} }
  });
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
    if (!tray) { tray = document.createElement('aside'); tray.id = 'transfer-tray'; tray.className = 'transfer-tray'; (document.querySelector('.conversation') || document.body).append(tray); }
    tray.innerHTML = `<header><b>${esc(tr('transfers'))}</b></header>` + [...transfers.entries()].map(([key, item]) => {
      const percent = item.size ? Math.min(100, Math.round(item.done * 100 / item.size)) : 0;
      const state = item.error ? item.error : item.state === 'done' ? (item.dir === 'in' ? tr('received') : item.unconfirmed ? tr('notConfirmed') : tr('sent')) : (item.dir === 'in' ? tr('receiving') : tr('sending'));
      return `<div class="transfer-row ${item.error ? 'error' : ''}" data-key="${esc(key)}"><div><b>${esc(item.name)}</b> <small>${esc(size(item.size))} · ${esc(item.dir === 'in' ? tr('from', { name: item.peer }) : tr('to', { name: item.peer }))}</small></div>`
        + `<div class="transfer-bar"><i style="width:${item.state === 'done' && !item.error ? 100 : percent}%"></i></div><small>${esc(state)}</small>`
        + `${item.url ? `<button type="button" class="transfer-save" data-key="${esc(key)}">${esc(tr('save'))}</button>` : ''}<button type="button" class="transfer-close" data-key="${esc(key)}" aria-label="${esc(tr('close'))}">×</button></div>`;
    }).join('');
  }
  document.addEventListener('click', event => {
    const close = event.target.closest?.('.transfer-close'); if (close) { const item = transfers.get(close.dataset.key); if (item?.url) URL.revokeObjectURL(item.url); transfers.delete(close.dataset.key); renderTray(); return; }
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
    for (const { file } of items) {
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
      record = { meta, parts: [], got: 0, item: { dir: 'in', name: meta.n.replace(/[\\/\0]/g, '_').slice(0, 200) || 'file', size: meta.s, done: 0, state: 'receiving', peer: senderName(from) } };
      incoming.set(key, record); transfers.set(key, record.item);
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
      try { playSound('notify'); } catch {}
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
  window.nkFileCardHtml = card => `<div class="file-card"><span class="file-card-icon">📎</span><div class="file-card-text"><b>${esc(card.name)}</b><small>${esc(card.size)} · ∞ ${esc(tr('infinityCard'))}</small></div><a class="file-card-download" href="${esc(card.url)}" target="_blank" rel="noopener">${esc(tr('download'))}</a></div>`;
  const relabel = () => { const button = $$('#attach-button'); if (button) { button.title = tr('attach'); button.setAttribute('aria-label', tr('attach')); } };
  relabel(); setInterval(relabel, 3000);
})();
