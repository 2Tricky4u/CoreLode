/**
 * ZzFX micro sound synth (adapted; original by Frank Force, MIT/public domain).
 * Generates all SFX at runtime from parameter arrays — no audio files shipped.
 */

let ctx: AudioContext | null = null;
let unlocked = false;

export function audioContext(): AudioContext | null {
  return ctx;
}

export function unlockAudio(): void {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  unlocked = true;
}

export function isUnlocked(): boolean {
  return unlocked && !!ctx && ctx.state === 'running';
}

// biome-ignore format: parameter list mirrors the reference implementation
export function zzfxBuildSamples(
  volume = 1, randomness = 0.05, frequency = 220, attack = 0, sustain = 0,
  release = 0.1, shape = 0, shapeCurve = 1, slide = 0, deltaSlide = 0,
  pitchJump = 0, pitchJumpTime = 0, repeatTime = 0, noise = 0, modulation = 0,
  bitCrush = 0, delay = 0, sustainVolume = 1, decay = 0, tremolo = 0,
): Float32Array {
  const sampleRate = 44100;
  const PI2 = Math.PI * 2;
  const startSlide = (slide *= (500 * PI2) / sampleRate / sampleRate);
  let startFrequency = (frequency *= ((1 + randomness * 2 * Math.random() - randomness) * PI2) / sampleRate);
  const b: number[] = [];
  let t = 0;
  let tm = 0;
  let i = 0;
  let j = 1;
  let r = 0;
  let c = 0;
  let s = 0;
  let f: number;
  let length: number;

  attack = attack * sampleRate + 9;
  decay *= sampleRate;
  sustain *= sampleRate;
  release *= sampleRate;
  delay *= sampleRate;
  deltaSlide *= (500 * PI2) / sampleRate ** 3;
  modulation *= PI2 / sampleRate;
  pitchJump *= PI2 / sampleRate;
  pitchJumpTime *= sampleRate;
  repeatTime = (repeatTime * sampleRate) | 0;

  length = (attack + decay + sustain + release + delay) | 0;
  for (; i < length; b[i++] = s) {
    if (!(++c % ((bitCrush * 100) | 0))) {
      s = shape
        ? shape > 1
          ? shape > 2
            ? shape > 3
              ? Math.sin((t % PI2) ** 3)
              : Math.max(Math.min(Math.tan(t), 1), -1)
            : 1 - (((((2 * t) / PI2) % 2) + 2) % 2)
          : 1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2)
        : Math.sin(t);
      s =
        (repeatTime ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / repeatTime) : 1) *
        Math.sign(s) *
        Math.abs(s) ** shapeCurve *
        volume *
        0.3 *
        (i < attack
          ? i / attack
          : i < attack + decay
            ? 1 - ((i - attack) / decay) * (1 - sustainVolume)
            : i < attack + decay + sustain
              ? sustainVolume
              : i < length - delay
                ? ((length - i - delay) / release) * sustainVolume
                : 0);
      s = delay
        ? s / 2 +
          (delay > i ? 0 : ((i < length - delay ? 1 : (length - i) / delay) * b[(i - delay) | 0]) / 2)
        : s;
    }
    f = (frequency += slide += deltaSlide) * Math.cos(modulation * tm++);
    t += f - f * noise * (1 - (((Math.sin(i) + 1) * 1e9) % 2));
    if (j && ++j > pitchJumpTime) {
      frequency += pitchJump;
      startFrequency += pitchJump;
      j = 0;
    }
    if (repeatTime && !(++r % repeatTime)) {
      frequency = startFrequency;
      slide = startSlide;
      j = j || 1;
    }
  }
  return new Float32Array(b);
}

const bufferCache = new Map<string, AudioBuffer>();

export function playZzfx(
  params: (number | undefined)[],
  volume = 1,
  loop = false,
): AudioBufferSourceNode | null {
  if (!ctx || ctx.state !== 'running') return null;
  const key = params.join(',');
  let buf = bufferCache.get(key);
  if (!buf) {
    const samples = zzfxBuildSamples(...(params as Parameters<typeof zzfxBuildSamples>));
    buf = ctx.createBuffer(1, samples.length, 44100);
    buf.getChannelData(0).set(samples);
    bufferCache.set(key, buf);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = loop;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(gain).connect(ctx.destination);
  src.start();
  return src;
}
