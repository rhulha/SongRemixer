const CHUNK = 512;

function updateMinMax(mn, mx, value) {
  if (value < mn) mn = value;
  if (value > mx) mx = value;
  return { mn, mx };
}

export function buildPeaks(samples) {
  const n = Math.ceil(samples.length / CHUNK);
  const mins = new Float32Array(n), maxs = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let mn = 0, mx = 0;
    const a = i * CHUNK, b = Math.min(a + CHUNK, samples.length);
    for (let j = a; j < b; j++) {
      const result = updateMinMax(mn, mx, samples[j]);
      mn = result.mn; mx = result.mx;
    }
    mins[i] = mn; maxs[i] = mx;
  }
  return { mins, maxs };
}

export function peaksMinMax(peaks, samples, totalSamples, s0, s1) {
  const si = Math.max(0, Math.floor(s0));
  const ei = Math.min(totalSamples - 1, Math.ceil(s1));
  if (s1 - s0 >= CHUNK / 2) {
    const ci = Math.max(0, Math.floor(si / CHUNK));
    const ce = Math.min(peaks.mins.length - 1, Math.ceil(ei / CHUNK));
    let mn = 0, mx = 0;
    for (let c = ci; c <= ce; c++) {
      const result = updateMinMax(mn, mx, peaks.mins[c]);
      mn = result.mn; mx = result.mx;
      const result2 = updateMinMax(mn, mx, peaks.maxs[c]);
      mn = result2.mn; mx = result2.mx;
    }
    return { mn, mx };
  }
  let mn = samples[si], mx = samples[si];
  for (let i = si; i <= ei; i++) {
    const result = updateMinMax(mn, mx, samples[i]);
    mn = result.mn; mx = result.mx;
  }
  return { mn, mx };
}