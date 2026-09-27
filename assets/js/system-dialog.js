const controls = window.windowControls; const $ = selector => document.querySelector(selector);
let action;
const words = { ru: { unknownError: 'Неизвестная ошибка.', ok: 'ОК', close: 'Закрыть' }, en: { unknownError: 'Unknown error.', ok: 'OK', close: 'Close' } };
let language = 'ru'; const t = key => words[language][key];
function applyText() { document.documentElement.lang = language; $('#ok').textContent = t('ok'); $('#close').setAttribute('aria-label', t('close')); }
function applyTheme(theme) { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; }
function render(data = {}) { const type = ['critical','error','warning','info','question'].includes(data.type) ? data.type : 'error'; document.title = data.title || 'NekoChat Reloaded'; $('.xp-title').textContent = document.title; $('#message').textContent = data.message || t('unknownError'); $('#icon').className = type; action = data.action || null; $('#action').hidden = !action; $('#action').textContent = data.actionLabel || ''; const sound = new Audio(`assets/sounds/${type === 'critical' ? 'critical-stop.wav' : type === 'warning' ? 'exclamation.wav' : type === 'error' ? 'error.wav' : 'default.wav'}`); sound.volume = .72; sound.play().catch(() => {}); }
$('#close').onclick = () => controls.close(); $('#ok').onclick = () => controls.close(); $('#action').onclick = () => { if (action) controls.systemAction(action); controls.close(); }; controls.onSystemDialog(render); controls.onThemeChanged(applyTheme); controls.getActiveTheme().then(applyTheme);
controls.getDisplaySettings?.().then(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); });
