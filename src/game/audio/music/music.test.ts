/** Pure tests for the score: theory, the tracker parser, and score invariants. */
import { SFX, type SfxKey } from '@core/index';
import { describe, expect, it } from 'vitest';
import {
  PIECES,
  type PieceName,
  mineLayerWeights,
  parsePattern,
  pieceSteps,
  stepDuration,
} from './patterns';
import { MODES, degreeToMidi, midiToHz, triad } from './scales';
import { VOICES } from './voices';

describe('scales', () => {
  it('A4 = 440 Hz and octaves double', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 6);
    expect(midiToHz(81)).toBeCloseTo(880, 6);
    expect(midiToHz(57)).toBeCloseTo(220, 6);
  });

  it('degreeToMidi wraps into octaves in both directions', () => {
    const a = MODES.aeolian;
    expect(degreeToMidi(60, a, 0)).toBe(60);
    expect(degreeToMidi(60, a, 2)).toBe(63); // minor third
    expect(degreeToMidi(60, a, 7)).toBe(72); // octave up
    expect(degreeToMidi(60, a, -1)).toBe(58); // the note below the root
    expect(degreeToMidi(60, a, 14)).toBe(84); // two octaves
  });

  it('triad stacks scale thirds', () => {
    expect(triad(60, MODES.aeolian, 0)).toEqual([60, 63, 67]); // C minor
    expect(triad(60, MODES.dorian, 0)).toEqual([60, 63, 67]);
  });

  it('every mode is ascending and inside one octave', () => {
    for (const [name, mode] of Object.entries(MODES)) {
      expect(mode[0], name).toBe(0);
      for (let i = 1; i < mode.length; i++) expect(mode[i], name).toBeGreaterThan(mode[i - 1]);
      expect(mode[mode.length - 1], name).toBeLessThan(12);
    }
  });
});

describe('pattern parser', () => {
  it('reads degrees, rests and holds', () => {
    expect(parsePattern('0...')).toEqual([{ step: 0, degree: 0, len: 1 }]);
    expect(parsePattern('0---')).toEqual([{ step: 0, degree: 0, len: 4 }]);
    expect(parsePattern('.a..')).toEqual([{ step: 1, degree: 10, len: 1 }]);
    expect(parsePattern('0.1-')).toEqual([
      { step: 0, degree: 0, len: 1 },
      { step: 2, degree: 1, len: 2 },
    ]);
    expect(parsePattern('....')).toEqual([]);
  });

  it('rejects malformed patterns', () => {
    expect(() => parsePattern('-0')).toThrow(); // hold with nothing to extend
    expect(() => parsePattern('0.-')).toThrow(); // hold after a gap
    expect(() => parsePattern('0z')).toThrow(); // not a hex degree
  });
});

describe('score invariants', () => {
  const names = Object.keys(PIECES) as PieceName[];

  it('has the six pieces the game asks for', () => {
    expect(names.sort()).toEqual(['boss', 'ending', 'mine', 'title']);
    expect(PIECES.mine.layers).toBe(3); // three depth beds
    expect(PIECES.boss.layers).toBe(2); // form 2 adds the lead
    expect(PIECES.title.layers).toBe(1);
    expect(PIECES.ending.layers).toBe(1);
  });

  it.each(names)('%s is well formed', (name) => {
    const p = PIECES[name];
    expect(p.bpm).toBeGreaterThan(30);
    expect(p.progression.length).toBeGreaterThan(0);
    expect(p.tracks.length).toBeGreaterThan(0);
    expect(stepDuration(p)).toBeGreaterThan(0);

    for (const track of p.tracks) {
      // one char per step, 16 steps per bar
      expect(track.steps.length, `${name}/${track.voice}`).toBe(pieceSteps(p));
      expect(track.layer).toBeGreaterThanOrEqual(0);
      expect(track.layer).toBeLessThan(p.layers);
      expect(VOICES[track.voice], `voice ${track.voice}`).toBeDefined();
      if (track.mode) expect(MODES[track.mode]).toBeDefined();
      // parses, and actually plays something
      expect(() => parsePattern(track.steps)).not.toThrow();
    }
    // every layer carries at least one track, or the cross-fade fades to silence
    for (let l = 0; l < p.layers; l++) {
      expect(
        p.tracks.some((t) => t.layer === l),
        `${name} layer ${l} is empty`,
      ).toBe(true);
    }
    // each piece must make some noise
    const notes = p.tracks.reduce((n, t) => n + parsePattern(t.steps).length, 0);
    expect(notes).toBeGreaterThan(4);
  });

  it('degrees stay inside a sane range', () => {
    for (const p of Object.values(PIECES)) {
      for (const t of p.tracks) {
        for (const n of parsePattern(t.steps)) {
          expect(n.degree).toBeGreaterThanOrEqual(0);
          expect(n.degree).toBeLessThanOrEqual(9);
        }
      }
    }
  });
});

describe('depth cross-fade', () => {
  it('is shallow-only at the surface and deep-only at the bottom', () => {
    const [a0, a1, a2] = mineLayerWeights(0);
    expect(a0).toBe(1);
    expect(a1).toBe(0);
    expect(a2).toBe(0);

    const [b0, , b2] = mineLayerWeights(-7400);
    expect(b0).toBe(0);
    expect(b2).toBeCloseTo(1, 3);
  });

  it('always overlaps — no depth is silent or single-bed-thin', () => {
    for (let ft = 0; ft >= -7400; ft -= 100) {
      const w = mineLayerWeights(ft);
      for (const v of w) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(w[0] + w[1] + w[2], `silent at ${ft} ft`).toBeGreaterThan(0.6);
    }
    // mid-depth: the shallow bed is still audible while the mid bed is up
    const [m0, m1] = mineLayerWeights(-3000);
    expect(m0).toBeGreaterThan(0.1);
    expect(m1).toBeGreaterThan(0.5);
  });

  it('descends monotonically into the deep bed', () => {
    let prev = -1;
    for (let ft = 0; ft >= -7400; ft -= 200) {
      const l2 = mineLayerWeights(ft)[2];
      expect(l2).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = l2;
    }
  });
});

describe('sfx registry', () => {
  it('every patch is a usable ZzFX parameter set', () => {
    for (const [key, params] of Object.entries(SFX)) {
      expect(Array.isArray(params), key).toBe(true);
      expect(params.length, key).toBeGreaterThanOrEqual(6);
      expect(typeof params[0], `${key} volume`).toBe('number');
      expect(params[2], `${key} frequency`).toBeGreaterThan(0);
    }
  });

  it('covers the sounds the game routes by name', () => {
    // These are played by AudioBus directly rather than pushed by the sim.
    const routed: SfxKey[] = [
      'collect',
      'collectBig',
      'cargoFull',
      'landThump',
      'hullHit',
      'gasHiss',
      'podExplode',
      'doorOpen',
      'promptBlip',
      'challengeWin',
      'challengeFail',
      'transmission',
      'sell',
      'fuelLow',
      'uiClick',
      'textBlip',
      'save',
      'drillLoop',
      'thrustLoop',
    ];
    for (const k of routed) expect(SFX[k], k).toBeDefined();
  });
});
