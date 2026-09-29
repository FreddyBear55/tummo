import { el, hexTile, icons } from '../ui.js';
import { flags, streak, sessions, bestHold, fmtShort, byType, dayKey } from '../store.js';
import { card, plural } from './common.js';

export function home(ctx) {
  const wrap = el('main', 'page home');

  const top = el('div', 'home-top');
  const name = flags().name;
  top.append(el('h1', 'welcome', name ? 'Welcome,\n' + name : 'Welcome'));
  const ring = el('div', 'streak-ring');
  ring.append(el('b', null, String(streak())), el('small', null, 'day streak'));
  top.append(ring);
  wrap.append(top);

  const tiles = el('div', 'tiles');
  tiles.append(
    hexTile({ label: 'Breathing\nExercises', icon: icons.lungs, color: 'deep', onTap: () => ctx.nav.go('breathMenu') }),
    hexTile({ label: 'Cold\nExposure', icon: icons.snow, color: 'frost', onTap: () => ctx.nav.go('coldHome') }),
    hexTile({ label: 'Power of\nthe Mind', icon: icons.mind, color: 'gold', onTap: () => ctx.nav.go('mindMenu') }),
  );
  wrap.append(tiles);

  // today at a glance
  const today = dayKey(new Date());
  const doneToday = sessions().filter((s) => dayKey(s.date) === today);
  const banner = el('section', 'banner');
  banner.append(
    el('h2', null, doneToday.length ? 'Nice work today' : 'Ready when you are'),
    el('p', null, doneToday.length
      ? plural(doneToday.length, 'session') + ' logged today. Keep the streak going.'
      : 'A few minutes of guided breathing sets the tone for the whole day.'));
  const go = el('button', 'btn primary slim', 'Start guided breathing');
  go.onclick = () => ctx.nav.go('guidedSetup');
  banner.append(go);
  wrap.append(banner);

  const stats = el('div', 'stat-row');
  const mk = (v, l) => { const b = el('div', 'stat'); b.append(el('div', 'stat-num', v), el('div', 'stat-lbl', l)); return b; };
  stats.append(mk(String(sessions().length), 'Sessions'), mk(fmtShort(bestHold()), 'Best hold'), mk(String(byType('cold').length), 'Cold plunges'));
  wrap.append(stats);

  return wrap;
}
