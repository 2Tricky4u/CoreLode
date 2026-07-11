/**
 * PWA icons, generated like everything else — no hand-painted assets.
 * The idle pod sprite is nearest-neighbour upscaled onto the game's
 * night-sky background with a subtle rounded frame.
 */
import { Sprite, writePng } from './png.mjs';
import { podFrames } from './sprites/pod.mjs';

const BG = [0x14, 0x0c, 0x1c]; // canvas/night background (#140c1c)
const FRAME = [0x45, 0x28, 0x3c]; // dusk purple frame accent

function icon(size) {
  const out = new Sprite(size, size);
  out.rect(0, 0, size, size, BG);
  // Rounded-corner mask: clear a 1/12-radius arc from each corner.
  const r = Math.floor(size / 12);
  for (let y = 0; y < r; y++) {
    for (let x = 0; x < r; x++) {
      if ((x - r) ** 2 + (y - r) ** 2 > r * r) {
        out.px(x, y, BG, 0);
        out.px(size - 1 - x, y, BG, 0);
        out.px(x, size - 1 - y, BG, 0);
        out.px(size - 1 - x, size - 1 - y, BG, 0);
      }
    }
  }
  // Thin inner frame.
  const m = Math.max(2, Math.floor(size / 48));
  out.rect(r, m, size - 2 * r, m, FRAME);
  out.rect(r, size - 2 * m, size - 2 * r, m, FRAME);
  out.rect(m, r, m, size - 2 * r, FRAME);
  out.rect(size - 2 * m, r, m, size - 2 * r, FRAME);

  // The pod, integer-scaled to ~78% of the icon and centred.
  const pod = podFrames().pod_idle;
  const scale = Math.max(1, Math.floor((size * 0.78) / Math.max(pod.w, pod.h)));
  const w = pod.w * scale;
  const h = pod.h * scale;
  const ox = Math.floor((size - w) / 2);
  const oy = Math.floor((size - h) / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [pr, pg, pb, pa] = pod.get(Math.floor(x / scale), Math.floor(y / scale));
      if (pa > 0) out.px(ox + x, oy + y, [pr, pg, pb], pa);
    }
  }
  return out;
}

for (const size of [192, 512]) {
  const s = icon(size);
  writePng(new URL(`../../public/icon-${size}.png`, import.meta.url).pathname, s.w, s.h, s.data);
  console.log(`icon-${size}.png`);
}
