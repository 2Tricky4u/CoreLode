import { SURFACE_ROW, TILE_PX, Tile, WORLD_H, WORLD_W, getTile } from '@core/index';
import type { GameState } from '@core/index';
/**
 * Ambient cavern life — purely cosmetic glowbugs drifting through open air
 * near the camera. Presentation-only by construction: reads the world grid,
 * never touches the sim, uses scene-local Math.random. Gated by the
 * ambientLife video setting and effects density.
 */
import Phaser from 'phaser';

interface Bug {
  img: Phaser.GameObjects.Image;
  x0: number;
  y0: number;
  phase: number;
  drift: number;
}

const MAX_BUGS = 6;

export class FaunaLayer {
  private bugs: Bug[] = [];
  enabled = true;

  constructor(
    private scene: Phaser.Scene,
    private state: GameState,
  ) {}

  update(): void {
    if (!this.enabled) {
      if (this.bugs.length > 0) this.clear();
      return;
    }
    const wv = this.scene.cameras.main.worldView; // zoom-aware visible rect
    if (wv.width < 1) return;
    // Cull bugs that scrolled far off screen.
    this.bugs = this.bugs.filter((b) => {
      const off =
        b.x0 < wv.x - 120 || b.x0 > wv.right + 120 || b.y0 < wv.y - 120 || b.y0 > wv.bottom + 120;
      if (off) b.img.destroy();
      return !off;
    });

    // Occasionally wake a glowbug in a random on-screen air tile underground.
    if (this.bugs.length < MAX_BUGS && Math.random() < 0.02) {
      const tx = Math.floor((wv.x + Math.random() * wv.width) / TILE_PX);
      const ty = Math.floor((wv.y + Math.random() * wv.height) / TILE_PX);
      if (
        tx > 1 &&
        tx < WORLD_W - 2 &&
        ty > SURFACE_ROW + 2 &&
        ty < WORLD_H - 14 &&
        getTile(this.state.world, tx, ty) === Tile.Air
      ) {
        const img = this.scene.add
          .image((tx + 0.5) * TILE_PX, (ty + 0.5) * TILE_PX, 'atlas', 'mote')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0x99e550)
          .setAlpha(0)
          .setDepth(8);
        this.bugs.push({
          img,
          x0: img.x,
          y0: img.y,
          phase: Math.random() * Math.PI * 2,
          drift: 6 + Math.random() * 10,
        });
      }
    }

    const now = this.scene.time.now / 1000;
    for (const b of this.bugs) {
      const a = now * 0.9 + b.phase;
      b.img.setPosition(b.x0 + Math.sin(a) * b.drift, b.y0 + Math.sin(a * 1.7) * b.drift * 0.6);
      b.img.setAlpha(0.35 + 0.3 * Math.sin(a * 2.3)); // firefly blink
    }
  }

  private clear(): void {
    for (const b of this.bugs) b.img.destroy();
    this.bugs = [];
  }
}
