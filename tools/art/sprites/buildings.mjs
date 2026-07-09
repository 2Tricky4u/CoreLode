import { P } from '../palette.mjs';
/**
 * Surface buildings — five bespoke structures whose silhouette says what they do:
 * 0 fuel     — pump kiosk under a canopy + a big horizontal fuel cylinder on legs
 * 1 processor— smelter: conveyor ramp → hopper → furnace block with a glowing
 *              mouth and a tall ember-topped chimney
 * 2 outfitter— service garage: wide open bay with a pod chassis on a lift,
 *              rooftop gantry crane dangling a drill cone
 * 3 item shop— storefront: striped awning over a display window stocked with
 *              dynamite/fuel cells, crates by the door, big billboard
 * 4 save     — comms bunker: dome roof, lattice mast with a radar dish,
 *              antenna array and a status-light strip
 * Light: top-left. DB32 only, ≤4 shades per material, dark selective framing.
 */
import { Sprite, texRng } from '../png.mjs';

const W = 150;
const H = 100;

const STEEL = { light: P.heather, base: P.smokeyAsh, shadow: P.valhalla };
const RUST = { light: P.twine, base: P.rope, shadow: P.oiledCedar };

/** Lit-left wall slab with panel seams. */
function wall(s, x, y, w, h, r, seams = true) {
  s.rect(x, y, w, h, r.base);
  s.rect(x, y, 3, h, r.light);
  s.rect(x + w - 3, y, 3, h, r.shadow);
  s.rect(x, y, w, 2, r.light);
  if (seams) for (let sx = x + 20; sx < x + w - 8; sx += 22) s.rect(sx, y + 5, 1, h - 7, r.shadow);
}

/** Recessed dark doorway, floor-standing. */
function doorway(s, cx, w = 24, h = 34) {
  const x = cx - w / 2;
  s.rect(x, H - h, w, h, P.valhalla);
  s.rect(x + 2, H - h + 2, w - 4, h - 2, P.opal);
  s.rect(x + 2, H - h + 2, w - 4, 3, P.black);
  s.hline(x + 4, x + w - 5, H - h + 16, P.smokeyAsh);
}

/** Glowing window with frame. */
function winGlow(s, x, y, w = 20, h = 14) {
  s.rect(x, y, w, h, P.valhalla);
  s.rect(x + 2, y + 2, w - 4, h - 4, P.viking);
  s.rect(x + 2, y + 2, w - 4, 3, P.lightSteel);
  s.rect(x + 2, y + h - 6, Math.floor(w / 2) - 2, 4, P.venicBlue);
}

/** Hazard chevrons (gold/dark alternating). */
function hazard(s, x, y, w, h = 4) {
  for (let i = 0; i < w; i++)
    s.rect(x + i, y, 1, h, Math.floor(i / 4) % 2 === 0 ? P.goldenFizz : P.valhalla);
}

/** Sign board with abstract glyph strokes. */
function signBoard(s, x, y, w, h, color, rnd) {
  s.rect(x, y, w, h, P.valhalla);
  s.rect(x + 2, y + 2, w - 4, h - 4, color);
  s.rect(x + 2, y + 2, w - 4, 2, P.white);
  s.rect(x + 2, y + h - 4, w - 4, 2, P.opal);
  for (let gx = x + 8; gx < x + w - 8; gx += 9) {
    const hgt = Math.min(h - 10, 5 + Math.floor(rnd() * 4));
    s.rect(gx, y + (h - hgt) / 2, 3, hgt, P.valhalla);
  }
}

function groundShadow(s) {
  s.rect(4, H - 2, W - 8, 2, P.valhalla);
}

/* ---------------------------------------------------------------- 0 fuel */
function fuelDepot(s, rnd) {
  // Kiosk (left) — small steel booth.
  wall(s, 6, 56, 54, 44, STEEL);
  doorway(s, 30, 20, 30);
  winGlow(s, 42, 62, 14, 10);
  // Canopy over kiosk + pump island, on poles.
  s.rect(64, 60, 3, 40, P.smokeyAsh);
  s.rect(88, 60, 3, 40, P.smokeyAsh);
  s.rect(2, 48, 92, 9, P.smokeyAsh);
  s.rect(2, 48, 92, 3, P.heather);
  s.rect(2, 55, 92, 2, P.valhalla);
  signBoard(s, 8, 30, 52, 16, P.mandy, rnd);
  s.rect(30, 46, 2, 2, P.smokeyAsh);
  // Pump island: concrete kerb + two pumps with meters and hoses.
  s.rect(60, 94, 36, 6, P.topaz);
  s.rect(60, 94, 36, 2, P.heather);
  for (const px of [64, 80]) {
    s.rect(px, 70, 12, 24, P.mandy);
    s.rect(px, 70, 12, 3, P.white);
    s.rect(px, 70, 2, 24, P.brown);
    s.rect(px + 2, 76, 8, 7, P.lightSteel); // meter
    s.rect(px + 3, 78, 6, 2, P.valhalla);
    s.rect(px + 11, 74, 2, 12, P.valhalla); // hose
    s.px(px + 12, 86, P.valhalla);
  }
  // The big fuel cylinder on legs (right) — the tell-from-a-distance shape.
  s.rect(102, 84, 4, 16, P.smokeyAsh);
  s.rect(134, 84, 4, 16, P.smokeyAsh);
  s.rect(101, 82, 38, 3, P.valhalla); // cradle
  s.circle(114, 62, 18, P.heather);
  s.circle(128, 62, 18, P.heather);
  s.rect(114, 44, 14, 37, P.heather);
  // shading: horizontal bands — lit crown, mid base, shadowed underbelly.
  const inTank = (x, y) => {
    const dx = x < 114 ? x - 114 : x > 128 ? x - 128 : 0;
    return dx * dx + (y - 62) * (y - 62) <= 17 * 17;
  };
  for (let y = 46; y <= 52; y++)
    for (let x = 98; x <= 144; x++) if (inTank(x, y)) s.px(x, y, P.lightSteel);
  for (let y = 70; y <= 79; y++)
    for (let x = 98; x <= 144; x++) if (inTank(x, y)) s.px(x, y, P.topaz);
  for (let y = 76; y <= 79; y++)
    for (let x = 98; x <= 144; x++) if (inTank(x, y)) s.px(x, y, P.valhalla);
  for (let y = 48; y < 78; y += 3) s.px(140, y, P.topaz); // end-cap seam
  for (let x = 102; x <= 140; x++) if (inTank(x, 45)) s.px(x, 45, P.lightSteel); // crown glint
  hazard(s, 104, 80, 34);
  // Filler pipe from tank to island.
  s.rect(96, 74, 8, 3, P.smokeyAsh);
  s.rect(96, 74, 3, 22, P.smokeyAsh);
  // Gauge on the tank face.
  s.circle(118, 58, 4, P.white);
  s.px(118, 58, P.mandy);
  s.px(119, 57, P.mandy);
  // Vent + beacon on top.
  s.rect(120, 40, 2, 5, P.smokeyAsh);
  s.px(120, 38, P.mandy);
}

/* ---------------------------------------------------- 1 mineral processor */
function processor(s, rnd) {
  // Furnace block (right, tall) — rust-streaked industrial mass.
  wall(s, 54, 38, 66, 62, RUST);
  for (let i = 0; i < 10; i++) {
    const x = 58 + Math.floor(rnd() * 58);
    s.rect(x, 44 + Math.floor(rnd() * 46), 1, 3 + Math.floor(rnd() * 5), P.oiledCedar);
  }
  // Furnace mouth: framed, molten glow.
  s.rect(72, 72, 32, 28, P.valhalla);
  s.rect(75, 75, 26, 25, P.black);
  s.rect(77, 82, 22, 18, P.tahitiGold);
  s.rect(79, 88, 18, 12, P.goldenFizz);
  s.px(82, 84, P.goldenFizz);
  s.px(92, 80, P.goldenFizz);
  hazard(s, 72, 68, 32);
  // Chimney with ember mouth + drifting smoke.
  s.rect(94, 2, 22, 36, P.smokeyAsh);
  s.rect(94, 2, 4, 36, P.heather);
  s.rect(112, 2, 4, 36, P.valhalla);
  s.rect(92, 0, 26, 4, P.valhalla);
  s.px(100, 1, P.tahitiGold);
  s.px(105, 0, P.goldenFizz);
  s.px(110, 1, P.tahitiGold);
  for (const [sx, sy, al] of [
    [104, -0, 0],
    [118, 6, 140],
    [124, 3, 100],
    [130, 6, 70],
  ])
    s.px(sx, sy, P.heather, al);
  // Side stack pipe.
  s.rect(60, 20, 8, 18, P.smokeyAsh);
  s.rect(60, 20, 2, 18, P.heather);
  s.rect(58, 18, 12, 3, P.valhalla);
  // Conveyor ramp from ground (left) up into the hopper.
  s.poly(
    [
      [4, 96],
      [52, 52],
      [58, 58],
      [10, 100],
    ],
    P.smokeyAsh,
  );
  s.poly(
    [
      [4, 96],
      [52, 52],
      [54, 54],
      [6, 98],
    ],
    P.heather,
  );
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const x = Math.round(8 + (50 - 8) * t);
    const y = Math.round(97 + (55 - 97) * t);
    s.px(x, y, P.valhalla); // rollers
    if (i % 2 === 0)
      s.px(x + 1, y - 3, P.tahitiGold); // ore lumps riding up
    else s.px(x + 1, y - 3, P.twine);
  }
  // legs under the belt
  s.rect(24, 82, 3, 18, P.valhalla);
  s.rect(42, 66, 3, 34, P.valhalla);
  // Hopper feeding the furnace.
  s.poly(
    [
      [46, 40],
      [74, 40],
      [66, 58],
      [54, 58],
    ],
    P.smokeyAsh,
  );
  s.rect(46, 40, 28, 3, P.heather);
  s.rect(54, 56, 12, 3, P.valhalla);
  // Small glowing slit windows.
  s.rect(108, 48, 8, 4, P.tahitiGold);
  s.rect(108, 56, 8, 4, P.tahitiGold);
  groundShadowStripFix(s);
}

// (kept separate so the conveyor can overhang the shadow line cleanly)
function groundShadowStripFix(s) {
  s.rect(12, H - 2, W - 16, 2, P.valhalla);
}

/* ------------------------------------------------------- 2 outfitter garage */
function outfitter(s, rnd) {
  const rampW = { light: P.cornflower, base: P.venicBlue, shadow: P.deepKoamaru };
  // Wide low garage body.
  wall(s, 4, 36, 142, 64, rampW);
  // Big open service bay with rolled-up slat door.
  s.rect(16, 50, 76, 50, P.valhalla);
  s.rect(19, 53, 70, 47, P.opal);
  s.rect(19, 53, 70, 3, P.black);
  for (let y = 56; y < 64; y += 2) s.hline(20, 87, y, P.smokeyAsh); // rolled slats
  // Inside: pod chassis on a hydraulic lift.
  s.rect(30, 92, 46, 4, P.smokeyAsh); // lift platform
  hazard(s, 30, 96, 46, 3);
  s.rect(38, 84, 4, 8, P.valhalla); // pistons
  s.rect(64, 84, 4, 8, P.valhalla);
  s.rect(34, 68, 38, 18, P.tahitiGold); // chassis
  s.rect(34, 68, 38, 3, P.pancho);
  s.rect(34, 83, 38, 3, P.oiledCedar);
  s.rect(40, 72, 10, 6, P.viking); // canopy
  s.px(41, 73, P.lightSteel);
  // Rooftop gantry crane with cable + drill cone.
  s.rect(8, 6, 4, 30, P.smokeyAsh);
  s.rect(136, 6, 4, 30, P.smokeyAsh);
  s.rect(6, 4, 138, 5, P.heather);
  s.rect(6, 8, 138, 1, P.valhalla);
  s.rect(102, 9, 8, 4, P.smokeyAsh); // trolley
  s.rect(105, 13, 2, 12, P.valhalla); // cable
  s.poly(
    [
      [100, 25],
      [112, 25],
      [106, 35],
    ],
    P.heather,
  ); // drill cone
  s.poly(
    [
      [106, 25],
      [112, 25],
      [106, 35],
    ],
    P.smokeyAsh,
  );
  // Tool-board window right of the bay.
  s.rect(102, 52, 34, 26, P.valhalla);
  s.rect(104, 54, 30, 22, P.lightSteel);
  for (let i = 0; i < 4; i++) s.rect(107 + i * 7, 57, 2, 8 + (i % 2) * 6, P.smokeyAsh);
  s.hline(105, 132, 70, P.topaz);
  signBoard(s, 96, 14, 46, 16, P.goldenFizz, rnd);
  groundShadow(s);
}

/* --------------------------------------------------------- 3 item shop */
function itemShop(s, rnd) {
  const rampW = { light: P.atlantis, base: P.elfGreen, shadow: P.dell };
  wall(s, 8, 28, 134, 72, rampW);
  // Billboard on the roof.
  signBoard(s, 26, 2, 96, 22, P.white, rnd);
  // wrench emblem over the board's left end
  s.circle(38, 12, 6, P.mandy);
  s.circle(38, 12, 2, P.white);
  s.rect(42, 10, 14, 4, P.mandy);
  // Striped awning over the display window.
  for (let x = 14; x < 92; x++)
    s.rect(x, 40, 1, 10, Math.floor((x - 14) / 8) % 2 === 0 ? P.mandy : P.white);
  s.rect(14, 40, 78, 2, P.valhalla);
  for (let x = 14; x < 92; x += 4) s.px(x + 2, 50, P.valhalla); // scallop
  // Display window with stocked shelves.
  s.rect(16, 52, 74, 34, P.valhalla);
  s.rect(19, 55, 68, 31, P.viking);
  s.rect(19, 55, 68, 4, P.lightSteel);
  s.hline(20, 86, 70, P.heather); // shelf
  s.hline(20, 86, 84, P.heather);
  // dynamite bundle
  for (let i = 0; i < 3; i++) s.rect(24 + i * 4, 62, 3, 8, P.mandy);
  s.px(27, 60, P.white);
  // fuel cell
  s.rect(44, 61, 8, 9, P.goldenFizz);
  s.rect(44, 61, 8, 2, P.white);
  // repair kit crate
  s.rect(60, 62, 12, 8, P.twine);
  s.rect(60, 65, 12, 2, P.valhalla);
  s.px(65, 63, P.white);
  // teleporter gizmo on the lower shelf
  s.rect(30, 76, 10, 8, P.clairvoyant);
  s.px(34, 74, P.plum);
  s.rect(52, 78, 14, 6, P.smokeyAsh);
  s.rect(52, 78, 14, 2, P.heather);
  // Door (right) + stacked crates by it.
  doorway(s, 112, 24, 36);
  s.rect(128, 82, 16, 18, P.twine);
  s.rect(128, 82, 16, 3, P.pancho);
  s.rect(128, 90, 16, 2, P.valhalla);
  s.rect(132, 68, 12, 14, P.stinger);
  s.rect(132, 68, 12, 2, P.twine);
  groundShadow(s);
}

/* -------------------------------------------------------- 4 save station */
function saveStation(s, rnd) {
  const rampW = { light: P.royalBlue, base: P.deepKoamaru, shadow: P.valhalla };
  // Blockhouse with a dome roof.
  wall(s, 30, 54, 92, 46, rampW);
  s.circle(76, 56, 27, P.heather);
  s.rect(46, 56, 60, 6, P.heather);
  s.circle(70, 50, 16, P.lightSteel); // top-left sheen
  s.rect(48, 58, 56, 4, P.topaz); // dome base band
  for (let i = 0; i < 7; i++) s.px(54 + i * 7, 46 - (i % 2) * 3, P.topaz); // rivets
  // Porthole window + door.
  doorway(s, 76, 22, 32);
  s.circle(50, 74, 7, P.valhalla);
  s.circle(50, 74, 5, P.viking);
  s.px(48, 72, P.lightSteel);
  // Status-light strip (the "your progress is stored" tell).
  s.rect(94, 66, 18, 12, P.valhalla);
  s.px(97, 69, P.christi);
  s.px(101, 69, P.goldenFizz);
  s.px(105, 69, P.mandy);
  s.rect(96, 73, 12, 2, P.opal);
  // Lattice mast (left) with radar dish + beacon.
  s.rect(14, 10, 3, 90, P.smokeyAsh);
  s.rect(20, 10, 3, 90, P.smokeyAsh);
  for (let y = 16; y < 96; y += 10) {
    s.hline(14, 22, y, P.valhalla);
    s.hline(14, 22, y + 5, P.smokeyAsh);
  }
  // Radar dish: rimmed concave bowl tilted up-right, feed strut with beacon tip.
  s.circle(19, 14, 10, P.heather);
  s.circle(21, 16, 8, P.venicBlue); // concave interior (shadow falls low-right)
  s.circle(18, 13, 4, P.viking); // inner sheen toward the light
  for (let a = 0; a < 12; a++)
    s.px(19 + Math.round(Math.cos(a) * 9), 14 + Math.round(Math.sin(a) * 9), P.lightSteel); // rim glints
  s.rect(19, 13, 10, 2, P.smokeyAsh); // feed strut
  s.px(29, 13, P.mandy);
  s.px(29, 12, P.mandy);
  s.rect(18, 0, 2, 6, P.smokeyAsh);
  s.px(18, 0, P.mandy);
  // Antenna array on the dome.
  for (const [ax, ah] of [
    [92, 16],
    [100, 10],
    [108, 20],
  ]) {
    s.rect(ax, 54 - ah, 1, ah, P.smokeyAsh);
    s.px(ax, 53 - ah, ah > 14 ? P.mandy : P.goldenFizz);
  }
  // Cable from mast to dome.
  for (let x = 24; x < 50; x += 2) s.px(x, 22 + Math.floor((x - 24) * 0.8), P.valhalla);
  void rnd;
  groundShadow(s);
}

export function buildingFrame(i) {
  const s = new Sprite(W, H);
  const rnd = texRng(0xb17d + i * 31);
  [fuelDepot, processor, outfitter, itemShop, saveStation][i](s, rnd);
  return s;
}
