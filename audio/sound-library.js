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