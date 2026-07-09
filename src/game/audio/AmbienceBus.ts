/**
 * Continuous ambient bed — real Web Audio noise + filters (far more controllable
 * than looping short ZzFX buffers). Four always-running voices whose gains are
 * driven by game state:
 *
 *   surfaceWind  above ground, gone by ~300 ft down
 *   caveTone     underground; darker and louder with depth
 *   lavaRumble   proximity to visible lava cells
 *   treadRumble  grounded and moving
 *
 * Deliberately absent: any gas-proximity sound. Gas pockets are invisible BY
 * DESIGN (a verified original mechanic, guarded by a unit test). An ambient hiss
 * near gas would leak it. Gas is audible only when it ignites.
 */
import { audioContext, isUnlocked } from './zzfx';

interface Layer {
  gain: GainNode;
  filter: BiquadFilterNode;
  target: number;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 0x9e3779b9 >>> 0;
  for (let i = 0; i < len; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    d[i] = seed / 0x3fffffff - 1;
  }
  return buf;
}

export class AmbienceBus {
  private master: GainNode | null = null;
  private layers: Record<'wind' | 'cave' | 'lava' | 'tread', Layer> | null = null;
  private volume = 1;
  private enabled = true;

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyMaster();
  }

  /** `fxDensity: reduced` silences the bed entirely. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    this.applyMaster();
  }

  private applyMaster(): void {
    const ctx = audioContext();
    if (!this.master || !ctx) return;
    this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, ctx.currentTime, 0.2);
  }

  private ensure(): boolean {
    if (this.layers) return true;
    const ctx = audioContext();
    if (!ctx || !isUnlocked()) return false;

    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(ctx.destination);

    const buf = noiseBuffer(ctx);
    const mk = (type: BiquadFilterType, freq: number, q: number): Layer => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.master!);
      src.start();
      return { gain, filter, target: 0 };
    };

    this.layers = {
      wind: mk('bandpass', 700, 0.8),
      cave: mk('lowpass', 320, 1.4),
      lava: mk('lowpass', 130, 2.2),
      tread: mk('bandpass', 190, 1.1),
    };
    return true;
  }

  /**
   * @param depthFt   negative underground
   * @param lavaNear  0..1 proximity to visible lava
   * @param driving   grounded and moving
   */
  update(depthFt: number, lavaNear: number, driving: boolean): void {
    if (!this.ensure()) return;
    const ctx = audioContext();
    const L = this.layers;
    if (!ctx || !L) return;

    const down = Math.max(0, -depthFt);
    const set = (l: Layer, v: number, tau = 0.6) =>
      l.gain.gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, tau);

    // Wind only near/above the surface.
    set(L.wind, depthFt > -300 ? 0.06 * (1 - down / 300) : 0);

    // Cave tone swells and darkens with depth.
    const caveT = Math.min(1, down / 5000);
    set(L.cave, down > 60 ? 0.05 + 0.09 * caveT : 0);
    L.cave.filter.frequency.setTargetAtTime(340 - 190 * caveT, ctx.currentTime, 1.2);

    // Lava proximity.
    set(L.lava, 0.16 * lavaNear, 0.35);

    // Tread rumble while driving on the ground.
    set(L.tread, driving ? 0.05 : 0, 0.12);
  }

  /** Silence everything (menus, game over). */
  silence(): void {
    const ctx = audioContext();
    if (!ctx || !this.layers) return;
    for (const l of Object.values(this.layers)) {
      l.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    }
  }
}
