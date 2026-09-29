import * as A from '../audio.js';
import { el, add, hexOrb } from '../ui.js';
import { addSession, bestHold, byType, fmtClock, fmtShort } from '../store.js';
import { header, page, card } from './common.js';

// A plain breath-hold stopwatch: tap to start, tap to stop. Logged like any session.
export function retention(ctx) {
  let t0 = 0, timer = null, running = false;
  const orb = hexOrb({ palette: 'ice', size: 280 });
  const hint = el('p', 'sess-hint', 'Exhale, then tap to start the clock.');
  const result = el('div', 'result-note');
  const recent = el('div');

  function drawRecent() {
    recent.replaceChildren();
    const rows = byType('retention').slice(0, 5);
    if (!rows.length) return;
    const c = card(el('h3', null, 'Recent holds'));
    rows.forEach((r) => {
      const row = el('div', 'row-simple');
      row.append(el('span', null, new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })), el('b', null, fmtShort(r.seconds)));
      c.append(row);
    });
    recent.append(c);
  }

  function reset() {
    orb.setPalette('ice'); orb.setScale(0.8, 600);
    orb.setText('00:00', 'best ' + fmtShort(bestHold()), true);
  }

  function toggle() {
    A.unlock();
    if (!running) {
      running = true; t0 = Date.now(); result.textContent = '';
      hint.textContent = 'Tap when you need to breathe.';
      A.setSessionActive(true); A.ping();
      orb.setScale(0.7, 800);
      timer = setInterval(() => orb.setText(fmtClock((Date.now() - t0) / 1000), 'holding', true), 200);
    } else {
      running = false; clearInterval(timer);
      const secs = (Date.now() - t0) / 1000;
      const prevBest = bestHold();
      addSession('retention', { seconds: secs });
      A.setSessionActive(false); A.gong();
      hint.textContent = 'Exhale, then tap to start the clock.';
      result.textContent = secs > prevBest && prevBest > 0 ? 'New personal best! ' + fmtShort(secs) : 'Held for ' + fmtShort(secs);
      reset(); drawRecent();
    }
  }

  ctx.onLeave(() => { clearInterval(timer); A.setSessionActive(false); });
  orb.root.onclick = toggle;
  orb.root.classList.add('tappable');
  reset(); drawRecent();
  return add(el('div'), header(ctx, 'Retention Timer'), page(el('div', 'center-page', add(el('div'), orb.root, hint, result)), recent));
}
