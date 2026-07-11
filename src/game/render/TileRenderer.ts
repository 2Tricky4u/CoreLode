import {
  type GameState,
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
 * one deliberate lie, and it lives HERE only.
 * v2: lava cells animate by cycling through 4 baked phase frames (classic
 * palette-cycling look); the QoL gas shimmer uses the same mechanism.
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
  /** Cells kept visually solid while drills eat through them (sim clears early).
   *  Keyed y*W+x — co-op can have several pods drilling at once. */
  private holds = new Map<number, number>();
  /** Animated cells, keyed y*W+x (values = tile coords). Rebuilt on repaint. */
  private lavaCells = new Map<number, { x: number; y: number }>();
  private gasCells = new Map<number, { x: number; y: number }>();
  private phase = 0;

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

  /**
   * Keep painting `tile` at (x,y) although the sim already cleared the cell —
   * the block must read solid until the drill is through (the sim breaks it
   * at the authentic 15 px point, well before the 40 px traversal ends).
   * The collectible overlay is dropped while held: the gem pops early with
   * the collect event; the remaining rock keeps grinding away.
   */
  setHolds(cells: Array<{ x: number; y: number; tile: number }>): void {
    const next = new Map<number, number>();
    for (const c of cells) next.set(c.y * WORLD_W + c.x, c.tile);
    // Repaint cells that left or changed, then cells that are new/different.
    for (const [key, tile] of this.holds) {
      if (next.get(key) !== tile) {
        this.holds.delete(key);
        this.paint(key % WORLD_W, Math.floor(key / WORLD_W));
      }
    }
    for (const [key, tile] of next) {
      if (this.holds.get(key) !== tile) {
        this.holds.set(key, tile);
        this.paint(key % WORLD_W, Math.floor(key / WORLD_W));
      }
    }
  }

  releaseHold(): void {
    this.setHolds([]);
  }

  /** Advance the lava/gas animation one phase (call ~6×/second). */
  cycle(): void {
    this.phase = (this.phase + 1) % 4;
    const I = this.meta.index;
    for (const { x, y } of this.lavaCells.values()) {
      this.base.putTileAt(I[`lava${(this.phase + x + y) % 4}`], x, y);
    }
    if (this.gasHint) {
      for (const { x, y } of this.gasCells.values()) {
        this.overlay.putTileAt(I[`gasShimmer${(this.phase + x) % 4}`], x, y);
      }
    }
  }

  /** Positions of currently-known lava cells near a world point (for ember FX). */
  lavaCellsNear(px: number, py: number, radiusPx: number): Array<{ x: number; y: number }> {
    const out: Array<{ x: number; y: number }> = [];
    for (const c of this.lavaCells.values()) {
      const cx = (c.x + 0.5) * TILE_PX;
      const cy = (c.y + 0.5) * TILE_PX;
      if (Math.abs(cx - px) < radiusPx && Math.abs(cy - py) < radiusPx) out.push(c);
    }
    return out;
  }

  repaintAll(): void {
    this.lavaCells.clear();
    this.gasCells.clear();
    for (let y = 0; y < WORLD_H; y++) this.repaintRow(y);
  }

  repaintRows(rows: number[]): void {
    for (const y of rows) {
      // drop stale animated cells on these rows, then repaint
      for (const [k, c] of this.lavaCells) if (c.y === y) this.lavaCells.delete(k);
      for (const [k, c] of this.gasCells) if (c.y === y) this.gasCells.delete(k);
      this.repaintRow(y);
    }
  }

  repaintRow(y: number): void {
    for (let x = 0; x < WORLD_W; x++) this.paint(x, y);
  }

  paint(x: number, y: number): void {
    const heldTile = this.holds.get(y * WORLD_W + x);
    const held = heldTile !== undefined;
    const t = held ? heldTile : getTile(this.state.world, x, y);
    const key = y * WORLD_W + x;
    if (isLava(t)) this.lavaCells.set(key, { x, y });
    else this.lavaCells.delete(key);
    if (isGas(t)) this.gasCells.set(key, { x, y });
    else this.gasCells.delete(key);

    const ix = this.frameFor(t, x, y);
    if (ix < 0) this.base.removeTileAt(x, y);
    else this.base.putTileAt(ix, x, y);
    const ov = held ? -1 : this.overlayFor(t, x, y);
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
    if (isLava(t)) return I[`lava${(this.phase + x + y) % 4}`];
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

  private overlayFor(t: number, x: number, _y: number): number {
    const I = this.meta.index;
    if (isMineral(t) || isArtifact(t)) return I[`gem${t - 6}`];
    if (t === Tile.Slate) return I.slate;
    if (isGas(t) && this.gasHint) return I[`gasShimmer${(this.phase + x) % 4}`];
    return -1;
  }
}
