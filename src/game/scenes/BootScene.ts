/** Loads the generated atlas + tileset, then reports ready to the App. */
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.load.atlas('atlas', 'atlas/game.png', 'atlas/game.json');
    this.load.image('tiles', 'atlas/tiles.png');
    this.load.json('tilesMeta', 'atlas/tiles.json');
  }

  create(): void {
    this.game.events.emit('assets-ready');
  }
}
