/**
 * The whole audio surface: sim events → ZzFX one-shots, a procedural score
 * (music/), and a continuous ambient bed (AmbienceBus). Nothing is sampled;
 * every sound is synthesized at runtime from a few KB of parameters.
 */
import { SFX, type SfxKey, type SimEvent } from '@core/index';
import { AmbienceBus } from './AmbienceBus';
import type { PieceName } from './music/patterns';
import { MusicPlayer } from './music/player';
import { audioContext, isUnlocked, playZzfx, unlockAudio } from './zzfx';

export class AudioBus {
  sfxVolume = 1;
  readonly music = new MusicPlayer();
  readonly ambience = new AmbienceBus();

  private drillLoop: AudioBufferSourceNode | null = null;
  private thrustLoop: AudioBufferSourceNode | null = null;
  private lastPlayed = new Map<string, number>();

  attachUnlock(): void {
    const unlock = () => {
      unlockAudio();
      this.music.onUnlock(); // a queued piece starts on the first gesture
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  set musicVolume(v: number) {
    this.music.setVolume(v);
    this.ambience.setVolume(Math.min(1, v * 1.2 + 0.15)); // bed tracks music, never fully silent
  }

  playMusic(name: PieceName): void {
    this.music.play(name);
  }
  stopMusic(): void {
    this.music.stop();
    this.ambience.silence();
  }
  setMusicDepth(ft: number): void {
    this.music.setDepth(ft);
  }
  setBossForm(form: 1 | 2): void {
    this.music.setBossForm(form);
  }
  duck(on: boolean): void {
    this.music.duck(on);
  }
  setPaused(paused: boolean): void {
    this.music.setPaused(paused);
  }

  /** @param pitch multiplies the patch's base frequency (1 = as authored). */
  play(key: SfxKey, volume = 1, pitch = 1): void {
    if (!isUnlocked()) return;
    // voice-pool throttle: the same sound at most once per 60 ms
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) ?? 0) < 60) return;
    this.lastPlayed.set(key, now);
    const params = SFX[key];
    if (pitch !== 1) {
      const p = [...params];
      p[2] = (p[2] ?? 220) * pitch;
      playZzfx(p, volume * this.sfxVolume);
      return;
    }
    playZzfx(params, volume * this.sfxVolume);
  }

  /** Live drill-loop pitch (1 = as authored) — ramped with dig progress by the scene. */
  setDrillPitch(rate: number): void {
    const ctx = audioContext();
    if (!this.drillLoop || !ctx) return;
    this.drillLoop.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.05);
  }

  onEvent(e: SimEvent): void {
    switch (e.t) {
      case 'sfx':
        this.play(e.key);
        break;
      case 'tileCleared':
        // The block gives way under the drill (blast clears are voiced by 'explosion').
        if (e.cause === 'drill') this.play('digBreak', 0.6);
        break;
      case 'collected':
        // Rarer mineral → higher, brighter chime. Tier 0-9, artifacts fanfare.
        if (e.collectibleId >= 10) this.play('collectBig', 1, 1.15);
        else this.play('collect', 1, 1 + e.collectibleId * 0.055);
        break;
      case 'cargoFullLost':
        this.play('cargoFull');
        break;
      case 'landed':
        // Impact thump only; the hull damage itself is voiced by 'damage'.
        if (e.impactVel > 2) this.play('landThump', Math.min(1, 0.35 + e.impactVel / 24));
        break;
      case 'damage':
        this.play('hullHit', Math.min(1, 0.5 + e.amount / 40));
        break;
      case 'gasIgnite':
        this.play('gasHiss');
        break;
      case 'podExploded':
        this.play('podExplode');
        this.ambience.silence();
        break;
      case 'enterBuilding':
        this.play('doorOpen');
        break;
      case 'buildingPrompt':
        if (e.id) this.play('promptBlip', 0.7);
        break;
      case 'challengeResult':
        this.play(e.win ? 'challengeWin' : 'challengeFail');
        break;
      case 'transmission':
        this.play('transmission');
        break;
      case 'bonusCash':
        this.play('sell', 0.7);
        break;
      case 'fuelLow':
        this.play('fuelLow', 0.6);
        break;
      case 'chain':
        // Rising pitch per chain link — the classic combo escalation.
        this.play('collect', 0.45, 1 + 0.05 * Math.min(e.count, 16));
        break;
      case 'chainBroken':
        if (e.banked) this.play('collect', 0.5, 1.6);
        else if (e.count >= 3) this.play('error', 0.35);
        break;
      case 'contractDone':
        this.play('challengeWin', 0.55);
        break;
    }
  }

  setLoops(drilling: boolean, thrusting: boolean): void {
    if (!isUnlocked()) return;
    if (drilling && !this.drillLoop) {
      this.drillLoop = playZzfx(SFX.drillLoop, 0.5 * this.sfxVolume, true);
      if (this.drillLoop) this.drillLoop.playbackRate.value = 0.8; // fresh block starts low
    }
    if (!drilling && this.drillLoop) {
      this.drillLoop.stop();
      this.drillLoop = null;
    }
    if (thrusting && !this.thrustLoop)
      this.thrustLoop = playZzfx(SFX.thrustLoop, 0.4 * this.sfxVolume, true);
    if (!thrusting && this.thrustLoop) {
      this.thrustLoop.stop();
      this.thrustLoop = null;
    }
  }

  stopLoops(): void {
    this.setLoops(false, false);
  }
}
