import { WaveformEditor } from '../audio/waveform-editor.js';
import { AudioPlayer } from '../audio/audio-player.js';
import { SoundLibrary } from '../audio/sound-library.js';
import { $, ga, SOUNDS, COLORS, SOUND_FILES } from './constants.js';
import { createMarkerStorageController } from './marker-storage.js';
import { createMarkerPanelController } from './marker-panel.js';

export function initApp() {
  const sounds = new SoundLibrary(SOUND_FILES);
  const editor = new WaveformEditor($('cv'), { sounds: SOUNDS, colors: COLORS });
  const player = new AudioPlayer(sounds, $('btn-play'));

  player.onTick = s => { editor.playhead = s; editor.redraw(); };
  player.onEnd = () => { editor.playhead = null; editor.redraw(); };

  const panel = createMarkerPanelController({ $, editor, sounds: SOUNDS, colors: COLORS });
  const markerStorage = createMarkerStorageController({ $, editor });

  ga('btn-wav', 'click', () => $('in-wav').click());
  ga('btn-play', 'click', () => player.toggle(editor.audioBuffer, editor.markers, editor.cursor ?? 0, editor.sampleRate));
  ga('btn-add', 'click', () => editor.addMarkerAtCursor());
  ga('btn-del', 'click', () => editor.deleteSelected());
  ga('btn-save', 'click', markerStorage.saveMarkersOverwrite);
  ga('btn-load', 'click', markerStorage.onLoadClick);

  ga('sample-edit', 'blur', panel.applyMarkerSampleEdit);
  ga('sample-edit', 'keydown', e => { if (e.key === 'Enter') $('sample-edit').blur(); });
  ga('sample-edit', 'input', panel.onSampleEditInput);

  ga('in-wav', 'change', async e => {
    const f = e.target.files[0]; if (!f) return;
    await editor.loadFile(f);
    $('status').textContent = `${f.name}  ${editor.duration.toFixed(1)}s`;
    $('btn-play').disabled = false;
    e.target.value = '';
  });

  ga('in-json', 'change', markerStorage.onInputJsonChange);

  document.addEventListener('keydown', e => {
    if (document.activeElement === $('sample-edit')) return;
    if (e.key === ' ') { e.preventDefault(); player.toggle(editor.audioBuffer, editor.markers, editor.cursor ?? 0, editor.sampleRate); }
    if (e.key === 'Escape') editor.deselect();
    if ((e.key === 'Delete' || e.key === 'Backspace') && editor.selected) editor.deleteSelected();
  });

  editor.onCursor = sample => {
    $('panel-pos').textContent = `cursor  sample ${sample}  (${(sample / editor.sampleRate).toFixed(3)}s)`;
  };

  editor.onMarkersChange = panel.refreshMarkerList;
  editor.onSelect = panel.onSelect;
  panel.buildCheckboxes(null);

  new ResizeObserver(() => editor.resize()).observe($('canvas-wrap'));
  editor.attachScrollbar($('sb-track'));

  loadWavFromUrl(editor, 'data/sandman.wav').then(() => {
    $('status').textContent = `sandman.wav  ${editor.duration.toFixed(1)}s`;
    $('btn-play').disabled = false;
  }).catch(() => {});
}

async function loadWavFromUrl(editor, url) {
  const ac = new AudioContext();
  const ab = await ac.decodeAudioData(await fetch(url).then(r => r.arrayBuffer()));
  await ac.close();
  await editor.loadAudioBuffer(ab);
}

initApp();