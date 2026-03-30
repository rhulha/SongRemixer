const $ = id => document.getElementById(id);
const ga = (el, n, cb) => $(el).addEventListener(n, cb);

const SOUNDS = ['bass', 'hit', 'snare', 'hat'];
const COLORS = { bass: '#e05555', hit: '#4fc3f7', snare: '#f0a030', hat: '#50c878' };
const CHUNK = 512;       // peak precompute resolution in samples
const HIT_PX = 8;        // pixel radius to hit a marker

let samples = null, totalSamples = 0, sampleRate = 44100;
let peaks = null;        // { mins, maxs } Float32Array per CHUNK
let markers = [];        // [{ sample: int, sounds: Set<string> }]
let sel = null;          // selected marker

let vStart = 0, vEnd = 1;

const cv = $('cv');
const cx = cv.getContext('2d');

// ---- WAV loading ----

ga('btn-wav', 'click', () => $('in-wav').click());

ga('in-wav', 'change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  $('status').textContent = 'loading…';
  const ac = new AudioContext();
  const ab = await ac.decodeAudioData(await f.arrayBuffer());
  sampleRate = ab.sampleRate;
  const L = ab.getChannelData(0);
  if (ab.numberOfChannels > 1) {
    const R = ab.getChannelData(1);
    samples = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) samples[i] = (L[i] + R[i]) * 0.5;
  } else {
    samples = L.slice();
  }
  totalSamples = samples.length;
  vStart = 0;
  vEnd = totalSamples;
  peaks = buildPeaks(samples);
  $('status').textContent = `${f.name}  ${(totalSamples / sampleRate).toFixed(1)}s`;
  updatePanel();
  draw();
  e.target.value = '';
});

function buildPeaks(s) {
  const n = Math.ceil(s.length / CHUNK);
  const mins = new Float32Array(n), maxs = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let mn = 0, mx = 0;
    const a = i * CHUNK, b = Math.min(a + CHUNK, s.length);
    for (let j = a; j < b; j++) {
      if (s[j] < mn) mn = s[j];
      if (s[j] > mx) mx = s[j];
    }
    mins[i] = mn;
    maxs[i] = mx;
  }
  return { mins, maxs };
}

// ---- Draw ----

function resize() {
  cv.width = cv.offsetWidth;
  cv.height = cv.offsetHeight;
  draw();
}

function draw() {
  const W = cv.width, H = cv.height;
  cx.fillStyle = '#0d0d1a';
  cx.fillRect(0, 0, W, H);
  if (!samples) return;

  const mid = H / 2, amp = H / 2 - 4;
  const spp = (vEnd - vStart) / W;

  cx.beginPath();
  cx.strokeStyle = '#2d7fa8';
  cx.lineWidth = 1;
  for (let x = 0; x < W; x++) {
    const s0 = vStart + x * spp, s1 = s0 + spp;
    const { mn, mx } = minMax(s0, s1);
    cx.moveTo(x + .5, mid - mx * amp);
    cx.lineTo(x + .5, Math.max(mid - mx * amp + 1, mid - mn * amp));
  }
  cx.stroke();

  cx.strokeStyle = '#151525';
  cx.lineWidth = 1;
  cx.beginPath(); cx.moveTo(0, mid); cx.lineTo(W, mid); cx.stroke();

  for (const m of markers) {
    const x = s2x(m.sample);
    if (x < -20 || x > W + 20) continue;
    const isSel = m === sel;
    cx.strokeStyle = isSel ? '#ffffff' : '#cccc44';
    cx.lineWidth = isSel ? 2 : 1;
    cx.setLineDash(isSel ? [] : [5, 4]);
    cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke();
    cx.setLineDash([]);
    let dy = 7;
    for (const snd of SOUNDS) {
      if (m.sounds.has(snd)) {
        cx.fillStyle = COLORS[snd];
        cx.beginPath(); cx.arc(x, dy, 4, 0, 6.28); cx.fill();
        dy += 11;
      }
    }
  }
}

function minMax(s0, s1) {
  const si = Math.max(0, Math.floor(s0));
  const ei = Math.min(totalSamples - 1, Math.ceil(s1));
  if (s1 - s0 >= CHUNK / 2) {
    const ci = Math.max(0, Math.floor(si / CHUNK));
    const ce = Math.min(peaks.mins.length - 1, Math.ceil(ei / CHUNK));
    let mn = 0, mx = 0;
    for (let c = ci; c <= ce; c++) {
      if (peaks.mins[c] < mn) mn = peaks.mins[c];
      if (peaks.maxs[c] > mx) mx = peaks.maxs[c];
    }
    return { mn, mx };
  }
  let mn = 0, mx = 0;
  for (let i = si; i <= ei; i++) {
    if (samples[i] < mn) mn = samples[i];
    if (samples[i] > mx) mx = samples[i];
  }
  return { mn, mx };
}

const s2x = s => (s - vStart) / (vEnd - vStart) * cv.width;
const x2s = x => Math.round(vStart + (x / cv.width) * (vEnd - vStart));

// ---- Zoom / Pan ----

cv.addEventListener('wheel', e => {
  if (!samples) return;
  e.preventDefault();
  const f = e.deltaY > 0 ? 1.25 : 0.8;
  const pivot = x2s(e.offsetX);
  vStart = Math.max(0, pivot - (pivot - vStart) * f);
  vEnd   = Math.min(totalSamples, pivot + (vEnd - pivot) * f);
  if (vEnd - vStart < 10) vEnd = vStart + 10;
  draw();
}, { passive: false });

let drag = null;

cv.addEventListener('mousedown', e => {
  if (e.button !== 0 || !samples) return;
  drag = { x: e.offsetX, vs: vStart, ve: vEnd, moved: false };
});

cv.addEventListener('mousemove', e => {
  if (!drag) return;
  if (Math.abs(e.offsetX - drag.x) > 4) drag.moved = true;
  if (!drag.moved) return;
  const range = drag.ve - drag.vs;
  const delta = ((e.offsetX - drag.x) / cv.width) * range;
  vStart = Math.max(0, drag.vs - delta);
  vEnd   = Math.min(totalSamples, drag.vs - delta + range);
  draw();
});

cv.addEventListener('mouseup', e => {
  if (!samples) { drag = null; return; }
  if (drag && !drag.moved) onClick(e.offsetX);
  drag = null;
});

cv.addEventListener('mouseleave', () => { drag = null; });

// ---- Marker interaction ----

function onClick(x) {
  const hit = markerAt(x);
  if (hit) {
    sel = hit === sel ? null : hit;
  } else {
    const m = { sample: x2s(x), sounds: new Set() };
    markers.push(m);
    markers.sort((a, b) => a.sample - b.sample);
    sel = m;
  }
  updatePanel();
  draw();
}

function markerAt(x) {
  for (const m of markers) {
    if (Math.abs(s2x(m.sample) - x) <= HIT_PX) return m;
  }
  return null;
}

// ---- Panel ----

function updatePanel() {
  const checks = $('sound-checks');
  const btnDel = $('btn-del');
  checks.innerHTML = '';
  if (!sel) {
    $('panel-pos').textContent = samples ? 'click waveform to place a marker' : 'load a wav to begin';
    btnDel.style.display = 'none';
    return;
  }
  $('panel-pos').textContent = `sample ${sel.sample}  (${(sel.sample / sampleRate).toFixed(3)}s)`;
  btnDel.style.display = 'inline-block';
  for (const snd of SOUNDS) {
    const lbl = document.createElement('label');
    lbl.className = 'sc';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = sel.sounds.has(snd);
    cb.addEventListener('change', () => {
      if (cb.checked) sel.sounds.add(snd); else sel.sounds.delete(snd);
      draw();
    });
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = COLORS[snd];
    lbl.append(cb, dot, document.createTextNode(snd));
    checks.append(lbl);
  }
}

ga('btn-del', 'click', () => {
  if (!sel) return;
  markers = markers.filter(m => m !== sel);
  sel = null;
  updatePanel();
  draw();
});

// ---- Save / Load ----

ga('btn-save', 'click', () => {
  const data = markers.map(m => ({ sample: m.sample, sounds: [...m.sounds] }));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = 'sandman_markers.json';
  a.click();
});

ga('btn-load', 'click', () => $('in-json').click());

ga('in-json', 'change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  markers = JSON.parse(await f.text()).map(d => ({ sample: d.sample, sounds: new Set(d.sounds) }));
  sel = null;
  updatePanel();
  draw();
  e.target.value = '';
});

// ---- Keyboard ----

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    sel = null; updatePanel(); draw();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
    markers = markers.filter(m => m !== sel);
    sel = null; updatePanel(); draw();
  }
});

// ---- Init ----

new ResizeObserver(resize).observe($('canvas-wrap'));
