/**
 * Two-form boss FSM. Verbatim: form HP 1000/2000 × NG+ level, damage × level,
 * only explosives hurt him, leaving the arena resets him, ~3 s between forms,
 * form drops (suit/staff/monocle, then hooves/horns/eyes/boiler) + victory
 * rewards. Attack timings are data-driven CAL values (core/data/boss.ts).
 */
import { BOSS, type BossAttackDef, type BossFormDef } from '../data/boss';
import { HELL_FLOOR_ROW, TILE_PX, WORLD_H } from '../data/constants';
import { bossDamageMult, bossFormHp } from '../data/difficulty';
import { FORM1_DROPS, FORM2_DROPS, VICTORY_REWARDS } from '../data/minerals';
import type { EventSink } from '../events';
import { atan2d, dist } from '../lib/math';
import { solidAt } from '../world/world';
import { applyDamage } from './physics';
import { fireTransmission } from './scripted';
import { type BossState, type GameState, type PodState, podAlive } from './state';

const formDef = (form: 1 | 2): BossFormDef => BOSS.forms[form - 1];

const podInArena = (p: PodState): boolean => Math.floor(p.y / TILE_PX) >= BOSS.arenaTopRow - 1;

export const inArena = (s: GameState): boolean => s.pods.some((p) => podAlive(p) && podInArena(p));

/** Nearest living pod in the arena (lower index breaks ties) — the boss's target. */
function bossTarget(s: GameState, b: BossState): PodState {
  let best: PodState | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const p of s.pods) {
    if (!podAlive(p) || !podInArena(p)) continue;
    const d = dist(p.x - b.x, p.y - b.y);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best ?? s.pod; // unreachable while inArena(s) holds, but keep it total
}

function spawnBoss(s: GameState, form: 1 | 2): BossState {
  // The original's spawn y (px 29532, row ~590) anchored the sprite's TOP —
  // its ~200px body put the feet on the arena floor. Our anchor is body-centre,
  // so ground him: one tile above the floor top (the view plants the feet).
  const y = HELL_FLOOR_ROW * TILE_PX - TILE_PX;
  return {
    form,
    hp: bossFormHp(form, s.level),
    x: (BOSS.spawnCol + 0.5) * TILE_PX,
    y,
    prevX: (BOSS.spawnCol + 0.5) * TILE_PX,
    prevY: y,
    facing: -1,
    phase: 'idle',
    phaseTicks: 0,
    currentAttack: null,
    attackCooldowns: {},
    contactCooldown: 0,
    laserAngle: 0,
    lastHitBy: 0,
  };
}

/** Grant drops to the player whose charge landed the kill (fallback: first living pod). */
function grantDrops(s: GameState, ids: readonly number[], out: EventSink): void {
  const owner = s.pods[s.boss?.lastHitBy ?? 0];
  const target = owner && podAlive(owner) ? owner : (s.pods.find((q) => podAlive(q)) ?? s.pod);
  const player = s.pods.indexOf(target);
  for (const id of ids) {
    target.bayContents[id]++;
    out.push({ t: 'collected', collectibleId: id, player });
  }
}

export function stepBoss(s: GameState, out: EventSink): void {
  const wasInArena = s.boss !== null;
  const nowInArena = inArena(s);

  // Entering: spawn form 1 + the reveal transmission.
  if (nowInArena && !s.boss) {
    s.boss = spawnBoss(s, 1);
    out.push({ t: 'bossActivated', form: 1 });
    out.push({ t: 'sfx', key: 'bossRoar' });
    fireTransmission(s, 'tx-boss', out);
    return;
  }
  // Leaving mid-fight: full reset (authentic — even during a death animation).
  if (!nowInArena && wasInArena && s.boss && s.outcome === 'active') {
    s.boss = null;
    out.push({ t: 'bossReset' });
    out.push({ t: 'sfx', key: 'bossReset' });
    return;
  }
  const b = s.boss;
  if (!b || s.outcome !== 'active') return;

  const def = formDef(b.form);
  const dmul = bossDamageMult(s.level);
  const p = bossTarget(s, b); // nearest living pod in the arena
  const dx = p.x - b.x;
  const distTiles = dist(dx, p.y - b.y) / TILE_PX;

  b.phaseTicks++;
  if (b.contactCooldown > 0) b.contactCooldown--;
  for (const k of Object.keys(b.attackCooldowns)) {
    if (b.attackCooldowns[k] > 0) b.attackCooldowns[k]--;
  }

  // Contact damage — every living pod in range shares one cooldown window.
  if (b.phase !== 'dead' && b.phase !== 'transition' && b.contactCooldown <= 0) {
    let hit = false;
    for (const q of s.pods) {
      if (!podAlive(q)) continue;
      if (dist(q.x - b.x, q.y - b.y) / TILE_PX < 1.6) {
        applyDamage(s, q, def.contactDamage * dmul, 'boss', out);
        hit = true;
      }
    }
    if (hit) b.contactCooldown = def.contactRetriggerTicks;
  }

  switch (b.phase) {
    case 'idle': {
      // Walk toward the pod along the arena floor.
      b.facing = dx < 0 ? -1 : 1;
      const nx = b.x + b.facing * def.walkSpeed;
      if (!solidAt(s.world, Math.floor(nx / TILE_PX), Math.floor(b.y / TILE_PX))) b.x = nx;
      // Pick an attack.
      const ready = def.attacks.filter((a) => (b.attackCooldowns[a.kind] ?? 0) <= 0);
      const usable = ready.filter((a) => (a.rangeTiles ? distTiles <= a.rangeTiles : true));
      if (usable.length > 0 && b.phaseTicks > 21) {
        const attack = usable[s.rng.int(usable.length)];
        b.currentAttack = attack.kind;
        b.phase = 'telegraph';
        b.phaseTicks = 0;
      }
      break;
    }
    case 'telegraph': {
      const attack = def.attacks.find((a) => a.kind === b.currentAttack)!;
      if (b.phaseTicks >= attack.telegraphTicks) {
        b.phase = 'attack';
        b.phaseTicks = 0;
        b.laserAngle = -Math.PI / 2 - (Math.PI / 3) * b.facing;
        out.push({ t: 'bossAttack', form: b.form, kind: attack.kind });
        out.push({
          t: 'sfx',
          key:
            attack.kind === 'laserSweep'
              ? 'bossLaser'
              : attack.kind === 'fireball'
                ? 'bossFireball'
                : 'bossSwing',
        });
        if (attack.kind === 'fireball') {
          s.projectiles.push({
            kind: 'fireball',
            x: b.x,
            y: b.y - TILE_PX,
            prevX: b.x,
            prevY: b.y - TILE_PX,
            xVel: BOSS.fireball.speed * b.facing,
            yVel: -6,
            ttl: BOSS.fireball.lifetimeTicks,
          });
        }
      }
      break;
    }
    case 'attack': {
      const attack = def.attacks.find((a) => a.kind === b.currentAttack)!;
      applyAttack(s, b, attack, dmul, distTiles, out);
      if (b.phaseTicks >= attack.activeTicks) {
        b.phase = 'recover';
        b.phaseTicks = 0;
        b.attackCooldowns[attack.kind] = attack.cooldownTicks;
      }
      break;
    }
    case 'recover': {
      const attack = def.attacks.find((a) => a.kind === b.currentAttack);
      if (b.phaseTicks >= (attack?.recoverTicks ?? 30)) {
        b.phase = 'idle';
        b.phaseTicks = 0;
        b.currentAttack = null;
      }
      break;
    }
    case 'transition': {
      if (b.phaseTicks >= BOSS.interPhaseTicks) {
        s.boss = spawnBoss(s, 2);
        out.push({ t: 'bossActivated', form: 2 });
        out.push({ t: 'sfx', key: 'bossRoar' });
        fireTransmission(s, 'tx-form2', out);
      }
      break;
    }
    case 'dead':
      break;
  }

  // Form death.
  if (b.hp <= 0 && b.phase !== 'dead' && b.phase !== 'transition') {
    if (b.form === 1) {
      grantDrops(s, FORM1_DROPS, out);
      out.push({ t: 'bossFormDown', form: 1 });
      out.push({ t: 'sfx', key: 'bossDeath' });
      b.phase = 'transition';
      b.phaseTicks = 0;
    } else {
      grantDrops(s, FORM2_DROPS, out);
      grantDrops(s, VICTORY_REWARDS, out);
      out.push({ t: 'bossFormDown', form: 2 });
      out.push({ t: 'sfx', key: 'bossDeath' });
      b.phase = 'dead';
      s.outcome = 'victory';
      fireTransmission(s, 'tx-victory', out);
      out.push({ t: 'victory' });
      out.push({ t: 'sfx', key: 'victory' });
    }
  }

  stepProjectiles(s, dmul, out);
}

function applyAttack(
  s: GameState,
  b: BossState,
  attack: BossAttackDef,
  dmul: number,
  _distTiles: number,
  out: EventSink,
): void {
  switch (attack.kind) {
    case 'laserSweep': {
      // Sweep an arc; hits regardless of terrain (authentic "through the ceiling").
      const t = b.phaseTicks / attack.activeTicks;
      b.laserAngle =
        -Math.PI + Math.PI * t * (b.facing === 1 ? 1 : -1) * 1.0 - (b.facing === 1 ? 0 : Math.PI);
      if (b.contactCooldown <= 0) {
        let hit = false;
        for (const q of s.pods) {
          if (!podAlive(q)) continue;
          const podAngle = atan2d(q.y - b.y, q.x - b.x); // deterministic across engines
          let diff = Math.abs(podAngle - b.laserAngle);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          if (diff < 0.09) {
            applyDamage(s, q, attack.damage * dmul, 'boss', out);
            q.xVel += attack.knockback.x * Math.sign(q.x - b.x);
            q.yVel += attack.knockback.y;
            q.mode = 'air';
            hit = true;
          }
        }
        if (hit) b.contactCooldown = 30;
      }
      break;
    }
    case 'staffSwing':
    case 'clawSweep': {
      const range = attack.kind === 'staffSwing' ? (attack.rangeTiles ?? 3) : 6;
      const hitTick = Math.floor(attack.activeTicks / 2);
      if (b.phaseTicks === hitTick) {
        for (const q of s.pods) {
          if (!podAlive(q)) continue;
          if (dist(q.x - b.x, q.y - b.y) / TILE_PX > range) continue;
          applyDamage(s, q, attack.damage * dmul, 'boss', out);
          q.xVel += attack.knockback.x * Math.sign(q.x - b.x || 1);
          q.yVel += attack.knockback.y;
          q.mode = 'air';
          if (attack.itemLockTicks) q.itemLock = Math.max(q.itemLock, attack.itemLockTicks);
        }
      }
      break;
    }
    case 'fireball':
      break; // projectile handles itself
  }
}

function stepProjectiles(s: GameState, dmul: number, out: EventSink): void {
  if (s.projectiles.length === 0) return;
  const arenaFloorY = (WORLD_H - 5) * TILE_PX;
  const keep: typeof s.projectiles = [];
  for (const pr of s.projectiles) {
    pr.prevX = pr.x;
    pr.prevY = pr.y;
    pr.yVel += BOSS.fireball.gravityPerFrame;
    pr.x += pr.xVel;
    pr.y += pr.yVel;
    pr.ttl--;
    // Bounce off the arena floor to ~80% arena height.
    if (pr.y > arenaFloorY - 10 && pr.yVel > 0) {
      const arenaH = 6 * TILE_PX;
      pr.yVel = -Math.sqrt(
        2 * BOSS.fireball.gravityPerFrame * arenaH * BOSS.fireball.bounceApexFrac,
      );
    }
    // Wall bounce.
    if (
      solidAt(
        s.world,
        Math.floor((pr.x + Math.sign(pr.xVel) * 12) / TILE_PX),
        Math.floor(pr.y / TILE_PX),
      )
    ) {
      pr.xVel = -pr.xVel;
    }
    for (const q of s.pods) {
      if (!podAlive(q)) continue;
      if (dist(q.x - pr.x, q.y - pr.y) < 30) {
        const def = formDef(s.boss?.form ?? 2);
        const fb = def.attacks.find((a) => a.kind === 'fireball');
        applyDamage(s, q, (fb?.damage ?? 20) * dmul, 'boss', out);
        pr.ttl = 0;
        break; // one pod eats the fireball
      }
    }
    if (pr.ttl > 0) keep.push(pr);
  }
  s.projectiles = keep;
}
