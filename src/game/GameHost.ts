/**
 * The bridge: fixed 42 Hz accumulator loop over the pure sim, pause ledger,
 * event fan-out to renderer/audio/UI. Pause is a set of reasons so overlapping
 * causes (modal + hidden tab) can't accidentally resume each other.
 */
import {
  type Command,
  DT_MS,
  EMPTY_INTENTS,
  type GameState,
  type SimEvent,
  applyCommand,
  tick,
} from '@core/index';
import type { InputManager } from '@input/InputManager';

export type EventListener = (e: SimEvent) => void;

export class GameHost {
  readonly state: GameState;
  private acc = 0;
  private pauseReasons = new Set<string>();
  private listeners: EventListener[] = [];
  private events: SimEvent[] = [];
  /** Render interpolation factor 0..1 within the current tick. */
  alpha = 0;
  /** Dev-mode sim speed multiplier (1 = realtime). */
  timeScale = 1;
  /** Dev-mode hook run before every tick (e.g. god-mode top-ups) — race-free. */
  beforeTick: (() => void) | null = null;

  constructor(
    state: GameState,
    private input: InputManager,
  ) {
    this.state = state;
  }

  onEvent(fn: EventListener): void {
    this.listeners.push(fn);
  }

  pause(reason: string): void {
    this.pauseReasons.add(reason);
  }
  resume(reason: string): void {
    this.pauseReasons.delete(reason);
  }
  get paused(): boolean {
    return this.pauseReasons.size > 0;
  }
  get pausedBy(): ReadonlySet<string> {
    return this.pauseReasons;
  }

  /** Apply a shop/UI command (allowed while paused) and fan out its events. */
  command(cmd: Command): void {
    this.events.length = 0;
    applyCommand(this.state, cmd, 0, this.events);
    this.dispatch();
  }

  update(dtMs: number): void {
    if (this.paused || this.state.outcome !== 'active') return;
    this.acc += Math.min(dtMs, 250) * this.timeScale; // clamp: no spiral of death after tab-away
    while (this.acc >= DT_MS) {
      const frame = this.input.gameFocus ? this.input.sample() : EMPTY_INTENTS;
      this.events.length = 0;
      this.beforeTick?.();
      tick(this.state, [frame], this.events);
      this.dispatch();
      this.acc -= DT_MS;
      if (this.paused || this.state.outcome !== 'active') break; // an event paused us mid-batch
    }
    this.alpha = this.acc / DT_MS;
  }

  private dispatch(): void {
    for (const e of this.events) for (const fn of this.listeners) fn(e);
  }
}
