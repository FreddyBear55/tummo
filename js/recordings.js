// Your own voice recordings, stored on this device in IndexedDB (works offline).
// A recording for a cue always wins over the bundled Mac-voice clip.

const DB = 'tummo-voice';
const STORE = 'clips';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

export const saveClip = (id, blob) => tx('readwrite', (s) => s.put(blob, id));
export const deleteClip = (id) => tx('readwrite', (s) => s.delete(id));
export const getClip = (id) => tx('readonly', (s) => s.get(id));
export const listClipIds = () => tx('readonly', (s) => s.getAllKeys());

// Cache of decoded ids so the audio engine can check quickly.
let known = new Set();
export async function refreshKnown() {
  try { known = new Set(await listClipIds()); } catch (e) { known = new Set(); }
  return known;
}
export const hasRecording = (id) => known.has(id);

/* ---------- recording via microphone ---------- */

export function bestMime() {
  const opts = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
  return opts.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

// Re-encodes a recording as 24 kHz mono WAV with silence trimmed off both ends.
// WAV plays on every device, whatever browser it was recorded in.
export async function toWav(blob) {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const buf = await ac.decodeAudioData(await blob.arrayBuffer());
  ac.close();
  const src = buf.getChannelData(0);
  const rate = 24000, ratio = buf.sampleRate / rate;
  const n = Math.floor(src.length / ratio);
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i++) pcm[i] = src[Math.floor(i * ratio)];
  const thr = 0.02;
  let a = 0, b = n - 1;
  while (a < n && Math.abs(pcm[a]) < thr) a++;
  while (b > a && Math.abs(pcm[b]) < thr) b--;
  a = Math.max(0, a - Math.floor(rate * 0.08)); b = Math.min(n - 1, b + Math.floor(rate * 0.15));
  const len = Math.max(1, b - a + 1);
  const out = new DataView(new ArrayBuffer(44 + len * 2));
  const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); out.setUint32(4, 36 + len * 2, true); str(8, 'WAVEfmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
  str(36, 'data'); out.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[a + i])) * 32767, true);
  return new Blob([out], { type: 'audio/wav' });
}

/* ---------- voice pack: move your recordings between devices ---------- */

const toB64 = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); });

export async function exportPack() {
  const ids = await listClipIds();
  const clips = {};
  for (const id of ids) clips[id] = await toB64(await getClip(id));
  return JSON.stringify({ app: 'tummo-voice', version: 1, clips });
}

export async function importPack(text) {
  const d = JSON.parse(text);
  if (d.app !== 'tummo-voice') throw new Error('This is not a Tummo voice pack.');
  let n = 0;
  for (const [id, b64] of Object.entries(d.clips || {})) {
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    await saveClip(id, new Blob([bytes], { type: 'audio/wav' })); n++;
  }
  await refreshKnown();
  return n;
}

export async function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This page has no microphone access (it must be opened from the https address).');
  if (!window.MediaRecorder) throw new Error('This browser cannot record audio (no MediaRecorder).');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = bestMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: rec.mimeType || mime || 'audio/mp4' }));
    };
  });
  rec.start();
  return { stop: () => { rec.stop(); return done; } };
}
