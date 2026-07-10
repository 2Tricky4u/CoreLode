import { ASSIST } from '../data/assists';
import { BOSS } from '../data/boss';
import { SPAWN_COL } from '../data/buildings';
import { PX_PER_FT, SURFACE_ROW, TILE_PX } from '../data/constants';
import { EXPEDITION } from '../data/expedition';
/**
 * Consumable activation — original rules: 5-frame cooldown, ground-only for
 * explosives/teleporters, refuel/repair usable anytime and min-capped.
 * The Discount (Quantum) Teleporter drops you "somewhere above surface level" —
 * a random height, so the hazard is the landing.
 */
import { ITEM_BY_ID, ITEM_EFFECTS, type ItemId } from '../data/items';
import { PHYSICS } from '../data/physics';
import type { EventSink } from '../events';
import { type GameState, bayUsed, maxHull, tankCapacity } from './state';

export function tryUseItem(s: GameState, id: ItemId, out: EventSink): void {
  const p = s.pod;
  const def = ITEM_BY_ID[id];
  if (!def) return;
  if (p.itemCooldown > 0 || p.itemLock > 0) return;
  // Slipstream Engine schematic: surface recall is free — no transporter needed.
  const freeRecall = id === 'priorityTransporter' && p.blueprints.includes('slipstreamEngine');
  if (!freeRecall && (p.inventory[id] ?? 0) <= 0) return;
  if (def.groundOnly && p.mode !== 'ground') {
    out.push({ t: 'sfx', key: 'error' });
    return;
  }

  const consume = () => {
    if (!freeRecall) p.inventory[id] = (p.inventory[id] ?? 1) - 1;
    p.itemCooldown = PHYSICS.itemCooldownFrames;
    s.stats.itemsUsed++;
  };

  switch (id) {
    case 'reserveFuel':
      consume();
      p.fuel = Math.min(tankCapacity(p), p.fuel + ITEM_EFFECTS.reserveFuelLiters);
      out.push({ t: 'sfx', key: 'refuel' });
      break;
    case 'nanoWelders':
      consume();
      p.hp = Math.min(maxHull(p), p.hp + ITEM_EFFECTS.nanoWeldersHp);
      out.push({ t: 'sfx', key: 'nano' });
      break;
    case 'dynamite':
    case 'plastique':
      consume();
      s.charges.push({ item: id, x: p.x, y: p.y, fuse: ITEM_EFFECTS.explosionFuseFrames });
      out.push({ t: 'sfx', key: 'fuseLight' });
      break;
    case 'discountTeleporter': {
      consume();
      // Random drop height above the surface — "results may vary".
      const dropFt = s.rng.range(ITEM_EFFECTS.discountDropMinFt, ITEM_EFFECTS.discountDropMaxFt);
      teleportPod(s, (SPAWN_COL + 0.5) * TILE_PX, SURFACE_ROW * TILE_PX - 21 - dropFt * PX_PER_FT);
      out.push({ t: 'teleport', item: id });
      out.push({ t: 'sfx', key: dropFt > 30 ? 'teleportFail' : 'teleportUp' });
      break;
    }
    case 'priorityTransporter':
      consume();
      teleportPod(s, (SPAWN_COL + 0.5) * TILE_PX, SURFACE_ROW * TILE_PX - 21);
      s.pod.mode = 'ground';
      out.push({ t: 'teleport', item: id });
      out.push({ t: 'sfx', key: 'teleportUp' });
      break;
    case 'coreTeleporter':
      // Hidden $1 dev item: straight to the planet's core (arena mouth).
      consume();
      teleportPod(s, (BOSS.spawnCol - 8 + 0.5) * TILE_PX, (BOSS.arenaTopRow + 1) * TILE_PX);
      out.push({ t: 'teleport', item: id });
      out.push({ t: 'sfx', key: 'teleportUp' });
      break;
  }
}

/**
 * Fuel-failsafe assist: instead of exploding on a dry tank, the pod is towed to
 * the surface — for a cut of your cash and the entire cargo hold. Survivable,
 * never free, and never usable as cheap transport.
 */
export function rescueTow(s: GameState, out: EventSink): void {
  const p = s.pod;
  const exp = s.mode.kind === 'expedition';
  const cost = Math.floor(p.cash * (exp ? EXPEDITION.rescue.costPct : ASSIST.rescueCostPct));
  const cargoLost = bayUsed(p);
  p.cash -= cost;
  p.bayContents.fill(0);
  p.fuel = Math.min(tankCapacity(p), ASSIST.rescueFuelLiters);
  if (exp) p.heat = Math.min(100, p.heat + EXPEDITION.rescue.heatPenalty); // tow runs hot
  teleportPod(s, (SPAWN_COL + 0.5) * TILE_PX, SURFACE_ROW * TILE_PX - 21);
  p.mode = 'ground';
  s.stats.rescues++;
  out.push({ t: 'rescue', cost, cargoLost });
  out.push({ t: 'sfx', key: 'rescue' });
}

function teleportPod(s: GameState, x: number, y: number): void {
  const p = s.pod;
  p.x = x;
  p.y = y;
  p.prevX = x; // no interpolation streak across a teleport
  p.prevY = y;
  p.xVel = 0;
  p.yVel = 0;
  p.mode = 'air';
  p.drilling = null;
  p.launchCount = 0;
}
