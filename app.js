// ===== Settings: change these two lines if needed =====
const CHANNEL_ID = 3527659;          // your public ThingSpeak channel
const REFRESH_MS = 15000;            // ThingSpeak free tier updates at most every 15 s
// ======================================================
const API = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?results=60`;
const $ = id => document.getElementById(id);
const num = v => (v === null || v === undefined || v === '') ? null : parseFloat(v);
let forceDemo = false, lastFeeds = [], charts = {};

function mkChart(id, sets) {
  return new Chart($(id), {
    type: 'line',
    data: { labels: [], datasets: sets.map(s => ({ label: s.l, data: [], borderColor: s.c, backgroundColor: s.c + '22', tension: .35, pointRadius: 0, borderWidth: 2.5, fill: !!s.f })) },
    options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#5d6f7b', usePointStyle: true, boxWidth: 8 } } },
      scales: { x: { ticks: { color: '#5d6f7b', maxTicksLimit: 6 }, grid: { display: false } }, y: { ticks: { color: '#5d6f7b' }, grid: { color: '#0f223012' } } } }
  });
}
function initCharts() {
  charts.vitals = mkChart('cVitals', [{ l: 'Heart rate (bpm)', c: '#ee5b5b' }, { l: 'SpO₂ (%)', c: '#0f9d8a' }]);
  charts.anomaly = mkChart('cAnomaly', [{ l: 'Anomaly score', c: '#e8a317', f: true }]);
  charts.study = mkChart('cStudy', [{ l: 'Activity', c: '#0f9d8a' }, { l: 'Sitting (min)', c: '#0f2230' }]);
}

function demoFeeds() {
  const now = Date.now(), out = [];
  for (let i = 59; i >= 0; i--) {
    const t = 59 - i, sit = Math.min(55, (t * 1.2) % 60);
    out.push({ created_at: new Date(now - i * 20000).toISOString(),
      field1: (72 + 8 * Math.sin(t / 6) + Math.random() * 3).toFixed(0),
      field2: (97 + Math.random() * 1.5).toFixed(0),
      field3: (sit > 40 ? 1 : 3 + 2 * Math.sin(t / 4)).toFixed(1),
      field4: sit.toFixed(0), field5: (12 + 10 * Math.sin(t / 9) + (t > 50 ? 30 : 0)).toFixed(0),
      field6: String(Math.round(Math.max(40, 90 - sit * .6 + Math.random() * 4))), field7: String(Math.floor(t / 20)), field8: String(2400 + Math.round(t * 18 + 40 * Math.sin(t / 4))) });
  }
  return out;
}

async function load() {
  let feeds = [], live = false, err = false;
  if (!forceDemo) {
    try {
      const r = await fetch(API, { cache: 'no-store' });
      feeds = (await r.json()).feeds || [];
      live = feeds.length > 0;
    } catch (e) { err = true; }
  }
  if (!live) feeds = demoFeeds();
  lastFeeds = feeds;
  render(feeds, live, err);
}

function setCard(id, val, dec = 0) { $(id).textContent = val === null ? '--' : (+val).toFixed(dec); }

function render(feeds, live, err) {
  const last = feeds[feeds.length - 1];
  const ageMin = (Date.now() - new Date(last.created_at)) / 60000;
  const online = live && ageMin < 2;
  const st = $('status');
  st.className = 'pill ' + (!live ? 'demo' : online ? 'live' : 'off');
  st.textContent = !live ? 'Demo data' : online ? 'Band online' : 'Band offline';
  $('updated').textContent = !live
    ? (err ? 'Could not reach ThingSpeak. Showing demo data.' : 'No readings yet. Showing demo data until the band sends its first reading.')
    : `Last reading ${new Date(last.created_at).toLocaleTimeString()} (${ageMin < 1 ? 'just now' : Math.round(ageMin) + ' min ago'})`;

  const hr = num(last.field1), sp = num(last.field2), an = num(last.field5), sit = num(last.field4);
  setCard('hr', hr); setCard('spo2', sp); setCard('anomaly', an); setCard('activity', num(last.field3), 1);
  setCard('sitting', sit); setCard('breaks', num(last.field7));
  $('heroHr').textContent = hr === null ? '--' : hr.toFixed(0);
  $('heroNote').textContent = !live ? 'Showing demo data' : online ? 'Live from your band' : 'Band is offline, showing last reading';

  const a = an || 0, ac = $('anomaly').parentElement;
  ac.className = 'card h' + (a >= 60 ? ' alert' : a >= 30 ? ' warn' : '');
  $('anomalyBar').style.width = Math.min(100, a) + '%';
  $('anomalyBar').style.background = a >= 60 ? 'var(--coral)' : a >= 30 ? 'var(--amber)' : 'var(--teal)';
  $('anomalyLabel').textContent = a >= 60 ? 'unusual pattern' : a >= 30 ? 'keep watching' : 'within your baseline';

  const labels = feeds.map(f => new Date(f.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const fill = (c, cols) => { c.data.labels = labels; cols.forEach((k, i) => c.data.datasets[i].data = feeds.map(f => num(f[k]))); c.update(); };
  fill(charts.vitals, ['field1', 'field2']); fill(charts.anomaly, ['field5']); fill(charts.study, ['field3', 'field4']);
  tips(feeds, last);
}

function tips(feeds, last) {
  const sit = num(last.field4) || 0, an = num(last.field5) || 0, sp = num(last.field2);
  const longest = Math.max(...feeds.map(f => num(f.field4) || 0));
  const t = [];
  if (sit >= 40) t.push(`You have been still for ${sit.toFixed(0)} minutes. Stand up and move for 3 to 5 minutes.`);
  else if (sit >= 30) t.push('You are close to 40 minutes of sitting. Plan a short break soon.');
  else t.push('Your sitting time is healthy right now. Keep moving between study blocks.');
  if (longest >= 45) t.push(`Your longest stretch in this window was ${longest.toFixed(0)} minutes. Aim to stay under 40.`);
  if (an >= 60) t.push('Your readings differ from your usual baseline for a sustained period. Rest, then re-check. If you feel unwell, talk to a doctor.');
  else if (an >= 30) t.push('Your readings are drifting from your baseline. Drink water and check your posture.');
  if (sp !== null && sp < 94) t.push('SpO₂ is below 94%. Check that the sensor sits snugly and your hand is warm and still.');
  $('tips').innerHTML = t.map(x => `<li>${x}</li>`).join('');
  $('banner').hidden = sit < 40;
}

document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b));
  ['cards', 'charts'].forEach(id => $(id).className = (id === 'cards' ? 'cards' : 'charts') + ' mode-' + b.dataset.mode);
  Object.values(charts).forEach(c => c.resize());
}));

$('demoBtn').addEventListener('click', e => {
  forceDemo = !forceDemo;
  e.target.textContent = forceDemo ? 'Use live data' : 'Use demo data';
  load();
});

$('csvBtn').addEventListener('click', () => {
  const head = 'time,heart_rate,spo2,activity,sitting_min,anomaly,posture,breaks,steps';
  const rows = lastFeeds.map(f => [f.created_at, f.field1, f.field2, f.field3, f.field4, f.field5, f.field6, f.field7, f.field8].join(','));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([head + '\n' + rows.join('\n')], { type: 'text/csv' }));
  a.download = 'omniband_data.csv'; a.click();
});

initCharts(); load(); setInterval(load, REFRESH_MS);

// features.js: loads after script.js and adds the advanced features.
const S = { brk: 40, rest: 70, spo: 94, snd: false, range: 0, scen: null, sess: null, moods: [], cool: {}, cur: [] };
const E = id => document.getElementById(id);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
try { S.moods = JSON.parse(localStorage.getItem('ob_moods') || '[]'); } catch (e) {}

// Wrap the original render so every refresh also updates the new features
const _render = render;
render = function (feeds, live, err) {
  const m = S.range ? feeds.filter(f => Date.now() - new Date(f.created_at) < S.range * 60000) : feeds;
  const use = m.length ? m : feeds;
  _render(use, live, err); S.cur = use; extras(use);
};

// Demo scenarios
const _demo = demoFeeds;
const SC = { calm: [70, .3, 3, 8, 98, 88], sit: [72, .95, .8, 15, 97, 85], heart: [118, .2, .6, 75, 96, 80], stress: [98, .4, .7, 35, 97, 75] };
demoFeeds = function () {
  const p = SC[S.scen]; if (!p) return _demo();
  const now = Date.now(), out = [];
  for (let t = 0; t < 60; t++) {
    const r = Math.min(1, t / 20), q = (t / 59) ** 2, j = () => Math.random() * 4 - 2;
    out.push({ created_at: new Date(now - (59 - t) * 20000).toISOString(),
      field1: Math.round(72 + (p[0] - 72) * q + j()), field2: Math.round(p[4] - Math.random()),
      field3: (p[2] + Math.random() * .4).toFixed(1), field4: Math.round(t * p[1]),
      field5: Math.round(p[3] * r), field6: String(Math.round(p[5] - t * p[1] * .5)), field7: '0', field8: String(2400 + Math.round(t * p[2] * 8)) });
  }
  return out;
};
E('scen').addEventListener('click', e => {
  const s = e.target.dataset.s; if (!s) return;
  S.scen = s === 'live' ? null : s; forceDemo = s !== 'live'; load();
});

const stressOf = x => { const h = num(x.field1), a = num(x.field3) || 0; return h === null ? 0 : clamp((h - (S.rest + a * 6)) / 30 * 100); };

function extras(f) {
  const l = f[f.length - 1], g = k => num(l[k]);
  const hr = g('field1'), sp = g('field2'), act = g('field3') || 0, sit = g('field4') || 0, an = g('field5') || 0;
  const st = stressOf(l), stL = st < 30 ? 'Low' : st < 60 ? 'Moderate' : 'High';
  E('stress').textContent = `Stress indicator (experimental): ${stL}, ${st.toFixed(0)}/100. Based on how far your heart rate is above what is expected for your movement.`;

  // Wellness score
  const sitPen = sit > S.brk ? Math.min(35, 10 + (sit - S.brk) * 1.75) : sit / S.brk * 10;
  const score = Math.round(clamp(100 - sitPen - an * .35 - (act < 1.5 ? 15 : act < 3 ? 5 : 0) - (sp !== null && sp < S.spo ? 15 : 0) - st * .2));
  const arc = E('ringArc');
  arc.style.strokeDashoffset = 326.7 * (1 - score / 100);
  arc.style.stroke = score >= 75 ? 'var(--teal)' : score >= 50 ? 'var(--amber)' : 'var(--coral)';
  E('wScore').textContent = score;
  E('wVerdict').textContent = (score >= 75 ? 'Doing well. ' : score >= 50 ? 'Needs attention. ' : 'Take action now. ') +
    (sit < S.brk ? `Next break in about ${Math.round(S.brk - sit)} min.` : 'Time for a movement break.');

  // Range statistics
  const st2 = k => { const v = f.map(x => num(x[k])).filter(x => x !== null); return v.length ? `${Math.min(...v)} / ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(0)} / ${Math.max(...v)}` : '--'; };
  E('stats').textContent = `Heart rate min/avg/max: ${st2('field1')}   SpO₂ min/avg/max: ${st2('field2')}`;

  // Alerts
  const act5 = f.slice(-5), active = [];
  if (an >= 60 || (hr !== null && act < 2 && (hr > S.rest + 40 || hr < 45))) active.push(['heart', 'Unusual heart-rate pattern detected. This is an experimental alert, not a diagnosis.', 1]);
  if (act5.length === 5 && act5.every(x => stressOf(x) >= 60)) active.push(['stress', 'Sustained high stress indicator. Pause, breathe slowly and take a short walk.', 1]);
  if (sp !== null && sp < S.spo) active.push(['spo2', `SpO₂ is ${sp}%, below your ${S.spo}% limit. Check the sensor fit.`, 1]);
  if (sit >= S.brk) active.push(['sit', `You have been sitting for ${sit} minutes. Take a movement break.`, 0]);
  const b = E('banner');
  b.hidden = !active.length;
  if (active.length) { b.textContent = active[0][1]; b.className = 'banner' + (active[0][2] ? ' danger' : ''); }
  active.forEach(([k, msg]) => {
    if (Date.now() - (S.cool[k] || 0) < 12e4) return;
    S.cool[k] = Date.now();
    const li = document.createElement('li');
    li.innerHTML = `<b>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b>${msg}`;
    const ul = E('alerts'); if (ul.firstChild && ul.firstChild.textContent === 'No alerts yet.') ul.innerHTML = '';
    ul.prepend(li); while (ul.children.length > 8) ul.lastChild.remove();
    if (S.snd) { beep(); if ('Notification' in window && Notification.permission === 'granted') new Notification('OmniBand', { body: msg }); }
  });

  // Cohort radar
  const maxSit = Math.max(...f.map(x => num(x.field4) || 0)), avgAct = f.reduce((a, x) => a + (num(x.field3) || 0), 0) / f.length;
  const avgAn = f.reduce((a, x) => a + (num(x.field5) || 0), 0) / f.length;
  coh.data.datasets[0].data = [clamp(100 - Math.max(0, maxSit - S.brk) * 3), clamp((g('field7') || 0) * 25), clamp(avgAct * 20), clamp(100 - avgAn), clamp(100 - st)];
  coh.update();
}

const coh = new Chart(E('cCohort'), { type: 'radar',
  data: { labels: ['Sitting control', 'Breaks', 'Movement', 'Consistency', 'Calm'],
    datasets: [{ label: 'You', data: [], borderColor: '#0f9d8a', backgroundColor: '#0f9d8a33' },
               { label: 'Cohort average (simulated)', data: [75, 70, 65, 80, 72], borderColor: '#e8a317', backgroundColor: '#e8a31733' }] },
  options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100, ticks: { display: false } } }, plugins: { legend: { labels: { color: '#5d6f7b' } } } } });

function beep() {
  try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
    o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = .15; o.start(); o.stop(a.currentTime + .4); } catch (e) {}
}
E('snd').onchange = e => { S.snd = e.target.checked; if (S.snd) { beep(); if ('Notification' in window) Notification.requestPermission(); } };

// Settings and range
[['sBrk', 'oBrk', 'brk'], ['sRest', 'oRest', 'rest'], ['sSpo', 'oSpo', 'spo']].forEach(([i, o, k]) =>
  E(i).oninput = e => { S[k] = +e.target.value; E(o).textContent = S[k]; if (S.cur.length) extras(S.cur); });
E('range').onchange = e => { S.range = +e.target.value; load(); };

// Study session timer
const tick = () => { if (!S.sess) return; const s = Math.floor((Date.now() - S.sess.t) / 1000); E('sClock').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
setInterval(tick, 1000);
E('sBtn').onclick = () => {
  const lastB = () => num((S.cur[S.cur.length - 1] || {}).field7) || 0;
  if (!S.sess) { S.sess = { t: Date.now(), b: lastB() }; E('sBtn').textContent = 'Stop session'; return; }
  const fs = S.cur.filter(x => new Date(x.created_at) >= S.sess.t);
  E('sOut').textContent = `Last session: ${((Date.now() - S.sess.t) / 60000).toFixed(1)} min, longest sitting ${Math.max(0, ...fs.map(x => num(x.field4) || 0))} min, ${Math.max(0, lastB() - S.sess.b)} breaks.`;
  S.sess = null; E('sBtn').textContent = 'Start session'; E('sClock').textContent = '00:00';
};

// Mood check-in (self-report only)
function moodMsg() {
  const m = S.moods.slice(-3).map(x => x.v), low = m.length === 3 && m.every(v => v <= 2) || (m.length && m[m.length - 1] === 1);
  E('moodMsg').textContent = low
    ? 'Thank you for being honest. Feeling low for a while is worth talking about. Reach out to someone you trust or your college counsellor. In India you can call Tele-MANAS on 14416 (free, 24x7). If you feel unsafe, call 112.'
    : m.length ? 'Thanks for checking in. Keep an eye on sleep, movement and breaks. OmniBand cannot detect depression; this is a self-report only.' : E('moodMsg').textContent;
}
E('mood').addEventListener('click', e => {
  const v = +e.target.dataset.v; if (!v) return;
  S.moods.push({ t: Date.now(), v }); try { localStorage.setItem('ob_moods', JSON.stringify(S.moods.slice(-30))); } catch (x) {}
  moodMsg();
});

// Dark mode
try { if (localStorage.getItem('ob_theme') === 'dark') document.documentElement.dataset.theme = 'dark'; } catch (e) {}
const syncTheme = () => E('themeBtn').textContent = document.documentElement.dataset.theme === 'dark' ? 'Light' : 'Dark';
E('themeBtn').onclick = () => {
  const d = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = d ? 'light' : 'dark';
  try { localStorage.setItem('ob_theme', d ? 'light' : 'dark'); } catch (e) {}
  syncTheme();
};
syncTheme();
if (lastFeeds.length) render(lastFeeds, false, false);


// ===== Ideal vs real, health conditions, study-mode details =====
const D = document.getElementById('dashboard');
D.dataset.mode = 'health';
document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => { D.dataset.mode = b.dataset.mode; }));

S.goal = 8000; S.ht = 165;
charts.steps = mkChart('cSteps', [{ l: 'Steps today', c: '#0f9d8a', f: true }]);

const _r2 = render;
render = function (f, live, err) {
  try { _r2(f, live, err); } catch (e) { console.error('render error', e); }
  try { ideal(f); } catch (e) { console.error('ideal error', e); }
  const b = E('banner');
  if (calUI() && b.hidden) { b.hidden = false; b.className = 'banner danger'; b.textContent = 'You have passed your estimated daily calorie need. Choose lighter options and take a walk.'; }
  if (!b.hidden && /heart-rate/.test(b.textContent)) b.innerHTML += ' <a href="guide.html#heart">Chest pain? See first aid.</a>';
};

const band = s => s >= 85 ? ['Excellent', 'excellent'] : s >= 70 ? ['Good', 'good'] : s >= 50 ? ['Moderate', 'moderate'] : ['Bad', 'bad'];
function setCond(id, s) { const [t, c] = band(s), el = E(id); el.className = 'cond ' + c; el.querySelector('b').textContent = t; el.title = Math.round(s) + ' out of 100'; return t; }

function ideal(f) {
  const l = f[f.length - 1], g = k => num(l[k]), st = stressOf(l);
  const hr = g('field1'), sp = g('field2'), act = g('field3') || 0, sit = g('field4') || 0, an = g('field5') || 0, post = g('field6');
  const exp = Math.min(160, S.rest + act * 6), stL = st < 30 ? 'Low' : st < 60 ? 'Moderate' : 'High';

  // Conditions: Excellent / Good / Moderate / Bad
  const hrPen = hr === null ? 0 : Math.min(50, (hr < 60 ? 60 - hr : hr > 100 ? hr - 100 : 0) * 2);
  const spPen = sp === null ? 0 : sp >= 95 ? 0 : Math.min(40, (95 - sp) * 6);
  const heartT = setCond('cdHeart', 100 - hrPen - an * .5), healthT = setCond('cdHealth', 100 - hrPen * .6 - spPen - an * .3);
  const studyT = setCond('cdStudy', +E('wScore').textContent || 0);
  setCond('cdPosture', post === null ? 0 : post);

  // Study-mode cards
  E('stressV').textContent = st.toFixed(0); E('stressL').textContent = stL + ' stress';
  E('postV').textContent = post === null ? '--' : post.toFixed(0);
  E('postL').textContent = post === null ? 'posture score' : band(post)[0] + ' posture';
  E('iSit').textContent = `Ideal: under ${S.brk} min`; E('iBrk').textContent = `Ideal: one every ${S.brk} min`;

  // Steps (field8 = cumulative steps counted by the band)
  const stp = g('field8'), pv = f.length > 1 ? num(f[f.length - 2].field8) : null;
  const dt = f.length > 1 ? (new Date(l.created_at) - new Date(f[f.length - 2].created_at)) / 60000 : 0;
  const cad = stp !== null && pv !== null && dt > 0 && stp >= pv ? (stp - pv) / dt : 0;
  const km = stp === null ? 0 : stp * (S.ht * .415 / 100) / 1000;
  E('stepsV').textContent = stp === null ? '--' : stp.toLocaleString('en-IN');
  E('iStp').textContent = `Goal: ${S.goal.toLocaleString('en-IN')} steps (${stp === null ? 0 : Math.min(999, Math.round(stp / S.goal * 100))}%)`;
  E('stpBar').style.width = (stp === null ? 0 : Math.min(100, stp / S.goal * 100)) + '%';
  E('distV').textContent = km.toFixed(2); E('kcalV').textContent = stp === null ? '--' : Math.round(km * P.wt * .7);
  E('paceV').textContent = cad.toFixed(0);
  E('paceL').textContent = cad >= 100 ? 'brisk walking' : cad >= 60 ? 'steady walking' : cad > 0 ? 'slow walking' : 'not walking';
  charts.steps.data.labels = f.map(x => new Date(x.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  charts.steps.data.datasets[0].data = f.map(x => num(x.field8)); charts.steps.update();

  const R = [
    { m: 'h', n: 'Heart rate', v: hr, lo: 60, hi: 100, a: 40, b: 140, u: 'bpm', ex: `Expected for your movement: ${exp.toFixed(0)} bpm`, up: 'Rest, breathe slowly and avoid caffeine. If it stays high or you feel unwell, see a doctor.', dn: 'Low for a resting adult. If you feel dizzy or faint, sit down and seek advice.' },
    { m: 'h', n: 'Blood oxygen', v: sp, lo: 95, hi: 100, a: 85, b: 100, u: '%', ex: '', up: '', dn: 'Check the sensor fit and keep your hand warm and still. Repeated readings below 94% need medical advice.' },
    { m: 'h', n: 'Anomaly score', v: g('field5'), lo: 0, hi: 30, a: 0, b: 100, u: '/100', ex: 'Expected: under 15 for your own baseline', up: 'Your pattern differs from your own baseline. Rest and recheck; get checked if it persists.', dn: '' },
    { m: 's', n: 'Stress level', v: st, lo: 0, hi: 30, a: 0, b: 100, u: '/100', ex: `Predicted when calm: about 10. Your heart rate vs expected: ${hr === null ? '--' : (hr - exp > 0 ? '+' : '') + (hr - exp).toFixed(0)} bpm`, up: 'Your heart rate is above what your movement explains. Try 2 minutes of slow breathing and a short walk.', dn: '' },
    { m: 's', n: 'Posture score', v: post, lo: 75, hi: 100, a: 0, b: 100, u: '/100', ex: 'Estimated from wrist tilt', up: '', dn: 'Sit up straighter, relax your shoulders and keep your wrists neutral.' },
    { m: 's', n: 'Sitting time', v: g('field4'), lo: 0, hi: S.brk, a: 0, b: Math.max(90, S.brk * 1.5), u: 'min', ex: '', up: 'Stand up and move for 3 to 5 minutes.', dn: '' },
    { m: 's', n: 'Activity level', v: g('field3'), lo: 3, hi: 10, a: 0, b: 10, u: 'index', ex: '', up: '', dn: 'You have been quite still. Stretch or walk around.' }
  ];
  R.forEach(r => {
    if (r.v === null) { r.c = 'wait'; return; }
    const low = r.v < r.lo, d = low ? r.lo - r.v : r.v > r.hi ? r.v - r.hi : 0, span = (r.hi - r.lo) || 1;
    r.c = d === 0 ? 'ok' : d <= span * .25 ? 'watch' : 'out';
    r.adv = d === 0 ? 'Inside the ideal range.' : `${d.toFixed(0)} ${r.u} ${low ? 'below' : 'above'} ideal. ${low ? r.dn : r.up}`;
  });
  const pct = (r, x) => clamp((x - r.a) / (r.b - r.a) * 100);
  E('idealRows').innerHTML = R.map(r => `<div class="row ${r.c} ${r.m === 'h' ? 'hOnly' : 'sOnly'}">
    <div class="rn"><b>${r.n}</b></div>
    <div class="rv">${r.v === null ? '--' : (+r.v).toFixed(r.n === 'Activity level' ? 1 : 0)} <small>${r.u}</small>
      <small class="idl">${r.lo === 0 ? 'Ideal: under ' + r.hi : 'Ideal: ' + r.lo + ' to ' + r.hi} ${r.u}</small>${r.ex ? `<small class="idl">${r.ex}</small>` : ''}</div>
    <div class="rng"><i style="left:${pct(r, r.lo)}%;width:${pct(r, r.hi) - pct(r, r.lo)}%"></i>${r.v === null ? '' : `<u style="left:${pct(r, r.v)}%"></u>`}</div>
    <div class="rs">${{ ok: 'In range', watch: 'Slightly off', out: 'Out of range', wait: 'No data' }[r.c]}</div>
    <p>${r.v === null ? 'Waiting for a reading.' : r.adv}</p></div>`).join('');
  const sm = m => {
    const x = R.filter(r => r.m === m && r.c !== 'wait'), bad = x.filter(r => r.c !== 'ok');
    return bad.length ? `<b>${bad.length} of ${x.length} readings need attention</b> (${bad.map(r => r.n.toLowerCase()).join(', ')}). ${bad[0].adv}`
      : `<b>All ${x.length} readings are inside their ideal range.</b>`;
  };
  E('gSum').innerHTML = `<p class="hOnly">Heart condition: <b>${heartT}</b>. Overall health: <b>${healthT}</b>. ${sm('h')}</p><p class="sOnly">Study wellness: <b>${studyT}</b>. Steps today: <b>${stp === null ? '--' : stp.toLocaleString('en-IN')}</b> of ${S.goal.toLocaleString('en-IN')}. ${sm('s')}</p>`;
}
if (lastFeeds.length) render(lastFeeds, false, false);


// ===== Profile, automatic step goal, calories eaten =====
const P = { sex: 'f', age: 20, ht: 165, wt: 60, act: 1.375, eaten: [], alerted: false, day: new Date().toDateString() };
try { Object.assign(P, JSON.parse(localStorage.getItem('ob_profile') || '{}')); } catch (e) {}
if (P.day !== new Date().toDateString()) { P.eaten = []; P.alerted = false; P.day = new Date().toDateString(); }
const FOODS = { 'Roti': 100, 'Rice (1 cup)': 200, 'Dal (1 bowl)': 130, 'Paratha': 220, 'Idli (2)': 120, 'Dosa': 160, 'Samosa': 260, 'Biryani plate': 500, 'Maggi pack': 310, 'Pizza slice': 285, 'Banana': 105, 'Egg': 75, 'Chai with sugar': 80, 'Cold drink': 130 };
const saveP = () => { try { localStorage.setItem('ob_profile', JSON.stringify(P)); } catch (e) {} };
function calc() {
  const bmi = P.wt / ((P.ht / 100) ** 2), bmr = 10 * P.wt + 6.25 * P.ht - 5 * P.age + (P.sex === 'm' ? 5 : -161);
  const g = bmi < 18.5 ? 6000 : bmi < 25 ? 8000 : bmi < 30 ? 9000 : 10000;
  return { bmi, bmr: Math.round(bmr), tdee: Math.round(bmr * P.act), goal: P.age > 60 ? g - 1000 : g };
}
function calUI() {
  const c = calc(), eaten = P.eaten.reduce((a, x) => a + x.k, 0), over = eaten > c.tdee && c.bmi >= 18.5;
  E('cBar').style.width = Math.min(100, eaten / c.tdee * 100) + '%'; E('cBar').style.background = over ? 'var(--coral)' : 'var(--teal)';
  E('cTxt').textContent = `${eaten} of ${c.tdee} kcal eaten today (${eaten <= c.tdee ? c.tdee - eaten + ' left' : eaten - c.tdee + ' over'}).`;
  E('fList').innerHTML = P.eaten.map(x => `<li>${x.n}: ${x.k} kcal</li>`).join('') || '<li>Nothing logged yet.</li>';
  if (over && !P.alerted) {
    P.alerted = true; saveP();
    const li = document.createElement('li'); li.innerHTML = `<b>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b>Calories eaten (${eaten}) passed your estimated daily need (${c.tdee}).`;
    const ul = E('alerts'); if (ul.firstChild && ul.firstChild.textContent === 'No alerts yet.') ul.innerHTML = ''; ul.prepend(li);
    if (S.snd) beep();
  }
  if (over) { const b = E('banner'); b.hidden = false; b.className = 'banner danger'; b.textContent = 'You have passed your estimated daily calorie need. Choose lighter options and take a walk.'; }
  return over;
}
function applyP() {
  const c = calc(), km = c.goal * (P.ht * .415 / 100) / 1000;
  S.ht = P.ht; S.goal = c.goal;
  E('pOut').innerHTML = `BMI <b>${c.bmi.toFixed(1)}</b> (${c.bmi < 18.5 ? 'below the usual range' : c.bmi < 25 ? 'healthy range' : c.bmi < 30 ? 'above the usual range' : 'well above the usual range'}). Resting energy (BMR) <b>${c.bmr}</b> kcal. Daily calories to maintain weight: about <b>${c.tdee}</b> kcal. Daily step goal: <b>${c.goal.toLocaleString('en-IN')}</b> steps (about ${km.toFixed(1)} km, ${Math.round(km * P.wt * .7)} kcal burned). ${c.bmi < 18.5 ? 'Make sure you are eating enough; calorie alerts are off for you.' : ''}`;
  saveP(); calUI(); if (S.cur.length) ideal(S.cur);
}
[['pSex', 'sex'], ['pAge', 'age'], ['pHt', 'ht'], ['pWt', 'wt'], ['pAct', 'act']].forEach(([id, k]) => {
  E(id).value = P[k];
  E(id).onchange = e => { P[k] = k === 'sex' ? e.target.value : +e.target.value; applyP(); };
});
E('foods').innerHTML = Object.entries(FOODS).map(([n, k]) => `<button class="chip" data-n="${n}" data-k="${k}">${n} ${k}</button>`).join('');
E('foods').onclick = e => { if (e.target.dataset.k) { P.eaten.push({ n: e.target.dataset.n, k: +e.target.dataset.k }); applyP(); } };
E('fAdd').onclick = () => { const k = +E('fKcal').value; if (k > 0) { P.eaten.push({ n: E('fName').value || 'Food', k }); E('fName').value = E('fKcal').value = ''; applyP(); } };
E('fClr').onclick = () => { P.eaten = []; P.alerted = false; applyP(); };
applyP();