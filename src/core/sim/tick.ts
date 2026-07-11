/**
 * The fixed 42 Hz tick pipeline — the entire system order lives here.
 * The host must not call tick() while paused (modals/menus own that gate).
 */
import { BLUEPRINT_EFFECTS } from '../data/blueprints';
import { BUILDINGS } from '../data/buildings';
import { SURFACE_ROW, TILE_PX } from '../data/constants';
import type { EventSink } from '../events';
import type { IntentFrame } from '../intents';
import { markDiscovered } from '../world/world';
import { stepBoss } from './boss';
import { stepChain } from './chain';
import { stepContracts } from './contracts';
import { stepCritters } from './critters';
import { stepDrilling } from './drilling';
import { stepCharges } from './explosives';
import { stepHeat } from './heat';
import { rescueTow, tryUseItem } from './items';
import { objectiveMet } from './objectives';
import { POD_HH, stepPhysics } from './physics';
import { stepRelics } from './relics';
import { stepScripted } from './scripted';
import {
  type GameState,
  type PodState,
  bayContentsCount,
  challengeDef,
  maxHull,
  podDepthFt,
  podTileX,
  podTileY,
} from './state';

export function tick(s: GameState, input: IntentFrame, out: EventSink): void {
  if (s.outcome !== 'active') return;
  s.tick++;
  s.stats.ticks++;
  const p = s.pod;

  // 1. snapshot for render interpolation
  p.prevX = p.x;
  p.prevY = p.y;
  if (s.boss) {
    s.boss.prevX = s.boss.x;
    s.boss.prevY = s.boss.y;
  }

  // 2. timers
  if (p.itemCooldown > 0) p.itemCooldown--;
  if (p.itemLock > 0) p.itemLock--;
  if (p.lavaLatch > 0) p.lavaLatch--;
  // Phoenix Hull schematic: slow self-repair (1 HP/s, BLUEPRINT_EFFECTS).
  if (s.tick % 42 === 0 && p.blueprints.includes('phoenixHull') && p.hp < maxHull(p))
    p.hp = Math.min(maxHull(p), p.hp + BLUEPRINT_EFFECTS.hullRegenPerSecond);

  // 3. item use (edge intent)
  if (input.useItem) tryUseItem(s, p, input.useItem, out);

  // 4. drilling (owns movement during a dig) then free movement
  stepDrilling(s, p, input, out);
  if (p.mode !== 'dig') stepPhysics(s, p, input, out);

  // 4b. minimap fog-of-war bookkeeping — reveal around the pod when it enters
  //     a new tile (and once on the very first tick of a run).
  const tx = podTileX(p);
  const ty = podTileY(p);
  if (s.tick === 1 || tx !== Math.floor(p.prevX / TILE_PX) || ty !== Math.floor(p.prevY / TILE_PX))
    markDiscovered(s.world, tx, ty);

  // 5. placed charges
  stepCharges(s, out);

  // 5b. expedition heat, chain timeout, critters (all early-return outside expedition)
  stepHeat(s, out);
  stepChain(s, out);
  stepCritters(s, out);

  // 6. surface buildings — standing on one only shows a prompt; the menu opens
  //    on the explicit interact press, so walking past never hijacks the screen.
  const onSurface = p.mode === 'ground' && Math.abs(p.y + POD_HH - SURFACE_ROW * TILE_PX) < 6;
  const col = podTileX(p);
  const here = onSurface
    ? (BUILDINGS.find((bd) => col >= bd.colStart && col <= bd.colEnd)?.id ?? null)
    : null;
  if (here !== p.nearBuilding) {
    p.nearBuilding = here;
    out.push({ t: 'buildingPrompt', id: here, player: s.pods.indexOf(p) });
  }
  if (here && input.interact) out.push({ t: 'enterBuilding', id: here, player: s.pods.indexOf(p) });

  // 7. scripted events (transmissions, eggs, quakes)
  stepScripted(s, out);

  // 7b. expedition relic offers at depth milestones (early-returns otherwise)
  stepRelics(s, out);

  // 8. boss (arena only)
  stepBoss(s, out);

  // 9. death conditions
  if (s.outcome === 'active') {
    if (p.hp <= 0) {
      s.outcome = 'destroyed';
      out.push({ t: 'podExploded', cause: 'hull', player: s.pods.indexOf(p) });
    } else if (p.fuel <= 0 && p.mode !== 'ground') {
      // out of fuel airborne/digging → the pod is lost (authentic: explosion)
      fuelEmergency(s, p, out);
    } else if (p.fuel <= 0 && p.mode === 'ground' && podDepthFt(p) < -1) {
      // stranded underground with a dry tank → also lost
      fuelEmergency(s, p, out);
    }
    if (p.fuel > 0 && p.fuel < 2) out.push({ t: 'fuelLow', player: s.pods.indexOf(p) });
  }

  // 10. challenge objectives / timer, expedition contracts
  stepChallenge(s, out);
  stepContracts(s, out);
}

/** A dry tank is fatal — unless the run was created with the fuel-failsafe assist. */
function fuelEmergency(s: GameState, p: PodState, out: EventSink): void {
  if (s.mode.assists?.fuelFailsafe) {
    rescueTow(s, p, out);
    return;
  }
  s.outcome = 'destroyed';
  out.push({ t: 'podExploded', cause: 'fuel', player: s.pods.indexOf(p) });
}

function stepChallenge(s: GameState, out: EventSink): void {
  const ch = challengeDef(s);
  if (!ch || s.outcome !== 'active') return;

  if (s.tick >= s.challengeEndTick) {
    s.outcome = 'challengeLost';
    out.push({ t: 'challengeResult', win: false, elapsedTicks: s.tick });
    return;
  }

  if (objectiveMet(s, ch.objective)) {
    s.outcome = 'challengeWon';
    out.push({ t: 'challengeResult', win: true, elapsedTicks: s.tick });
  }
}
