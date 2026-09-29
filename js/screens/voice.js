import * as A from '../audio.js';
import { el, add, icons } from '../ui.js';
import { header, page, card } from './common.js';
import { startRecording, saveClip, deleteClip, hasRecording, refreshKnown, toWav, exportPack, importPack } from '../recordings.js';

// Record your own voice for any line, right on this device. Recordings work offline.
export function voiceStudio(ctx) {
  const script = A.getScript();
  const groups = [
    ['Energetic: breathing', script.cues.filter((c) => c.tone === 'energetic')],
    ['Calm: holding and recovery', script.cues.filter((c) => c.tone === 'calm')],
    ['Calm: Power of the Mind', script.mind.flatMap((p) => p.steps.map((s) => ({ ...s, tone: 'calm' })))],
  ];
  const wrap = el('main', 'page');
  const progress = el('p', 'lede small', '');
  const total = groups.reduce((n, g) => n + g[1].length, 0);
  let active = null;

  const updateProgress = () => {
    const n = groups.reduce((c, g) => c + g[1].filter((x) => hasRecording(x.id)).length, 0);
    progress.textContent = n + ' of ' + total + ' lines recorded. Lines you skip use the Mac voice.';
  };

  wrap.append(el('p', 'lede', 'Read each line in the tone shown. Tap the mic, speak, tap again to stop. Find a quiet room and hold the phone about a hand’s width away.'), progress);

  const pack = card(el('h3', null, 'Move recordings between devices'));
  pack.append(el('p', 'lede small', 'Record on any device, export a voice pack, then import it on your other devices (AirDrop or Files works).'));
  const exp = el('button', 'btn outline', 'Export voice pack');
  const file = el('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.style.display = 'none';
  const imp = el('button', 'btn outline', 'Import voice pack');
  const msg = el('p', 'muted', '');
  exp.onclick = async () => {
    const text = await exportPack();
    const f = new File([text], 'tummo-voice-pack.json', { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f] }).catch(() => {}); return; }
    const a = el('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.append(a); a.click(); a.remove();
  };
  imp.onclick = () => file.click();
  file.onchange = async () => {
    try { msg.textContent = 'Imported ' + await importPack(await file.files[0].text()) + ' recordings. Reopen this screen to see them.'; updateProgress(); }
    catch (e) { msg.textContent = e.message; }
    file.value = '';
  };
  pack.append(exp, imp, file, msg);
  wrap.append(pack);

  groups.forEach(([title, cues]) => {
    const c = card(el('h3', null, title));
    cues.forEach((cue) => {
      const row = el('div', 'voice-row');
      const text = el('p', null, cue.text);
      const btns = el('div', 'voice-btns');
      const status = el('i', 'voice-dot' + (hasRecording(cue.id) ? ' on' : ''));
      const rec = el('button', 'icon-btn'); rec.type = 'button'; rec.append(icons.mic()); rec.setAttribute('aria-label', 'Record');
      const play = el('button', 'icon-btn'); play.type = 'button'; play.append(icons.play()); play.setAttribute('aria-label', 'Play');
      const del = el('button', 'icon-btn'); del.type = 'button'; del.append(icons.trash()); del.setAttribute('aria-label', 'Delete recording');
      const sync = () => { const has = hasRecording(cue.id); status.classList.toggle('on', has); del.style.display = has ? '' : 'none'; };

      rec.onclick = async () => {
        A.unlock();
        if (active && active.id === cue.id) {
          const blob = await toWav(await active.handle.stop());
          await saveClip(cue.id, blob); await refreshKnown();
          rec.classList.remove('recording'); active = null; sync(); updateProgress();
          return;
        }
        if (active) return;
        try {
          const handle = await startRecording();
          active = { id: cue.id, handle };
          rec.classList.add('recording');
        } catch (e) { text.textContent = 'Microphone not available. Allow access in Settings › Safari › Microphone.'; }
      };
      play.onclick = () => A.previewClip(cue.id);
      del.onclick = async () => { await deleteClip(cue.id); await refreshKnown(); sync(); updateProgress(); };

      btns.append(rec, play, del);
      row.append(status, text, btns);
      sync();
      c.append(row);
    });
    wrap.append(c);
  });
  updateProgress();
  ctx.onLeave(() => { if (active) active.handle.stop(); });
  return add(el('div'), header(ctx, 'Record my voice'), wrap);
}
