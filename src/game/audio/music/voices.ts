/**
 * PURE voice definitions. A `VoiceSpec` is a declarative synth patch: the runtime
 * (synth.ts, Web Audio) and the offline renderer (tools/music/render.mjs, raw
 * samples) each realize the SAME data, so what you hear in the browser is what
 * the preview WAVs contain.
 *
 * Style: dark industrial drone — detuned saws, sub bass, metallic noise, few
 * bright partials. Nothing sampled; everything is oscillators and filtered noise.
 */

export type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface OscSpec {
  type: OscType;
  /** Detune in cents — small values thicken, large values sour. */
  detune: number;
  /** Relative level within the voice. */
  gain: number;
  /** Octave offset from the note. */
  octave: number;
}

export interface AmpEnv {
  attack: number;
  decay: number;
  /** Sustain level 0..1 held for the remainder of the note. */
  sustain: number;
  release: number;
}

export interface FilterSpec {
  type: 'lowpass' | 'bandpass' | 'highpass';
  /** Base cutoff in Hz. */
  freq: number;
  q: number;
  /** Extra cutoff (Hz) at note-on, decaying to the base over `envDecay` seconds. */
  env?: number;
  envDecay?: number;
}

export interface VoiceSpec {
  /** Oscillator stack, or omitted for a pure noise voice. */
  oscs?: OscSpec[];
  /** White noise mixed in at this level (0 = none). */
  noise?: number;
  amp: AmpEnv;
  filter?: FilterSpec;
  /** Drop the pitch by `amount` semitones over `time` seconds (drums). */
  pitchDrop?: { amount: number; time: number };
  /** Expand the played degree into a stacked-thirds triad. */
  chord?: boolean;
  /** Overall level. */
  gain: number;
}

export type VoiceName =
  | 'pad'
  | 'drone'
  | 'bass'
  | 'sub'
  | 'pluck'
  | 'bell'
  | 'kick'
  | 'metal'
  | 'wash';

export const VOICES: Record<VoiceName, VoiceSpec> = {
  /** Slow detuned saw chord — the harmonic bed. */
  pad: {
    oscs: [
      { type: 'sawtooth', detune: -7, gain: 0.5, octave: 0 },
      { type: 'sawtooth', detune: 7, gain: 0.5, octave: 0 },
      { type: 'triangle', detune: 0, gain: 0.35, octave: -1 },
    ],
    amp: { attack: 0.9, decay: 0.6, sustain: 0.75, release: 1.6 },
    filter: { type: 'lowpass', freq: 620, q: 0.7 },
    chord: true,
    gain: 0.16,
  },

  /** Sour sustained drone — the deep layer's dread. Heavy detune, no chord. */
  drone: {
    oscs: [
      { type: 'sawtooth', detune: -22, gain: 0.5, octave: -1 },
      { type: 'sawtooth', detune: 19, gain: 0.5, octave: -1 },
      { type: 'square', detune: 0, gain: 0.18, octave: -2 },
    ],
    amp: { attack: 1.8, decay: 1.0, sustain: 0.85, release: 2.4 },
    filter: { type: 'lowpass', freq: 340, q: 3.2 },
    gain: 0.15,
  },

  /** Mid bass with a filter snap. */
  bass: {
    oscs: [
      { type: 'sawtooth', detune: 0, gain: 0.6, octave: -1 },
      { type: 'square', detune: -5, gain: 0.35, octave: -1 },
    ],
    amp: { attack: 0.004, decay: 0.16, sustain: 0.35, release: 0.14 },
    filter: { type: 'lowpass', freq: 220, q: 6, env: 900, envDecay: 0.13 },
    gain: 0.3,
  },

  /** Pure sub pulse — felt more than heard. */
  sub: {
    oscs: [
      { type: 'sine', detune: 0, gain: 1, octave: -2 },
      { type: 'triangle', detune: 0, gain: 0.12, octave: -1 },
    ],
    amp: { attack: 0.02, decay: 0.3, sustain: 0.25, release: 0.35 },
    filter: { type: 'lowpass', freq: 160, q: 0.5 },
    gain: 0.34,
  },

  /** Short plucked tone — the only "melodic" voice underground. */
  pluck: {
    oscs: [
      { type: 'sawtooth', detune: -4, gain: 0.5, octave: 0 },
      { type: 'triangle', detune: 4, gain: 0.4, octave: 0 },
    ],
    amp: { attack: 0.003, decay: 0.42, sustain: 0.0, release: 0.2 },
    filter: { type: 'lowpass', freq: 900, q: 2.5, env: 1800, envDecay: 0.2 },
    gain: 0.17,
  },

  /** Struck bell — title, boss lead accents, ending. */
  bell: {
    oscs: [
      { type: 'sine', detune: 0, gain: 0.6, octave: 0 },
      { type: 'sine', detune: 3, gain: 0.28, octave: 1 },
      { type: 'sine', detune: -3, gain: 0.12, octave: 2 },
    ],
    amp: { attack: 0.002, decay: 1.4, sustain: 0.0, release: 0.9 },
    filter: { type: 'lowpass', freq: 2600, q: 0.6 },
    gain: 0.14,
  },

  /** Heartbeat / boss kick — sine with a pitch drop. */
  kick: {
    oscs: [{ type: 'sine', detune: 0, gain: 1, octave: -1 }],
    amp: { attack: 0.002, decay: 0.24, sustain: 0.0, release: 0.06 },
    pitchDrop: { amount: 26, time: 0.09 },
    filter: { type: 'lowpass', freq: 400, q: 0.7 },
    gain: 0.5,
  },

  /** Metallic industrial hit — bandpassed noise, mine machinery. */
  metal: {
    noise: 1,
    amp: { attack: 0.001, decay: 0.16, sustain: 0.0, release: 0.1 },
    filter: { type: 'bandpass', freq: 2400, q: 7, env: 1400, envDecay: 0.07 },
    gain: 0.11,
  },

  /** Slow filtered noise wash — air moving through rock. */
  wash: {
    noise: 1,
    amp: { attack: 1.4, decay: 1.0, sustain: 0.6, release: 1.8 },
    filter: { type: 'bandpass', freq: 520, q: 1.4 },
    gain: 0.05,
  },
};
