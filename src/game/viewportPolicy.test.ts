import { describe, expect, it } from 'vitest';
import {
  DESIGN_H,
  DESIGN_W,
  MIN_ZOOM,
  ZOOM_STEP,
  coverScreenRect,
  uiScaleForViewport,
  zoomForViewport,
} from './viewportPolicy';

/** Screen x of a scrollFactor(0), origin-(0,0) object under camera zoom z. */
const screenX = (objX: number, viewW: number, z: number): number =>
  objX * z + (viewW / 2) * (1 - z);
const screenY = (objY: number, viewH: number, z: number): number =>
  objY * z + (viewH / 2) * (1 - z);

describe('zoomForViewport', () => {
  it('never shows less world than the designed 550×400 view', () => {
    for (let w = 320; w <= 3840; w += 97) {
      for (let h = 320; h <= 2160; h += 89) {
        const z = zoomForViewport(w, h);
        // Visible world window at zoom z:
        expect(w / z).toBeGreaterThanOrEqual(DESIGN_W - 1e-9);
        expect(h / z).toBeGreaterThanOrEqual(DESIGN_H - 1e-9);
      }
    }
  });

  it('snaps down to 1/8 steps and floors at MIN_ZOOM', () => {
    expect(zoomForViewport(550, 400)).toBe(1);
    expect(zoomForViewport(1920, 1080)).toBe(2.625); // min(3.49, 2.7) → floor to 1/8
    expect(zoomForViewport(360, 740)).toBe(0.625); // 360/550 = 0.6545 → snapped down
    expect(zoomForViewport(100, 100)).toBe(MIN_ZOOM); // tiny → clamped
    const z = zoomForViewport(1234, 777);
    expect((z / ZOOM_STEP) % 1).toBeCloseTo(0, 12);
  });

  it('desktop 1920×1080 matches the former FIT sprite size (h-bound)', () => {
    // FIT gave min(1920/550, 1080/400) = 2.7; snapped down to 2.625.
    expect(zoomForViewport(1920, 1080)).toBeCloseTo(2.625);
  });
});

describe('uiScaleForViewport', () => {
  it('applies the touch legibility floor', () => {
    expect(uiScaleForViewport(360, 740, true)).toBe(1);
    expect(uiScaleForViewport(360, 740, false)).toBe(0.75);
  });
  it('tracks the picture and caps at 3', () => {
    expect(uiScaleForViewport(1100, 800, false)).toBe(2);
    expect(uiScaleForViewport(5000, 4000, false)).toBe(3);
  });
});

describe('coverScreenRect', () => {
  it('covers the exact viewport at any zoom (corner round-trips)', () => {
    for (const z of [0.5, 0.625, 1, 2.625, 2.7]) {
      for (const [w, h] of [
        [360, 740],
        [740, 360],
        [1920, 1080],
      ]) {
        const r = coverScreenRect(w, h, z, 275, 200);
        // Top-left corner of the object lands at screen (0,0)…
        expect(screenX(r.x, w, z)).toBeCloseTo(0, 8);
        expect(screenY(r.y, h, z)).toBeCloseTo(0, 8);
        // …and the scaled texture spans exactly the viewport on screen.
        expect(275 * r.scaleX * z).toBeCloseTo(w, 8);
        expect(200 * r.scaleY * z).toBeCloseTo(h, 8);
      }
    }
  });

  it('reduces to identity placement at zoom 1', () => {
    const r = coverScreenRect(550, 400, 1, 550, 400);
    expect(r).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
  });
});
