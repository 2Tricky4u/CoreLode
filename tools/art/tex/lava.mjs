import { LAVA } from '../palette.mjs';
/** Lava: dark crust islands over bright ember veins; 4 phase frames = baked palette cycling. */
import { Sprite, texRng } from '../png.mjs';

const T = 50;
const HEAT = [LAVA.ember, LAVA.hot, LAVA.core, LAVA.hot]; // cycle gradient

export function lavaTile(variant, phase) {
  const s = new Sprite(T, T);
  const rnd = texRng(0x1afa + variant * 13); // same layout per variant; phase only shifts heat
  // Ember bed.
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const w = Math.sin((x + y * 0.7) * 0.35) + Math.sin(x * 0.18 - y * 0.22);
      const heat = HEAT[(Math.floor((w + 2) * 1.6) + phase) % HEAT.length];
      s.px(x, y, heat);
    }
  }
  // Crust islands (dark, slightly beveled) — the veins glow between them.
  const islands = 7 + Math.floor(rnd() * 3);
  for (let i = 0; i < islands; i++) {
    const cx = Math.floor(rnd() * T);
    const cy = 6 + Math.floor(rnd() * (T - 8));
    const rx = 4 + Math.floor(rnd() * 6);
    const ry = 3 + Math.floor(rnd() * 4);
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (d > 1) continue;
        s.px(cx + x, cy + y, d > 0.6 && x + y < 0 ? LAVA.crustL : LAVA.crust);
      }
    }
  }
  // Bubbles popping on the hottest phase pixels.
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rnd() * T);
    const y = Math.floor(rnd() * T);
    if ((i + phase) % 4 === 0) {
      s.px(x, y, LAVA.core);
      s.px(x + 1, y, LAVA.core);
      s.px(x, y - 1, LAVA.hot);
    }
  }
  // Hot rim at the top edge (reads as heat-glow toward open air).
  for (let x = 0; x < T; x++) {
    if ((x + phase * 3) % 4 !== 0) s.px(x, 0, LAVA.core);
    s.px(x, 1, LAVA.hot);
  }
  return s;
}
