// Light / dark / follow-the-phone. Stored in settings.theme ('auto' | 'light' | 'dark').
import { settings } from './store.js';

const mq = window.matchMedia('(prefers-color-scheme: dark)');

export function isDark() {
  const t = settings().theme;
  return t === 'dark' || (t !== 'light' && mq.matches);
}

export function applyTheme() {
  const t = settings().theme;
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = isDark() ? '#061a21' : '#0b3442';
}

mq.addEventListener('change', applyTheme);
