/**
 * SFX routing: sim events → ZzFX synth. Music: procedural ambient loops built
 * from the same synth (droning pads by depth band) — zero shipped audio files.
 */
import { SFX, type SfxKey, type SimEvent } from '@core/index';
import { isUnlocked, playZzfx, unlockAudio } from './zzfx';

export class AudioBus {
  sfxVolume = 1;
  musicVolume = 0.7;
  private drillLoop: AudioBufferSourceNode | null = null;
  private thrustLoop: AudioBufferSourceNode | null = null;
  private lastPlayed = new Map<string, number>();

  attachUnlock(): void {
    const unlock = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  play(key: SfxKey, volume = 1): void {
    if (!isUnlocked()) return;
    // basic voice-pool throttle: same sfx max once per 60 ms
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) ?? 0) < 60) return;
    this.lastPlayed.set(key, now);
    playZzfx(SFX[key], volume * this.sfxVolume);
  }

  onEvent(e: SimEvent): void {
    switch (e.t) {
      case 'sfx':
        this.play(e.key as SfxKey);
        break;
      case 'collected':
        this.play(e.collectibleId >= 6 ? 'collectBig' : 'collect');
        break;
      case 'cargoFullLost':
        this.play('cargoFull');
        break;
      case 'landed':
        if (e.damage > 0) this.play('hullHit');
        else this.play('landThump', 0.5);
        break;
      case 'podExploded':
        this.play('explosionLarge');
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
      case 'digStart':
        this.play('clink', 0.3);
        break;
    }
  }

  setLoops(drilling: boolean, thrusting: boolean): void {
    if (!isUnlocked()) return;
    if (drilling && !this.drillLoop)
      this.drillLoop = playZzfx(SFX.drillLoop, 0.5 * this.sfxVolume, true);
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
