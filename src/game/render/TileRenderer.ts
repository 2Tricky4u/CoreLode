import {
  type GameState,
  SKY_ROWS,
  SURFACE_ROW,
  TILE_PX,
  Tile,
  WORLD_H,
  WORLD_W,
  getTile,
  isArtifact,
  isBoulder,
  isDirt,
  isGas,
  isLava,
  isMineral,
} from '@core/index';
/**
 * World rendering: two dynamic tilemap layers (base terrain + collectible
 * overlays) over the full 36×600 grid. Gas renders as that band's dirt — the
 * one deliberate lie, and it lives HERE only. Phaser culls to the camera.
 */
import type Phaser from 'phaser';

interface TilesetMeta {
  columns: number;
  tileSize: number;
  index: Record<string, number>;
}

/** Depth band (0-5) for soil palette selection. */
const bandFor = (y: number): number => {
  const frac = (y - SURFACE_ROW) / (WORLD_H - SURFACE_ROW);
  return Math.max(0, Math.min(5, Math.floor(frac * 6)));
};

export class TileRenderer {
  private base!: Phaser.Tilemaps.TilemapLayer;
  private overlay!: Phaser.Tilemaps.TilemapLayer;
  private meta!: TilesetMeta;
  private gasHint = false;

  constructor(
    private scene: Phaser.Scene,
    private state: GameState,
  ) {}

  create(): void {
    this.meta = this.scene.cache.json.get('tilesMeta') as TilesetMeta;
    const map = this.scene.make.tilemap({
      width: WORLD_W,
      height: WORLD_H,
      tileWidth: TILE_PX,
      tileHeight: TILE_PX,
    });
    const tiles = map.addTilesetImage('tiles', 'tiles', TILE_PX, TILE_PX, 0, 0)!;
    this.base = map.createBlankLayer('base', tiles)!;
    this.overlay = map.createBlankLayer('overlay', tiles)!;
    this.repaintAll();
  }

  setGasHint(on: boolean): void {
    this.gasHint = on;
  }

  repaintAll(): void {
    for (let y = 0; y < WORLD_H; y++) this.repaintRow(y);
  }

  repaintRows(rows: number[]): void {
    for (const y of rows) this.repaintRow(y);
  }

  repaintRow(y: number): void {
    for (let x = 0; x < WORLD_W; x++) this.paint(x, y);
  }

  paint(x: number, y: number): void {
    const t = getTile(this.state.world, x, y);
    const ix = this.frameFor(t, x, y);
    if (ix < 0) this.base.removeTileAt(x, y);
    else this.base.putTileAt(ix, x, y);
    const ov = this.overlayFor(t, x, y);
    if (ov < 0) this.overlay.removeTileAt(x, y);
    else this.overlay.putTileAt(ov, x, y);
  }

  private frameFor(t: number, x: number, y: number): number {
    const I = this.meta.index;
    if (t === Tile.Air) return -1;
    if (isDirt(t)) return I[`dirt${t}_p${bandFor(y)}`];
    if (isMineral(t) || isArtifact(t)) return I[`dirt${1 + ((x + y) % 5)}_p${bandFor(y)}`];
    if (isGas(t)) return I[`dirt${1 + ((x * 7 + y) % 5)}_p${bandFor(y)}`]; // the lie
    if (isBoulder(t)) return I[`boulder${t - Tile.BoulderFirst}`];
    if (isLava(t)) return I[`lava${t - Tile.LavaFirst}`];
    switch (t) {
      case Tile.TurfA:
        return I.turfA;
      case Tile.TurfB:
        return I.turfB;
      case Tile.BarrierA:
        return I.barrierA;
      case Tile.BarrierB:
        return I.barrierB;
      case Tile.HellFloor:
      case Tile.Bedrock:
        return I.bedrock;
      case Tile.Slate:
        return I[`dirt2_p${bandFor(y)}`];
      default:
        return I.bedrock;
    }
  }

  private overlayFor(t: number, _x: number, y: number): number {
    const I = this.meta.index;
    if (isMineral(t) || isArtifact(t)) return I[`gem${t - 6}`];
    if (t === Tile.Slate) return I.slate;
    if (isGas(t) && this.gasHint) return I.gem12; // faint marker only with the QoL toggle
    void y;
    return -1;
  }
}
