/**
 * PURE music theory. No Web Audio, no DOM — shared by the runtime synth and the
 * offline WAV renderer (tools/music/render.mjs), and unit-tested directly.
 */

/** Semitone offsets from the root. Dark set: the deeper you go, the darker the mode. */
export const MODES = {
  aeolian: [0, 2, 3, 5, 7, 8, 10], // natural minor — title
  dorian: [0, 2, 3, 5, 7, 9, 10], // minor with a bright 6th — ending
  phrygian: [0, 1, 3, 5, 7, 8, 10], // flat 2nd — menace
  locrian: [0, 1, 3, 5, 6, 8, 10], // flat 5th — the deep, unstable
  minorPent: [0, 3, 5, 7, 10], // no half-steps — safe, shallow
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11], // raised 7th — boss lead
} as const;

export type ModeName = keyof typeof MODES;

/** Equal temperament. A4 (MIDI 69) = 440 Hz. */
export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/**
 * Map a scale degree to a MIDI note, wrapping into octaves.
 * degree 0 = root, 7 (in a 7-note mode) = root + 12, −1 = the note below.
 */
export function degreeToMidi(root: number, mode: readonly number[], degree: number): number {
  const n = mode.length;
  const octave = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return root + octave * 12 + mode[idx];
}

/** A triad built by stacking scale thirds (degrees d, d+2, d+4). */
export const triad = (root: number, mode: readonly number[], degree: number): number[] => [
  degreeToMidi(root, mode, degree),
  degreeToMidi(root, mode, degree + 2),
  degreeToMidi(root, mode, degree + 4),
];
