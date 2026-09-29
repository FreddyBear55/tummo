// Everything Tummo remembers lives here: settings, session log, flags.
// One localStorage key, plus export/import so history can move between devices.

const KEY = 'tummo.v4';

export const DEFAULTS = {
  // breathing
  rounds: 3,
  breaths: 40,
  pace: 'standard',          // slow | standard | fast
  recoverySec: 15,
  holdTargetStart: 60,
  holdTargetStep: 30,
  holdTargetMax: 300,
  // cold
  coldStart: 30,
  coldStep: 15,
  coldMax: 180,
  coldPrep: 10,
  coldTempF: 50,
  // audio
  voiceSet: 'mac',           // mac | off  (your own recordings override individual clips)
  guideBreathing: true,
  guideRetention: true,
  breathSounds: true,
  musicBreath: true,
  musicHold: true,
  gong: true,
  trackBreath: 0,
  trackHold: 0,
  voiceVol: 90,
  breathVol: 70,
  musicVol: 45,
};

export const PACES = {
  slow:     { label: 'Slow',     inSec: 3.0, outSec: 3.0 },
  standard: { label: 'Standard', inSec: 2.0, outSec: 2.0 },
  fast:     { label: 'Fast',     inSec: 1.5, outSec: 1.5 },
};

function blank() {
  return { version: 4, rev: 2, settings: { ...DEFAULTS }, sessions: [], flags: { onboarded: false, name: '' } };
}

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      // rev 2 (2026-09-29): default breaths per round went from 30 to 40. Move over anyone still on the old default.
      if ((d.rev || 1) < 2 && d.settings && d.settings.breaths === 30) d.settings.breaths = 40;
      return {
        version: 4,
        rev: 2,
        settings: { ...DEFAULTS, ...(d.settings || {}) },
        sessions: Array.isArray(d.sessions) ? d.sessions : [],
        flags: { onboarded: false, name: '', ...(d.flags || {}) },
      };
    }
  } catch (e) { /* fall through to blank */ }
  return blank();
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage full or blocked */ }
}

export const settings = () => data.settings;
export const flags = () => data.flags;
export const sessions = () => data.sessions;

export function setSetting(key, value) { data.settings[key] = value; persist(); }
export function setFlag(key, value) { data.flags[key] = value; persist(); }

// type: 'breath' | 'cold' | 'retention' | 'mind'
export function addSession(type, fields) {
  const s = { id: type + '-' + Date.now(), type, date: new Date().toISOString(), ...fields };
  data.sessions.unshift(s);
  persist();
  return s;
}

export function clearSessions() { data.sessions = []; persist(); }

/* ---------- derived stats ---------- */

export const byType = (t) => data.sessions.filter((s) => s.type === t);

export function bestHold() {
  let best = 0;
  data.sessions.forEach((s) => {
    if (s.type === 'breath') (s.holds || []).forEach((h) => { best = Math.max(best, h); });
    if (s.type === 'retention') best = Math.max(best, s.seconds || 0);
  });
  return best;
}

export function dayKey(d) {
  const x = new Date(d);
  return x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate();
}

export function activeDays() {
  const days = new Set();
  data.sessions.forEach((s) => days.add(dayKey(s.date)));
  return days;
}

export function streak() {
  const days = activeDays();
  const cur = new Date();
  let n = 0;
  if (!days.has(dayKey(cur))) cur.setDate(cur.getDate() - 1); // today not done yet: don't break the streak
  while (days.has(dayKey(cur))) { n++; cur.setDate(cur.getDate() - 1); }
  return n;
}

export function holdTarget(round) {
  const s = data.settings;
  return Math.min(s.holdTargetStart + (round - 1) * s.holdTargetStep, s.holdTargetMax);
}

export function coldTarget() {
  const s = data.settings;
  return Math.min(s.coldStart + byType('cold').length * s.coldStep, s.coldMax);
}

/* ---------- export / import ---------- */

export function exportJSON() {
  return JSON.stringify(
    { app: 'tummo', version: 4, exportedAt: new Date().toISOString(),
      settings: data.settings, flags: { name: data.flags.name }, sessions: data.sessions },
    null, 2);
}

// Merges sessions by id (never duplicates), keeps existing settings unless told otherwise.
export function importJSON(text, { withSettings = true } = {}) {
  const d = JSON.parse(text);
  if (d.app !== 'tummo' || !Array.isArray(d.sessions)) throw new Error('This is not a Tummo backup file.');
  const have = new Set(data.sessions.map((s) => s.id));
  let added = 0;
  d.sessions.forEach((s) => { if (s && s.id && !have.has(s.id)) { data.sessions.push(s); added++; } });
  data.sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (withSettings && d.settings) data.settings = { ...DEFAULTS, ...d.settings };
  if (d.flags && d.flags.name && !data.flags.name) data.flags.name = d.flags.name;
  persist();
  return added;
}

/* ---------- formatting helpers shared by screens ---------- */

export function fmtShort(sec) {
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? m + ':' + String(s).padStart(2, '0') : s + 's';
}
export function fmtClock(sec) {
  sec = Math.floor(sec);
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
}
