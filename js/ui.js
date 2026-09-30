// Small UI building blocks: element helper, hexagon graphics, icons, controls.

export function el(tag, cls, content) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (content != null) {
    if (content instanceof Node) n.appendChild(content);
    else n.textContent = content;
  }
  return n;
}

export function add(parent, ...kids) {
  kids.flat().forEach((k) => k && parent.appendChild(k));
  return parent;
}

const NS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs = {}, kids = []) {
  const n = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  kids.forEach((k) => n.appendChild(k));
  return n;
}

// Rounded pointy-top hexagon centred at (cx, cy) with circumradius r.
// Rounded corners come from a thick stroke in the same colour as the fill.
export function hexPoints(cx, cy, r) {
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return (cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2);
  }).join(' ');
}

import { isDark } from './theme.js';

const PALETTES = {
  ember: ['#e8722c', '#f08a34', '#f5a94a', '#f9cd82', '#fff4dc'],
  ice:   ['#b9dde5', '#cfe8ee', '#e0f1f5', '#ecf7fa', '#f5fbfc'],
  cold:  ['#5aa9c8', '#79bcd6', '#9fd0e3', '#c4e3ee', '#e6f4f9'],
  mind:  ['#d99a1f', '#e8b040', '#f1c56a', '#f7dc9c', '#fdf2d6'],
  teal:  ['#1b5566', '#2a6b7d', '#4a8a9b', '#8cb8c4', '#d3e6ea'],
};
// Night mode: every palette becomes a red ramp, brightest at the rim and darkest in the centre so the text stays readable.
const NIGHT = ['#c22a1f', '#a12018', '#82180f', '#5f100b', '#3a0906'];
const DARK_PALETTES = { ember: NIGHT, ice: NIGHT, cold: NIGHT, mind: NIGHT, teal: NIGHT };

// The big breathing hexagon: layered rings that scale together, with text on top.
export function hexOrb({ palette = 'ember', size = 260 } = {}) {
  const root = el('div', 'orb');
  root.style.setProperty('--orb', size + 'px');
  const stage = el('div', 'orb-stage');
  const shape = el('div', 'orb-shape');
  const s = svg('svg', { viewBox: '0 0 200 200' });
  const layers = [];
  [88, 80, 72, 64, 56].forEach((r, i) => {
    const p = svg('polygon', { points: hexPoints(100, 100, r), 'stroke-width': 10, 'stroke-linejoin': 'round' });
    layers.push(p); s.appendChild(p);
  });
  shape.appendChild(s);
  const big = el('div', 'orb-big');
  const sub = el('div', 'orb-sub');
  stage.append(shape, big, sub);
  root.appendChild(stage);

  const api = {
    root,
    setPalette(name) {
      const cols = (isDark() && DARK_PALETTES[name]) || PALETTES[name] || PALETTES.ember;
      layers.forEach((p, i) => { p.setAttribute('fill', cols[i]); p.setAttribute('stroke', cols[i]); });
      root.dataset.palette = name;
    },
    setScale(scale, ms = 0) {
      shape.style.transition = ms ? 'transform ' + ms + 'ms cubic-bezier(.45,.05,.4,.95)' : 'none';
      shape.style.transform = 'scale(' + scale + ')';
    },
    setText(b, sm = '', isTime = false) {
      big.textContent = b; sub.textContent = sm;
      big.classList.toggle('time', isTime === true);
      big.classList.toggle('word', isTime === 'word');
    },
  };
  api.setPalette(palette);
  return api;
}

// Small hexagon tile used on the home screen.
export function hexTile({ label, icon, color, onTap }) {
  const b = el('button', 'hex-tile ' + color);
  b.type = 'button';
  const s = svg('svg', { viewBox: '0 0 200 200', class: 'hex-bg' }, [
    svg('polygon', { points: hexPoints(100, 100, 84), 'stroke-width': 24, 'stroke-linejoin': 'round' }),
  ]);
  b.append(s);
  const inner = el('div', 'hex-inner');
  inner.append(icon(), el('span', 'hex-label', label));
  b.append(inner);
  b.onclick = onTap;
  return b;
}

/* ---------- icons (simple, soft line icons) ---------- */

function icon(inner, vb = '0 0 48 48') {
  return () => {
    const s = svg('svg', { viewBox: vb, class: 'ico', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    s.innerHTML = inner;
    return s;
  };
}

export const icons = {
  lungs: icon('<path d="M24 8v16"/><path d="M24 24c-3 3-4 5-8 5"/><path d="M24 24c3 3 4 5 8 5"/><path d="M20 14c-7 2-11 12-11 22 0 3 2 4 5 3 5-1 6-6 6-10V14z"/><path d="M28 14c7 2 11 12 11 22 0 3-2 4-5 3-5-1-6-6-6-10V14z"/>'),
  snow: icon('<path d="M24 5v38M8 14l32 20M8 34l32-20"/><path d="M19 8l5 4 5-4M19 40l5-4 5 4M6 19l6 1-1 6M42 29l-6-1 1-6M6 29l6-1-1-6M42 19l-6 1 1 6"/>'),
  mind: icon('<path d="M24 10c-6-4-15 0-15 8 0 3 1 5 3 6-2 2-2 5 0 8 1 2 3 3 5 3 1 3 4 5 7 4V10z"/><path d="M24 10c6-4 15 0 15 8 0 3-1 5-3 6 2 2 2 5 0 8-1 2-3 3-5 3-1 3-4 5-7 4"/>'),
  timer: icon('<circle cx="24" cy="27" r="14"/><path d="M24 27V18M19 6h10M36 12l3-3"/>'),
  chart: icon('<path d="M8 40V26M20 40V16M32 40V22M44 40V10" transform="scale(.9) translate(2,2)"/>'),
  gear: icon('<circle cx="24" cy="24" r="6"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M11 37l4-4M33 15l4-4"/>'),
  home: icon('<path d="M8 22L24 9l16 13"/><path d="M12 20v18h24V20"/>'),
  back: icon('<path d="M30 8L14 24l16 16"/>'),
  book: icon('<path d="M8 10c6-2 12-2 16 2 4-4 10-4 16-2v28c-6-2-12-2-16 2-4-4-10-4-16-2z"/><path d="M24 12v28"/>'),
  mic: icon('<rect x="18" y="6" width="12" height="22" rx="6"/><path d="M12 22c0 8 5 13 12 13s12-5 12-13M24 35v7"/>'),
  play: icon('<path d="M16 10l22 14-22 14z"/>'),
  stop: icon('<rect x="12" y="12" width="24" height="24" rx="4"/>'),
  trash: icon('<path d="M10 14h28M18 14V9h12v5M14 14l2 26h16l2-26"/>'),
  share: icon('<path d="M24 30V8M15 16l9-9 9 9"/><path d="M10 26v14h28V26"/>'),
};

/* ---------- controls ---------- */

export function toggle(label, on, onChange, { sub = false, hint = '' } = {}) {
  const row = el('label', 'row-toggle' + (sub ? ' sub' : ''));
  const text = el('span', 'row-label', label);
  if (hint) text.append(el('small', null, hint));
  const box = el('input');
  box.type = 'checkbox'; box.checked = !!on; box.className = 'switch';
  box.onchange = () => onChange(box.checked);
  row.append(text, box);
  return row;
}

export function stepper(label, value, { min, max, step = 1, format = String, onChange }) {
  const row = el('div', 'row-stepper');
  row.append(el('span', 'row-label', label));
  const box = el('div', 'stepper');
  const minus = el('button', 'step-btn', '−'), plus = el('button', 'step-btn', '+');
  const val = el('span', 'step-val', format(value));
  [minus, plus].forEach((b) => { b.type = 'button'; });
  const set = (v) => { value = Math.max(min, Math.min(max, v)); val.textContent = format(value); onChange(value); };
  minus.onclick = () => set(value - step);
  plus.onclick = () => set(value + step);
  box.append(minus, val, plus);
  row.append(box);
  return row;
}

export function segmented(options, current, onChange) {
  const wrap = el('div', 'segmented');
  const btns = options.map(([key, label]) => {
    const b = el('button', 'seg' + (key === current ? ' on' : ''), label);
    b.type = 'button';
    b.onclick = () => { btns.forEach((x) => x.classList.remove('on')); b.classList.add('on'); onChange(key); };
    wrap.append(b);
    return b;
  });
  return wrap;
}

export function slider(label, value, onInput) {
  const row = el('div', 'row-slider');
  row.append(el('span', 'row-label', label));
  const r = el('input');
  r.type = 'range'; r.min = 0; r.max = 100; r.value = value;
  r.oninput = () => onInput(parseInt(r.value, 10));
  row.append(r);
  return row;
}

export function confirmDialog({ title, body, yes = 'Yes', no = 'No' }) {
  return new Promise((resolve) => {
    const scrim = el('div', 'scrim');
    const box = el('div', 'dialog');
    const done = (v) => { scrim.remove(); resolve(v); };
    const y = el('button', 'btn primary', yes), n = el('button', 'btn outline', no);
    y.onclick = () => done(true); n.onclick = () => done(false);
    box.append(el('h3', null, title), el('p', null, body), y, n);
    scrim.append(box);
    document.body.append(scrim);
  });
}
