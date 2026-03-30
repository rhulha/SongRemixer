import numpy as np
import scipy.io.wavfile as wav
import os

DATA_DIR = 'data'


def read_wav(filename):
    _, data = wav.read(os.path.join(DATA_DIR, filename))
    if data.ndim == 1:
        data = np.column_stack([data, data])
    return data.astype(np.int32)


def mix(track, sample, byte_offset, volume=0.6):
    # Java offsets are in int16 units (AudioTimes.eineSekunde = 44100*2 = 88200)
    # 2 int16 values per stereo frame → divide by 2
    frame_offset = byte_offset // 2
    n = min(len(sample), len(track) - frame_offset)
    if n <= 0:
        return
    track[frame_offset:frame_offset + n] += (sample[:n] * volume).astype(np.int32)


def mix_bass(track, bass, byte_offset):
    mix(track, bass, byte_offset)


def add_beat_loop(track, hit, bass, snear, start_byte, end_byte):
    duration = end_byte - start_byte
    tick = duration // 16

    mix(track, hit,  start_byte + tick * 0)
    mix(track, bass, start_byte + tick * 0)
    mix(track, hit,  start_byte + tick * 2)
    mix(track, hit,  start_byte + tick * 4)
    mix(track, snear,start_byte + tick * 4)
    mix(track, hit,  start_byte + tick * 6)
    mix(track, bass, start_byte + tick * 7)
    mix(track, hit,  start_byte + tick * 8)
    mix(track, bass, start_byte + tick * 9)
    mix(track, hit,  start_byte + tick * 10)
    mix(track, bass, start_byte + tick * 10)
    mix(track, hit,  start_byte + tick * 12)
    mix(track, snear,start_byte + tick * 12)
    mix(track, hit,  start_byte + tick * 14)


def main():
    sandman = read_wav('sandman.wav')
    bass    = read_wav('bass.wav')
    hit     = read_wav('hit.wav')
    snear   = read_wav('snear.wav')

    track = np.zeros_like(sandman, dtype=np.int32)

    # Beat start positions in bytes (Java: sample_index * 2 for stereo)
    beat1 = (460_800 + 430) * 2
    beat2 = (562_760 + 430) * 2
    beat3 = (663_445 + 430) * 2
    beat4 = (762_339 + 430) * 2
    beat5 = (860_416 + 430) * 2
    beat6 = (958_120 + 430) * 2
    beat7 = 1_055_881 * 2
    beat8 = 1_152_152 * 2

    increment = 98077 * 2

    add_beat_loop(track, hit, bass, snear, beat1, beat2)
    add_beat_loop(track, hit, bass, snear, beat2, beat3)
    add_beat_loop(track, hit, bass, snear, beat3, beat4)
    add_beat_loop(track, hit, bass, snear, beat4, beat5)
    add_beat_loop(track, hit, bass, snear, beat5, beat6)
    add_beat_loop(track, hit, bass, snear, beat6, beat7)
    add_beat_loop(track, hit, bass, snear, beat7, beat8)
    add_beat_loop(track, hit, bass, snear, beat8, beat8 + increment)

    mix_bass(track, bass, 1_249_229 * 2)

    t = 1_448_848 * 2; add_beat_loop(track, hit, bass, snear, t, t + increment)
    t = 1_545_606 * 2; add_beat_loop(track, hit, bass, snear, t, t + increment)
    t = 1_642_622 * 2; add_beat_loop(track, hit, bass, snear, t, t + increment)
    t = 1_740_513 * 2; add_beat_loop(track, hit, bass, snear, t, t + increment)
    t = 1_837_200 * 2; add_beat_loop(track, hit, bass, snear, t, t + increment)
    t = 1_932_624 * 2; add_beat_loop(track, hit, bass, snear, t, t + increment)

    mix_bass(track, bass, 2_028_852 * 2)
    mix_bass(track, bass, 2_053_106 * 2)
    mix_bass(track, bass, 2_077_374 * 2)
    mix_bass(track, bass, 2_101_184 * 2)

    t = 2_124_320 * 2; add_beat_loop(track, hit, bass, snear, t, t + increment)
    t = 2_221_709 * 2; add_beat_loop(track, hit, bass, snear, t, t + increment)
    t = 2_318_854 * 2; add_beat_loop(track, hit, bass, snear, t, t + increment)
    add_beat_loop(track, hit, bass, snear, t, t + increment)

    track = np.clip(track, -32768, 32767).astype(np.int16)

    out_path = os.path.join(DATA_DIR, 'SandmanBeats.wav')
    wav.write(out_path, 44100, track)
    print(f"Saved: {out_path}")


if __name__ == '__main__':
    main()
