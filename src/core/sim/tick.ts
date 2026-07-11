/**
 * The fixed 42 Hz tick pipeline — the entire system order lives here.
 * The host must not call tick() while paused (modals/menus own that gate).
 *
 * Multi-pod: `inputs[i]` drives `pods[i]`; missing frames read as EMPTY.
 * Every per-pod loop runs index-ascending — that order is part of the
 * deterministic replay contract (lockstep co-op replays it on every peer).
 * The loops are split (A: move, B: buildings, C: death) so a solo tick
 * executes in EXACTLY the historical order — the golden replay test pins it.
 */
import { BLUEPRINT_EFFECTS } from '../data/blueprints';
import { BUILDINGS, SPAWN_COL } from '../data/buildings';
import { SURFACE_ROW, TILE_PX } from '../data/constants';
import { COOP } from '../data/coop';
import type { EventSink } from '../events';
import { EMPTY_INTENTS, type IntentFrame } from '../intents';
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
  podAlive,
  podDepthFt,
  podTileX,
  podTileY,
  tankCapacity,
  wallet,
} from './state';

export function tick(s: GameState, inputs: readonly IntentFrame[], out: EventSink): void {
  if (s.outcome !== 'active') return;
  s.tick++;
  s.stats.ticks++;

  // 1. snapshot for render interpolation
  for (const p of s.pods) {
    p.prevX = p.x;
    p.prevY = p.y;
  }
  if (s.boss) {
    s.boss.prevX = s.boss.x;
    s.boss.prevY = s.boss.y;
  }

  // 2–4. per-pod: timers, item use, movement, fog (loop A)
  for (let i = 0; i < s.pods.length; i++) {
    const p = s.pods[i];
    if (!podAlive(p)) continue;
    const input = inputs[i] ?? EMPTY_INTENTS;

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
    if (
      s.tick === 1 ||
      tx !== Math.floor(p.prevX / TILE_PX) ||
      ty !== Math.floor(p.prevY / TILE_PX)
    )
      markDiscovered(s.world, tx, ty);
  }

  // 5. placed charges
  stepCharges(s, out);

  // 5b. expedition heat, chain timeout, critters (all early-return outside expedition)
  stepHeat(s, out);
  stepChain(s, out);
  stepCritters(s, out);

  // 6. surface buildings (loop B) — standing on one only shows a prompt; the
  //    menu opens on the explicit interact press, so walking past never
  //    hijacks the screen.
  for (let i = 0; i < s.pods.length; i++) {
    const p = s.pods[i];
    if (!podAlive(p)) continue;
    const input = inputs[i] ?? EMPTY_INTENTS;
    const onSurface = p.mode === 'ground' && Math.abs(p.y + POD_HH - SURFACE_ROW * TILE_PX) < 6;
    const col = podTileX(p);
    const here = onSurface
      ? (BUILDINGS.find((bd) => col >= bd.colStart && col <= bd.colEnd)?.id ?? null)
      : null;
    if (here !== p.nearBuilding) {
      p.nearBuilding = here;
      out.push({ t: 'buildingPrompt', id: here, player: i });
    }
    if (here && input.interact) out.push({ t: 'enterBuilding', id: here, player: i });
  }

  // 7. scripted events (transmissions, eggs, quakes)
  stepScripted(s, out);

  // 7b. expedition relic offers at depth milestones (early-returns otherwise)
  stepRelics(s, out);

  // 8. boss (arena only)
  stepBoss(s, out);

  // 9. death conditions (loop C) — plus co-op respawns
  for (let i = 0; i < s.pods.length && s.outcome === 'active'; i++) {
    const p = s.pods[i];
    if (!podAlive(p)) {
      if (s.mode.kind === 'coop' && s.tick >= p.respawnAtTick) respawnPod(s, p, i, out);
      continue;
    }
    if (p.hp <= 0) {
      podLost(s, p, i, 'hull', out);
    } else if (p.fuel <= 0 && p.mode !== 'ground') {
      // out of fuel airborne/digging → the pod is lost (authentic: explosion)
      fuelEmergency(s, p, out);
    } else if (p.fuel <= 0 && p.mode === 'ground' && podDepthFt(p) < -1) {
      // stranded underground with a dry tank → also lost
      fuelEmergency(s, p, out);
    }
    if (p.fuel > 0 && p.fuel < 2) out.push({ t: 'fuelLow', player: i });
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
  podLost(s, p, s.pods.indexOf(p), 'fuel', out);
}

/**
 * A pod is destroyed. Solo/challenge/expedition: the run ends (authentic).
 * Co-op: the pod goes down for COOP.respawnTicks — cargo forfeited, a cut of
 * the team wallet charged — and the run only ends on a simultaneous full wipe.
 */
function podLost(
  s: GameState,
  p: PodState,
  player: number,
  cause: 'hull' | 'fuel',
  out: EventSink,
): void {
  if (s.mode.kind !== 'coop') {
    s.outcome = 'destroyed';
    out.push({ t: 'podExploded', cause, player });
    return;
  }
  const fee = Math.floor(wallet(s).cash * COOP.respawnFeePct);
  wallet(s).cash -= fee;
  p.bayContents.fill(0);
  p.drilling = null;
  p.mode = 'air';
  p.respawnAtTick = s.tick + COOP.respawnTicks;
  out.push({ t: 'podDown', player, cause, fee });
  out.push({ t: 'sfx', key: 'podExplode' });
  if (s.pods.every((q) => !podAlive(q))) {
    // Total wipe — every pod down at once ends the session for the team.
    s.outcome = 'destroyed';
    out.push({ t: 'podExploded', cause, player });
  }
}

/** Co-op respawn: back at your own spawn column, repaired, tank topped to the cap. */
function respawnPod(s: GameState, p: PodState, player: number, out: EventSink): void {
  p.respawnAtTick = 0;
  p.hp = maxHull(p);
  p.fuel = Math.min(tankCapacity(p), COOP.respawnFuelLiters);
  p.x = (SPAWN_COL + player * COOP.spawnColStride + 0.5) * TILE_PX;
  p.y = SURFACE_ROW * TILE_PX - TILE_PX / 2;
  p.prevX = p.x;
  p.prevY = p.y;
  p.xVel = 0;
  p.yVel = 0;
  p.mode = 'air';
  p.drilling = null;
  p.launchCount = 0;
  p.nearBuilding = null;
  out.push({ t: 'podRespawned', player });
  out.push({ t: 'sfx', key: 'teleportUp' });
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
