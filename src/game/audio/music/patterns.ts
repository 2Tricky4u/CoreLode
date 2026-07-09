/**
 * PURE tracker data — the score. Text IS the music, exactly as the char grids in
 * tools/art are the sprites: 16 steps per bar, one character per step.
 *
 *   '.'          rest
 *   '-'          hold (extends the previous note by one step)
 *   0-9, a-f     scale degree (hex), 0 = root of the current mode
 *
 * A track flagged `follow` adds the bar's progression degree, so one pattern
 * moves with the chords. Chord voices (pad) expand a degree into stacked thirds.
 */
import type { ModeName } from './scales';
import type { VoiceName } from './voices';

export interface Track {
  voice: VoiceName;
  /** Layer group: cross-faded independently (depth, boss form). */
  layer: number;
  /** Step string; length must be bars × 16. */
  steps: string;
  /** Octave offset applied on top of the voice's own. */
  octave?: number;
  /** Per-track level trim. */
  gain?: number;
  /** Transpose by the bar's progression degree. */
  follow?: boolean;
  /** Override the piece's mode (e.g. a locrian drone under a pentatonic bed). */
  mode?: ModeName;
}

export interface Piece {
  bpm: number;
  /** MIDI root note. */
  root: number;
  mode: ModeName;
  bars: number;
  /** Number of layer groups (mine = 3 depth beds, boss = 2). */
  layers: number;
  /** Scale-degree offset per bar, cycled. */
  progression: number[];
  tracks: Track[];
}

export type PieceName = 'title' | 'mine' | 'boss' | 'ending';

export interface NoteEvent {
  step: number;
  degree: number;
  /** Length in steps (a note plus its holds). */
  len: number;
}

/** Turn a step string into note events. Throws on malformed patterns. */
export function parsePattern(steps: string): NoteEvent[] {
  const notes: NoteEvent[] = [];
  for (let i = 0; i < steps.length; i++) {
    const c = steps[i];
    if (c === '.') continue;
    if (c === '-') {
      const last = notes[notes.length - 1];
      if (!last || last.step + last.len !== i) {
        throw new Error(`hold '-' at step ${i} does not extend a note`);
      }
      last.len++;
      continue;
    }
    const degree = Number.parseInt(c, 16);
    if (Number.isNaN(degree)) throw new Error(`bad step character '${c}' at ${i}`);
    notes.push({ step: i, degree, len: 1 });
  }
  return notes;
}

/** Join 16-char bars into a step string (readable, and length-checked by tests). */
const bars = (...b: string[]): string => b.join('');
const rep = (bar: string, n: number): string => bar.repeat(n);

const REST = '................';

// ---------------------------------------------------------------------------
// title — slow aeolian pad, a lonely bell motif. A2 root.
// ---------------------------------------------------------------------------
const TITLE: Piece = {
  bpm: 70,
  root: 45,
  mode: 'aeolian',
  bars: 4,
  layers: 1,
  progression: [0, 0, 5, 3],
  tracks: [
    { voice: 'pad', layer: 0, follow: true, steps: rep('0---------------', 4) },
    { voice: 'sub', layer: 0, follow: true, steps: rep('0-------0-------', 4) },
    {
      voice: 'bell',
      layer: 0,
      octave: 1,
      gain: 0.9,
      steps: bars(REST, '....4-----......', '........2-----..', '0-----..........'),
    },
  ],
};

// ---------------------------------------------------------------------------
// mine — one piece, three depth beds that cross-fade. F2 root, minor pentatonic
// (no half-steps: safe up top). The deep bed drags in a locrian drone + heartbeat.
// ---------------------------------------------------------------------------
const MINE: Piece = {
  bpm: 58,
  root: 41,
  mode: 'minorPent',
  bars: 8,
  layers: 3,
  progression: [0, 0, 2, 0, 0, 3, 1, 0],
  tracks: [
    // L0 — shallow: soft pad + rare pluck. Gains are trimmed so each bed is
    // roughly equal-loudness on its own; descending must change the MOOD, not
    // the volume (verified against tools/music report.json RMS per bed).
    { voice: 'pad', layer: 0, follow: true, gain: 2.3, steps: rep('0---------------', 8) },
    {
      voice: 'pluck',
      layer: 0,
      octave: 1,
      gain: 1.5,
      steps: bars(
        REST,
        '......2.........',
        REST,
        '..........4.....',
        REST,
        '...1............',
        REST,
        '.......3........',
      ),
    },
    // L1 — mid: sub-bass pulse + filtered noise wash + machinery
    { voice: 'sub', layer: 1, follow: true, steps: rep('0-------0---0---', 8) },
    { voice: 'wash', layer: 1, steps: rep('0---------------', 8) },
    { voice: 'metal', layer: 1, gain: 0.8, steps: rep(bars(REST, '........0.......'), 4) },
    // L2 — deep: dissonant drone (tritone in the second half) + heartbeat
    {
      voice: 'drone',
      layer: 2,
      mode: 'locrian',
      steps: bars(rep('0---------------', 4), rep('4---------------', 4)),
    },
    { voice: 'kick', layer: 2, gain: 0.7, steps: rep('0..0............', 8) },
  ],
};

// ---------------------------------------------------------------------------
// boss — driving phrygian. Layer 1 (the harmonic-minor lead) arrives with form 2.
// ---------------------------------------------------------------------------
const BOSS: Piece = {
  bpm: 132,
  root: 40,
  mode: 'phrygian',
  bars: 4,
  layers: 2,
  progression: [0, 0, 1, 0],
  tracks: [
    // L0 — the engine
    {
      voice: 'kick',
      layer: 0,
      steps: bars('0...0...0...0...', '0...0...0...0...', '0...0...0...0...', '0...0...0.0.0.0.'),
    },
    {
      voice: 'bass',
      layer: 0,
      follow: true,
      steps: bars('0.0.0.0.0.0.0.0.', '0.0.0.0.1.0.1.0.', '0.0.3.0.0.0.3.0.', '0.0.0.0.4.3.1.0.'),
    },
    { voice: 'metal', layer: 0, steps: rep('....0.......0...', 4) },
    { voice: 'drone', layer: 0, gain: 0.8, steps: rep('0---------------', 4) },
    // L1 — the true form. Loud enough that form 2 is unmistakable.
    {
      voice: 'pluck',
      layer: 1,
      octave: 1,
      mode: 'harmonicMinor',
      gain: 1.9,
      steps: bars('0.2.3.4.3.2.0...', '6.5.4.3.4.5.6...', '0.2.3.4.6.4.3.2.', '1---0-----......'),
    },
    {
      voice: 'bell',
      layer: 1,
      octave: 1,
      mode: 'harmonicMinor',
      gain: 1.5,
      steps: bars('0...............', REST, '4...............', '0...............'),
    },
  ],
};

// ---------------------------------------------------------------------------
// ending — dorian, the bright 6th. It resolves.
// ---------------------------------------------------------------------------
const ENDING: Piece = {
  bpm: 64,
  root: 48,
  mode: 'dorian',
  bars: 4,
  layers: 1,
  progression: [0, 3, 4, 0],
  tracks: [
    { voice: 'pad', layer: 0, follow: true, steps: rep('0---------------', 4) },
    { voice: 'sub', layer: 0, follow: true, steps: rep('0-------0-------', 4) },
    {
      voice: 'bell',
      layer: 0,
      octave: 1,
      steps: bars('0...2...4...6...', '4...6...4...2...', '0...2...4...2...', '0-------........'),
    },
  ],
};

export const PIECES: Record<PieceName, Piece> = {
  title: TITLE,
  mine: MINE,
  boss: BOSS,
  ending: ENDING,
};

/** Total steps in one loop of a piece. */
export const pieceSteps = (p: Piece): number => p.bars * 16;
/** Seconds per 16th-note step. */
export const stepDuration = (p: Piece): number => 60 / p.bpm / 4;

/**
 * Depth → layer weights for `mine`, cosine cross-faded with overlap so no two
 * beds ever hard-cut. depthFt is negative underground.
 */
export function mineLayerWeights(depthFt: number): [number, number, number] {
  const d = -depthFt; // feet, positive downward
  const ramp = (x: number, a: number, b: number): number => {
    if (x <= a) return 0;
    if (x >= b) return 1;
    return 0.5 - 0.5 * Math.cos((Math.PI * (x - a)) / (b - a));
  };
  // Wide overlaps: a bed must still be present while the next one arrives, or
  // the middle depths sound thin (measured — L0 used to vanish by −3000 ft while
  // L1 was only at 0.85).
  const l0 = 1 - ramp(d, 1200, 4000);
  const l1 = ramp(d, 1600, 3400) * (1 - 0.35 * ramp(d, 5000, 7000));
  const l2 = ramp(d, 4200, 6800);
  return [l0, l1, l2];
}
