// nav.js: hamburger menu (all pages) and mobile dashboard tabs (index page)
const burger = document.getElementById('burger'), menu = document.getElementById('menu');
function setMenu(open) {
  menu.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', open);
  burger.innerHTML = open ? '&#10005;' : '&#9776;';
}
burger.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
window.addEventListener('resize', () => { if (window.innerWidth > 860) setMenu(false); });

const mt = document.getElementById('mtabs');
if (mt) mt.addEventListener('click', e => {
  const t = e.target.dataset.t; if (t === undefined) return;
  mt.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.target));
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.dataset.t === t));
  window.dispatchEvent(new Event('resize'));          // lets the charts redraw at the right size
  document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth', block: 'start' });
});