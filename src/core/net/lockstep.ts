/**
 * Pure lockstep bookkeeping (no browser APIs — fully unit-testable).
 *
 * HostSequencer (host side): buffers each player's `in {t}`; once every
 * non-dropped player has tick T, it emits one authoritative bundle. Ticks
 * 0..D−1 are pre-seeded EMPTY (inputs are scheduled for T+D, so nothing can
 * arrive for them). Dropped players are EMPTY-substituted from then on.
 *
 * BundleLedger (every peer): buffers bundles and releases them strictly in
 * tick order — the sim only ever executes from a bundle, so all N sims stay
 * bit-identical.
 */
import type { Command } from '../commands';
import { EMPTY_INTENTS, type IntentFrame } from '../intents';
import { fnv1a } from '../lib/math';
import { type GameState, bayUsed } from '../sim/state';
import { INPUT_DELAY_TICKS } from './messages';

export interface PlayerInput {
  frame: IntentFrame;
  cmds: Command[];
}

export interface Bundle {
  t: number;
  frames: IntentFrame[];
  cmds: Command[][];
}

export class HostSequencer {
  private buf = new Map<number, Array<PlayerInput | null>>();
  private dropped = new Set<number>();
  private nextOut = 0;

  constructor(readonly players: number) {}

  /** Store a player's input for tick t (ignores stale ticks already emitted). */
  put(player: number, t: number, frame: IntentFrame, cmds: Command[]): void {
    if (t < this.nextOut || player < 0 || player >= this.players) return;
    let row = this.buf.get(t);
    if (!row) {
      row = new Array<PlayerInput | null>(this.players).fill(null);
      this.buf.set(t, row);
    }
    row[player] = { frame, cmds };
  }

  /** Mark a player as gone — their missing inputs read EMPTY forever. */
  drop(player: number): void {
    this.dropped.add(player);
  }

  private has(row: Array<PlayerInput | null>, player: number): boolean {
    return row[player] !== null || this.dropped.has(player);
  }

  /** True when the NEXT bundle (in strict tick order) can be emitted. */
  ready(): boolean {
    const t = this.nextOut;
    if (t < INPUT_DELAY_TICKS) return true; // pre-seeded EMPTY warm-up ticks
    const row = this.buf.get(t);
    if (!row) return this.playersAllDropped();
    for (let i = 0; i < this.players; i++) if (!this.has(row, i)) return false;
    return true;
  }

  private playersAllDropped(): boolean {
    let live = 0;
    for (let i = 0; i < this.players; i++) if (!this.dropped.has(i)) live++;
    return live === 0;
  }

  /** Emit the next bundle (strict tick order); null while inputs are missing. */
  take(): Bundle | null {
    if (!this.ready()) return null;
    const t = this.nextOut;
    const row = this.buf.get(t);
    const frames: IntentFrame[] = [];
    const cmds: Command[][] = [];
    for (let i = 0; i < this.players; i++) {
      const cell = t < INPUT_DELAY_TICKS ? null : (row?.[i] ?? null);
      frames.push(cell?.frame ?? EMPTY_INTENTS);
      cmds.push(cell?.cmds ?? []);
    }
    this.buf.delete(t);
    this.nextOut = t + 1;
    return { t, frames, cmds };
  }
}

export class BundleLedger {
  private buf = new Map<number, Bundle>();
  private nextExec = 0;

  put(b: Bundle): void {
    if (b.t >= this.nextExec) this.buf.set(b.t, b);
  }

  canExec(): boolean {
    return this.buf.has(this.nextExec);
  }

  /** The next bundle in strict tick order, or null if it has not arrived. */
  take(): Bundle | null {
    const b = this.buf.get(this.nextExec);
    if (!b) return null;
    this.buf.delete(this.nextExec);
    this.nextExec++;
    return b;
  }

  get nextTick(): number {
    return this.nextExec;
  }

  /** Reset after a resync (state re-shipped at a fresh session origin). */
  reset(): void {
    this.buf.clear();
    this.nextExec = 0;
  }
}

/**
 * Desync sentinel hash: every pod's kinematics + economy, the rng cursor and
 * the world grid. ~0.1 ms for the 21,600-cell world — fine once per second.
 */
export function coopStateHash(s: GameState): number {
  const vals: number[] = [s.tick, s.rng.state, s.stats.tilesDug, s.story.maxDepthFt];
  for (const p of s.pods) {
    vals.push(
      p.x,
      p.y,
      p.xVel,
      p.yVel,
      p.hp,
      p.fuel,
      p.cash,
      p.points,
      p.heat,
      p.respawnAtTick,
      bayUsed(p),
    );
  }
  const h1 = fnv1a(vals);
  const h2 = fnv1a(s.world.tiles);
  return (h1 ^ ((h2 << 5) | (h2 >>> 27))) >>> 0;
}
