import { describe, expect, it } from 'vitest';
import { BARRIER_ROW, ENTRANCE_COLS, SURFACE_ROW, WORLD_H, WORLD_W } from '../data/constants';
import { Rng } from '../lib/rng';
import { Tile, isBoulder, isGas, isLava } from './tiles';
import { createWorld, earthquake, getTile } from './world';
import { generateWorld, idx } from './worldgen';

describe('generateWorld', () => {
  it('is deterministic for a given seed', () => {
    const a = generateWorld(1234, true);
    const b = generateWorld(1234, true);
    expect(Buffer.from(a.tiles.buffer).equals(Buffer.from(b.tiles.buffer))).toBe(true);
    expect(a.slate).toEqual(b.slate);
  });

  it('differs across seeds', () => {
    const a = generateWorld(1, false);
    const b = generateWorld(2, false);
    expect(Buffer.from(a.tiles.buffer).equals(Buffer.from(b.tiles.buffer))).toBe(false);
  });

  it('has sky rows, a turf surface, and the 2-tile arena entrance', () => {
    const w = generateWorld(42, false);
    for (let x = 0; x < WORLD_W; x++) {
      for (let y = 0; y < SURFACE_ROW; y++) expect(w.tiles[idx(x, y)]).toBe(Tile.Air);
      const t = w.tiles[idx(x, SURFACE_ROW)];
      expect([Tile.TurfA, Tile.TurfB]).toContain(t);
    }
    for (const x of ENTRANCE_COLS) expect(w.tiles[idx(x, BARRIER_ROW)]).toBe(Tile.Air);
    // barrier band solid elsewhere (interior columns)
    for (let x = 2; x < WORLD_W - 2; x++) {
      if ((ENTRANCE_COLS as readonly number[]).includes(x)) continue;
      expect([Tile.BarrierA, Tile.BarrierB]).toContain(w.tiles[idx(x, BARRIER_ROW)]);
    }
  });

  it('respects hazard depth gates (boulders/lava/gas never above their thresholds)', () => {
    const w = generateWorld(7, false);
    const boulderMin = Math.ceil(WORLD_H / 4.5);
    const lavaMin = Math.ceil(WORLD_H / 2.25);
    const gasMin = Math.ceil((2 * WORLD_H) / 3);
    for (let y = SURFACE_ROW + 1; y < BARRIER_ROW; y++) {
      for (let x = 2; x < WORLD_W - 2; x++) {
        const t = w.tiles[idx(x, y)];
        if (isBoulder(t)) expect(y, `boulder at row ${y}`).toBeGreaterThan(boulderMin - 1);
        if (isLava(t)) expect(y, `lava at row ${y}`).toBeGreaterThan(lavaMin - 1);
        if (isGas(t)) expect(y, `gas at row ${y}`).toBeGreaterThan(gasMin - 1);
      }
    }
  });

  it('never spawns minerals above their formula-minimum rows', () => {
    // Tile 15 (Amazonite) needs base 8 + random(int(y/65)+2) ≥ 7 → int(y/65) ≥ 5 → y ≥ 325.
    const w = generateWorld(99, false);
    for (let y = SURFACE_ROW + 1; y < 325; y++) {
      for (let x = 2; x < WORLD_W - 2; x++) {
        expect(w.tiles[idx(x, y)]).not.toBe(Tile.MineralLast);
      }
    }
    // Artifacts only below row 80.
    for (let y = SURFACE_ROW + 1; y <= 80; y++) {
      for (let x = 2; x < WORLD_W - 2; x++) {
        const t = w.tiles[idx(x, y)];
        expect(t < Tile.ArtifactFirst || t > Tile.ArtifactLast).toBe(true);
      }
    }
  });

  it('produces roughly ⅓ air caverns underground (statistical)', () => {
    let air = 0;
    let total = 0;
    for (let seed = 0; seed < 5; seed++) {
      const w = generateWorld(seed, false);
      for (let y = SURFACE_ROW + 1; y < BARRIER_ROW - 1; y++) {
        for (let x = 2; x < WORLD_W - 2; x++) {
          total++;
          if (w.tiles[idx(x, y)] === Tile.Air) air++;
        }
      }
    }
    const frac = air / total;
    expect(frac).toBeGreaterThan(0.28);
    expect(frac).toBeLessThan(0.4);
  });

  it('buries exactly one relic schematic in goldium mode, none otherwise', () => {
    const g = generateWorld(5, true);
    expect(g.slate).not.toBeNull();
    let count = 0;
    for (let i = 0; i < g.tiles.length; i++) if (g.tiles[i] === Tile.Slate) count++;
    expect(count).toBe(1);
    const plain = generateWorld(5, false);
    expect(plain.slate).toBeNull();
  });
});

describe('earthquake', () => {
  it('shifts eligible rows by one with wraparound, walls intact', () => {
    const w = createWorld(11, false);
    const before = Array.from({ length: WORLD_W }, (_, x) => getTile(w, x, 100));
    const rng = new Rng(1);
    const rows = earthquake(w, rng, 4); // intensity 4 → every eligible row shifts
    expect(rows.length).toBeGreaterThan(WORLD_H / 2);
    const after = Array.from({ length: WORLD_W }, (_, x) => getTile(w, x, 100));
    // walls unchanged
    expect(after[0]).toBe(before[0]);
    expect(after[WORLD_W - 1]).toBe(before[WORLD_W - 1]);
    // interior is a rotation of the previous interior
    const rotL = [...before.slice(3, WORLD_W - 2), before[2]];
    const rotR = [before[WORLD_W - 3], ...before.slice(2, WORLD_W - 3)];
    const interior = after.slice(2, WORLD_W - 2);
    expect([JSON.stringify(rotL), JSON.stringify(rotR)]).toContain(JSON.stringify(interior));
  });
});
