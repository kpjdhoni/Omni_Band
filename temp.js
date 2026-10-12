// temp.js: skin temperature from the NTC thermistor. Loads after app.js.
// The band sends the temperature in ThingSpeak's "status" field (a channel has only 8 numeric fields).
const TP = { lo: 32, hi: 35.5, hot: 37.5, cold: 30 };
const tOf = x => { const v = parseFloat(x.status); return isFinite(v) ? v : null; };
charts.temp = mkChart('cTemp', [{ l: 'Skin temperature (°C)', c: '#e8793a', f: true }]);

// Demo data gets a temperature too ("High temperature" scenario ramps it up)
const _d3 = demoFeeds;
demoFeeds = function () {
  const out = _d3();
  out.forEach((f, i) => { f.status = (33.5 + .5 * Math.sin(i / 8) + (S.scen === 'fever' ? Math.min(4.4, i * .09) : 0) + Math.random() * .15).toFixed(1); });
  return out;
};

const _r3 = render;
render = function (f, live, err) {
  try { _r3(f, live, err); } catch (e) { console.error('render error', e); }
  try { tempUI(f); } catch (e) { console.error('temp error', e); }
};

function tempUI(f) {
  const t = tOf(f[f.length - 1]), el = E('tempV');
  el.textContent = t === null ? '--' : t.toFixed(1);
  E('tempL').textContent = t === null ? '°C at the wrist' : t >= TP.hot ? 'High for the wrist' : t > TP.hi ? 'A little warm' : t >= TP.lo ? 'Normal at the wrist' : t >= TP.cold ? 'A little cool' : 'Cool: check sensor contact';
  el.parentElement.className = 'card h' + (t !== null && t >= TP.hot ? ' alert' : t !== null && (t > TP.hi || t < TP.lo) ? ' warn' : '');
  charts.temp.data.labels = f.map(x => new Date(x.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  charts.temp.data.datasets[0].data = f.map(tOf); charts.temp.update();
  if (t !== null && t >= TP.hot) {
    const msg = `Skin temperature is ${t.toFixed(1)} °C, high for the wrist. This is not a fever diagnosis; check with a clinical thermometer.`;
    const b = E('banner'); b.hidden = false; b.className = 'banner danger'; b.textContent = msg;
    if (Date.now() - (S.cool.temp || 0) > 12e4) {
      S.cool.temp = Date.now();
      const li = document.createElement('li'); li.innerHTML = `<b>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b>${msg}`;
      const ul = E('alerts'); if (ul.firstChild && ul.firstChild.textContent === 'No alerts yet.') ul.innerHTML = '';
      ul.prepend(li); if (S.snd) beep();
    }
  }
}

// Add a temperature row to the "Your values vs ideal values" panel (Health mode)
const _i2 = ideal;
ideal = function (f) { _i2(f); try { tempRow(f); } catch (e) { console.error('temp row error', e); } };
function tempRow(f) {
  const t = tOf(f[f.length - 1]), a = 26, b = 40, p = x => clamp((x - a) / (b - a) * 100);
  const c = t === null ? 'wait' : t >= TP.lo && t <= TP.hi ? 'ok' : t >= TP.lo - 1.5 && t <= TP.hi + 1 ? 'watch' : 'out';
  const adv = t === null ? 'Waiting for a reading.' : c === 'ok' ? 'Inside the ideal range.' : t > TP.hi ? 'Warmer than usual at the wrist. Rest, drink water and recheck with a clinical thermometer if you feel unwell.' : 'Cooler than usual. Check that the sensor touches your skin and warm your hands.';
  E('idealRows').insertAdjacentHTML('beforeend', `<div class="row ${c} hOnly">
    <div class="rn"><b>Skin temperature</b></div>
    <div class="rv">${t === null ? '--' : t.toFixed(1)} <small>°C</small><small class="idl">Ideal: ${TP.lo} to ${TP.hi} °C at the wrist</small><small class="idl">Wrist skin is cooler than core body temperature</small></div>
    <div class="rng"><i style="left:${p(TP.lo)}%;width:${p(TP.hi) - p(TP.lo)}%"></i>${t === null ? '' : `<u style="left:${p(t)}%"></u>`}</div>
    <div class="rs">${{ ok: 'In range', watch: 'Slightly off', out: 'Out of range', wait: 'No data' }[c]}</div>
    <p>${adv}</p></div>`);
}
if (lastFeeds.length) render(lastFeeds, false, false);
