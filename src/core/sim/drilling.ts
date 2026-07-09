import { BLUEPRINTS } from '../data/blueprints';
import { TILE_PX } from '../data/constants';
import { pointsMod } from '../data/difficulty';
import { COLLECTIBLES, DIRT_POINTS, POINTS_TILE_CAP, POINTS_VALUE_MULT } from '../data/minerals';
/**
 * Drilling — original rules: hold a direction into diggable ground for >5 frames
 * to engage; down always (when the tile below is diggable), sideways only while
 * grounded, never up. During a dig the pod travels into the tile at
 * drillSpeed px/frame; the tile breaks 15 px in; the dig completes at ~40 px
 * (we complete at the tile center). Digging burns enginePower/25000 fuel/frame.
 */
import { PHYSICS } from '../data/physics';
import type { EventSink } from '../events';
import type { IntentFrame } from '../intents';
import {
  Tile,
  collectibleIndex,
  isDrillable,
  isDrillableFractal,
  isGas,
  isLava,
} from '../world/tiles';
import { getTile, setTile } from '../world/world';
import { applyGasPocket, applyLavaHit } from './hazards';
import { groundedAt } from './physics';
import {
  type GameState,
  bayCapacity,
  bayUsed,
  drillSpeed,
  enginePower,
  hasFractalDrill,
  podTileX,
  podTileY,
} from './state';

const canDig = (s: GameState, t: number): boolean =>
  hasFractalDrill(s.pod) ? isDrillableFractal(t) : isDrillable(t);

/** Collect a mineral/artifact tile's contents (points always; cargo if room). */
export function collectTile(s: GameState, tile: number, out: EventSink): void {
  const p = s.pod;
  // Points — exact original formula (dirt 25, minerals value×5, capped at Diamond).
  let pts: number;
  const ci = collectibleIndex(tile);
  if (ci >= 0) {
    const capped = COLLECTIBLES[Math.min(tile, POINTS_TILE_CAP) - 6];
    pts = pointsMod(capped.value * POINTS_VALUE_MULT, s.level);
  } else {
    pts = pointsMod(DIRT_POINTS, s.level);
  }
  p.points += pts;
  out.push({ t: 'points', amount: pts });

  if (ci >= 0) {
    if (bayUsed(p) < bayCapacity(p)) {
      p.bayContents[ci]++;
      s.stats.collectedTotal++;
      out.push({ t: 'collected', collectibleId: ci });
    } else {
      out.push({ t: 'cargoFullLost', collectibleId: ci }); // authentic: destroyed
    }
  }
}

/** Consequences of breaking a tile by drilling (called at the 15px break point). */
function breakTile(s: GameState, tx: number, ty: number, out: EventSink): void {
  const tile = getTile(s.world, tx, ty);
  setTile(s.world, tx, ty, Tile.Air);
  s.stats.tilesDug++;
  out.push({ t: 'tileCleared', x: tx, y: ty, tile, cause: 'drill' });

  if (tile === Tile.Slate) {
    if (s.mode.kind === 'challenge') {
      s.stats.exitReached = true; // mazes use the slate as the exit beacon
      return;
    }
    if (s.world.slate) {
      const bp = BLUEPRINTS.find((b) => b.id === s.world.slate?.blueprint);
      if (bp && !s.pod.blueprints.includes(bp.id)) s.pod.blueprints.push(bp.id);
      out.push({ t: 'blueprintFound', id: s.world.slate.blueprint });
      out.push({ t: 'sfx', key: 'schematic' });
      s.world.slate = null;
    }
    return;
  }
  if (isLava(tile)) {
    applyLavaHit(s, out);
    return;
  }
  if (isGas(tile)) {
    applyGasPocket(s, tx, ty, out);
    return;
  }
  collectTile(s, tile, out);
}

export function stepDrilling(s: GameState, input: IntentFrame, out: EventSink): void {
  const p = s.pod;

  // --- active dig job ---
  if (p.drilling) {
    const job = p.drilling;
    const speed = drillSpeed(p);
    job.traveledPx += speed;
    p.fuel = Math.max(0, p.fuel - enginePower(p) / PHYSICS.fuelDigDivisor);

    // Move the pod toward the target tile center.
    const cx = (job.targetX + 0.5) * TILE_PX;
    const cy = (job.targetY + 0.5) * TILE_PX + (TILE_PX / 2 - 21); // rest on the cell floor
    const total = PHYSICS.digDonePx;
    const t = Math.min(1, job.traveledPx / total);
    p.x = job.startPxX + (cx - job.startPxX) * t;
    p.y = job.startPxY + (cy - job.startPxY) * t;

    if (!job.broken && job.traveledPx >= PHYSICS.digBreakAtPx) {
      job.broken = true;
      breakTile(s, job.targetX, job.targetY, out);
    }
    if (t >= 1) {
      p.drilling = null;
      p.mode = groundedAt(s, p.x, p.y) ? 'ground' : 'air';
      p.launchCount = 0;
      p.xVel = 0;
      p.yVel = 0;
    }
    return;
  }

  // --- dig initiation (launchCount: >5 held frames, verbatim) ---
  const tx = podTileX(p);
  const ty = podTileY(p);
  let dir: 'down' | 'left' | 'right' | null = null;
  let targetX = tx;
  let targetY = ty;

  if (input.down && !input.up) {
    targetY = ty + 1;
    if (canDig(s, getTile(s.world, tx, targetY))) dir = 'down';
  } else if ((input.left || input.right) && p.mode === 'ground' && !input.up) {
    const side = input.left ? -1 : 1;
    targetX = tx + side;
    // must be pushing against the wall (standing beside it)
    if (canDig(s, getTile(s.world, targetX, ty))) dir = input.left ? 'left' : 'right';
  }

  if (dir && (p.mode === 'ground' || (dir === 'down' && groundedAt(s, p.x, p.y)))) {
    p.launchCount++;
    if (p.launchCount > PHYSICS.digStartDelayFrames) {
      p.drilling = {
        dir,
        targetX,
        targetY,
        startPxX: p.x,
        startPxY: p.y,
        traveledPx: 0,
        broken: false,
      };
      p.mode = 'dig';
      p.launchCount = 0;
      out.push({ t: 'digStart', x: targetX, y: targetY, dir });
    }
  } else {
    p.launchCount = 0;
  }
}
