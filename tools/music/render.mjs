#!/usr/bin/env node
/**
 * Offline renderer: realizes the SAME VoiceSpec/patterns the browser plays, but
 * into raw samples, and writes .wav files plus a numeric report.
 *
 * This is the substitute for the art pipeline's vision loop: I cannot hear the
 * music, so I read report.json (levels, clipping, layer divergence, note counts)
 * while you listen to the WAVs.
 *
 * Run with vite-node (it resolves the TypeScript sources):
 *   npm run music:preview
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PIECES,
  mineLayerWeights,
  parsePattern,
  pieceSteps,
  stepDuration,
} from '../../src/game/audio/music/patterns.ts';
import { MODES, degreeToMidi, midiToHz, triad } from '../../src/game/audio/music/scales.ts';
import { VOICES } from '../../src/game/audio/music/voices.ts';
import { SAMPLE_RATE, analyse, writeWav } from './wav.mjs';

const OUT = process.env.MUSIC_OUT ?? join(process.cwd(), 'scratchpad-music');
const MASTER = 0.7; // default musicVol

// ---------- deterministic noise (matches synth.ts) ----------
function makeNoise(len) {
  const d = new Float32Array(len);
  let seed = 0x2f6e2b1 >>> 0;
  for (let i = 0; i < len; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    d[i] = (seed / 0x3fffffff - 1) * 0.6;
  }
  return d;
}
const NOISE = makeNoise(SAMPLE_RATE * 2);

// ---------- waveforms ----------
const wave = (type, phase) => {
  switch (type) {
    case 'sine':
      return Math.sin(phase * 2 * Math.PI);
    case 'square':
      return phase % 1 < 0.5 ? 1 : -1;
    case 'sawtooth':
      return 2 * (phase % 1) - 1;
    default: // triangle
      return 4 * Math.abs((phase % 1) - 0.5) - 1;
  }
};

/** Web-Audio-style exponential ramp between two levels. */
const expRamp = (v0, v1, t, dur) => {
  if (dur <= 0) return v1;
  const a = Math.max(1e-4, v0);
  const b = Math.max(1e-4, v1);
  return a * (b / a) ** Math.min(1, t / dur);
};

/** Amplitude envelope value at time t (seconds), for a note of length `dur`. */
function ampEnv(spec, t, dur) {
  const { attack, decay, sustain, release } = spec.amp;
  const end = Math.max(dur, attack + 0.01);
  if (t < 0) return 0;
  if (t < attack) return expRamp(1e-4, 1, t, attack);
  if (sustain <= 0) {
    if (t < attack + decay) return expRamp(1, 1e-4, t - attack, decay);
    return 0;
  }
  if (t < attack + decay) return expRamp(1, sustain, t - attack, decay);
  if (t < end) return sustain;
  if (t < end + release) return expRamp(sustain, 1e-4, t - end, release);
  return 0;
}

const noteLength = (spec, dur) => {
  const { attack, decay, sustain, release } = spec.amp;
  if (sustain <= 0) return attack + decay + release;
  return Math.max(dur, attack + 0.01) + release;
};

/** Chamberlin state-variable filter, one instance per note. */
function makeSvf(type) {
  let low = 0;
  let band = 0;
  return (input, fc, q) => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SAMPLE_RATE * 0.22)) / SAMPLE_RATE);
    const damp = 1 / Math.max(0.5, q);
    const high = input - low - damp * band;
    band += f * high;
    low += f * band;
    if (type === 'lowpass') return low;
    if (type === 'highpass') return high;
    return band;
  };
}

/** Render one note additively into `buf` starting at sample `at`. */
function renderNote(buf, at, spec, midis, dur, gain) {
  const len = Math.ceil(noteLength(spec, dur) * SAMPLE_RATE);
  const svf = spec.filter ? makeSvf(spec.filter.type) : null;
  const phases = [];
  if (spec.oscs) {
    for (const _m of midis) for (const _o of spec.oscs) phases.push(0);
  }
  const level = gain * spec.gain * MASTER;

  for (let i = 0; i < len; i++) {
    const idx = at + i;
    if (idx >= buf.length) break;
    const t = i / SAMPLE_RATE;
    let s = 0;

    if (spec.oscs) {
      let p = 0;
      for (const midi of midis) {
        for (const o of spec.oscs) {
          let hz = midiToHz(midi + o.octave * 12) * 2 ** (o.detune / 1200);
          if (spec.pitchDrop) {
            const from = midiToHz(midi + o.octave * 12 + spec.pitchDrop.amount);
            hz = t < spec.pitchDrop.time ? expRamp(from, hz, t, spec.pitchDrop.time) : hz;
          }
          phases[p] += hz / SAMPLE_RATE;
          s += wave(o.type, phases[p]) * (o.gain / midis.length);
          p++;
        }
      }
    }
    if (spec.noise) s += NOISE[(at + i) % NOISE.length] * spec.noise;

    if (svf && spec.filter) {
      let fc = spec.filter.freq;
      if (spec.filter.env) {
        const d = spec.filter.envDecay ?? 0.1;
        fc = t < d ? expRamp(spec.filter.freq + spec.filter.env, spec.filter.freq, t, d) : fc;
      }
      s = svf(s, fc, spec.filter.q);
    }

    buf[idx] += s * ampEnv(spec, t, dur) * level;
  }
}

/** Render a piece; `weights[layer]` scales each layer (solo = [1] at that index). */
function renderPiece(piece, weights, loops = 1) {
  const stepDur = stepDuration(piece);
  const total = pieceSteps(piece) * loops;
  const tail = 3;
  const buf = new Float32Array(Math.ceil((total * stepDur + tail) * SAMPLE_RATE));
  const noteCounts = {};

  for (const track of piece.tracks) {
    const w = weights[track.layer] ?? 0;
    if (w <= 0.0001) continue;
    const spec = VOICES[track.voice];
    const mode = MODES[track.mode ?? piece.mode];
    const notes = parsePattern(track.steps);
    noteCounts[`${track.voice}@L${track.layer}`] =
      (noteCounts[`${track.voice}@L${track.layer}`] ?? 0) + notes.length * loops;

    for (let loop = 0; loop < loops; loop++) {
      const base = loop * pieceSteps(piece);
      for (const n of notes) {
        const step = base + n.step;
        const bar = Math.floor(n.step / 16);
        const chordDeg = piece.progression[bar % piece.progression.length] ?? 0;
        const degree = n.degree + (track.follow ? chordDeg : 0);
        const oct = (track.octave ?? 0) * 12;
        const midis = spec.chord
          ? triad(piece.root, mode, degree).map((m) => m + oct)
          : [degreeToMidi(piece.root, mode, degree) + oct];
        renderNote(
          buf,
          Math.round(step * stepDur * SAMPLE_RATE),
          spec,
          midis,
          n.len * stepDur,
          (track.gain ?? 1) * w,
        );
      }
    }
  }
  return { buf, noteCounts };
}

// ---------- render set ----------
mkdirSync(OUT, { recursive: true });
const report = {};

const emit = (name, piece, weights, loops = 1) => {
  const { buf, noteCounts } = renderPiece(piece, weights, loops);
  writeWav(join(OUT, `${name}.wav`), buf);
  report[name] = { ...analyse(buf), weights, notes: noteCounts };
  const r = report[name];
  console.log(
    `${name.padEnd(14)} ${String(r.seconds).padStart(5)}s  peak ${r.peak.toFixed(3)}  rms ${r.rms.toFixed(4)}  clipped ${r.clippedSamples}  bright ${r.brightnessHz}Hz`,
  );
};

emit('title', PIECES.title, [1]);
emit('ending', PIECES.ending, [1]);

// mine: each bed solo, then the three depths you actually hear
emit('mine-L0-solo', PIECES.mine, [1, 0, 0]);
emit('mine-L1-solo', PIECES.mine, [0, 1, 0]);
emit('mine-L2-solo', PIECES.mine, [0, 0, 1]);
emit('mine-shallow', PIECES.mine, mineLayerWeights(-200));
emit('mine-mid', PIECES.mine, mineLayerWeights(-3000));
emit('mine-deep', PIECES.mine, mineLayerWeights(-7000));

// boss: form 1 is L0 only; form 2 adds the lead
emit('boss-form1', PIECES.boss, [1, 0], 2);
emit('boss-form2', PIECES.boss, [1, 1], 2);

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\n${Object.keys(report).length} files → ${OUT}`);
