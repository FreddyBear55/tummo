// Tummo's whole sound engine.
//
//  voice   — your own recordings, else bundled Mac-voice clips, else the phone's built-in speech
//  breath  — recorded breath samples (audio/breath/manifest.json), else a soft synthesized breath
//  music   — looped tracks (audio/music/manifest.json), else a gentle built-in pad
//  cues    — ping, tick and gong (synthesized)

import { settings } from './store.js';
import { getClip, hasRecording, refreshKnown } from './recordings.js';

let ctx = null;
const bus = {};
const buffers = new Map();     // url -> AudioBuffer | null
let script = { cues: [], mind: [] };
let manifests = { breath: { in: [], out: [] }, music: { breath: [], hold: [] } };

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const vol = (key) => clamp01((settings()[key] ?? 0) / 100);

/* ---------- setup ---------- */

export async function init() {
  const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [s, b, m] = await Promise.all([
    get('voice/script.json'), get('audio/breath/manifest.json'), get('audio/music/manifest.json'),
  ]);
  if (s) script = s;
  if (b) manifests.breath = b;
  if (m) manifests.music = m;
  await refreshKnown();
}

export const getScript = () => script;
export const getTracks = (mode) => manifests.music[mode] || [];
export const cueText = (id) => {
  const c = script.cues.find((x) => x.id === id);
  if (c) return c.text;
  for (const p of script.mind) { const st = p.steps.find((x) => x.id === id); if (st) return st.text; }
  return '';
};

// Must be called from a tap. iOS only lets audio start after a user gesture.
export function unlock() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    ['voice', 'breath', 'music', 'fx'].forEach((n) => {
      bus[n] = ctx.createGain();
      bus[n].connect(ctx.destination);
    });
    keepAliveForSilentSwitch();
  }
  if (ctx.state !== 'running') ctx.resume();
  applyVolumes();
}

// On iPhone, Web Audio is muted by the side (ringer) switch unless the page is "playing media".
function keepAliveForSilentSwitch() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older iOS */ }
  try {
    const a = document.createElement('audio');
    a.setAttribute('playsinline', '');
    a.loop = true;
    a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    a.volume = 0.01;
    a.play().catch(() => {});
  } catch (e) { /* not fatal */ }
}

export function applyVolumes() {
  if (!ctx) return;
  const t = ctx.currentTime;
  bus.voice.gain.setTargetAtTime(vol('voiceVol'), t, 0.05);
  bus.breath.gain.setTargetAtTime(vol('breathVol'), t, 0.05);
  bus.music.gain.setTargetAtTime(vol('musicVol') * 0.4, t, 0.05);
  bus.fx.gain.setTargetAtTime(0.6, t, 0.05);
}

async function loadBuffer(url) {
  if (buffers.has(url)) return buffers.get(url);
  buffers.set(url, null);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const buf = await ctx.decodeAudioData(await res.arrayBuffer());
    buffers.set(url, buf);
    return buf;
  } catch (e) {
    buffers.delete(url);
    return null;
  }
}

async function decodeBlob(blob) {
  try { return await ctx.decodeAudioData(await blob.arrayBuffer()); } catch (e) { return null; }
}

/* ---------- voice ---------- */

let voiceNode = null;
let voiceBusyUntil = 0;

export function stopVoice() {
  if (voiceNode) { try { voiceNode.stop(); } catch (e) { /* already ended */ } voiceNode = null; }
  voiceBusyUntil = 0;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

// priority 'high' interrupts whatever is playing. 'low' is skipped if the voice is still talking.
export async function say(id, { priority = 'high', guide = true, force = false } = {}) {
  const s = settings();
  if (!ctx || (!force && (s.voiceSet === 'off' || !guide))) return;
  if (priority === 'low' && ctx.currentTime < voiceBusyUntil) return;
  stopVoice();

  let buf = null;
  if (hasRecording(id)) {
    const blob = await getClip(id).catch(() => null);
    if (blob) buf = await decodeBlob(blob);
  }
  if (!buf) buf = await loadBuffer('audio/voice/mac/' + id + '.m4a');

  if (buf) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(bus.voice);
    src.start();
    voiceNode = src;
    voiceBusyUntil = ctx.currentTime + buf.duration + 0.4;
    src.onended = () => { if (voiceNode === src) voiceNode = null; };
    return;
  }
  // last resort: the phone's own speech
  const text = cueText(id);
  if (text && 'speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.volume = vol('voiceVol');
    speechSynthesis.speak(u);
    voiceBusyUntil = ctx.currentTime + text.length / 14;
  }
}

// Plays a single clip for the voice studio preview.
export async function previewClip(id) {
  if (!ctx) unlock();
  stopVoice();
  await say(id, { priority: 'high', force: true });
}

/* ---------- breath ---------- */

export async function breath(kind, durSec) {
  if (!ctx || !settings().breathSounds) return;
  const list = (manifests.breath[kind] || []);
  if (list.length) {
    const url = 'audio/breath/' + list[Math.floor(Math.random() * list.length)];
    const buf = await loadBuffer(url);
    if (buf) return playSample(buf, durSec);
  }
  synthBreath(kind, durSec);
}

function playSample(buf, durSec) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = Math.max(0.6, Math.min(1.5, buf.duration / durSec));
  const g = ctx.createGain();
  const t = ctx.currentTime, d = buf.duration / src.playbackRate.value;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1, t + Math.min(0.12, d * 0.15));
  g.gain.setValueAtTime(1, t + d * 0.8);
  g.gain.linearRampToValueAtTime(0, t + d);
  src.connect(g).connect(bus.breath);
  src.start(t);
}

let noiseBuf = null;
function noise() {
  if (noiseBuf) return noiseBuf;
  const len = ctx.sampleRate * 3;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {           // pink-ish noise: softer than white
    const w = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056;
    d[i] = (b0 + b1 + b2 + w * 0.05) * 3.2;
  }
  return noiseBuf;
}

function synthBreath(kind, dur) {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise(); src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  const g = ctx.createGain();
  const from = kind === 'in' ? 500 : 1300, to = kind === 'in' ? 1300 : 450;
  bp.frequency.setValueAtTime(from, t);
  bp.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  if (kind === 'in') {
    g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  } else {
    g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  src.connect(bp).connect(lp).connect(g).connect(bus.breath);
  src.start(t, Math.random() * 2); src.stop(t + dur + 0.05);
}

/* ---------- music ---------- */

const music = { mode: null, node: null, gain: null, pad: null };

export async function musicMode(mode, fade = 2) {
  if (!ctx) return;
  const s = settings();
  const wanted = mode && ((mode === 'breath' && s.musicBreath) || (mode === 'hold' && s.musicHold)) ? mode : null;
  if (wanted === music.mode) return;
  fadeOutCurrent(fade);
  music.mode = wanted;
  if (!wanted) return;

  const list = manifests.music[wanted] || [];
  const pick = list[settings()[wanted === 'breath' ? 'trackBreath' : 'trackHold']] || list[0];
  const url = pick ? 'audio/music/' + pick.file : null;
  const buf = url ? await loadBuffer(url) : null;
  if (music.mode !== wanted) return;            // mode changed while loading
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(1, ctx.currentTime + fade);
  g.connect(bus.music);
  if (buf) {
    music.node = loopWithCrossfade(buf, g, wanted);
  } else {
    music.node = buildPad(wanted, g);
  }
  music.gain = g;
}

// Plays a track over and over, overlapping each repeat with the next so there's never a gap.
function loopWithCrossfade(buf, out, wanted) {
  const overlap = Math.min(3, buf.duration / 4);
  const live = new Set();
  let timer = null, stopped = false;
  function spawn() {
    if (stopped || music.mode !== wanted) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(live.size ? 0 : 1, t);
    if (live.size) g.gain.linearRampToValueAtTime(1, t + overlap);
    g.gain.setValueAtTime(1, t + buf.duration - overlap);
    g.gain.linearRampToValueAtTime(0, t + buf.duration);
    src.connect(g).connect(out);
    src.start(t);
    live.add(src);
    src.onended = () => live.delete(src);
    timer = setTimeout(spawn, (buf.duration - overlap) * 1000);
  }
  spawn();
  return { stop() { stopped = true; clearTimeout(timer); live.forEach((s) => { try { s.stop(); } catch (e) { /* ended */ } }); } };
}

function fadeOutCurrent(fade) {
  const { node, gain } = music;
  if (!gain) return;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0, t + fade);
  setTimeout(() => { try { node.stop(); } catch (e) { /* pad object has stop() too */ } gain.disconnect(); }, fade * 1000 + 200);
  music.node = null; music.gain = null;
}

export const musicStop = (fade = 1.5) => musicMode(null, fade);

// Built-in placeholder pad until real tracks are dropped into audio/music/.
function buildPad(mode, out) {
  const chord = mode === 'breath' ? [220, 277.18, 329.63, 415.3] : [110, 164.81, 220];
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = mode === 'breath' ? 1400 : 700;
  lp.connect(out);
  const oscs = [];
  chord.forEach((f) => [-4, 4].forEach((det) => {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
    const g = ctx.createGain(); g.gain.value = 0.05;
    o.connect(g).connect(lp); o.start(); oscs.push(o);
  }));
  return { stop: () => oscs.forEach((o) => { try { o.stop(); } catch (e) { /* ended */ } }) };
}

/* ---------- cues: tick, ping, gong ---------- */

function tone(freq, dur, peak, type = 'sine') {
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus.fx); o.start(t); o.stop(t + dur + 0.05);
}

export function tick() { if (ctx) tone(880, 0.12, 0.25); }

export function ping() { if (ctx && settings().gong) { tone(1318.5, 0.9, 0.3); tone(1975.5, 0.6, 0.12); } }

export function gong() {
  if (!ctx || !settings().gong) return;
  [[110, 3.2, 0.34], [164, 2.6, 0.2], [277, 2.0, 0.14], [421, 1.4, 0.08]].forEach(([f, d, p]) => tone(f, d, p));
}

/* ---------- keep the screen on during a session ---------- */

let wake = null;
export async function keepAwake() {
  try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch (e) { /* denied */ }
}
export function allowSleep() {
  if (wake) { wake.release().catch(() => {}); wake = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wake === null && sessionActive) keepAwake();
});
let sessionActive = false;
export function setSessionActive(on) { sessionActive = on; if (on) keepAwake(); else allowSleep(); }
