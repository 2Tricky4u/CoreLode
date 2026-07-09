/**
 * Transport: a lookahead scheduler (the standard drift-free Web Audio pattern —
 * a coarse timer queues notes precisely into AudioContext time), plus per-layer
 * gain nodes so the depth beds cross-fade and the boss's second form fades in.
 *
 * Never blocks boot: if the AudioContext isn't unlocked yet the requested piece
 * is queued and starts on the first user gesture.
 */
import { audioContext, isUnlocked } from '../zzfx';
import {
  type NoteEvent,
  PIECES,
  type Piece,
  type PieceName,
  type Track,
  mineLayerWeights,
  parsePattern,
  pieceSteps,
  stepDuration,
} from './patterns';
import { MODES, degreeToMidi, triad } from './scales';
import { playVoice } from './synth';
import { VOICES } from './voices';

const LOOKAHEAD_S = 0.14;
const TIMER_MS = 25;

const parsed = new Map<string, NoteEvent[]>();
const notesOf = (t: Track): NoteEvent[] => {
  let n = parsed.get(t.steps);
  if (!n) {
    n = parsePattern(t.steps);
    parsed.set(t.steps, n);
  }
  return n;
};

export class MusicPlayer {
  private master: GainNode | null = null;
  private layerGains: GainNode[] = [];
  private piece: Piece | null = null;
  private pieceName: PieceName | null = null;
  private step = 0;
  private nextStepTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  private volume = 0.7;
  private ducked = false;
  private pending: PieceName | null = null;
  private depthFt = 0;
  private bossForm: 1 | 2 = 1;

  /** Call after the AudioContext unlocks (first gesture). */
  onUnlock(): void {
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      this.play(p);
    }
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyMaster();
  }

  /** Duck under modals/transmissions rather than stopping. */
  duck(on: boolean): void {
    this.ducked = on;
    this.applyMaster();
  }

  private applyMaster(): void {
    const ctx = audioContext();
    if (!this.master || !ctx) return;
    const target = this.volume * (this.ducked ? 0.3 : 1);
    this.master.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
  }

  get current(): PieceName | null {
    return this.pieceName;
  }

  play(name: PieceName): void {
    if (this.pieceName === name) return;
    const ctx = audioContext();
    if (!ctx || !isUnlocked()) {
      this.pending = name; // start on unlock
      return;
    }
    this.stopScheduler();

    const piece = PIECES[name];
    this.piece = piece;
    this.pieceName = name;
    this.step = 0;

    if (!this.master) {
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
    }
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(
      Math.max(0.0001, this.volume * (this.ducked ? 0.3 : 1)),
      ctx.currentTime + 0.9,
    );

    for (const g of this.layerGains) g.disconnect();
    this.layerGains = Array.from({ length: piece.layers }, () => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.master!);
      return g;
    });
    this.updateLayerGains(true);

    this.nextStepTime = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.tick(), TIMER_MS);
  }

  stop(): void {
    const ctx = audioContext();
    this.pending = null;
    if (ctx && this.master) {
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
    }
    this.stopScheduler();
    this.pieceName = null;
    this.piece = null;
  }

  /** Freeze scheduling (hidden tab) without tearing down the piece. */
  setPaused(paused: boolean): void {
    if (paused) {
      this.stopScheduler();
    } else if (this.piece && !this.timer) {
      const ctx = audioContext();
      if (!ctx) return;
      this.nextStepTime = ctx.currentTime + 0.05;
      this.timer = setInterval(() => this.tick(), TIMER_MS);
    }
  }

  private stopScheduler(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setDepth(ft: number): void {
    this.depthFt = ft;
    if (this.pieceName === 'mine') this.updateLayerGains(false);
  }

  setBossForm(form: 1 | 2): void {
    this.bossForm = form;
    if (this.pieceName === 'boss') this.updateLayerGains(false);
  }

  private updateLayerGains(immediate: boolean): void {
    const ctx = audioContext();
    if (!ctx || !this.piece) return;
    let weights: number[];
    if (this.pieceName === 'mine') weights = mineLayerWeights(this.depthFt);
    else if (this.pieceName === 'boss') weights = [1, this.bossForm === 2 ? 1 : 0];
    else weights = this.layerGains.map(() => 1);

    this.layerGains.forEach((g, i) => {
      const w = weights[i] ?? 1;
      if (immediate) g.gain.setValueAtTime(w, ctx.currentTime);
      // A long constant: descending should feel like a slow tide, not a switch.
      else g.gain.setTargetAtTime(w, ctx.currentTime, 1.6);
    });
  }

  private tick(): void {
    const ctx = audioContext();
    const piece = this.piece;
    if (!ctx || !piece) return;
    const total = pieceSteps(piece);
    const stepDur = stepDuration(piece);
    while (this.nextStepTime < ctx.currentTime + LOOKAHEAD_S) {
      this.scheduleStep(piece, this.step, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.step = (this.step + 1) % total;
    }
  }

  private scheduleStep(piece: Piece, step: number, time: number, stepDur: number): void {
    const ctx = audioContext();
    if (!ctx) return;
    const bar = Math.floor(step / 16);
    const chordDeg = piece.progression[bar % piece.progression.length] ?? 0;

    for (const track of piece.tracks) {
      const dest = this.layerGains[track.layer];
      if (!dest) continue;
      for (const n of notesOf(track)) {
        if (n.step !== step) continue;
        const spec = VOICES[track.voice];
        const mode = MODES[track.mode ?? piece.mode];
        const degree = n.degree + (track.follow ? chordDeg : 0);
        const oct = (track.octave ?? 0) * 12;
        const midis = spec.chord
          ? triad(piece.root, mode, degree).map((m) => m + oct)
          : [degreeToMidi(piece.root, mode, degree) + oct];
        playVoice(ctx, dest, spec, midis, time, n.len * stepDur, track.gain ?? 1);
      }
    }
  }
}
