/**
 * Phaser bootstrap. The canvas fills the viewport (Scale.RESIZE — no
 * letterbox); GameScene applies the camera zoom policy from viewportPolicy
 * so the visible world is always at least the original 550×400 stage
 * (≈11×8 tiles) and bigger screens simply see more of the mine.
 */
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { DESIGN_H, DESIGN_W } from './viewportPolicy';

export function createPhaserGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: DESIGN_W, // boot size only — RESIZE takes over immediately
    height: DESIGN_H,
    backgroundColor: '#140c1c',
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    scene: [BootScene, GameScene],
  });
}
