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
    this._updateButtonUI('▶ Play');
    if (this.onEnd) this.onEnd();
  }

  _updateButtonUI(label) {
    if (this._btn) this._btn.textContent = label;
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
    this._updateButtonUI('■ Stop');

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
      this._updateButtonUI('▶ Play');
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