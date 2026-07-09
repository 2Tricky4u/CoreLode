/** Hand-rolled 16-bit PCM WAV writer (zero deps), mirroring tools/art/png.mjs. */
import { writeFileSync } from 'node:fs';

export const SAMPLE_RATE = 44100;

/** @param samples Float32Array in [-1,1] (mono) */
export function writeWav(path, samples, sampleRate = SAMPLE_RATE) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((v * 32767) | 0, 44 + i * 2);
  }
  writeFileSync(path, buf);
}

/** Numeric health report — what I read instead of listening. */
export function analyse(samples, sampleRate = SAMPLE_RATE) {
  let peak = 0;
  let sumSq = 0;
  let sum = 0;
  let clipped = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    const a = Math.abs(v);
    if (a > peak) peak = a;
    if (a >= 0.999) clipped++;
    sumSq += v * v;
    sum += v;
  }
  const rms = Math.sqrt(sumSq / Math.max(1, samples.length));

  // Cheap spectral centroid: zero-crossing rate maps monotonically to brightness.
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i - 1] < 0 && samples[i] >= 0) || (samples[i - 1] >= 0 && samples[i] < 0)) {
      crossings++;
    }
  }
  const brightnessHz = (crossings / 2 / (samples.length / sampleRate)) | 0;

  return {
    seconds: +(samples.length / sampleRate).toFixed(2),
    peak: +peak.toFixed(4),
    rms: +rms.toFixed(4),
    dcOffset: +(sum / Math.max(1, samples.length)).toFixed(5),
    clippedSamples: clipped,
    brightnessHz,
  };
}
