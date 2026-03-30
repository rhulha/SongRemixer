import { buildPeaks, peaksMinMax } from './waveform-peaks.js';

const HIT_PX = 8;

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
    this._selectedSet = new Set();
    this._audioBuffer = null;
    this._playhead = null;
    this._cursor = null;
    this._drag = null;
    this._sbTrack = null;
    this._sbThumb = null;
    this._sbDrag = null;
    this.onSelect = null;
    this.onCursor = null;
    this.onMarkersChange = null;
    this.onMarkerMoved = null;
    this.isMoveAllEnabled = null;
    this._bindEvents();
  }

  get loaded()      { return !!this._samples; }
  get duration()    { return this._totalSamples / this._sampleRate; }
  get sampleRate()  { return this._sampleRate; }
  get selected()    { return this._sel; }
  get selectedSet() { return this._selectedSet; }
  get markers()     { return this._markers; }
  get audioBuffer() { return this._audioBuffer; }
  get viewStart()   { return this._vStart; }
  get cursor()      { return this._cursor; }
  set playhead(v)   { this._playhead = v; }

  async loadAudioBuffer(ab) {
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
    this._peaks = buildPeaks(this._samples);
    this._playhead = null;
    this._cursor = null;
    this._draw();
  }

  async loadFile(file) {
    const ac = new AudioContext();
    const ab = await ac.decodeAudioData(await file.arrayBuffer());
    ac.close();
    await this.loadAudioBuffer(ab);
  }

  async loadMarkers(file) {
    this._markers = JSON.parse(await file.text()).map(d => ({ sample: d.sample, sounds: new Set(d.sounds) }));
    this._sel = null;
    this._selectedSet.clear();
    if (this.onSelect) this.onSelect(null);
    if (this.onMarkersChange) this.onMarkersChange();
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
    if (this._selectedSet.size === 0) return;
    this._markers = this._markers.filter(m => !this._selectedSet.has(m));
    this._setSelection(null, true);
  }

  deselect() {
    this._setSelection(null, false);
  }

  _setSelection(marker, notifyMarkersChange) {
    this._sel = marker;
    this._selectedSet.clear();
    if (marker) this._selectedSet.add(marker);
    if (this.onSelect) this.onSelect(marker);
    if (notifyMarkersChange && this.onMarkersChange) this.onMarkersChange();
    this._draw();
  }

  addMarkerAtCursor() {
    if (this._cursor === null) return;
    const m = { sample: this._cursor, sounds: new Set() };
    this._markers.push(m);
    this._markers.sort((a, b) => a.sample - b.sample);
    this._setSelection(m, true);
  }

  jumpToMarker(m) {
    const range = this._vEnd - this._vStart;
    const half = range / 2;
    let vs = m.sample - half;
    if (vs < 0) vs = 0;
    let ve = vs + range;
    if (ve > this._totalSamples) { ve = this._totalSamples; vs = ve - range; }
    this._vStart = Math.max(0, vs);
    this._vEnd = Math.min(this._totalSamples, ve);
    this._cursor = m.sample;
    this._setSelection(m, false);
  }

  resize() {
    this._cv.width = this._cv.offsetWidth;
    this._cv.height = this._cv.offsetHeight;
    this._draw();
  }

  redraw() { this._draw(); }

  attachScrollbar(track) {
    this._sbTrack = track;
    this._sbThumb = track.querySelector('div');

    track.addEventListener('mousedown', e => {
      if (e.target === this._sbThumb || !this._samples) return;
      const rect = track.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const range = this._vEnd - this._vStart;
      this._vStart = Math.max(0, Math.min(this._totalSamples - range, ratio * this._totalSamples - range / 2));
      this._vEnd = this._vStart + range;
      this._draw();
    });

    this._sbThumb.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      this._sbDrag = { x: e.clientX, vStart: this._vStart, trackW: this._sbTrack.getBoundingClientRect().width };
    });

    document.addEventListener('mousemove', e => {
      if (!this._sbDrag) return;
      const dx = e.clientX - this._sbDrag.x;
      const range = this._vEnd - this._vStart;
      const newStart = Math.max(0, Math.min(this._totalSamples - range,
        this._sbDrag.vStart + (dx / this._sbDrag.trackW) * this._totalSamples));
      this._vStart = newStart;
      this._vEnd = newStart + range;
      this._draw();
    });

    document.addEventListener('mouseup', () => { this._sbDrag = null; });
  }

  _updateScrollbar() {
    if (!this._sbThumb || !this._totalSamples) return;
    const ratio = (this._vEnd - this._vStart) / this._totalSamples;
    this._sbThumb.style.width = Math.max(0.02, ratio) * 100 + '%';
    this._sbThumb.style.left = (this._vStart / this._totalSamples) * 100 + '%';
  }

  _drawVerticalLine(sample, color, width) {
    const x = this._s2x(sample);
    if (x < 0 || x > this._cv.width) return;
    this._cx.strokeStyle = color;
    this._cx.lineWidth = width;
    this._cx.setLineDash([]);
    this._cx.beginPath();
    this._cx.moveTo(x, 0);
    this._cx.lineTo(x, this._cv.height);
    this._cx.stroke();
  }

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
      const { mn, mx } = peaksMinMax(this._peaks, this._samples, this._totalSamples, s0, s1);
      cx.moveTo(x + .5, mid - mx * amp);
      cx.lineTo(x + .5, Math.max(mid - mx * amp + 1, mid - mn * amp));
    }
    cx.stroke();

    cx.strokeStyle = '#151525';
    cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(0, mid); cx.lineTo(W, mid); cx.stroke();

    if (this._cursor !== null) {
      this._drawVerticalLine(this._cursor, '#4af', 1.5);
    }

    if (this._playhead !== null) {
      this._drawVerticalLine(this._playhead, '#ffffff', 1.5);
    }

    for (const m of this._markers) {
      const x = this._s2x(m.sample);
      if (x < -20 || x > W + 20) continue;
      const isSel = this._selectedSet.has(m);
      cx.strokeStyle = isSel ? '#ffffff' : '#cccc44';
      cx.lineWidth = isSel ? 2 : 1;
      cx.setLineDash(isSel ? [] : [5, 4]);
      cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke();
      cx.setLineDash([]);
      let dy = 7;
      for (const snd of m.sounds) {
        cx.fillStyle = this._colors[snd];
        cx.beginPath(); cx.arc(x, dy, 4, 0, 6.28); cx.fill();
        dy += 11;
      }
    }

    this._updateScrollbar();
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
      const hit = this._markerAt(e.offsetX);
      if (hit && !(e.ctrlKey || e.metaKey)) {
        const moveAll = this.isMoveAllEnabled ? !!this.isMoveAllEnabled() : false;
        const sorted = [...this._markers].sort((a, b) => a.sample - b.sample);
        const idx = sorted.indexOf(hit);
        const followers = moveAll && idx >= 0 ? sorted.slice(idx + 1) : [];
        const followerSamples = followers.map(m => m.sample);
        this._setSelection(hit, false);
        this._drag = {
          mode: 'marker',
          x: e.offsetX,
          moved: false,
          marker: hit,
          startSample: hit.sample,
          moveAll,
          followers,
          followerSamples
        };
        return;
      }
      this._drag = { mode: 'pan', x: e.offsetX, vs: this._vStart, ve: this._vEnd, moved: false };
    });

    this._cv.addEventListener('mousemove', e => {
      if (!this._drag) return;
      if (this._drag.mode === 'marker') {
        let delta = this._x2s(e.offsetX) - this._drag.startSample;
        const allStarts = [this._drag.startSample, ...this._drag.followerSamples];
        const minStart = Math.min(...allStarts);
        const maxStart = Math.max(...allStarts);
        const minDelta = -minStart;
        const maxDelta = (this._totalSamples - 1) - maxStart;
        if (delta < minDelta) delta = minDelta;
        if (delta > maxDelta) delta = maxDelta;
        if (Math.abs(e.offsetX - this._drag.x) > 1 || delta !== 0) this._drag.moved = true;

        this._drag.marker.sample = this._drag.startSample + delta;
        if (this._drag.moveAll) {
          for (let i = 0; i < this._drag.followers.length; i++) {
            this._drag.followers[i].sample = this._drag.followerSamples[i] + delta;
          }
        }

        this._markers.sort((a, b) => a.sample - b.sample);
        this._draw();
        if (this.onMarkersChange) this.onMarkersChange();
        if (this.onMarkerMoved) this.onMarkerMoved(this._drag.marker);
        return;
      }
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
      if (this._drag && this._drag.mode === 'marker') {
        this._drag = null;
        return;
      }
      if (this._drag && !this._drag.moved) this._onClick(e.offsetX, e.ctrlKey || e.metaKey);
      this._drag = null;
    });

    this._cv.addEventListener('mouseleave', () => { this._drag = null; });
  }

  _onClick(x, ctrlKey) {
    const hit = this._markerAt(x);
    if (hit) {
      if (ctrlKey) {
        if (this._selectedSet.has(hit)) {
          this._selectedSet.delete(hit);
          if (this._sel === hit) this._sel = this._selectedSet.size > 0 ? [...this._selectedSet][0] : null;
        } else {
          this._selectedSet.add(hit);
          if (!this._sel) this._sel = hit;
        }
      } else {
        this._setSelection(hit, false);
        return;
      }
      if (this.onSelect) this.onSelect(this._sel);
    } else {
      this._cursor = this._x2s(x);
      if (this.onCursor) this.onCursor(this._cursor);
      this._setSelection(null, false);
      return;
    }
    this._draw();
  }

  _markerAt(x) {
    for (const m of this._markers)
      if (Math.abs(this._s2x(m.sample) - x) <= HIT_PX) return m;
    return null;
  }
}