import * as A from '../audio.js';
import { el, toggle, stepper, segmented, slider, confirmDialog } from '../ui.js';
import { settings, setSetting, flags, setFlag, exportJSON, importJSON, clearSessions, fmtShort } from '../store.js';
import { card } from './common.js';
import { applyTheme } from '../theme.js';
import { listClipIds } from '../recordings.js';

function shareOrDownload(filename, text) {
  const file = new File([text], filename, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    return navigator.share({ files: [file], title: 'Tummo backup' }).catch(() => {});
  }
  const a = el('a');
  a.href = URL.createObjectURL(file); a.download = filename;
  document.body.append(a); a.click(); a.remove();
}

export function settingsScreen(ctx) {
  const s = settings();
  const wrap = el('main', 'page');
  wrap.append(el('h1', 'page-title', 'Settings'));

  const nameIn = el('input', 'text-input');
  nameIn.placeholder = 'Your first name'; nameIn.value = flags().name || '';
  nameIn.onchange = () => setFlag('name', nameIn.value.trim());
  wrap.append(card(el('h3', null, 'Profile'), nameIn));

  const look = card(el('h3', null, 'Appearance'));
  look.append(segmented([['auto', 'Auto'], ['light', 'Day'], ['dark', 'Night']], s.theme || 'auto', (k) => { setSetting('theme', k); applyTheme(); }));
  look.append(el('small', 'muted', 'Night is pure black with red text, to protect your night vision. Auto follows your phone’s light or dark setting. Turn your screen brightness down too.'));
  wrap.append(look);

  const voice = card(el('h3', null, 'Voice'));
  voice.append(segmented([['mac', 'Mac voice'], ['off', 'Off']], s.voiceSet === 'off' ? 'off' : 'mac', (k) => { setSetting('voiceSet', k); if (k === 'off') A.stopVoice(); }));
  const studio = el('button', 'btn outline', 'Record my own voice');
  studio.onclick = () => ctx.nav.go('voiceStudio');
  const count = el('small', 'muted', '');
  listClipIds().then((ids) => { count.textContent = ids.length ? ids.length + ' of your recordings are in use.' : 'Your recordings replace the Mac voice line by line.'; }).catch(() => {});
  voice.append(studio, count);
  wrap.append(voice);

  const styles = A.getBreathStyles();
  if (styles.length) {
    const bs = card(el('h3', null, 'Breathing sound'));
    const cur = () => settings().breathStyle || 'soft';
    const rows = styles.map((st) => {
      const row = el('div', 'style-row' + (st.id === cur() ? ' on' : ''));
      row.setAttribute('role', 'button');
      const txt = el('div');
      txt.append(el('strong', null, st.title), el('small', null, st.desc));
      const play = el('button', 'style-play', 'Hear it');
      play.type = 'button';
      play.onclick = (e) => { e.stopPropagation(); A.previewBreath(st.id); };
      row.append(txt, play);
      row.onclick = () => { setSetting('breathStyle', st.id); rows.forEach((r, i) => r.classList.toggle('on', styles[i].id === st.id)); A.previewBreath(st.id); };
      return row;
    });
    bs.append(...rows);
    wrap.append(bs);
  }

  const sound = card(el('h3', null, 'Sound'));
  sound.append(
    slider('Voice volume', s.voiceVol, (v) => { setSetting('voiceVol', v); A.applyVolumes(); }),
    slider('Breath volume', s.breathVol, (v) => { setSetting('breathVol', v); A.applyVolumes(); }),
    slider('Music volume', s.musicVol, (v) => { setSetting('musicVol', v); A.applyVolumes(); }));
  wrap.append(sound);

  const music = card(el('h3', null, 'Music'));
  [['breath', 'trackBreath', 'While breathing'], ['hold', 'trackHold', 'While holding']].forEach(([mode, key, label]) => {
    const tracks = A.getTracks(mode);
    if (tracks.length < 2) return;
    music.append(el('span', 'row-label', label), segmented(tracks.map((tr, i) => [i, tr.title]), s[key], (i) => setSetting(key, +i)));
  });
  if (music.children.length > 1) wrap.append(music);

  const holds = card(el('h3', null, 'Hold targets'));
  holds.append(
    stepper('First round', s.holdTargetStart, { min: 15, max: 240, step: 15, format: fmtShort, onChange: (v) => setSetting('holdTargetStart', v) }),
    stepper('Added each round', s.holdTargetStep, { min: 0, max: 120, step: 15, format: (v) => '+' + v + 's', onChange: (v) => setSetting('holdTargetStep', v) }),
    stepper('Maximum', s.holdTargetMax, { min: 60, max: 600, step: 30, format: fmtShort, onChange: (v) => setSetting('holdTargetMax', v) }));
  wrap.append(holds);

  const cold = card(el('h3', null, 'Cold targets'));
  cold.append(
    stepper('First plunge', s.coldStart, { min: 10, max: 120, step: 5, format: fmtShort, onChange: (v) => setSetting('coldStart', v) }),
    stepper('Added each plunge', s.coldStep, { min: 0, max: 60, step: 5, format: (v) => '+' + v + 's', onChange: (v) => setSetting('coldStep', v) }),
    stepper('Maximum', s.coldMax, { min: 30, max: 600, step: 15, format: fmtShort, onChange: (v) => setSetting('coldMax', v) }));
  wrap.append(cold);

  const backup = card(el('h3', null, 'Backup and other devices'));
  backup.append(el('p', 'lede small', 'Export your history, then import it on your iPad or iPhone.'));
  const exp = el('button', 'btn outline', 'Export history');
  exp.onclick = () => shareOrDownload('tummo-backup-' + new Date().toISOString().slice(0, 10) + '.json', exportJSON());
  const file = el('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.style.display = 'none';
  const msg = el('p', 'muted', '');
  file.onchange = async () => {
    try {
      const n = importJSON(await file.files[0].text());
      msg.textContent = 'Imported ' + n + ' new session' + (n === 1 ? '' : 's') + '.';
    } catch (e) { msg.textContent = e.message; }
    file.value = '';
  };
  const imp = el('button', 'btn outline', 'Import history');
  imp.onclick = () => file.click();
  backup.append(exp, imp, file, msg);
  wrap.append(backup);

  const more = card(el('h3', null, 'More'));
  const safety = el('button', 'btn outline', 'Safety rules'); safety.onclick = () => ctx.nav.go('safety');
  const intro = el('button', 'btn outline', 'Replay intro'); intro.onclick = () => ctx.nav.go('onboarding');
  const wipe = el('button', 'btn danger', 'Erase all history');
  wipe.onclick = async () => {
    if (await confirmDialog({ title: 'Erase all history?', body: 'This removes every logged session on this device. It can’t be undone.', yes: 'Erase', no: 'Keep' })) {
      clearSessions(); ctx.nav.tab('settings');
    }
  };
  more.append(safety, intro, wipe);
  wrap.append(more);
  return wrap;
}
