import { el, svg } from '../ui.js';
import { sessions, streak, bestHold, byType, activeDays, dayKey, fmtShort } from '../store.js';
import { card, statBox, plural } from './common.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function results() {
  const wrap = el('main', 'page');
  wrap.append(el('h1', 'page-title', 'Results'));

  const stats = el('div', 'stat-row');
  stats.append(statBox(String(streak()), 'Day streak', true), statBox(String(sessions().length), 'Sessions'), statBox(fmtShort(bestHold()), 'Best hold'));
  wrap.append(stats);

  const cal = el('div');
  wrap.append(card(cal));
  let view = new Date(); view.setDate(1);
  const days = activeDays();

  function drawCal() {
    cal.replaceChildren();
    const head = el('div', 'cal-head');
    const prev = el('button', 'cal-nav', '‹'), next = el('button', 'cal-nav', '›');
    [prev, next].forEach((b) => { b.type = 'button'; });
    prev.onclick = () => { view.setMonth(view.getMonth() - 1); drawCal(); };
    next.onclick = () => { view.setMonth(view.getMonth() + 1); drawCal(); };
    head.append(prev, el('strong', null, MONTHS[view.getMonth()] + ' ' + view.getFullYear()), next);
    const grid = el('div', 'cal-grid');
    'SMTWTFS'.split('').forEach((d) => grid.append(el('span', 'cal-dow', d)));
    const first = view.getDay(), count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (let i = 0; i < first; i++) grid.append(el('span'));
    for (let d = 1; d <= count; d++) {
      const key = view.getFullYear() + '-' + (view.getMonth() + 1) + '-' + d;
      const isToday = key === dayKey(new Date());
      grid.append(el('span', 'cal-day' + (days.has(key) ? ' on' : '') + (isToday ? ' today' : ''), String(d)));
    }
    cal.append(head, grid);
  }
  drawCal();

  // best hold per breathing session, most recent 12
  const breath = byType('breath').slice(0, 12).reverse();
  if (breath.length > 1) {
    const vals = breath.map((s) => Math.max(0, ...(s.holds || [0])));
    const max = Math.max(...vals, 1);
    const W = 300, H = 90, bw = W / vals.length;
    const chart = svg('svg', { viewBox: `0 0 ${W} ${H + 4}`, class: 'chart' });
    vals.forEach((v, i) => {
      const h = Math.max(3, (v / max) * H);
      chart.append(svg('rect', { x: i * bw + 3, y: H - h + 2, width: bw - 6, height: h, rx: 4, fill: i === vals.length - 1 ? 'var(--amber)' : 'var(--sky)' }));
    });
    wrap.append(card(el('h3', null, 'Best hold per session'), chart));
  }

  const hist = card(el('h3', null, 'History'));
  if (!sessions().length) hist.append(el('p', 'empty', 'No sessions yet. Start one from Home.'));
  sessions().slice(0, 40).forEach((s) => {
    const row = el('div', 'hist-row');
    const left = el('div');
    const date = new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    let sub, right;
    if (s.type === 'breath') { sub = 'Breathing · ' + plural(s.rounds, 'round') + ' · ' + plural(s.breaths, 'breath'); right = fmtShort(Math.max(0, ...(s.holds || [0]))); }
    else if (s.type === 'cold') { sub = 'Cold · ' + s.tempF + '°F' + (s.hit ? ' · target met' : ''); right = fmtShort(s.seconds); }
    else if (s.type === 'retention') { sub = 'Retention timer'; right = fmtShort(s.seconds); }
    else { sub = s.name || 'Mind'; right = fmtShort(s.seconds); }
    left.append(el('div', 'hist-date', date), el('div', 'hist-sub', sub));
    row.append(el('i', 'dot ' + s.type), left, el('b', null, right));
    hist.append(row);
  });
  wrap.append(hist);
  return wrap;
}
