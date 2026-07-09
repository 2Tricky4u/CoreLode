import { TILE_PX } from '../data/constants';
/**
 * Placed charges (dynamite 3×3, plastique 5×5). Blasts clear blastable tiles —
 * minerals are destroyed, not collected (authentic). Gas tiles caught in a blast
 * ignite (the pod takes gas damage if within blast+1 tiles). Explosives are
 * the ONLY thing that damages the boss: 240/120 centered, 60 off-center.
 */
import { ITEM_EFFECTS } from '../data/items';
import type { EventSink } from '../events';
import { Tile, isBlastable, isGas } from '../world/tiles';
import { getTile, setTile } from '../world/world';
import { applyGasPocket } from './hazards';
import type { GameState } from './state';

export function stepCharges(s: GameState, out: EventSink): void {
  if (s.charges.length === 0) return;
  const remaining: typeof s.charges = [];
  for (const c of s.charges) {
    c.fuse--;
    if (c.fuse > 0) {
      // Audible countdown — a lit charge you can hear ticking under you.
      if (c.fuse % 10 === 0) out.push({ t: 'sfx', key: 'fuseTick' });
      remaining.push(c);
      continue;
    }
    detonate(
      s,
      c.x,
      c.y,
      c.item === 'plastique' ? ITEM_EFFECTS.plastiqueRadiusTiles : ITEM_EFFECTS.dynamiteRadiusTiles,
      c.item,
      out,
    );
  }
  s.charges = remaining;
}

function detonate(
  s: GameState,
  px: number,
  py: number,
  radiusTiles: number,
  item: 'dynamite' | 'plastique',
  out: EventSink,
): void {
  const cx = Math.floor(px / TILE_PX);
  const cy = Math.floor(py / TILE_PX);
  out.push({ t: 'explosion', x: px, y: py, radiusTiles, item });
  out.push({ t: 'sfx', key: item === 'plastique' ? 'explosionLarge' : 'explosionSmall' });

  for (let ty = cy - radiusTiles; ty <= cy + radiusTiles; ty++) {
    for (let tx = cx - radiusTiles; tx <= cx + radiusTiles; tx++) {
      const tile = getTile(s.world, tx, ty);
      if (tile === Tile.Air || !isBlastable(tile)) continue;
      if (tile === Tile.Slate) continue; // never destroy the relic schematic
      setTile(s.world, tx, ty, Tile.Air);
      if (tile >= Tile.BoulderFirst && tile <= Tile.BoulderLast) s.stats.stonesDestroyed++;
      out.push({ t: 'tileCleared', x: tx, y: ty, tile, cause: 'blast' });
      if (isGas(tile)) {
        // Igniting a pocket hurts if the pod is near the blast zone.
        const podTx = Math.floor(s.pod.x / TILE_PX);
        const podTy = Math.floor(s.pod.y / TILE_PX);
        if (Math.abs(podTx - tx) <= radiusTiles + 1 && Math.abs(podTy - ty) <= radiusTiles + 1) {
          applyGasPocket(s, tx, ty, out);
        } else {
          out.push({ t: 'gasIgnite', x: tx, y: ty });
        }
      }
    }
  }

  // Boss damage — center hit vs off-center (authentic values).
  const b = s.boss;
  if (b && b.phase !== 'dead' && b.phase !== 'transition') {
    const distTiles = Math.hypot(b.x - px, b.y - py) / TILE_PX;
    const centerRange = ITEM_EFFECTS.bossCenterRangeTiles + radiusTiles - 1;
    let dmg = 0;
    if (distTiles <= centerRange) {
      dmg =
        item === 'plastique'
          ? ITEM_EFFECTS.bossDamage.plastiqueCenter
          : ITEM_EFFECTS.bossDamage.dynamiteCenter;
    } else if (distTiles <= centerRange + 3) {
      dmg = ITEM_EFFECTS.bossDamage.offCenter;
    }
    if (dmg > 0) {
      b.hp -= dmg;
      out.push({ t: 'bossDamaged', amount: dmg, hp: Math.max(0, b.hp) });
      out.push({ t: 'sfx', key: 'bossHurt' });
    }
  }
}
