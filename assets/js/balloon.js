// Fills the XP balloon for each new message; a click opens Nekochat, × just closes it.
const $ = selector => document.querySelector(selector);
const controls = window.windowControls;
controls.onBalloonShow(({ title, sender, content, avatarUrl, language } = {}) => {
  $('#balloon-title').textContent = title || 'Nekochat Reloaded';
  $('#balloon-sender').textContent = sender || '';
  $('#balloon-text').textContent = content || '';
  $('#balloon-close').setAttribute('aria-label', language === 'en' ? 'Close' : 'Закрыть');
  const picture = $('#balloon-avatar');
  picture.hidden = !avatarUrl; if (avatarUrl) picture.src = avatarUrl;
});
$('#balloon').addEventListener('click', event => { if (event.target.closest('#balloon-close')) controls.balloonClose(); else controls.balloonClick(); });
