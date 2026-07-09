#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * Procedural pixel-art atlas generator (clean-room placeholder art, DB32 palette).
 * Zero dependencies: writes the PNG by hand via node:zlib.
 * Output: public/atlas/game.png + game.json (Phaser 3 atlas JSON-hash format).
 */
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- tiny PNG writer ----------
const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = ~0;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function writePng(path, width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

// ---------- DB32 palette (public domain, DawnBringer) ----------
const P = {
  black: [0, 0, 0],
  valhalla: [34, 32, 52],
  loulou: [69, 40, 60],
  oiledCedar: [102, 57, 49],
  rope: [143, 86, 59],
  tahitiGold: [223, 113, 38],
  twine: [217, 160, 102],
  pancho: [238, 195, 154],
  goldenFizz: [251, 242, 54],
  atlantis: [153, 229, 80],
  christi: [106, 190, 48],
  elfGreen: [55, 148, 110],
  dell: [75, 105, 47],
  verdigris: [82, 75, 36],
  opal: [50, 60, 57],
  deepKoamaru: [63, 63, 116],
  venicBlue: [48, 96, 130],
  royalBlue: [91, 110, 225],
  cornflower: [99, 155, 255],
  viking: [95, 205, 228],
  lightSteel: [203, 219, 252],
  white: [255, 255, 255],
  heather: [155, 173, 183],
  topaz: [132, 126, 135],
  dimGray: [105, 106, 106],
  smokeyAsh: [89, 86, 82],
  clairvoyant: [118, 66, 138],
  brown: [172, 50, 50],
  mandy: [217, 87, 99],
  plum: [215, 123, 186],
  rainForest: [143, 151, 74],
  stinger: [138, 111, 48],
};

// depth palettes: surface ochre → rust → crimson → charred violet
const SOIL_PALETTES = [
  { base: P.rope, dark: P.oiledCedar, spec: P.twine },
  { base: P.oiledCedar, dark: P.loulou, spec: P.rope },
  { base: P.stinger, dark: P.verdigris, spec: P.twine },
  { base: P.brown, dark: P.loulou, spec: P.mandy },
  { base: P.loulou, dark: P.valhalla, spec: P.clairvoyant },
  { base: P.valhalla, dark: P.black, spec: P.deepKoamaru },
];
const GEM_COLORS = [
  P.smokeyAsh, // ferrite
  P.tahitiGold, // bronzite
  P.lightSteel, // argentite
  P.goldenFizz, // aurite
  P.heather, // platinite
  P.viking, // einsteinium
  P.christi, // emerald
  P.mandy, // ruby
  P.white, // diamond
  P.plum, // amazonite
  P.pancho, // fossil
  P.stinger, // cache
  P.heather, // xeno skeleton
  P.goldenFizz, // sacred idol
];

// ---------- frame drawing ----------
let seed = 0xa5f3;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

class Sprite {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4);
  }
  px(x, y, c, a = 255) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = a;
  }
  rect(x, y, w, h, c, a = 255) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c, a);
  }
  outline(c) {
    this.rect(0, 0, this.w, 1, c);
    this.rect(0, this.h - 1, this.w, 1, c);
    this.rect(0, 0, 1, this.h, c);
    this.rect(this.w - 1, 0, 1, this.h, c);
  }
  circle(cx, cy, r, c, a = 255) {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) this.px(cx + x, cy + y, c, a);
  }
  diamond(cx, cy, r, c) {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) if (Math.abs(x) + Math.abs(y) <= r) this.px(cx + x, cy + y, c);
  }
}

const T = 50;
function soilTile(pal, variant) {
  const s = new Sprite(T, T);
  s.rect(0, 0, T, T, pal.base);
  seed = 1000 + variant * 77;
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(rnd() * T);
    const y = Math.floor(rnd() * T);
    s.px(x, y, rnd() < 0.6 ? pal.dark : pal.spec, 160);
  }
  // chunky clods
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(rnd() * (T - 8));
    const y = Math.floor(rnd() * (T - 8));
    s.rect(x, y, 3 + Math.floor(rnd() * 4), 2 + Math.floor(rnd() * 3), pal.dark, 200);
  }
  s.outline(pal.dark);
  return s;
}
function turfTile(v) {
  const s = soilTile(SOIL_PALETTES[0], v);
  s.rect(0, 0, T, 9, P.brown);
  s.rect(0, 0, T, 4, P.mandy);
  for (let x = 0; x < T; x += 3) s.px(x, 9 + (x % 2), P.loulou);
  return s;
}
function boulderTile(v) {
  const s = new Sprite(T, T);
  s.rect(0, 0, T, T, [0, 0, 0], 0);
  s.circle(25, 27, 21, P.smokeyAsh);
  s.circle(20, 22, 14, P.topaz);
  s.circle(16, 18, 6, P.heather);
  seed = 40 + v;
  for (let i = 0; i < 30; i++) s.px(Math.floor(rnd() * T), Math.floor(rnd() * T), P.dimGray, 120);
  return s;
}
function lavaTile(v) {
  const s = new Sprite(T, T);
  s.rect(0, 0, T, T, P.brown);
  seed = 90 + v * 3;
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(rnd() * T);
    const y = Math.floor(rnd() * T);
    s.px(x, y, rnd() < 0.5 ? P.tahitiGold : P.goldenFizz, 220);
  }
  s.rect(0, 0, T, 3, P.tahitiGold);
  s.outline(P.loulou);
  return s;
}
function barrierTile(v) {
  const s = new Sprite(T, T);
  s.rect(0, 0, T, T, P.valhalla);
  for (let y = 0; y < T; y += 5) s.rect(0, y, T, 1, v ? P.deepKoamaru : P.opal);
  s.outline(P.black);
  return s;
}
function bedrockTile() {
  const s = new Sprite(T, T);
  s.rect(0, 0, T, T, P.opal);
  seed = 7;
  for (let i = 0; i < 90; i++) s.px(Math.floor(rnd() * T), Math.floor(rnd() * T), P.valhalla, 200);
  s.outline(P.black);
  return s;
}
function gemOverlay(i) {
  const s = new Sprite(T, T);
  const c = GEM_COLORS[i];
  if (i < 10) {
    // mineral: cluster of faceted lumps
    s.diamond(18, 22, 7, c);
    s.diamond(31, 30, 9, c);
    s.diamond(27, 15, 5, c);
    s.px(16, 20, P.white);
    s.px(29, 27, P.white);
    s.px(30, 28, P.white);
    s.diamond(18, 22, 7, undefined ?? c); // keep shape solid
    // dark edging
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      s.px(Math.round(31 + Math.cos(a) * 9), Math.round(30 + Math.sin(a) * 9), P.valhalla, 180);
    }
  } else if (i === 10) {
    // fossil — curled skeleton
    s.circle(25, 28, 12, P.pancho);
    s.circle(25, 28, 8, [0, 0, 0], 0);
    s.rect(20, 14, 12, 4, P.pancho);
    s.circle(33, 15, 4, P.pancho);
    s.px(34, 14, P.black);
  } else if (i === 11) {
    // cache — chest
    s.rect(12, 20, 26, 18, P.stinger);
    s.rect(12, 20, 26, 5, P.twine);
    s.rect(23, 26, 4, 6, P.goldenFizz);
    s.rect(12, 20, 1, 18, P.oiledCedar);
    s.rect(37, 20, 1, 18, P.oiledCedar);
  } else if (i === 12) {
    // xeno skeleton
    s.circle(25, 18, 7, P.heather);
    s.circle(22, 17, 2, P.black);
    s.circle(28, 17, 2, P.black);
    s.rect(23, 25, 4, 12, P.heather);
    s.rect(17, 27, 16, 2, P.heather);
    s.rect(18, 31, 14, 2, P.heather);
  } else {
    // sacred idol
    s.rect(20, 12, 10, 22, P.goldenFizz);
    s.circle(25, 12, 6, P.goldenFizz);
    s.rect(16, 34, 18, 4, P.stinger);
    s.px(23, 11, P.black);
    s.px(27, 11, P.black);
  }
  return s;
}
function slateTile() {
  const s = new Sprite(T, T);
  s.rect(10, 12, 30, 26, P.venicBlue);
  s.rect(12, 14, 26, 22, P.royalBlue);
  for (let y = 17; y < 33; y += 4) s.rect(15, y, 20, 1, P.viking);
  s.outline?.(P.black);
  return s;
}

function podFrame(kind, phase) {
  const s = new Sprite(T, T);
  // body
  s.rect(9, 18, 32, 20, P.tahitiGold);
  s.rect(9, 18, 32, 4, P.twine);
  s.rect(13, 10, 20, 10, P.viking); // canopy
  s.rect(15, 12, 10, 5, P.lightSteel);
  s.rect(9, 36, 32, 3, P.smokeyAsh);
  // treads
  s.rect(7, 39, 36, 7, P.valhalla);
  for (let x = 9; x < 42; x += 5) s.rect(x, 41, 2, 3, P.smokeyAsh);
  // drill arm
  if (kind === 'side') {
    s.rect(41, 24, 7, 6, P.heather);
    s.diamond(48 + (phase ? 1 : 0), 27, 4, P.topaz);
  } else {
    s.rect(22, 44 - (phase ? 1 : 0), 6, 5, P.heather);
    s.diamond(25, 49, 4, P.topaz);
  }
  if (kind === 'fly') {
    const fl = phase ? 7 : 10;
    s.rect(14, 46, 5, fl, P.goldenFizz);
    s.rect(31, 46, 5, fl, P.tahitiGold);
  }
  if (kind === 'hurt') {
    for (let i = 0; i < 40; i++)
      s.px(Math.floor(rnd() * T), 18 + Math.floor(rnd() * 20), P.mandy, 150);
  }
  return s;
}

function bossFrame(form, phase) {
  const w = 100;
  const h = 140;
  const s = new Sprite(w, h);
  const body = form === 1 ? P.valhalla : P.brown;
  const accent = form === 1 ? P.mandy : P.tahitiGold;
  // legs
  s.rect(24, 108, 14, 30, body);
  s.rect(62, 108, 14, 30, body);
  if (form === 2) {
    s.circle(31, 136, 7, P.smokeyAsh); // hooves
    s.circle(69, 136, 7, P.smokeyAsh);
  }
  // torso (suit for form1, bare for form2)
  s.rect(18, 52, 64, 60, body);
  if (form === 1) {
    s.rect(44, 52, 12, 46, P.white); // shirt
    s.rect(47, 52, 6, 40, accent); // tie → forked tail hint
    s.rect(44, 92, 12, 8, accent);
  } else {
    s.rect(38, 70, 24, 24, P.goldenFizz); // furnace heart
    s.rect(42, 74, 16, 16, P.tahitiGold);
    if (phase) s.rect(46, 78, 8, 8, P.white);
  }
  // arms
  s.rect(6, 56, 12, 40, body);
  s.rect(82, 56, 12, 40, body);
  if (form === 2) s.rect(82, 92, 16, 10, P.smokeyAsh); // claw
  // head
  s.circle(50, 34, 18, form === 1 ? P.pancho : P.brown);
  // horns
  s.rect(30, 12, 6, 14, form === 1 ? body : P.pancho);
  s.rect(64, 12, 6, 14, form === 1 ? body : P.pancho);
  // eyes
  s.px(43, 30, P.brown);
  s.px(44, 30, P.brown);
  s.rect(55, 28, 6, 4, P.goldenFizz); // monocle glint
  if (form === 2) {
    s.rect(41, 28, 5, 4, P.goldenFizz);
  }
  // staff (form1)
  if (form === 1) s.rect(90, 30, 4, 80, P.smokeyAsh);
  return s;
}

function fxFrames() {
  const out = {};
  for (let i = 0; i < 5; i++) {
    const s = new Sprite(60, 60);
    const r = 6 + i * 6;
    s.circle(30, 30, r, i < 2 ? P.white : i < 3 ? P.goldenFizz : P.tahitiGold, 255 - i * 40);
    s.circle(30, 30, Math.max(2, r - 6), i < 2 ? P.goldenFizz : P.brown, 200 - i * 30);
    out[`boom${i}`] = s;
  }
  for (let i = 0; i < 3; i++) {
    const s = new Sprite(20, 20);
    seed = 300 + i;
    for (let k = 0; k < 14; k++) s.px(Math.floor(rnd() * 20), Math.floor(rnd() * 20), P.twine, 220);
    out[`dust${i}`] = s;
  }
  const gas = new Sprite(40, 40);
  gas.circle(20, 20, 14, P.atlantis, 120);
  gas.circle(14, 14, 8, P.christi, 120);
  out.gasPuff = gas;
  const fb = new Sprite(22, 22);
  fb.circle(11, 11, 9, P.tahitiGold);
  fb.circle(11, 11, 5, P.goldenFizz);
  out.fireball = fb;
  const beam = new Sprite(8, 8);
  beam.rect(0, 0, 8, 8, P.mandy);
  beam.rect(2, 2, 4, 4, P.white);
  out.laserDot = beam;
  const tp = new Sprite(50, 60);
  for (let y = 0; y < 60; y += 3) tp.rect(20 - (y % 6), y, 12 + (y % 8), 1, P.viking, 200);
  out.teleBeam = tp;
  // guardian seraph
  const g = new Sprite(34, 44);
  g.rect(13, 10, 8, 22, P.white);
  g.circle(17, 8, 5, P.pancho);
  g.rect(3, 12, 10, 14, P.lightSteel);
  g.rect(21, 12, 10, 14, P.lightSteel);
  g.circle(17, 2, 6, P.goldenFizz, 140);
  out.guardian = g;
  return out;
}

function buildingFrame(i) {
  const s = new Sprite(150, 100);
  const wall = [P.venicBlue, P.elfGreen, P.clairvoyant, P.stinger, P.deepKoamaru][i];
  const sign = [P.goldenFizz, P.white, P.plum, P.mandy, P.viking][i];
  s.rect(5, 30, 140, 70, wall);
  s.rect(5, 30, 140, 6, P.valhalla);
  s.rect(0, 20, 150, 12, P.smokeyAsh); // roof
  s.rect(60, 62, 30, 38, P.valhalla); // door
  s.rect(15, 45, 26, 18, P.lightSteel); // window
  s.rect(109, 45, 26, 18, P.lightSteel);
  s.rect(20, 2, 110, 20, P.valhalla); // sign board
  s.rect(22, 4, 106, 16, sign);
  if (i === 0) {
    // fuel pump
    s.rect(130, 70, 12, 30, P.mandy);
    s.rect(133, 60, 6, 10, P.smokeyAsh);
  }
  if (i === 4) {
    // antenna for the save station
    s.rect(72, -0, 4, 20, P.heather);
    s.circle(74, 2, 3, P.mandy);
  }
  return s;
}

function iconFrame(i) {
  // 24px cargo/HUD icons reuse gem drawing scaled-ish
  const s = new Sprite(24, 24);
  const c = GEM_COLORS[Math.min(i, GEM_COLORS.length - 1)];
  s.diamond(12, 12, 8, c);
  s.px(9, 9, P.white);
  s.px(10, 9, P.white);
  return s;
}

function portraitFrame(kind) {
  const s = new Sprite(48, 48);
  s.rect(0, 0, 48, 48, P.valhalla);
  if (kind === 'employer' || kind === 'employerTrue') {
    const skin = kind === 'employer' ? P.pancho : P.brown;
    s.circle(24, 20, 12, skin);
    s.rect(14, 32, 20, 14, kind === 'employer' ? P.opal : P.brown);
    s.rect(22, 32, 4, 10, kind === 'employer' ? P.mandy : P.goldenFizz);
    s.rect(28, 16, 6, 4, P.goldenFizz); // monocle
    s.px(18, 17, P.black);
    if (kind === 'employerTrue') {
      s.rect(10, 4, 4, 10, P.pancho);
      s.rect(34, 4, 4, 10, P.pancho);
      s.rect(16, 17, 4, 3, P.goldenFizz);
    }
  } else if (kind === 'minerRig7') {
    s.circle(24, 22, 11, P.pancho);
    s.rect(13, 10, 22, 6, P.stinger); // hard hat
    s.rect(15, 34, 18, 12, P.venicBlue);
    s.px(20, 21, P.black);
    s.px(28, 21, P.black);
    s.rect(18, 27, 12, 2, P.rope); // moustache
  } else if (kind === 'dispatch') {
    s.rect(10, 12, 28, 24, P.opal);
    s.rect(14, 16, 20, 10, P.atlantis);
    s.rect(14, 30, 20, 2, P.atlantis);
  } else if (kind === 'deity') {
    s.circle(24, 24, 14, P.goldenFizz, 160);
    s.circle(24, 24, 8, P.white);
  } else {
    // static
    seed = 999;
    for (let i = 0; i < 500; i++)
      s.px(Math.floor(rnd() * 48), Math.floor(rnd() * 48), rnd() < 0.5 ? P.heather : P.opal);
  }
  return s;
}

// ---------- assemble atlas ----------
const frames = {};
for (let p = 0; p < 6; p++)
  for (let v = 1; v <= 5; v++) frames[`dirt${v}_p${p}`] = soilTile(SOIL_PALETTES[p], v + p * 5);
frames.turfA = turfTile(1);
frames.turfB = turfTile(2);
for (let v = 0; v < 3; v++) frames[`boulder${v}`] = boulderTile(v);
for (let v = 0; v < 3; v++) frames[`lava${v}`] = lavaTile(v);
frames.barrierA = barrierTile(0);
frames.barrierB = barrierTile(1);
frames.bedrock = bedrockTile();
frames.slate = slateTile();
for (let i = 0; i < 14; i++) frames[`gem${i}`] = gemOverlay(i);
frames.pod_idle = podFrame('idle', 0);
frames.pod_fly0 = podFrame('fly', 0);
frames.pod_fly1 = podFrame('fly', 1);
frames.pod_drill_down0 = podFrame('down', 0);
frames.pod_drill_down1 = podFrame('down', 1);
frames.pod_drill_side0 = podFrame('side', 0);
frames.pod_drill_side1 = podFrame('side', 1);
frames.pod_hurt = podFrame('hurt', 0);
frames.boss1_a = bossFrame(1, 0);
frames.boss1_b = bossFrame(1, 1);
frames.boss2_a = bossFrame(2, 0);
frames.boss2_b = bossFrame(2, 1);
Object.assign(frames, fxFrames());
for (let i = 0; i < 5; i++) frames[`building${i}`] = buildingFrame(i);
for (let i = 0; i < 14; i++) frames[`icon${i}`] = iconFrame(i);
for (const k of ['employer', 'employerTrue', 'minerRig7', 'static', 'dispatch', 'deity'])
  frames[`portrait_${k}`] = portraitFrame(k);

// shelf packing
const names = Object.keys(frames);
names.sort((a, b) => frames[b].h - frames[a].h);
const ATLAS_W = 1024;
let cx = 0;
let cy = 0;
let shelfH = 0;
const placed = {};
for (const name of names) {
  const f = frames[name];
  if (cx + f.w + 2 > ATLAS_W) {
    cx = 0;
    cy += shelfH + 2;
    shelfH = 0;
  }
  placed[name] = { x: cx, y: cy };
  cx += f.w + 2;
  if (f.h > shelfH) shelfH = f.h;
}
const ATLAS_H = 1 << Math.ceil(Math.log2(cy + shelfH + 2));
const atlas = Buffer.alloc(ATLAS_W * ATLAS_H * 4);
for (const name of names) {
  const f = frames[name];
  const { x, y } = placed[name];
  for (let yy = 0; yy < f.h; yy++) {
    f.data.copy(atlas, ((y + yy) * ATLAS_W + x) * 4, yy * f.w * 4, (yy + 1) * f.w * 4);
  }
}

const outDir = join(ROOT, 'public', 'atlas');
mkdirSync(outDir, { recursive: true });
writePng(join(outDir, 'game.png'), ATLAS_W, ATLAS_H, atlas);

// ---------- grid tileset for the Phaser tilemap (50×50 cells) ----------
const tileOrder = [];
for (let p = 0; p < 6; p++) for (let v = 1; v <= 5; v++) tileOrder.push(`dirt${v}_p${p}`);
tileOrder.push('turfA', 'turfB', 'barrierA', 'barrierB', 'bedrock', 'slate');
for (let v = 0; v < 3; v++) tileOrder.push(`boulder${v}`);
for (let v = 0; v < 3; v++) tileOrder.push(`lava${v}`);
for (let i = 0; i < 14; i++) tileOrder.push(`gem${i}`);
const COLS = 10;
const rows = Math.ceil(tileOrder.length / COLS);
const tw = COLS * T;
const th = rows * T;
const tbuf = Buffer.alloc(tw * th * 4);
tileOrder.forEach((name, i) => {
  const f = frames[name];
  const gx = (i % COLS) * T;
  const gy = Math.floor(i / COLS) * T;
  for (let yy = 0; yy < f.h; yy++)
    f.data.copy(tbuf, ((gy + yy) * tw + gx) * 4, yy * f.w * 4, (yy + 1) * f.w * 4);
});
writePng(join(outDir, 'tiles.png'), tw, th, tbuf);
writeFileSync(
  join(outDir, 'tiles.json'),
  JSON.stringify({
    columns: COLS,
    tileSize: T,
    index: Object.fromEntries(tileOrder.map((n, i) => [n, i])),
  }),
);
console.log(`tileset: ${tileOrder.length} tiles → public/atlas/tiles.png (${tw}×${th})`);
const json = {
  frames: Object.fromEntries(
    names.map((n) => [
      n,
      {
        frame: { x: placed[n].x, y: placed[n].y, w: frames[n].w, h: frames[n].h },
        rotated: false,
        trimmed: false,
        sourceSize: { w: frames[n].w, h: frames[n].h },
        spriteSourceSize: { x: 0, y: 0, w: frames[n].w, h: frames[n].h },
      },
    ]),
  ),
  meta: { image: 'game.png', size: { w: ATLAS_W, h: ATLAS_H }, scale: '1' },
};
writeFileSync(join(outDir, 'game.json'), JSON.stringify(json));
console.log(`atlas: ${names.length} frames → public/atlas/game.png (${ATLAS_W}×${ATLAS_H})`);
