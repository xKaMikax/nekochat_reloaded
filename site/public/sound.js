// The Windows XP sounds of the site, off until the visitor asks (browsers do not allow sound before a click anyway).
(() => {
  const link = document.getElementById('xp-sound');
  if (!link) return;
  let on = false;
  try { on = localStorage.getItem('nk_site_sound') === '1'; } catch {}
  const play = name => { if (!on) return; try { const audio = new Audio(`/app/assets/sounds/${name}.wav`); audio.volume = .5; audio.play().catch(() => {}); } catch {} };
  const show = () => { link.textContent = on ? link.dataset.on : link.dataset.off; link.classList.toggle('here', on); };
  show();
  link.addEventListener('click', event => {
    event.preventDefault();
    on = !on; try { localStorage.setItem('nk_site_sound', on ? '1' : '0'); } catch {}
    show(); if (on) play('logon');
  });
  document.querySelectorAll('.nav a:not(#xp-sound), .tile, .card').forEach(item => item.addEventListener('click', () => play('navigation')));
})();
