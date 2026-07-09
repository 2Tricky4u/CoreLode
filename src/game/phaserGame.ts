/**
 * Phaser bootstrap. Native resolution mirrors the original 550×400 stage
 * (≈11×8 tiles visible); Scale.FIT letterboxes it crisply.
 */
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

export function createPhaserGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 550,
    height: 400,
    backgroundColor: '#140c1c',
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, GameScene],
  });
}
