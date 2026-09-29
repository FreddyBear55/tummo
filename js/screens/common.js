import { el, icons } from '../ui.js';

// Dark top bar with back arrow, title and optional right-hand control.
export function header(ctx, title, { right = null, back = true, onBack = null } = {}) {
  const bar = el('header', 'topbar');
  const l = el('button', 'bar-btn');
  l.type = 'button';
  if (back) {
    l.append(icons.back());
    l.setAttribute('aria-label', 'Back');
    l.onclick = onBack || (() => ctx.nav.back());
  } else l.style.visibility = 'hidden';
  bar.append(l, el('h1', null, title), right || el('span', 'bar-btn'));
  return bar;
}

export function page(...kids) {
  const p = el('main', 'page');
  kids.flat().forEach((k) => k && p.append(k));
  return p;
}

export function card(...kids) {
  const c = el('section', 'card');
  kids.flat().forEach((k) => k && c.append(k));
  return c;
}

// Fires cb on a quick second tap. Used for "tap twice to continue".
export function onDoubleTap(node, cb, ms = 450) {
  let last = 0;
  node.addEventListener('pointerup', () => {
    const now = Date.now();
    if (now - last < ms) { last = 0; cb(); } else last = now;
  });
}

export function statBox(value, label, accent = false) {
  const b = el('div', 'stat');
  b.append(el('div', 'stat-num' + (accent ? ' accent' : ''), value), el('div', 'stat-lbl', label));
  return b;
}

export const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
