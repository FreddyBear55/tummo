import * as A from './audio.js';
import { flags } from './store.js';
import { applyTheme } from './theme.js';
import { el, icons, svg, hexPoints } from './ui.js';
import { home } from './screens/home.js';
import { breathMenu, guidedSetup, guidedSession, guidedSummary } from './screens/breathe.js';
import { retention } from './screens/retention.js';
import { coldHome, coldSession, coldSummary } from './screens/cold.js';
import { mindMenu, mindSession } from './screens/mind.js';
import { results } from './screens/results.js';
import { settingsScreen } from './screens/settings.js';
import { voiceStudio } from './screens/voice.js';
import { onboarding, safety, basics } from './screens/intro.js';

const screens = {
  home, breathMenu, guidedSetup, guidedSession, guidedSummary, retention,
  coldHome, coldSession, coldSummary, mindMenu, mindSession,
  results, settings: settingsScreen, voiceStudio, onboarding, safety, basics,
};
const TABS = { results: 'Results', home: 'Home', settings: 'Settings' };
const app = document.getElementById('app');

let stack = [];
let leaveHook = null;

export const nav = {
  go(name, params = {}, { replace = false } = {}) {
    if (replace) stack.pop();
    stack.push({ name, params });
    render();
  },
  back() {
    if (stack.length > 1) stack.pop();
    render();
  },
  // jump to a top-level tab, clearing history
  tab(name) { stack = [{ name, params: {} }]; render(); },
  home() { nav.tab('home'); },
};

function render() {
  if (leaveHook) { try { leaveHook(); } catch (e) { console.error(e); } leaveHook = null; }
  const { name, params } = stack[stack.length - 1];
  const ctx = { nav, params, onLeave: (fn) => { leaveHook = fn; } };
  app.replaceChildren();
  const view = el('div', 'view screen-' + name);
  view.append(screens[name](ctx));
  app.append(view);
  if (TABS[name]) app.append(tabbar(name));
  app.scrollTop = 0;
  window.scrollTo(0, 0);
}

function tabbar(active) {
  const bar = el('nav', 'tabbar');
  const mk = (key, iconFn, label) => {
    const b = el('button', 'tab' + (active === key ? ' on' : ''));
    b.type = 'button';
    b.append(iconFn(), el('span', null, label));
    b.onclick = () => nav.tab(key);
    return b;
  };
  const centre = el('button', 'tab-home' + (active === 'home' ? ' on' : ''));
  centre.type = 'button';
  centre.setAttribute('aria-label', 'Home');
  centre.append(svg('svg', { viewBox: '0 0 64 64' }, [
    svg('polygon', { points: hexPoints(32, 32, 26), style: 'fill:var(--paper);stroke:var(--paper)', 'stroke-width': 8, 'stroke-linejoin': 'round' }),
    svg('polygon', { points: hexPoints(22, 36, 7), style: 'fill:var(--ink)' }),
    svg('polygon', { points: hexPoints(38, 28, 7), style: 'fill:var(--hexb)' }),
    svg('polygon', { points: hexPoints(40, 44, 7), style: 'fill:var(--hexc)' }),
  ]));
  centre.onclick = () => nav.tab('home');
  bar.append(mk('results', icons.chart, 'Results'), centre, mk('settings', icons.gear, 'Settings'));
  return bar;
}

async function boot() {
  applyTheme();
  await A.init();
  nav.tab(flags().onboarded ? 'home' : 'onboarding');
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // A new version took over: reload once so it shows up, but never in the middle of a session.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !A.isSessionActive()) location.reload();
    });
  }
}
boot();
