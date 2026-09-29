import * as A from '../audio.js';
import { el, add, hexOrb, icons, stepper, confirmDialog } from '../ui.js';
import { settings, setSetting, addSession, coldTarget, byType, fmtShort, fmtClock } from '../store.js';
import { header, page, card, statBox } from './common.js';

export function coldHome(ctx) {
  const s = settings();
  const wrap = el('div', 'cold-scope');
  const orb = hexOrb({ palette: 'cold', size: 150 });
  orb.setText('', ''); orb.root.classList.add('float', 'mini');

  const log = byType('cold');
  const best = log.reduce((m, c) => Math.max(m, c.seconds || 0), 0);
  const target = el('div', 'stat-row');
  target.append(statBox(fmtShort(coldTarget()), 'Today’s target'), statBox(fmtShort(best), 'Best'), statBox(String(log.length), 'Plunges'));

  const c1 = card(
    stepper('Water temperature', s.coldTempF, { min: 32, max: 70, format: (v) => v + '°F', onChange: (v) => setSetting('coldTempF', v) }),
    stepper('Get-ready countdown', s.coldPrep, { min: 0, max: 30, step: 5, format: (v) => v + 's', onChange: (v) => setSetting('coldPrep', v) }));

  const warn = el('p', 'lede small', 'Never alone, and never with a breath hold. Get out if you go numb, shiver hard, or lose coordination.');
  const start = el('button', 'btn primary sticky cold', 'Start');
  start.onclick = () => { A.unlock(); ctx.nav.go('coldSession'); };

  const recent = card(el('h3', null, 'Recent'));
  log.slice(0, 5).forEach((c) => {
    const row = el('div', 'row-simple');
    row.append(el('span', null, new Date(c.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + c.tempF + '°F' + (c.hit ? ' · target met' : '')), el('b', null, fmtShort(c.seconds)));
    recent.append(row);
  });

  return add(wrap, header(ctx, 'Cold Exposure'), page(orb.root, target, c1, warn, log.length ? recent : null), start);
}

export function coldSession(ctx) {
  const s = settings();
  const target = coldTarget();
  const st = { phase: s.coldPrep > 0 ? 'prep' : 'in', t0: 0, done: false };
  let timers = [];
  const clear = () => { timers.forEach((t) => { clearInterval(t); clearTimeout(t); }); timers = []; };
  const every = (fn, ms) => timers.push(setInterval(fn, ms));

  const wrap = el('div', 'session cold-scope');
  const bar = el('header', 'topbar');
  const cancel = el('button', 'bar-pill', 'Cancel');
  cancel.type = 'button';
  bar.append(el('span', 'bar-btn'), el('h1', null, 'Target ' + fmtShort(target) + ' · ' + s.coldTempF + '°F'), cancel);

  const title = el('h2', 'sess-title', '');
  const orb = hexOrb({ palette: 'cold', size: 280 });
  const hint = el('p', 'sess-hint', '');
  const action = el('button', 'btn primary cold', '');
  const body = el('main', 'page center-page');
  body.append(title, orb.root, hint, action);
  wrap.append(bar, body);

  function stop() { clear(); A.stopVoice(); A.musicStop(1.5); A.setSessionActive(false); }
  ctx.onLeave(() => { if (!st.done) stop(); });
  cancel.onclick = async () => {
    if (await confirmDialog({ title: 'Cancel plunge', body: 'Stop this session without logging it?' })) { stop(); st.done = true; ctx.nav.back(); }
  };

  function prep() {
    st.phase = 'prep';
    let left = s.coldPrep;
    A.setSessionActive(true); A.musicMode('hold', 2);
    title.textContent = 'Before you step in';
    hint.textContent = 'Long, slow exhales. Enter gradually. Don’t jump or dunk your head.';
    orb.setScale(0.85, 0); orb.setText(String(left), 'get ready');
    action.textContent = 'I’m in. Start now';
    action.onclick = () => { clear(); immerse(); };
    A.say('c-prep');
    every(() => {
      left--;
      orb.setText(String(Math.max(0, left)), 'get ready');
      if (left > 0 && left <= 3) A.tick();
      if (left <= 0) { clear(); immerse(); }
    }, 1000);
  }

  function immerse() {
    st.phase = 'in'; st.t0 = Date.now();
    A.setSessionActive(true); A.musicMode('hold', 2);
    title.textContent = 'Stay with the breath';
    hint.textContent = 'Get out if you go numb, shiver hard, or lose coordination.';
    action.textContent = 'I’m out';
    action.onclick = out;
    orb.setScale(0.9, 1200);
    A.ping(); A.say('c-in');
    const marks = { 15: 'c-steady', 45: 'c-calm', 30: 'c-30', 60: 'c-60', 90: 'c-90', 120: 'c-120', 150: 'c-150', 180: 'c-180' };
    const fired = new Set();
    let hit = false;
    every(() => {
      const e = (Date.now() - st.t0) / 1000;
      orb.setText(fmtClock(e), 'target ' + fmtShort(target), true);
      Object.entries(marks).forEach(([sec, id]) => {
        if (e >= +sec && !fired.has(id)) { fired.add(id); if (!(hit && e - target < 5)) A.say(id, { priority: sec % 30 === 0 ? 'high' : 'low' }); }
      });
      if (!hit && e >= target) { hit = true; A.gong(); A.say('c-target'); }
    }, 250);
  }

  function out() {
    const secs = (Date.now() - st.t0) / 1000;
    clear(); st.done = true; A.setSessionActive(false); A.musicStop(3); A.gong(); A.say('c-out');
    const rec = addSession('cold', { seconds: secs, target, tempF: s.coldTempF, hit: secs >= target });
    ctx.nav.go('coldSummary', { id: rec.id, next: coldTarget() }, { replace: true });
  }

  if (st.phase === 'prep') prep(); else immerse();
  return wrap;
}

export function coldSummary(ctx) {
  const rec = byType('cold').find((x) => x.id === ctx.params.id) || { seconds: 0, target: 0, tempF: 0 };
  const wrap = el('div', 'cold-scope');
  const orb = hexOrb({ palette: 'cold', size: 130 });
  orb.setText(fmtShort(rec.seconds), '', true); orb.root.classList.add('mini');
  const rows = card();
  [['Time in', fmtShort(rec.seconds)], ['Target', fmtShort(rec.target) + (rec.hit ? ' ✓' : '')], ['Water', rec.tempF + '°F'], ['Next target', fmtShort(ctx.params.next || 0)]]
    .forEach(([k, v]) => { const r = el('div', 'row-simple'); r.append(el('span', null, k), el('b', null, v)); rows.append(r); });
  const done = el('button', 'btn primary sticky cold', 'Done');
  done.onclick = () => ctx.nav.home();
  return add(wrap, header(ctx, 'Out of the cold', { back: false }),
    page(orb.root, rows, el('p', 'lede small', 'Warm up by moving: gentle squats, arm swings. A hot shower straight away undoes some of the benefit and can make you dizzy.')), done);
}
