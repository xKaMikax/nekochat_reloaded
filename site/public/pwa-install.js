// Install the web version as an app: the browser's own prompt where there is one, a hint on an iPhone.
(() => {
  const ru = (navigator.language || '').toLowerCase().startsWith('ru');
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return;
  try { if (localStorage.getItem('nk_install_dismissed') === '1') return; } catch {}
  const text = ru ? { title: 'Установить Nekochat Reloaded как приложение?', install: 'Установить', later: 'Не сейчас', ios: 'Чтобы установить: нажмите «Поделиться» и «На экран Домой».' }
                  : { title: 'Install Nekochat Reloaded as an app?', install: 'Install', later: 'Not now', ios: 'To install: tap Share, then Add to Home Screen.' };
  let prompt = null;
  function bar(body, withButton) {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:99999;max-width:300px;padding:10px 12px;background:#ece9d8;border:2px outset #fff;font:12px Tahoma,Verdana,sans-serif;color:#000;box-shadow:2px 2px 6px rgba(0,0,0,.4)';
    box.innerHTML = `<b style="color:#000080">${text.title}</b><div style="margin:6px 0">${body}</div>`;
    const buttons = document.createElement('div');
    if (withButton) { const go = document.createElement('button'); go.textContent = text.install; go.onclick = async () => { box.remove(); try { prompt.prompt(); await prompt.userChoice; } catch {} }; buttons.append(go, ' '); }
    const later = document.createElement('button'); later.textContent = text.later; later.onclick = () => { box.remove(); try { localStorage.setItem('nk_install_dismissed', '1'); } catch {} };
    buttons.append(later); box.append(buttons); document.body.append(box);
  }
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); prompt = event; setTimeout(() => bar('', true), 2500); });
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) setTimeout(() => bar(text.ios, false), 4000);
})();
