import { WaveformEditor, AudioPlayer, SoundLibrary } from './lib.js';

const $ = id => document.getElementById(id);
const ga = (el, n, cb) => $(el).addEventListener(n, cb);

const SOUNDS = ['bass', 'hit', 'snare', 'hat'];
const COLORS = { bass: '#e05555', hit: '#4fc3f7', snare: '#f0a030', hat: '#50c878' };
const SOUND_FILES = { bass: 'data/bass.wav', hit: 'data/hit.wav', snare: 'data/snear.wav', hat: 'data/hat.wav' };

const sounds = new SoundLibrary(SOUND_FILES);
const editor = new WaveformEditor($('cv'), { sounds: SOUNDS, colors: COLORS });
const player = new AudioPlayer(sounds, $('btn-play'));
player.onTick = s => { editor.playhead = s; editor.redraw(); };
player.onEnd  = () => { editor.playhead = null; editor.redraw(); };

ga('btn-wav',     'click', () => $('in-wav').click());
ga('btn-play',    'click', () => player.toggle(editor.audioBuffer, editor.markers, editor.cursor ?? 0, editor.sampleRate));
ga('btn-add',     'click', () => editor.addMarkerAtCursor());
ga('btn-del',     'click', () => editor.deleteSelected());
ga('btn-save',    'click', () => editor.saveMarkers('sandman_markers.json'));
ga('btn-load',    'click', () => $('in-json').click());

async function loadWavFromUrl(url) {
  const ac = new AudioContext();
  const ab = await ac.decodeAudioData(await fetch(url).then(r => r.arrayBuffer()));
  await ac.close();
  await editor.loadAudioBuffer(ab);
}

ga('in-wav', 'change', async e => {
  const f = e.target.files[0]; if (!f) return;
  await editor.loadFile(f);
  $('status').textContent = `${f.name}  ${editor.duration.toFixed(1)}s`;
  $('btn-play').disabled = false;
  e.target.value = '';
});

loadWavFromUrl('data/sandman.wav').then(() => {
  $('status').textContent = `sandman.wav  ${editor.duration.toFixed(1)}s`;
  $('btn-play').disabled = false;
}).catch(() => {});

ga('in-json', 'change', async e => { await editor.loadMarkers(e.target.files[0]); e.target.value = ''; });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') editor.deselect();
  if ((e.key === 'Delete' || e.key === 'Backspace') && editor.selected) editor.deleteSelected();
});

editor.onCursor = sample => {
  $('panel-pos').textContent = `cursor  sample ${sample}  (${(sample / editor.sampleRate).toFixed(3)}s)`;
};

editor.onSelect = sel => {
  const checks = $('sound-checks');
  checks.innerHTML = '';
  $('btn-del').style.display = sel ? 'inline-block' : 'none';
  if (!sel) {
    if (editor.cursor !== null) {
      $('panel-pos').textContent = `cursor  sample ${editor.cursor}  (${(editor.cursor / editor.sampleRate).toFixed(3)}s)`;
    } else {
      $('panel-pos').textContent = editor.loaded ? 'click waveform to set cursor' : 'load a wav to begin';
    }
    return;
  }
  $('panel-pos').textContent = `sample ${sel.sample}  (${(sel.sample / editor.sampleRate).toFixed(3)}s)`;
  for (const snd of SOUNDS) {
    const lbl = document.createElement('label');
    lbl.className = 'sc';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = sel.sounds.has(snd);
    cb.onchange = () => { sel.sounds[cb.checked ? 'add' : 'delete'](snd); editor.redraw(); };
    const dot = document.createElement('span');
    dot.className = 'dot'; dot.style.background = COLORS[snd];
    lbl.append(cb, dot, document.createTextNode(snd));
    checks.append(lbl);
  }
};

new ResizeObserver(() => editor.resize()).observe($('canvas-wrap'));
editor.attachScrollbar($('sb-track'));
