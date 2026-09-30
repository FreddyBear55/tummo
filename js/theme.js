// Day / Night / follow-the-phone. Stored in settings.theme ('auto' | 'light' | 'dark').
// Night = pure black with red accents (keeps night vision).
import { settings } from './store.js';

const mq = window.matchMedia('(prefers-color-scheme: dark)');

export function isDark() {
  const t = settings().theme;
  return t === 'dark' || (t !== 'light' && mq.matches);
}

export function applyTheme() {
  document.documentElement.dataset.mode = isDark() ? 'night' : 'day';
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = isDark() ? '#000000' : '#0b3442';
}

mq.addEventListener('change', applyTheme);
