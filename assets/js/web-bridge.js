// Browser: stands in for preload.js. The host page (web/host.js) owns the windows,
// so every page takes its window.windowControls from there (same as ios-bridge.js).
(() => {
  let host;
  try { host = window.top.NKHost; } catch {}
  if (!host || window === window.top) return;
  window.windowControls = host.controlsFor(window);
  document.documentElement.classList.add('web');

  // Clicking a window brings it to the front, like on the PC. The first click also asks for
  // notification permission: browsers allow the prompt only right after a user action.
  window.addEventListener('pointerdown', () => { host.focusFrom(window); host.requestNotifications(); }, true);

  // -webkit-app-region: drag works only in Electron: move the window by its title bar.
  document.addEventListener('pointerdown', event => {
    const bar = event.target.closest?.('.xp-titlebar');
    if (!bar || event.button !== 0 || event.target.closest('button, input, select, textarea, a')) return;
    let lastX = event.screenX; let lastY = event.screenY;
    bar.setPointerCapture(event.pointerId);
    const move = moveEvent => { host.moveBy(window, moveEvent.screenX - lastX, moveEvent.screenY - lastY); lastX = moveEvent.screenX; lastY = moveEvent.screenY; };
    const stop = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', stop); bar.removeEventListener('pointercancel', stop); };
    bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', stop); bar.addEventListener('pointercancel', stop);
  });
  document.addEventListener('dblclick', event => {
    if (event.target.closest?.('.xp-titlebar') && !event.target.closest('button')) window.windowControls.maximize();
  });

  // Narrow screens show either the chat list or the open chat (see web.css).
  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('#conversation-header');
    if (!header) return;
    const update = () => {
      const open = header.childElementCount > 0;
      document.documentElement.classList.toggle('chat-open', open);
      if (open && !header.querySelector('.web-back')) {
        const button = document.createElement('button');
        // .xp-button gets the theme's real BUTTON_BMP 9-slice (theme-controls.css).
        button.type = 'button'; button.className = 'xp-button web-back'; button.setAttribute('aria-label', document.documentElement.lang === 'en' ? 'Back' : 'Назад');
        button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>';
        button.addEventListener('click', event => { event.stopPropagation(); document.querySelector('.tab.active')?.click(); });
        header.prepend(button);
      }
    };
    new MutationObserver(update).observe(header, { childList: true });
    update();
  });
})();
