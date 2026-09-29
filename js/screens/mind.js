import * as A from '../audio.js';
import { el, add, hexOrb, icons, confirmDialog } from '../ui.js';
import { addSession, fmtClock } from '../store.js';
import { header, page } from './common.js';

export function mindMenu(ctx) {
  const list = el('div', 'mind-list');
  A.getScript().mind.forEach((p) => {
    const b = el('button', 'mind-card');
    b.type = 'button';
    const badge = el('div', 'tool-badge gold');
    badge.append(icons.mind());
    const txt = el('div');
    txt.append(el('strong', null, p.title), el('p', null, p.blurb), el('small', null, p.minutes + ' min'));
    b.append(badge, txt);
    b.onclick = () => { A.unlock(); ctx.nav.go('mindSession', { id: p.id }); };
    list.append(b);
  });
  return add(el('div'), header(ctx, 'Power of the Mind'), page(el('p', 'lede', 'Short guided sessions to focus, prepare and reset. Best with headphones.'), list));
}

export function mindSession(ctx) {
  const prog = A.getScript().mind.find((p) => p.id === ctx.params.id);
  const total = prog.minutes * 60;
  const st = { t0: Date.now(), done: false };
  let timer = null;
  const fired = new Set();

  const wrap = el('div', 'session mind-scope');
  const bar = el('header', 'topbar');
  const fin = el('button', 'bar-pill', 'End');
  fin.type = 'button';
  bar.append(el('span', 'bar-btn'), el('h1', null, prog.title), fin);

  const orb = hexOrb({ palette: 'mind', size: 260 });
  orb.root.classList.add('breathe-slow');
  const line = el('p', 'mind-line', 'Settle in…');
  const body = el('main', 'page center-page');
  body.append(orb.root, line);
  wrap.append(bar, body);

  function stop() { clearInterval(timer); A.stopVoice(); A.musicStop(2); A.setSessionActive(false); }
  ctx.onLeave(() => { if (!st.done) stop(); });

  fin.onclick = async () => {
    if (await confirmDialog({ title: 'End session', body: 'End this session now?' })) { stop(); st.done = true; ctx.nav.back(); }
  };

  function finish() {
    st.done = true; stop(); A.gong();
    addSession('mind', { name: prog.title, seconds: Math.round((Date.now() - st.t0) / 1000) });
    ctx.nav.back();
  }

  A.setSessionActive(true);
  A.musicMode('hold', 3);
  timer = setInterval(() => {
    const e = (Date.now() - st.t0) / 1000;
    orb.setText(fmtClock(Math.max(0, total - e)), '', true);
    prog.steps.forEach((step) => {
      if (e >= step.t && !fired.has(step.id)) { fired.add(step.id); line.textContent = step.text; A.say(step.id); }
    });
    if (e >= total) finish();
  }, 250);
  orb.setText(fmtClock(total), '', true);
  return wrap;
}
