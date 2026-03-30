const CHUNK = 512;
const HIT_PX = 8;

export class SoundLibrary {
  constructor(files) {
    this._buffers = {};
    this._ready = this._load(files);
  }

  async _load(files) {
    const ac = new AudioContext();
    for (const [name, path] of Object.entries(files)) {
      const buf = await fetch(path).then(r => r.arrayBuffer());
      this._buffers[name] = await ac.decodeAudioData(buf);
    }
    ac.close();
  }

  get(name) { return this._buffers[name]; }
}

export class AudioPlayer {
  constructor(sounds, playBtn) {
    this._sounds = sounds;
    this._btn = playBtn;
    this._ctx = null;
    this._node = null;
    this._beatNodes = [];
    this.onTick = null;
    this.onEnd = null;
  }

  get playing() { return !!this._node; }

  toggle(audioBuffer, markers, viewStart, sampleRate) {
    if (this._node) { this.stop(); return; }
    this._start(audioBuffer, markers, viewStart, sampleRate);
  }

  stop() {
    if (this._node) {
      this._node.onended = null;
      try { this._node.stop(); } catch (_) {}
      this._node = null;
    }
    for (const n of this._beatNodes) { try { n.stop(); } catch (_) {} }
    this._beatNodes = [];
    if (this._btn) this._btn.textContent = '▶ Play';
    if (this.onEnd) this.onEnd();
  }

  _start(audioBuffer, markers, viewStart, sampleRate) {
    this._ctx = new AudioContext();
    this._node = this._ctx.createBufferSource();
    this._node.buffer = audioBuffer;
    this._node.connect(this._ctx.destination);

    const startSample = Math.max(0, Math.floor(viewStart));
    const offsetSec = startSample / sampleRate;
    const startTime = this._ctx.currentTime;

    this._node.start(0, offsetSec);
    if (this._btn) this._btn.textContent = '■ Stop';

    for (const m of markers) {
      const markerSec = m.sample / sampleRate;
      if (markerSec < offsetSec) continue;
      const when = startTime + (markerSec - offsetSec);
      for (const snd of m.sounds) {
        const buf = this._sounds.get(snd);
        if (!buf) continue;
        const n = this._ctx.createBufferSource();
        n.buffer = buf;
        n.connect(this._ctx.destination);
        n.start(when);
        this._beatNodes.push(n);
      }
    }

    this._node.onended = () => {
      this._node = null;
      this._beatNodes = [];
      if (this._btn) this._btn.textContent = '▶ Play';
      if (this.onEnd) this.onEnd();
    };

    const tick = () => {
      if (!this._node) return;
      const sample = startSample + (this._ctx.currentTime - startTime) * sampleRate;
      if (sample > audioBuffer.length) { this.stop(); return; }
      if (this.onTick) this.onTick(sample);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

export class WaveformEditor {
  constructor(canvas, opts = {}) {
    this._cv = canvas;
    this._cx = canvas.getContext('2d');
    this._sounds = opts.sounds || [];
    this._colors = opts.colors || {};
    this._samples = null;
    this._peaks = null;
    this._sampleRate = 44100;
    this._totalSamples = 0;
    this._vStart = 0;
    this._vEnd = 1;
    this._markers = [];
    this._sel = null;
    this._audioBuffer = null;
    this._playhead = null;
    this._drag = null;
    this.onSelect = null;
    this._bindEvents();
  }

  get loaded()      { return !!this._samples; }
  get duration()    { return this._totalSamples / this._sampleRate; }
  get sampleRate()  { return this._sampleRate; }
  get selected()    { return this._sel; }
  get markers()     { return this._markers; }
  get audioBuffer() { return this._audioBuffer; }
  get viewStart()   { return this._vStart; }
  set playhead(v)   { this._playhead = v; }

  async loadFile(file) {
    const ac = new AudioContext();
    const ab = await ac.decodeAudioData(await file.arrayBuffer());
    this._audioBuffer = ab;
    this._sampleRate = ab.sampleRate;
    const L = ab.getChannelData(0);
    if (ab.numberOfChannels > 1) {
      const R = ab.getChannelData(1);
      this._samples = new Float32Array(L.length);
      for (let i = 0; i < L.length; i++) this._samples[i] = (L[i] + R[i]) * 0.5;
    } else {
      this._samples = L.slice();
    }
    this._totalSamples = this._samples.length;
    this._vStart = 0;
    this._vEnd = this._totalSamples;
    this._peaks = _buildPeaks(this._samples);
    this._playhead = null;
    this._draw();
  }

  async loadMarkers(file) {
    this._markers = JSON.parse(await file.text()).map(d => ({ sample: d.sample, sounds: new Set(d.sounds) }));
    this._sel = null;
    if (this.onSelect) this.onSelect(null);
    this._draw();
  }

  saveMarkers(filename) {
    const data = this._markers.map(m => ({ sample: m.sample, sounds: [...m.sounds] }));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = filename;
    a.click();
  }

  deleteSelected() {
    if (!this._sel) return;
    this._markers = this._markers.filter(m => m !== this._sel);
    this._sel = null;
    if (this.onSelect) this.onSelect(null);
    this._draw();
  }

  deselect() {
    this._sel = null;
    if (this.onSelect) this.onSelect(null);
    this._draw();
  }

  resize() {
    this._cv.width = this._cv.offsetWidth;
    this._cv.height = this._cv.offsetHeight;
    this._draw();
  }

  redraw() { this._draw(); }

  _s2x(s) { return (s - this._vStart) / (this._vEnd - this._vStart) * this._cv.width; }
  _x2s(x) { return Math.round(this._vStart + (x / this._cv.width) * (this._vEnd - this._vStart)); }

  _draw() {
    const cv = this._cv, cx = this._cx;
    const W = cv.width, H = cv.height;
    cx.fillStyle = '#0d0d1a';
    cx.fillRect(0, 0, W, H);
    if (!this._samples) return;

    const mid = H / 2, amp = H / 2 - 4;
    const spp = (this._vEnd - this._vStart) / W;

    cx.beginPath();
    cx.strokeStyle = '#2d7fa8';
    cx.lineWidth = 1;
    for (let x = 0; x < W; x++) {
      const s0 = this._vStart + x * spp, s1 = s0 + spp;
      const { mn, mx } = _peaksMinMax(this._peaks, this._samples, this._totalSamples, s0, s1);
      cx.moveTo(x + .5, mid - mx * amp);
      cx.lineTo(x + .5, Math.max(mid - mx * amp + 1, mid - mn * amp));
    }
    cx.stroke();

    cx.strokeStyle = '#151525';
    cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(0, mid); cx.lineTo(W, mid); cx.stroke();

    if (this._playhead !== null) {
      const px = this._s2x(this._playhead);
      if (px >= 0 && px <= W) {
        cx.strokeStyle = '#ffffff';
        cx.lineWidth = 1.5;
        cx.setLineDash([]);
        cx.beginPath(); cx.moveTo(px, 0); cx.lineTo(px, H); cx.stroke();
      }
    }

    for (const m of this._markers) {
      const x = this._s2x(m.sample);
      if (x < -20 || x > W + 20) continue;
      const isSel = m === this._sel;
      cx.strokeStyle = isSel ? '#ffffff' : '#cccc44';
      cx.lineWidth = isSel ? 2 : 1;
      cx.setLineDash(isSel ? [] : [5, 4]);
      cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke();
      cx.setLineDash([]);
      let dy = 7;
      for (const snd of this._sounds) {
        if (m.sounds.has(snd)) {
          cx.fillStyle = this._colors[snd];
          cx.beginPath(); cx.arc(x, dy, 4, 0, 6.28); cx.fill();
          dy += 11;
        }
      }
    }
  }

  _bindEvents() {
    this._cv.addEventListener('wheel', e => {
      if (!this._samples) return;
      e.preventDefault();
      const f = e.deltaY > 0 ? 1.25 : 0.8;
      const pivot = this._x2s(e.offsetX);
      this._vStart = Math.max(0, pivot - (pivot - this._vStart) * f);
      this._vEnd   = Math.min(this._totalSamples, pivot + (this._vEnd - pivot) * f);
      if (this._vEnd - this._vStart < 10) this._vEnd = this._vStart + 10;
      this._draw();
    }, { passive: false });

    this._cv.addEventListener('mousedown', e => {
      if (e.button !== 0 || !this._samples) return;
      this._drag = { x: e.offsetX, vs: this._vStart, ve: this._vEnd, moved: false };
    });

    this._cv.addEventListener('mousemove', e => {
      if (!this._drag) return;
      if (Math.abs(e.offsetX - this._drag.x) > 4) this._drag.moved = true;
      if (!this._drag.moved) return;
      const range = this._drag.ve - this._drag.vs;
      const delta = ((e.offsetX - this._drag.x) / this._cv.width) * range;
      this._vStart = Math.max(0, this._drag.vs - delta);
      this._vEnd   = Math.min(this._totalSamples, this._drag.vs - delta + range);
      this._draw();
    });

    this._cv.addEventListener('mouseup', e => {
      if (!this._samples) { this._drag = null; return; }
      if (this._drag && !this._drag.moved) this._onClick(e.offsetX);
      this._drag = null;
    });

    this._cv.addEventListener('mouseleave', () => { this._drag = null; });
  }

  _onClick(x) {
    const hit = this._markerAt(x);
    if (hit) {
      this._sel = hit === this._sel ? null : hit;
    } else {
      const m = { sample: this._x2s(x), sounds: new Set() };
      this._markers.push(m);
      this._markers.sort((a, b) => a.sample - b.sample);
      this._sel = m;
    }
    if (this.onSelect) this.onSelect(this._sel);
    this._draw();
  }

  _markerAt(x) {
    for (const m of this._markers)
      if (Math.abs(this._s2x(m.sample) - x) <= HIT_PX) return m;
    return null;
  }
}

function _buildPeaks(samples) {
  const n = Math.ceil(samples.length / CHUNK);
  const mins = new Float32Array(n), maxs = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let mn = 0, mx = 0;
    const a = i * CHUNK, b = Math.min(a + CHUNK, samples.length);
    for (let j = a; j < b; j++) {
      if (samples[j] < mn) mn = samples[j];
      if (samples[j] > mx) mx = samples[j];
    }
    mins[i] = mn; maxs[i] = mx;
  }
  return { mins, maxs };
}

function _peaksMinMax(peaks, samples, totalSamples, s0, s1) {
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
