import { el, add, hexOrb } from '../ui.js';
import { setFlag, flags } from '../store.js';
import { header, page, card } from './common.js';

export const SAFETY = [
  ['never', 'Never in or near water.', 'No pools, baths, showers, or open water. Passing out underwater is how breath-hold training kills people, and it happens without warning.'],
  ['never', 'Sit or lie down. Never stand.', 'If you faint, you should already be on the floor. Not on a chair, not on a bed edge, not on stairs.'],
  ['never', 'Never while driving or on a bike.', 'Not in a car, not on a bike, not anywhere a blackout would be dangerous.'],
  ['never', 'Cold water: never alone.', 'Have someone nearby. Get out if you go numb, shiver uncontrollably, or lose coordination. Never combine a breath hold with the plunge.'],
  ['note', 'Tingling and dizziness are normal.', 'Fainting is possible. If you black out, stop the session for the day.'],
  ['note', 'Talk to a doctor first if…', 'You are pregnant, or have epilepsy, a heart condition, high blood pressure, or a history of fainting.'],
  ['note', 'Stop if anything feels wrong.', 'This is training, not a contest. The urge to breathe is information, not weakness.'],
];

function safetyList() {
  const ul = el('ul', 'safety-list');
  SAFETY.forEach(([kind, title, body]) => {
    const li = el('li');
    li.append(el('span', 'ic ' + kind, kind === 'note' ? '!' : '✕'));
    const d = el('div');
    d.append(el('strong', null, title), el('p', null, body));
    li.append(d);
    ul.append(li);
  });
  return ul;
}

export function safety(ctx) {
  return el('div', null, add(el('div'),
    header(ctx, 'Safety'),
    page(el('p', 'lede', 'Breath holding can make you faint with no warning. These rules keep it safe.'), card(safetyList()))));
}

const SLIDES = [
  { title: 'Breathe. Hold. Recover.', body: 'Tummo guides you through rounds of powerful breathing, a relaxed breath hold, and a recovery breath. Your hold times are logged so you can watch them grow.', palette: 'ember' },
  { title: 'Cold, on your terms', body: 'Build cold tolerance gradually. Tummo gives you a target that rises a little each time, and coaches you through the plunge.', palette: 'cold' },
  { title: 'Calm the mind', body: 'Short guided sessions for intention, visualization and gratitude. Everything works offline, and everything stays on your device.', palette: 'mind' },
];

export function onboarding(ctx) {
  const wrap = el('main', 'page onboarding');
  let i = 0;
  function draw() {
    wrap.replaceChildren();
    const dots = el('div', 'dots');
    for (let d = 0; d <= SLIDES.length; d++) dots.append(el('i', d === i ? 'on' : ''));
    wrap.append(dots);

    if (i < SLIDES.length) {
      const s = SLIDES[i];
      const orb = hexOrb({ palette: s.palette, size: 200 });
      orb.setText('', '');
      orb.root.classList.add('float');
      wrap.append(orb.root, el('h2', 'center', s.title), el('p', 'lede center', s.body));
      const next = el('button', 'btn primary', 'Next');
      next.onclick = () => { i++; draw(); };
      wrap.append(next);
      return;
    }

    wrap.append(el('h2', 'center', 'Before you start'), el('p', 'lede center', 'A couple of quick things.'));
    const nameIn = el('input', 'text-input');
    nameIn.placeholder = 'Your first name (optional)';
    nameIn.value = flags().name || '';
    wrap.append(nameIn, card(safetyList()));
    const ok = el('button', 'btn primary', 'I understand. Let’s begin');
    ok.onclick = () => {
      setFlag('name', nameIn.value.trim());
      setFlag('onboarded', true);
      ctx.nav.home();
    };
    wrap.append(ok);
  }
  draw();
  return wrap;
}

export function basics(ctx) {
  const steps = [
    ['Get in position', 'Sit comfortably or lie down, somewhere you could safely pass out. Never in or near water.'],
    ['Breathe deep, then let go', 'Take a big breath into the belly, then chest, and let it fall out without forcing. Around 30–40 breaths per round.'],
    ['Exhale and hold', 'After the last breath out, stop breathing. Stay relaxed. There is nothing to do but wait for a strong urge to breathe.'],
    ['Recovery breath', 'Breathe in deeply, hold for about 15 seconds, then release. That is one round.'],
    ['Repeat', 'Do three or four rounds. Your holds usually get longer with each one.'],
  ];
  const list = el('ol', 'steps');
  steps.forEach(([t, b]) => { const li = el('li'); li.append(el('strong', null, t), el('p', null, b)); list.append(li); });
  return el('div', null, add(el('div'), header(ctx, 'Breathing basics'), page(card(list))));
}
