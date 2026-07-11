/**
 * Networked sim driver: host-sequenced deterministic lockstep for 2–6 players.
 *
 * Every peer executes ticks ONLY from authoritative bundles (host included),
 * so all sims stay bit-identical. Local input for tick T+D is sent when tick
 * T executes (a constant D-tick pipeline); commands ride the same stream and
 * apply at their scheduled tick in (tick, player) order, never out-of-band.
 *
 * Presentation pauses ('modal', 'hidden', 'intro') are intentionally IGNORED:
 * the mine keeps running while a teammate shops. Only the synchronized 'user'
 * pause (pause menu) stops the session, for everyone.
 */
import {
  BundleLedger,
  type Command,
  DT_MS,
  EMPTY_INTENTS,
  type GameState,
  HASH_EVERY_TICKS,
  HostSequencer,
  INPUT_DELAY_TICKS,
  type IntentFrame,
  type NetMessage,
  type SimEvent,
  applyCommand,
  coopStateHash,
  decodeMsg,
  encodeMsg,
  tick,
} from '@core/index';
import type { NetChannel } from '@platform/net/channel';
import type { EventListener, SimHost } from './GameHost';

export interface LockstepOptions {
  role: 'host' | 'guest';
  /** This client's seat (0 = host). */
  localPlayer: number;
  /** Total seats in the session. */
  players: number;
  /** Host: one channel per guest (index i ⇒ player i+1). Guest: exactly one (to the host). */
  channels: NetChannel[];
  /** Local input source (App passes the InputManager sampler). */
  sampleInput: () => IntentFrame;
}

export class LockstepHost implements SimHost {
  readonly state: GameState;
  alpha = 0;
  timeScale = 1; // fixed in networked play; kept for SimHost compatibility
  beforeTick: (() => void) | null = null; // dev hooks are disabled in co-op

  /** Called when a guest's state hash diverges from the host's. */
  onDesync: ((player: number) => void) | null = null;
  /** A peer vanished: the player index (host side) or null = the host is gone. */
  onDisconnect: ((player: number | null) => void) | null = null;

  private readonly role: 'host' | 'guest';
  private readonly localPlayer: number;
  private readonly players: number;
  private readonly channels: NetChannel[];
  private readonly sampleInput: () => IntentFrame;

  private seq: HostSequencer | null; // host only
  private ledger = new BundleLedger();
  private acc = 0;
  private sendCursor = INPUT_DELAY_TICKS; // ticks 0..D−1 are pre-seeded EMPTY
  private pendingCmds: Command[] = [];
  private listeners: EventListener[] = [];
  private events: SimEvent[] = [];
  private syncPaused = false;
  private stalledSinceMs = 0;
  /** Host: my sentinel hashes awaiting guest reports (tick → hash). */
  private myHashes = new Map<number, number>();
  private pendingGuestHashes: Array<{ player: number; t: number; h: number }> = [];

  constructor(state: GameState, opts: LockstepOptions) {
    this.state = state;
    this.role = opts.role;
    this.localPlayer = opts.localPlayer;
    this.players = opts.players;
    this.channels = opts.channels;
    this.sampleInput = opts.sampleInput;
    this.seq = this.role === 'host' ? new HostSequencer(this.players) : null;
    this.channels.forEach((ch, i) => {
      const guestPlayer = this.role === 'host' ? i + 1 : null;
      ch.onMessage = (text) => this.handleMessage(guestPlayer, text);
      ch.onClose = () => this.handleClose(guestPlayer);
    });
  }

  // ---------- SimHost surface ----------
  onEvent(fn: EventListener): void {
    this.listeners.push(fn);
  }

  /**
   * Only the synchronized 'user' pause stops a lockstep session; the local
   * presentation pauses (modal/hidden/intro) must not stall the shared mine.
   */
  pause(reason: string): void {
    if (reason !== 'user') return;
    this.setSyncPause(true, true);
  }
  resume(reason: string): void {
    if (reason !== 'user') return;
    this.setSyncPause(false, true);
  }
  get paused(): boolean {
    return this.syncPaused;
  }
  get pausedBy(): ReadonlySet<string> {
    return this.syncPaused ? new Set(['user']) : new Set();
  }

  /** Commands ride the input stream — applied at their scheduled tick on every peer. */
  command(cmd: Command): void {
    this.pendingCmds.push(cmd);
  }

  /** How long execution has been blocked waiting for the network (0 = flowing). */
  get stalledMs(): number {
    return this.stalledSinceMs;
  }

  /** Which players the stall is waiting on. Host: late guests; guest: [] (the host). */
  latePlayers(): number[] {
    if (this.seq) return this.seq.lateFor().filter((p) => p !== this.localPlayer);
    return [];
  }

  update(dtMs: number): void {
    if (this.syncPaused || this.state.outcome !== 'active') return;
    this.acc += Math.min(dtMs, 250);
    let progressed = false;
    while (this.acc >= DT_MS) {
      if (this.role === 'host') this.pumpSequencer();
      const bundle = this.ledger.take();
      if (!bundle) break; // stall — waiting for the network
      this.events.length = 0;
      // Commands first, (tick, player)-ordered, then the tick itself.
      for (let pl = 0; pl < bundle.cmds.length; pl++) {
        for (const cmd of bundle.cmds[pl]) applyCommand(this.state, cmd, pl, this.events);
      }
      tick(this.state, bundle.frames, this.events);
      this.dispatch();
      this.afterExec(bundle.t);
      this.acc -= DT_MS;
      progressed = true;
      if (this.syncPaused || this.state.outcome !== 'active') break;
    }
    if (progressed) {
      this.stalledSinceMs = 0;
    } else if (this.acc >= DT_MS) {
      this.stalledSinceMs += dtMs;
      this.acc = Math.min(this.acc, DT_MS * 4); // don't bank a huge catch-up burst
    }
    this.alpha = Math.min(1, this.acc / DT_MS);
  }

  // ---------- internals ----------
  /** Host: fold ready inputs into the next bundle and broadcast it. */
  private pumpSequencer(): void {
    const seq = this.seq;
    if (!seq || !seq.ready()) return;
    const b = seq.take();
    if (!b) return;
    this.broadcast({ m: 'bundle', t: b.t, frames: b.frames, cmds: b.cmds });
    this.ledger.put(b);
  }

  /** After executing tick t: schedule local input for t+D and run the sentinel. */
  private afterExec(t: number): void {
    const frame = this.sampleInput();
    const cmds = this.pendingCmds;
    this.pendingCmds = [];
    const target = this.sendCursor++;
    if (this.role === 'host') {
      this.seq?.put(this.localPlayer, target, frame, cmds);
    } else {
      this.channels[0]?.send(encodeMsg({ m: 'in', t: target, frame, cmds }));
    }

    if (t > 0 && t % HASH_EVERY_TICKS === 0) {
      const h = coopStateHash(this.state);
      if (this.role === 'host') {
        this.myHashes.set(t, h);
        // prune anything older than a few sentinel periods
        for (const key of this.myHashes.keys())
          if (key < t - HASH_EVERY_TICKS * 5) this.myHashes.delete(key);
        this.drainGuestHashes();
      } else {
        this.channels[0]?.send(encodeMsg({ m: 'hash', t, h }));
      }
    }
  }

  private drainGuestHashes(): void {
    this.pendingGuestHashes = this.pendingGuestHashes.filter(({ player, t, h }) => {
      const mine = this.myHashes.get(t);
      if (mine === undefined) return true; // host hasn't reached t yet — keep waiting
      if (mine !== h) this.onDesync?.(player);
      return false;
    });
  }

  private handleMessage(fromGuest: number | null, text: string): void {
    const msg = decodeMsg(text);
    if (!msg) return;
    switch (msg.m) {
      case 'in':
        if (this.role === 'host' && fromGuest !== null)
          this.seq?.put(fromGuest, msg.t, msg.frame, msg.cmds);
        break;
      case 'bundle':
        if (this.role === 'guest')
          this.ledger.put({ t: msg.t, frames: msg.frames, cmds: msg.cmds });
        break;
      case 'hash':
        if (this.role === 'host' && fromGuest !== null) {
          this.pendingGuestHashes.push({ player: fromGuest, t: msg.t, h: msg.h });
          this.drainGuestHashes();
        }
        break;
      case 'pause':
        this.setSyncPause(msg.on, this.role === 'host'); // host relays to the others
        break;
      case 'dropped':
        if (this.role === 'guest') this.onDisconnect?.(msg.player);
        break;
      case 'bye':
        this.handleClose(fromGuest);
        break;
      default:
        break; // lobby messages (hi/join/start/resume/chunk) are handled by the app
    }
  }

  private handleClose(fromGuest: number | null): void {
    if (this.role === 'host' && fromGuest !== null) {
      this.seq?.drop(fromGuest);
      this.broadcast({ m: 'dropped', player: fromGuest });
      this.onDisconnect?.(fromGuest);
    } else if (this.role === 'guest') {
      this.onDisconnect?.(null); // the host is gone — session over
    }
  }

  private setSyncPause(on: boolean, propagate: boolean): void {
    if (this.syncPaused === on) return;
    this.syncPaused = on;
    if (propagate) this.broadcast({ m: 'pause', on });
  }

  private broadcast(msg: NetMessage): void {
    const text = encodeMsg(msg);
    for (const ch of this.channels) ch.send(text);
  }

  private dispatch(): void {
    for (const e of this.events) for (const fn of this.listeners) fn(e);
  }

  /** Leave the session cleanly. */
  shutdown(): void {
    for (const ch of this.channels) {
      ch.send(encodeMsg({ m: 'bye' }));
      ch.close();
    }
  }
}

// Re-export for tests and app wiring convenience.
export { EMPTY_INTENTS, INPUT_DELAY_TICKS };
