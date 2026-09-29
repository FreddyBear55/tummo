import * as A from '../audio.js';
import { el, add, hexOrb, icons, toggle, stepper, segmented, confirmDialog } from '../ui.js';
import { settings, setSetting, PACES, addSession, holdTarget, sessions, fmtShort, fmtClock } from '../store.js';
import { header, page, card, onDoubleTap, plural } from './common.js';

/* ------------------------------------------------------------------ menu */

function toolCard(title, iconFn, tint, onTap) {
  const b = el('button', 'tool-card');
  b.type = 'button';
  const badge = el('div', 'tool-badge ' + tint);
  badge.append(iconFn());
  b.append(badge, el('span', null, title));
  b.onclick = onTap;
  return b;
}

export function breathMenu(ctx) {
  const wrap = el('div');
  const tools = el('div', 'tool-row');
  tools.append(
    toolCard('Guided\nBreathing', icons.lungs, 'ember', () => ctx.nav.go('guidedSetup')),
    toolCard('Retention\nTimer', icons.timer, 'ice', () => ctx.nav.go('retention')));
  const ex = el('div', 'tool-row');
  ex.append(
    toolCard('Breathing\nBasics', icons.book, 'ice', () => ctx.nav.go('basics')),
    toolCard('Safety\nRules', icons.book, 'gold', () => ctx.nav.go('safety')));
  const intro = el('section', 'banner light');
  intro.append(el('h2', null, 'Guided Breathing'), el('p', null, 'Rounds of power breathing, a relaxed hold, and a recovery breath. No limits, no subscription.'));
  add(wrap, header(ctx, 'Breathing exercises'), page(intro, el('h3', 'section-h', 'Tools'), tools, el('h3', 'section-h', 'Learn'), ex));
  return wrap;
}

/* ------------------------------------------------------------------ setup */

export function guidedSetup(ctx) {
  const s = settings();
  const wrap = el('div');
  const body = el('main', 'page');

  const orb = hexOrb({ palette: 'ember', size: 150 });
  orb.setText('', '');
  orb.root.classList.add('float', 'mini');

  body.append(orb.root);
  body.append(segmented(Object.entries(PACES).map(([k, v]) => [k, v.label]), s.pace, (k) => setSetting('pace', k)));

  const c1 = card();
  c1.append(
    stepper('Rounds', s.rounds, { min: 1, max: 8, onChange: (v) => setSetting('rounds', v) }),
    stepper('Breaths per round', s.breaths, { min: 10, max: 60, step: 5, onChange: (v) => setSetting('breaths', v) }),
    stepper('Recovery hold', s.recoverySec, { min: 5, max: 30, step: 5, format: (v) => v + 's', onChange: (v) => setSetting('recoverySec', v) }));
  const c2 = card();
  c2.append(
    toggle('Guidance voice', s.guideBreathing, (v) => setSetting('guideBreathing', v), { hint: 'Energetic while breathing' }),
    toggle('Retention guidance', s.guideRetention, (v) => setSetting('guideRetention', v), { hint: 'Calm while holding' }),
    toggle('Breathing sounds', s.breathSounds, (v) => setSetting('breathSounds', v)),
    toggle('Music while breathing', s.musicBreath, (v) => setSetting('musicBreath', v)),
    toggle('Music while holding', s.musicHold, (v) => setSetting('musicHold', v)),
    toggle('Ping and gong', s.gong, (v) => setSetting('gong', v)));
  body.append(c1, c2);

  const start = el('button', 'btn primary sticky', 'Start');
  start.onclick = () => { A.unlock(); ctx.nav.go('guidedSession'); };
  add(wrap, header(ctx, 'Guided Breathing'), body, start);
  return wrap;
}

/* ------------------------------------------------------------------ session */

const COACH = ['b-power', 'b-full', 'b-strong', 'b-alive', 'b-tingle', 'b-flow'];

export function guidedSession(ctx) {
  const s = settings();
  const pace = PACES[s.pace];
  const st = { round: 1, phase: 'lead', holds: [], breath: 0, coachIdx: 0, done: false };
  let timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const every = (fn, ms) => { const t = setInterval(fn, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = []; };

  const wrap = el('div', 'session');
  const bar = el('header', 'topbar');
  const roundLbl = el('h1', null, 'Round 1 / ' + s.rounds);
  const fin = el('button', 'bar-pill', 'Finish');
  fin.type = 'button';
  bar.append(el('span', 'bar-btn'), roundLbl, fin);

  const title = el('h2', 'sess-title', 'Get ready');
  const orb = hexOrb({ palette: 'ember', size: 280 });
  const hint = el('p', 'sess-hint', '');
  const mini = miniToggles();
  const body = el('main', 'page center-page');
  body.append(title, orb.root, hint, mini);
  wrap.append(bar, body);

  const say = (id, opts = {}) => A.say(id, { guide: st.phase === 'retention' ? s.guideRetention : s.guideBreathing, ...opts });

  function end() { clearTimers(); A.stopVoice(); A.musicStop(1); A.setSessionActive(false); }
  ctx.onLeave(() => { if (!st.done) end(); });

  fin.onclick = async () => {
    const yes = await confirmDialog({ title: 'Finish exercise', body: 'Are you sure you want to finish the exercise?' });
    if (yes) { end(); st.done = true; ctx.nav.home(); }
  };

  /* --- phases --- */

  function lead() {
    st.phase = 'lead';
    A.setSessionActive(true);
    A.musicMode('breath', 3);
    title.textContent = 'Get ready';
    hint.textContent = 'Sit comfortably. Follow the rhythm.';
    orb.setPalette('ember'); orb.setScale(0.7, 0); orb.setText('Ready', '', 'word');
    say('begin');
    later(startBreathing, 5200);
  }

  function startBreathing() {
    st.phase = 'breathing'; st.breath = 0; st.coachIdx = 0;
    roundLbl.textContent = 'Round ' + st.round + ' / ' + s.rounds;
    title.textContent = 'Take ' + s.breaths + ' deep breaths';
    hint.textContent = 'Tap twice to go into retention.';
    orb.setPalette('ember'); orb.setScale(0.7, 0);
    A.musicMode('breath', 2);
    if (st.round > 1) say('round-' + Math.min(st.round, 8));
    step(true, st.round > 1 ? 2200 : 0);
  }

  function step(isIn, delay = 0) {
    later(() => {
      if (st.phase !== 'breathing') return;
      const dur = (isIn ? pace.inSec : pace.outSec) * 1000;
      if (isIn) {
        st.breath++;
        orb.setText(String(st.breath), '');
        coach();
      }
      orb.setScale(isIn ? 1 : 0.7, dur);
      A.breath(isIn ? 'in' : 'out', dur / 1000);
      later(() => {
        if (!isIn && st.breath >= s.breaths) { enterRetention(); return; }
        step(!isIn);
      }, dur);
    }, delay);
  }

  function coach() {
    const n = st.breath, left = s.breaths - n;
    if (left === 10 && s.breaths >= 20) return say('b-ten');
    if (left === 5 && s.breaths >= 15) return say('b-five');
    if (left === 0) return say('b-last');
    if (n >= 4 && (n - 4) % 7 === 0 && left > 12) {
      say(COACH[st.coachIdx % COACH.length], { priority: 'low' });
      st.coachIdx++;
    }
  }

  function enterRetention() {
    clearTimers();
    st.phase = 'retention';
    const target = holdTarget(st.round);
    const t0 = Date.now();
    st.holdStart = t0;
    title.textContent = 'Let go and hold';
    hint.textContent = 'Tap twice to go into recovery breath.';
    orb.setPalette('ice'); orb.setScale(0.8, 1400);
    orb.setText('00:00', 'target ' + fmtShort(target), true);
    A.musicMode('hold', 2.5);
    A.ping();
    say('h-start');
    let hitTarget = false, lastMinute = 0;
    const cues = [[20, 'h-relax'], [40, 'h-soft'], [90, 'h-urge']];
    const fired = new Set();
    every(() => {
      const e = (Date.now() - t0) / 1000;
      orb.setText(fmtClock(e), 'target ' + fmtShort(target), true);
      const minute = Math.floor(e / 60);
      if (minute > lastMinute && minute <= 5) { lastMinute = minute; say('h-min-' + minute); }
      else if (minute > 5 && minute > lastMinute) lastMinute = minute;
      cues.forEach(([sec, id]) => {
        if (e >= sec && !fired.has(id)) {
          fired.add(id);
          if (Math.abs(e - minute * 60) > 6) say(id, { priority: 'low' });
        }
      });
      if (!hitTarget && e >= target) { hitTarget = true; A.gong(); say('h-target'); }
    }, 250);
  }

  function enterRecovery() {
    clearTimers();
    st.holds.push((Date.now() - st.holdStart) / 1000);
    st.phase = 'recovery';
    let left = s.recoverySec;
    title.textContent = 'Recovery breath';
    hint.textContent = 'Breathe in deep and hold.';
    orb.setPalette('ice'); orb.setScale(1, 1600);
    orb.setText(String(left), 'recovery');
    A.musicMode('breath', 2);
    A.breath('in', 1.8);
    say('r-in');
    every(() => {
      left--;
      orb.setText(String(Math.max(0, left)), 'recovery');
      if (left > 0 && left <= 3) A.tick();
      if (left === 3) say('r-out', { priority: 'low' });
      if (left <= 0) { clearTimers(); nextRound(); }
    }, 1000);
  }

  function nextRound() {
    A.breath('out', 1.8);
    if (st.round >= s.rounds) return finish();
    st.round++;
    startBreathing();
  }

  function finish() {
    st.done = true;
    A.gong();
    say('finish');
    A.musicStop(4);
    A.setSessionActive(false);
    const rec = addSession('breath', { rounds: s.rounds, breaths: s.breaths, pace: s.pace, holds: st.holds, targets: st.holds.map((_, i) => holdTarget(i + 1)) });
    ctx.nav.go('guidedSummary', { id: rec.id }, { replace: true });
  }

  // double-tap anywhere in the body advances the phase
  onDoubleTap(body, () => {
    if (st.phase === 'breathing') { clearTimers(); A.stopVoice(); enterRetention(); }
    else if (st.phase === 'retention') { A.stopVoice(); enterRecovery(); }
  });

  lead();
  return wrap;
}

function miniToggles() {
  const s = settings();
  const row = el('div', 'mini-toggles');
  const pill = (label, key, after) => {
    const p = el('button', 'pill' + (s[key] ? ' on' : ''), label);
    p.type = 'button';
    p.onclick = (e) => {
      e.stopPropagation();
      setSetting(key, !settings()[key]);
      p.classList.toggle('on', settings()[key]);
      if (after) after(settings()[key]);
    };
    return p;
  };
  row.append(
    pill('Voice', 'guideBreathing', (on) => { if (!on) A.stopVoice(); }),
    pill('Breath', 'breathSounds'),
    pill('Music', 'musicBreath', (on) => { setSetting('musicHold', on); if (!on) A.musicStop(1); }));
  return row;
}

/* ------------------------------------------------------------------ summary */

export function guidedSummary(ctx) {
  const rec = sessions().find((x) => x.id === ctx.params.id) || { holds: [], targets: [] };
  const list = el('div', 'result-list');
  const max = Math.max(1, ...rec.holds, ...(rec.targets || []));
  rec.holds.forEach((h, i) => {
    const row = el('div', 'result-row');
    const label = el('div', 'result-top');
    label.append(el('span', null, 'Round ' + (i + 1)), el('b', null, fmtShort(h)));
    const track = el('div', 'result-track');
    const fill = el('div', 'result-fill' + (h >= (rec.targets[i] || 0) ? ' hit' : ''));
    fill.style.width = Math.max(4, (h / max) * 100) + '%';
    track.append(fill);
    row.append(label, track, el('small', null, 'Target ' + fmtShort(rec.targets[i] || 0)));
    list.append(row);
  });

  const orb = hexOrb({ palette: 'ember', size: 130 });
  orb.setText('✓', ''); orb.root.classList.add('mini');
  const done = el('button', 'btn primary sticky', 'Done');
  done.onclick = () => ctx.nav.home();
  const best = Math.max(0, ...rec.holds);
  return add(el('div'),
    header(ctx, 'Session complete', { back: false }),
    page(orb.root,
      el('h2', 'center', best ? 'Best hold ' + fmtShort(best) : 'Well done'),
      card(list),
      el('p', 'lede center', plural(rec.rounds || 0, 'round') + ' · ' + plural(rec.breaths || 0, 'breath') + ' per round')),
    done);
}
