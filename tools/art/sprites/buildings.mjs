import { P } from '../palette.mjs';
/**
 * Surface buildings — parametric bodies (walls/roof ramps, doors, windows) with
 * distinct silhouettes + grid-authored toppers/signs per building:
 * 0 fuel (pump canopy) · 1 processor (smelter chimney) · 2 outfitter (gantry crane)
 * 3 item shop (wrench sign) · 4 save station (antenna dome).
 */
import { Sprite, texRng } from '../png.mjs';

const W = 150;
const H = 100;

const WALL_RAMPS = [
  { light: P.cornflower, base: P.venicBlue, shadow: P.deepKoamaru },
  { light: P.atlantis, base: P.elfGreen, shadow: P.dell },
  { light: P.plum, base: P.clairvoyant, shadow: P.loulou },
  { light: P.twine, base: P.stinger, shadow: P.verdigris },
  { light: P.royalBlue, base: P.deepKoamaru, shadow: P.valhalla },
];
const SIGN_COLORS = [P.goldenFizz, P.white, P.plum, P.mandy, P.viking];

export function buildingFrame(i) {
  const s = new Sprite(W, H);
  const r = WALL_RAMPS[i];
  const rnd = texRng(0xb17d + i * 31);

  // Body with left-lit wall.
  s.rect(8, 34, W - 16, H - 34, r.base);
  s.rect(8, 34, 5, H - 34, r.light);
  s.rect(W - 13, 34, 5, H - 34, r.shadow);
  // Panel seams.
  for (let x = 30; x < W - 20; x += 24) s.rect(x, 38, 1, H - 42, r.shadow);
  // Roof: overhanging slab, lit top.
  s.rect(2, 26, W - 4, 10, P.smokeyAsh);
  s.rect(2, 26, W - 4, 3, P.heather);
  s.rect(2, 34, W - 4, 2, P.valhalla);
  // Door (centered, recessed).
  s.rect(62, 62, 26, 38, P.valhalla);
  s.rect(64, 64, 22, 36, P.opal);
  s.rect(64, 64, 22, 3, P.black);
  s.hline(66, 84, 80, P.smokeyAsh);
  // Windows with frames + glow.
  for (const wx of [22, 108]) {
    s.rect(wx, 44, 22, 16, P.valhalla);
    s.rect(wx + 2, 46, 18, 12, P.viking);
    s.rect(wx + 2, 46, 18, 4, P.lightSteel);
    s.rect(wx + 2, 52, 8, 6, P.venicBlue);
  }
  // Sign board above the door.
  s.rect(30, 6, 90, 20, P.valhalla);
  s.rect(32, 8, 86, 16, SIGN_COLORS[i]);
  s.rect(32, 8, 86, 2, P.white);
  s.rect(32, 22, 86, 2, P.opal);
  // Sign glyph strokes (abstract lettering).
  for (let x = 40; x < 110; x += 9) {
    const hgt = 6 + Math.floor(rnd() * 5);
    s.rect(x, 12 + (11 - hgt) / 2, 3, hgt, P.valhalla);
  }
  s.rect(28, 4, 2, 24, P.smokeyAsh); // sign posts
  s.rect(120, 4, 2, 24, P.smokeyAsh);

  // --- distinct toppers ---
  switch (i) {
    case 0: {
      // fuel: pump island + canopy pole + hose
      s.rect(126, 60, 16, 40, P.mandy);
      s.rect(126, 60, 16, 4, P.white);
      s.rect(128, 68, 12, 10, P.lightSteel); // meter
      s.rect(130, 70, 8, 3, P.valhalla);
      s.rect(140, 56, 3, 20, P.smokeyAsh); // hose arm
      s.rect(140, 74, 6, 3, P.valhalla);
      break;
    }
    case 1: {
      // processor: chimney with ember glow + hopper
      s.rect(100, 2, 18, 26, P.smokeyAsh);
      s.rect(100, 2, 4, 26, P.heather);
      s.rect(102, 0, 14, 4, P.valhalla);
      s.px(106, 1, P.tahitiGold);
      s.px(109, 0, P.goldenFizz);
      s.px(112, 1, P.tahitiGold);
      // hopper chute on the left
      s.poly(
        [
          [10, 44],
          [34, 44],
          [28, 62],
          [16, 62],
        ],
        P.smokeyAsh,
      );
      s.rect(16, 60, 12, 3, P.valhalla);
      break;
    }
    case 2: {
      // outfitter: rooftop gantry crane holding a pod chassis
      s.rect(16, 2, 4, 26, P.smokeyAsh);
      s.rect(118, 2, 4, 26, P.smokeyAsh);
      s.rect(14, 2, 112, 4, P.heather);
      s.rect(66, 6, 2, 10, P.valhalla); // cable
      s.rect(58, 16, 18, 8, P.tahitiGold); // hanging chassis
      s.rect(58, 16, 18, 2, P.pancho);
      break;
    }
    case 3: {
      // item shop: big wrench emblem over the sign
      s.circle(24, 12, 7, P.heather);
      s.circle(24, 12, 3, P.valhalla);
      s.rect(27, 12, 18, 5, P.heather);
      s.rect(43, 10, 6, 9, P.heather);
      s.rect(45, 12, 4, 5, P.valhalla);
      break;
    }
    default: {
      // save station: dome + blinking antenna
      s.circle(75, 22, 14, P.heather);
      s.circle(72, 19, 9, P.lightSteel);
      s.rect(74, 0, 2, 12, P.smokeyAsh);
      s.circle(75, 1, 2, P.mandy);
      break;
    }
  }

  // Ground shadow strip.
  s.rect(4, H - 2, W - 8, 2, P.valhalla);
  return s;
}
