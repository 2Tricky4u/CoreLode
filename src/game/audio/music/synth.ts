/**
 * Web Audio realization of a VoiceSpec. The offline renderer
 * (tools/music/render.mjs) implements the same maths on raw samples, so the
 * preview WAVs match what the browser plays.
 */
import { midiToHz } from './scales';
import type { VoiceSpec } from './voices';

let noiseBuffer: AudioBuffer | null = null;

function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  // Deterministic white noise (matches the offline renderer's LCG).
  let seed = 0x2f6e2b1 >>> 0;
  for (let i = 0; i < len; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    d[i] = (seed / 0x3fffffff - 1) * 0.6;
  }
  noiseBuffer = buf;
  return buf;
}

/** Total tail of a note so callers can size their scheduling. */
export const voiceTail = (spec: VoiceSpec): number => spec.amp.release;

/**
 * Schedule one note. `midis` holds one note, or the triad for a chord voice.
 * Returns nothing; nodes self-clean on stop.
 */
export function playVoice(
  ctx: AudioContext,
  dest: AudioNode,
  spec: VoiceSpec,
  midis: number[],
  time: number,
  dur: number,
  gain: number,
): void {
  const { attack, decay, sustain, release } = spec.amp;
  const end = time + Math.max(dur, attack + 0.01);

  const vca = ctx.createGain();
  vca.gain.setValueAtTime(0.0001, time);
  vca.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * spec.gain), time + attack);
  const susLevel = Math.max(0.0001, gain * spec.gain * sustain);
  if (sustain > 0) {
    vca.gain.exponentialRampToValueAtTime(susLevel, time + attack + decay);
    vca.gain.setValueAtTime(susLevel, end);
  } else {
    // Percussive: decay straight to silence, ignore the note length.
    vca.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  }
  vca.gain.exponentialRampToValueAtTime(0.0001, end + release);

  let node: AudioNode = vca;
  if (spec.filter) {
    const f = ctx.createBiquadFilter();
    f.type = spec.filter.type;
    f.Q.value = spec.filter.q;
    const base = spec.filter.freq;
    if (spec.filter.env) {
      f.frequency.setValueAtTime(Math.min(18000, base + spec.filter.env), time);
      f.frequency.exponentialRampToValueAtTime(
        Math.max(40, base),
        time + (spec.filter.envDecay ?? 0.1),
      );
    } else {
      f.frequency.setValueAtTime(base, time);
    }
    vca.connect(f);
    node = f;
  }
  node.connect(dest);

  const stopAt = end + release + 0.02;
  const sources: Array<OscillatorNode | AudioBufferSourceNode> = [];

  if (spec.oscs) {
    for (const midi of midis) {
      for (const o of spec.oscs) {
        const osc = ctx.createOscillator();
        osc.type = o.type;
        const hz = midiToHz(midi + o.octave * 12);
        osc.frequency.setValueAtTime(hz, time);
        if (spec.pitchDrop) {
          const from = midiToHz(midi + o.octave * 12 + spec.pitchDrop.amount);
          osc.frequency.setValueAtTime(from, time);
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, hz), time + spec.pitchDrop.time);
        }
        osc.detune.setValueAtTime(o.detune, time);
        const og = ctx.createGain();
        og.gain.value = o.gain / midis.length;
        osc.connect(og).connect(vca);
        sources.push(osc);
      }
    }
  }
  if (spec.noise) {
    const src = ctx.createBufferSource();
    src.buffer = getNoise(ctx);
    src.loop = true;
    const ng = ctx.createGain();
    ng.gain.value = spec.noise;
    src.connect(ng).connect(vca);
    sources.push(src);
  }

  for (const s of sources) {
    s.start(time);
    s.stop(stopAt);
    s.onended = () => s.disconnect();
  }
  // Free the chain once the tail has rung out.
  setTimeout(
    () => {
      try {
        vca.disconnect();
        if (node !== vca) node.disconnect();
      } catch {
        /* already gone */
      }
    },
    Math.max(0, (stopAt - ctx.currentTime) * 1000) + 120,
  );
}
