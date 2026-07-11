/**
 * Viewport policy — the single source of truth for how the fixed-design
 * 550×400 play field maps onto an arbitrary (phone…ultrawide) viewport.
 *
 * Pure module: no Phaser, no DOM — imported by both the game layer
 * (GameScene resize handler) and the UI layer (UiRoot --px), and unit-tested.
 *
 * Invariant: the camera zoom never shows LESS world than the designed
 * 550×400 view on either axis — extra screen area reveals more world,
 * it never crops the classic picture.
 */

/** The original fixed render size the game was authored against. */
export const DESIGN_W = 550;
export const DESIGN_H = 400;

/** Zoom snaps down to 1/8 steps — fewer fractional-zoom pixel artifacts. */
export const ZOOM_STEP = 0.125;
/** Never zoom out past this (a 0.5× view already shows a 1100×800 window). */
export const MIN_ZOOM = 0.5;

/**
 * Camera zoom for a given viewport: fit-at-least the design view on both
 * axes, snapped DOWN to the nearest step (down = shows more, never crops).
 */
export function zoomForViewport(w: number, h: number): number {
  const fit = Math.min(w / DESIGN_W, h / DESIGN_H);
  const snapped = Math.floor(fit / ZOOM_STEP) * ZOOM_STEP;
  return Math.max(MIN_ZOOM, snapped);
}

/**
 * The `--px` UI scale for a viewport. Follows the picture zoom, with a
 * legibility floor (1.0 on touch screens — the HUD is authored at 8px) and
 * a ceiling so ultrawide monitors don't get a comically large HUD.
 */
export function uiScaleForViewport(w: number, h: number, coarsePointer: boolean): number {
  const fit = Math.min(w / DESIGN_W, h / DESIGN_H);
  const floor = coarsePointer ? 1.0 : 0.75;
  return Math.min(3, Math.max(floor, fit));
}

export interface ScreenRect {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Placement for a scrollFactor(0) overlay that must cover the whole SCREEN
 * while the camera is zoomed. Phaser scales scrollFactor(0) objects by the
 * camera zoom about the viewport centre, so an origin-(0,0) object placed at
 * ((w/2)(1−1/z), (h/2)(1−1/z)) with scale texSize→viewport/z has local
 * units equal to screen pixels and exactly fills the view.
 */
export function coverScreenRect(
  viewW: number,
  viewH: number,
  zoom: number,
  texW: number,
  texH: number,
): ScreenRect {
  return {
    x: (viewW / 2) * (1 - 1 / zoom),
    y: (viewH / 2) * (1 - 1 / zoom),
    scaleX: viewW / zoom / texW,
    scaleY: viewH / zoom / texH,
  };
}
