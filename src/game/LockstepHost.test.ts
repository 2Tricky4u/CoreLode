/**
 * LockstepHost twin tests: real sims on both ends of an in-memory channel
 * pair — no browser, no WebRTC. The hashes must match on every peer.
 */
import { DT_MS, EMPTY_INTENTS, type IntentFrame, coopStateHash, createRun } from '@core/index';
import type { NetChannel } from '@platform/net/channel';
import { describe, expect, it } from 'vitest';
import { LockstepHost } from './LockstepHost';

class PairChannel implements NetChannel {
  peer: PairChannel | null = null;
  onMessage: ((text: string) => void) | null = null;
  onClose: (() => void) | null = null;
  /** When true, messages queue instead of delivering (stall simulation). */
  holding = false;
  private held: string[] = [];

  send(text: string): void {
    if (!this.peer) return;
    if (this.holding) {
      this.held.push(text);
      return;
    }
    this.peer.onMessage?.(text);
  }

  release(): void {
    this.holding = false;
    const drain = this.held;
    this.held = [];
    for (const text of drain) this.peer?.onMessage?.(text);
  }

  close(): void {
    this.peer?.onClose?.();
  }
}

const pipe = (): [PairChannel, PairChannel] => {
  const a = new PairChannel();
  const b = new PairChannel();
  a.peer = b;
  b.peer = a;
  return [a, b];
};

const script = (player: number) =>
  (() => {
    let n = 0;
    const moves: Array<Partial<IntentFrame>> = [
      { down: true },
      { down: true },
      player === 0 ? { left: true } : { right: true },
      {},
    ];
    return (): IntentFrame => ({ ...EMPTY_INTENTS, ...moves[n++ % moves.length] });
  })();

function makeSession(players: number, seed = 77) {
  const mode = { kind: 'coop' as const, goldium: true, players };
  const hostChannels: PairChannel[] = [];
  const guests: LockstepHost[] = [];
  for (let g = 1; g < players; g++) {
    const [hostEnd, guestEnd] = pipe();
    hostChannels.push(hostEnd);
    guests.push(
      new LockstepHost(createRun({ seed, mode }), {
        role: 'guest',
        localPlayer: g,
        players,
        channels: [guestEnd],
        sampleInput: script(g),
      }),
    );
  }
  const host = new LockstepHost(createRun({ seed, mode }), {
    role: 'host',
    localPlayer: 0,
    players,
    channels: hostChannels,
    sampleInput: script(0),
  });
  return { host, guests, hostChannels };
}

const stepAll = (peers: LockstepHost[], frames: number) => {
  for (let i = 0; i < frames; i++) for (const p of peers) p.update(DT_MS);
};

describe('LockstepHost', () => {
  it('keeps 2 peers bit-identical over 300 ticks', () => {
    const { host, guests } = makeSession(2);
    stepAll([host, ...guests], 320);
    expect(host.state.tick).toBeGreaterThan(250);
    expect(Math.abs(host.state.tick - guests[0].state.tick)).toBeLessThanOrEqual(1);
    // Compare at a common executed tick: step the laggard once more if needed.
    while (guests[0].state.tick < host.state.tick) guests[0].update(DT_MS);
    while (host.state.tick < guests[0].state.tick) host.update(DT_MS);
    expect(coopStateHash(guests[0].state)).toBe(coopStateHash(host.state));
  });

  it('keeps 6 peers bit-identical', () => {
    const { host, guests } = makeSession(6);
    const peers = [host, ...guests];
    stepAll(peers, 200);
    const target = Math.max(...peers.map((p) => p.state.tick));
    for (const p of peers) while (p.state.tick < target) p.update(DT_MS);
    const hashes = peers.map((p) => coopStateHash(p.state));
    expect(new Set(hashes).size).toBe(1);
  });

  it("a guest's command executes at the same tick on every peer", () => {
    const { host, guests } = makeSession(2);
    stepAll([host, ...guests], 20);
    guests[0].state.pods[1].bayContents[0] = 10; // hand-plant cargo on BOTH sims
    host.state.pods[1].bayContents[0] = 10;
    guests[0].command({ c: 'sellAllCargo' });
    stepAll([host, ...guests], 20);
    expect(host.state.pods[0].cash).toBe(guests[0].state.pods[0].cash);
    expect(host.state.pods[0].cash).toBe(320); // $20 + $300 — applied exactly once each
  });

  it('stalls when the network withholds and catches up on release', () => {
    const { host, guests, hostChannels } = makeSession(2);
    stepAll([host, ...guests], 20);
    hostChannels[0].holding = true; // host stops sending bundles to the guest
    const guestTick = guests[0].state.tick;
    stepAll([host, ...guests], 30);
    expect(guests[0].state.tick).toBeLessThanOrEqual(guestTick + 4); // guest starved
    expect(guests[0].stalledMs).toBeGreaterThan(0);
    hostChannels[0].release();
    stepAll([host, ...guests], 60);
    const target = Math.max(host.state.tick, guests[0].state.tick);
    for (const p of [host, guests[0]]) while (p.state.tick < target) p.update(DT_MS);
    expect(coopStateHash(guests[0].state)).toBe(coopStateHash(host.state));
  });

  it('detects an injected divergence via the hash sentinel', () => {
    const { host, guests } = makeSession(2);
    let desynced = -1;
    host.onDesync = (player) => {
      desynced = player;
    };
    stepAll([host, ...guests], 20);
    guests[0].state.pods[1].cash += 999; // corrupt the guest sim
    stepAll([host, ...guests], 120); // ≥ one sentinel period
    expect(desynced).toBe(1);
  });

  it('a dropped guest is EMPTY-substituted and the host keeps running', () => {
    const { host, guests, hostChannels } = makeSession(3);
    stepAll([host, ...guests], 20);
    let dropped = -1;
    host.onDisconnect = (player) => {
      dropped = player ?? -1;
    };
    hostChannels[1].onClose?.(); // player 2's pipe dies
    const before = host.state.tick;
    stepAll([host, guests[0]], 60);
    expect(dropped).toBe(2);
    expect(host.state.tick).toBeGreaterThan(before + 40); // no stall
  });
});
