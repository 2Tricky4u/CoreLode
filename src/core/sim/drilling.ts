import { BLUEPRINTS } from '../data/blueprints';
import { TILE_PX } from '../data/constants';
import { pointsMod } from '../data/difficulty';
import { EXPEDITION } from '../data/expedition';
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
  isArtifact,
  isDrillable,
  isDrillableFractal,
  isGas,
  isLava,
  isMineral,
  isSolid,
} from '../world/tiles';
import { getTile, setTile } from '../world/world';
import { chainOnCollect } from './chain';
import { maybeSpawnCritter } from './critters';
import { applyGasPocket, applyLavaHit } from './hazards';
import { groundedAt } from './physics';
import {
  type GameState,
  type PodState,
  bayCapacity,
  bayUsed,
  digFuelMult,
  drillSpeed,
  enginePower,
  hasFractalDrill,
  heatGainMult,
  podTileX,
  podTileY,
} from './state';

const canDig = (p: PodState, t: number): boolean =>
  hasFractalDrill(p) ? isDrillableFractal(t) : isDrillable(t);

/** Collect a mineral/artifact tile's contents (points always; cargo if room). */
export function collectTile(s: GameState, p: PodState, tile: number, out: EventSink): void {
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
  out.push({ t: 'points', amount: pts, player: s.pods.indexOf(p) });

  if (ci >= 0) {
    if (bayUsed(p) < bayCapacity(p)) {
      p.bayContents[ci]++;
      s.stats.collectedTotal++;
      out.push({ t: 'collected', collectibleId: ci, player: s.pods.indexOf(p) });
      chainOnCollect(s, p, ci, out); // expedition-only inside
    } else if (p.relics.includes('scavenger')) {
      // Scavenger relic: overflow ore is vaporized for double points, not lost.
      p.points += pts;
      out.push({ t: 'points', amount: pts, player: s.pods.indexOf(p) });
    } else {
      out.push({ t: 'cargoFullLost', collectibleId: ci, player: s.pods.indexOf(p) }); // authentic: destroyed
    }
  }
}

/** Consequences of breaking a tile by drilling (called at the 15px break point). */
function breakTile(s: GameState, p: PodState, tx: number, ty: number, out: EventSink): void {
  const tile = getTile(s.world, tx, ty);
  setTile(s.world, tx, ty, Tile.Air);
  s.stats.tilesDug++;
  if (s.mode.kind === 'expedition')
    p.heat = Math.min(EXPEDITION.heat.max, p.heat + EXPEDITION.heat.perTileDug * heatGainMult(p));
  out.push({ t: 'tileCleared', x: tx, y: ty, tile, cause: 'drill', player: s.pods.indexOf(p) });
  maybeSpawnCritter(s, p, tx, ty, out); // expedition-gated inside

  // Ore Magnet relic: minerals adjacent to a drilled tile pop out and collect.
  if (p.relics.includes('oreMagnet')) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const near = getTile(s.world, tx + dx, ty + dy);
        if (!isMineral(near) && !isArtifact(near)) continue;
        setTile(s.world, tx + dx, ty + dy, Tile.Air);
        out.push({
          t: 'tileCleared',
          x: tx + dx,
          y: ty + dy,
          tile: near,
          cause: 'drill',
          player: s.pods.indexOf(p),
        });
        collectTile(s, p, near, out);
      }
    }
  }

  if (tile === Tile.Slate) {
    if (s.mode.kind === 'challenge') {
      s.stats.exitReached = true; // mazes use the slate as the exit beacon
      return;
    }
    if (s.world.slate) {
      const bp = BLUEPRINTS.find((b) => b.id === s.world.slate?.blueprint);
      if (bp && !p.blueprints.includes(bp.id)) p.blueprints.push(bp.id);
      out.push({ t: 'blueprintFound', id: s.world.slate.blueprint, player: s.pods.indexOf(p) });
      out.push({ t: 'sfx', key: 'schematic' });
      s.world.slate = null;
    }
    return;
  }
  if (isLava(tile)) {
    applyLavaHit(s, p, out);
    return;
  }
  if (isGas(tile)) {
    applyGasPocket(s, p, tx, ty, out);
    return;
  }
  collectTile(s, p, tile, out);
}

export function stepDrilling(s: GameState, p: PodState, input: IntentFrame, out: EventSink): void {
  // --- active dig job ---
  if (p.drilling) {
    const job = p.drilling;
    const speed = drillSpeed(p);
    job.traveledPx += speed;
    p.fuel = Math.max(0, p.fuel - (enginePower(p) / PHYSICS.fuelDigDivisor) * digFuelMult(p));

    // Move the pod toward the target tile center.
    const cx = (job.targetX + 0.5) * TILE_PX;
    const cy = (job.targetY + 0.5) * TILE_PX + (TILE_PX / 2 - 21); // rest on the cell floor
    const total = PHYSICS.digDonePx;
    const t = Math.min(1, job.traveledPx / total);
    p.x = job.startPxX + (cx - job.startPxX) * t;
    p.y = job.startPxY + (cy - job.startPxY) * t;

    if (!job.broken && job.traveledPx >= PHYSICS.digBreakAtPx) {
      job.broken = true;
      breakTile(s, p, job.targetX, job.targetY, out);
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

  /** A tile we're pushing into but cannot drill (boulder/barrier) — clink. */
  let refused = 0;

  if (input.down && !input.up) {
    targetY = ty + 1;
    const t = getTile(s.world, tx, targetY);
    if (canDig(p, t)) dir = 'down';
    else if (isSolid(t)) refused = t;
  } else if ((input.left || input.right) && p.mode === 'ground' && !input.up) {
    const side = input.left ? -1 : 1;
    targetX = tx + side;
    // must be pushing against the wall (standing beside it)
    const t = getTile(s.world, targetX, ty);
    if (canDig(p, t)) dir = input.left ? 'left' : 'right';
    else if (isSolid(t)) refused = t;
  }

  // Throttled so leaning on a boulder isn't a machine-gun of clinks.
  if (refused && p.mode === 'ground' && s.tick % 14 === 0) {
    out.push({ t: 'sfx', key: 'clink' });
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
      out.push({ t: 'digStart', x: targetX, y: targetY, dir, player: s.pods.indexOf(p) });
      out.push({ t: 'sfx', key: 'drillBite' });
    }
  } else {
    p.launchCount = 0;
  }
}
