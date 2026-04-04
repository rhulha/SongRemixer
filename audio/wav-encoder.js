export class WavEncoder {
  static encode(audioBuffer, sounds, markers) {
    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    const channels = [];
    for (let c = 0; c < numChannels; c++) {
      const data = audioBuffer.getChannelData(c).slice();
      for (let i = 0; i < data.length; i++) {
        data[i] *= 0.65;
      }
      channels.push(data);
    }

    for (const marker of markers) {
      for (const soundName of marker.sounds) {
        const soundBuf = sounds.get(soundName);
        if (!soundBuf) continue;

        const soundChannels = [];
        for (let c = 0; c < soundBuf.numberOfChannels; c++) {
          soundChannels.push(soundBuf.getChannelData(c));
        }

        for (let s = 0; s < soundBuf.length && marker.sample + s < length; s++) {
          for (let c = 0; c < numChannels; c++) {
            const soundChan = soundChannels[Math.min(c, soundBuf.numberOfChannels - 1)];
            channels[c][marker.sample + s] += soundChan[s] * 0.3;
          }
        }
      }
    }

    return this._encodeWav(channels, sampleRate);
  }

  static _encodeWav(channels, sampleRate) {
    const numChannels = channels.length;
    const length = channels[0].length;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const data = new Float32Array(channels.length * length);

    for (let s = 0; s < length; s++) {
      for (let c = 0; c < numChannels; c++) {
        data[s * numChannels + c] = channels[c][s];
      }
    }

    this._writeWavHeader(view, sampleRate, numChannels, length, byteRate, blockAlign);
    this._writePcm16(view, data, 44);

    return buffer;
  }

  static _writeWavHeader(view, sampleRate, numChannels, numSamples, byteRate, blockAlign) {
    const dataSize = numSamples * blockAlign;

    view.setUint8(0, 'R'.charCodeAt(0));
    view.setUint8(1, 'I'.charCodeAt(0));
    view.setUint8(2, 'F'.charCodeAt(0));
    view.setUint8(3, 'F'.charCodeAt(0));
    view.setUint32(4, 36 + dataSize, true);
    view.setUint8(8, 'W'.charCodeAt(0));
    view.setUint8(9, 'A'.charCodeAt(0));
    view.setUint8(10, 'V'.charCodeAt(0));
    view.setUint8(11, 'E'.charCodeAt(0));
    view.setUint8(12, 'f'.charCodeAt(0));
    view.setUint8(13, 'm'.charCodeAt(0));
    view.setUint8(14, 't'.charCodeAt(0));
    view.setUint8(15, ' '.charCodeAt(0));
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    view.setUint8(36, 'd'.charCodeAt(0));
    view.setUint8(37, 'a'.charCodeAt(0));
    view.setUint8(38, 't'.charCodeAt(0));
    view.setUint8(39, 'a'.charCodeAt(0));
    view.setUint32(40, dataSize, true);
  }

  static _writePcm16(view, data, offset) {
    let pos = offset;
    for (let i = 0; i < data.length; i++) {
      const s = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      pos += 2;
    }
  }
}
