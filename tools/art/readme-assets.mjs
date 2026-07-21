#!/usr/bin/env node
/**
 * README hero assets, generated from the real art pipeline (same frames the game ships):
 *  - docs/readme/banner.png       pixel logo over a surface scene
 *  - docs/readme/play-button.gif  animated "PLAY NOW" button (shimmer sweep)
 *  - docs/readme/gem-row.png      collectible divider strip
 *  - docs/readme/demo.gif         synthetic dig reel: surface → bands → the boss cavern
 *                                 (not referenced by the README, which uses a live
 *                                 capture at docs/readme/gameplay.gif — this one is the
 *                                 always-reproducible fallback)
 * Everything is DB32, top-left lit, and composed from buildFrames() output —
 * these assets can never drift from the actual game art.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFrames } from './compose.mjs';
import { P } from './palette.mjs';
import { Sprite, texRng, writePng } from './png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'readme');
mkdirSync(OUT, { recursive: true });

const frames = buildFrames();
const T = 50;

// ---------------------------------------------------------------- text -----
// biome-ignore format: glyph table
const FONT3 = {
  A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',
  F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',
  K:'101110100110101',L:'100100100100111',M:'101111111101101',N:'101111111111101',O:'010101101101010',
  P:'110101110100100',Q:'010101101011001',R:'110101110110101',S:'011100010001110',T:'111010010010010',
  U:'101101101101011',V:'101101101010010',W:'101101111111101',X:'101010010010101',Y:'101101010010010',
  Z:'111001010100111','0':'010101101101010','1':'010110010010111','2':'110001010100111','3':'110001010001110',
  '4':'101101111001001','5':'111100110001110','6':'011100110101010','7':'111001010010010','8':'010101010101010',
  '9':'010101011001110','_':'000000000000111','-':'000000111000000',' ':'000000000000000',
  '.':'000000000000010','$':'011110011011110','+':'000010111010000',
};

function text3(s, x, y, str, color, zoom = 1) {
  let cx = x;
  for (const ch of str.toUpperCase()) {
    const bits = FONT3[ch] ?? FONT3['-'];
    for (let i = 0; i < 15; i++) {
      if (bits[i] === '1')
        s.rect(cx + (i % 3) * zoom, y + Math.floor(i / 3) * zoom, zoom, zoom, color);
    }
    cx += 4 * zoom;
  }
  return cx - x;
}
const text3w = (str, zoom = 1) => str.length * 4 * zoom;

// 5×7 chunky logo font — only the letters CORELODE needs.
// biome-ignore format: glyph table
const FONT5 = {
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
};

/** Gold-ramped logo text with a black rim, drawn at pixel zoom z. */
function logoText(str, z) {
  const w = str.length * 6 * z + 2;
  const h = 7 * z + 2;
  const s = new Sprite(w, h);
  const rowColor = (r) => (r < 2 ? P.goldenFizz : r < 5 ? P.tahitiGold : P.stinger);
  const stamp = (dx, dy, colorOf) => {
    let cx = 1 + dx;
    for (const ch of str) {
      const g = FONT5[ch];
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < 5; c++)
          if (g[r][c] === '#') s.rect(cx + c * z, 1 + dy + r * z, z, z, colorOf(r));
      cx += 6 * z;
    }
  };
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    stamp(dx, dy, () => P.black);
  stamp(0, 0, rowColor);
  return s;
}

// -------------------------------------------------------------- gif io -----
function lzw(minCodeSize, indexes) {
  const CLEAR = 1 << minCodeSize;
  const EOI = CLEAR + 1;
  let next = EOI + 1;
  let size = minCodeSize + 1;
  let table = new Map();
  const bytes = [];
  let acc = 0;
  let nbits = 0;
  const emit = (code) => {
    acc |= code << nbits;
    nbits += size;
    while (nbits >= 8) {
      bytes.push(acc & 0xff);
      acc >>>= 8;
      nbits -= 8;
    }
  };
  emit(CLEAR);
  let prev = indexes[0];
  for (let i = 1; i < indexes.length; i++) {
    const k = indexes[i];
    const key = (prev << 8) | k;
    const hit = table.get(key);
    if (hit !== undefined) {
      prev = hit;
      continue;
    }
    emit(prev);
    if (next === 4096) {
      emit(CLEAR);
      next = EOI + 1;
      size = minCodeSize + 1;
      table = new Map();
    } else {
      if (next >= 1 << size) size++;
      table.set(key, next++);
    }
    prev = k;
  }
  emit(prev);
  emit(EOI);
  if (nbits > 0) bytes.push(acc & 0xff);
  return Buffer.from(bytes);
}

/** Looping GIF89a from index frames over one global 256-color table. */
function writeGif(path, w, h, indexFrames, palette, delays) {
  if (palette.length > 256) throw new Error(`palette overflow: ${palette.length} colors`);
  const parts = [Buffer.from('GIF89a', 'ascii')];
  const lsd = Buffer.alloc(7);
  lsd.writeUInt16LE(w, 0);
  lsd.writeUInt16LE(h, 2);
  lsd[4] = 0xf7; // global table, 8 bpp, 256 entries
  parts.push(lsd);
  const gct = Buffer.alloc(256 * 3);
  palette.forEach((c, i) => gct.set(c, i * 3));
  parts.push(gct);
  parts.push(
    Buffer.concat([
      Buffer.from([0x21, 0xff, 0x0b]),
      Buffer.from('NETSCAPE2.0', 'ascii'),
      Buffer.from([3, 1, 0, 0, 0]),
    ]),
  );
  indexFrames.forEach((idx, i) => {
    const gce = Buffer.from([0x21, 0xf9, 4, 0x04, 0, 0, 0, 0]);
    gce.writeUInt16LE(delays[i], 4);
    parts.push(gce);
    const id = Buffer.alloc(10);
    id[0] = 0x2c;
    id.writeUInt16LE(w, 5);
    id.writeUInt16LE(h, 7);
    parts.push(id, Buffer.from([8]));
    const data = lzw(8, idx);
    for (let o = 0; o < data.length; o += 255) {
      const block = data.subarray(o, o + 255);
      parts.push(Buffer.from([block.length]), block);
    }
    parts.push(Buffer.from([0]));
  });
  parts.push(Buffer.from([0x3b]));
  writeFileSync(path, Buffer.concat(parts));
}

/** Quantize an opaque Sprite to palette indexes, growing `palette`/`lut` as needed. */
function toIndexes(s, palette, lut) {
  const idx = Buffer.alloc(s.w * s.h);
  for (let i = 0; i < s.w * s.h; i++) {
    const key = (s.data[i * 4] << 16) | (s.data[i * 4 + 1] << 8) | s.data[i * 4 + 2];
    let v = lut.get(key);
    if (v === undefined) {
      v = palette.length;
      palette.push([s.data[i * 4], s.data[i * 4 + 1], s.data[i * 4 + 2]]);
      lut.set(key, v);
    }
    idx[i] = v;
  }
  return idx;
}

/** Alpha-threshold blit: GIF has no alpha, so translucent art pixels snap to opaque. */
function stamp(dst, src, dx, dy) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      if (src.data[(y * src.w + x) * 4 + 3] < 128) continue;
      const i = (y * src.w + x) * 4;
      dst.px(dx + x, dy + y, [src.data[i], src.data[i + 1], src.data[i + 2]]);
    }
}

// -------------------------------------------------------------- banner -----
function banner() {
  const W = 480;
  const H = 135;
  const s = new Sprite(W, H);
  // dusk gradient, same hues as the surface mock scene
  const bands = [
    [40, [16, 12, 24]],
    [70, [26, 18, 32]],
    [95, [45, 28, 40]],
    [118, [80, 46, 44]],
  ];
  let y0 = 0;
  for (const [y1, c] of bands) {
    s.rect(0, y0, W, y1 - y0, c);
    y0 = y1;
  }
  const rnd = texRng(0xc0de);
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(rnd() * W);
    const y = Math.floor(rnd() * 66);
    s.px(x, y, rnd() < 0.2 ? P.white : P.lightSteel, rnd() < 0.5 ? 255 : 140);
  }
  for (let x = 0; x < W; x += T) stamp(s, frames[(x / T) % 2 ? 'turfA' : 'turfB'], x, 118);
  stamp(s, frames.building1, 8, 118 - frames.building1.h);
  stamp(s, frames.building4, W - frames.building4.w - 8, 118 - frames.building4.h);
  stamp(s, frames.icon3, 150, 96);
  stamp(s, frames.icon8, W - 176, 94);

  // the pod, mid-drill into the turf, dead center — the whole pitch in one sprite
  const pod = frames.pod_drill_down0;
  const podX = (W - pod.w) >> 1;
  stamp(s, pod, podX, 122 - pod.h);
  s.rect(podX + (pod.w >> 1) - 2, 119, 2, 2, P.white);
  s.rect(podX + (pod.w >> 1) + 3, 121, 2, 2, P.goldenFizz);

  const logo = logoText('CORELODE', 4);
  s.blit(logo, (W - logo.w) >> 1, 18);
  const sub = 'DIG DEEP. GET RICH. READ YOUR CONTRACT.';
  const sx = (W - text3w(sub)) >> 1;
  text3(s, sx + 1, 59, sub, P.black);
  text3(s, sx, 58, sub, P.lightSteel);

  const big = s.scale(2);
  writePng(join(OUT, 'banner.png'), big.w, big.h, big.data);
}

// --------------------------------------------------------- play button -----
function playButton() {
  const W = 174;
  const H = 44;
  const face = [34, 32, 52];
  const faceLit = [50, 48, 76];
  const base = new Sprite(W, H);
  base.rect(0, 0, W, H, P.black);
  base.rect(2, 2, W - 4, H - 4, face);
  base.rect(2, 2, W - 4, 2, P.goldenFizz); // bevel: light source top-left
  base.rect(2, 2, 2, H - 4, P.goldenFizz);
  base.rect(2, H - 4, W - 4, 2, P.stinger);
  base.rect(W - 4, 2, 2, H - 4, P.stinger);
  base.poly(
    [
      [16, 14],
      [28, 22],
      [16, 30],
    ],
    P.goldenFizz,
  );
  text3(base, 37, 13, 'PLAY NOW', P.goldenFizz, 4);

  const palette = [];
  const lut = new Map();
  const gifFrames = [];
  const delays = [];
  const goldKey = (P.goldenFizz[0] << 16) | (P.goldenFizz[1] << 8) | P.goldenFizz[2];
  const faceKey = (face[0] << 16) | (face[1] << 8) | face[2];
  const STEPS = 16;
  for (let f = 0; f < STEPS; f++) {
    const s = base.clone();
    if (f < 10) {
      const bandX = -40 + (f * (W + 80)) / 10;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const d = x - y - bandX;
          if (d < 0 || d > 16) continue;
          const i = (y * W + x) * 4;
          const key = (s.data[i] << 16) | (s.data[i + 1] << 8) | s.data[i + 2];
          if (key === goldKey) s.px(x, y, P.white);
          else if (key === faceKey) s.px(x, y, faceLit);
        }
    }
    gifFrames.push(toIndexes(s.scale(2), palette, lut));
    delays.push(f < 10 ? 6 : 20);
  }
  writeGif(join(OUT, 'play-button.gif'), W * 2, H * 2, gifFrames, palette, delays);
}

// -------------------------------------------------------------- gem row ----
function gemRow() {
  const Z = 2;
  const GAP = 12;
  const n = 14;
  const s = new Sprite(n * 24 * Z + (n - 1) * GAP, 24 * Z);
  for (let i = 0; i < n; i++) s.blit(frames[`icon${i}`].scale(Z), i * (24 * Z + GAP), 0);
  writePng(join(OUT, 'gem-row.png'), s.w, s.h, s.data);
}

// ----------------------------------------------------------------- demo ----
function demo() {
  const COLS = 11;
  const VIEW_H = 300;
  const W = COLS * T; // 550
  const SHAFT = 5;
  const ROWS = 26;
  const WORLD_H = ROWS * T;
  const SURFACE = 3 * T;
  const bandFor = (r) => (r <= 7 ? 0 : r <= 11 ? 1 : r <= 15 ? 2 : r <= 18 ? 3 : r <= 21 ? 4 : 5);
  const inCavern = (c, r) => r >= 22 && r <= 24 && c >= 3 && c <= 8;
  const lavaCells = new Set(['1,20', '9,21', '2,23', '7,24', '8,24']);
  const boulders = new Set(['3,6', '8,9', '2,13', '7,16', '9,14', '1,19']);
  const gems = [
    { c: 2, r: 5, t: 0 },
    { c: 8, r: 6, t: 1 },
    { c: 5, r: 6, t: 1 },
    { c: 1, r: 9, t: 2 },
    { c: 9, r: 10, t: 3 },
    { c: 5, r: 10, t: 3 },
    { c: 3, r: 12, t: 4 },
    { c: 8, r: 14, t: 5 },
    { c: 5, r: 13, t: 4 },
    { c: 1, r: 16, t: 6 },
    { c: 9, r: 17, t: 6 },
    { c: 5, r: 17, t: 7 },
    { c: 2, r: 19, t: 8 },
    { c: 9, r: 20, t: 9 },
    { c: 5, r: 20, t: 8 },
    { c: 3, r: 24, t: 12 },
    { c: 6, r: 24, t: 9 },
  ];
  const VALUE = [15, 40, 90, 180, 350, 700, 1200, 2000, 3500, 6000, 0, 0, 5000, 0];
  for (const g of gems) g.got = false;

  const podW = frames.pod_idle.w;
  const podH = frames.pod_idle.h;
  const podX = SHAFT * T + ((T - podW) >> 1);
  const floorY = 25 * T - podH;

  const palette = [];
  const lut = new Map();
  const gifFrames = [];
  const delays = [];
  const popups = [];
  let cash = 0;
  const rnd = texRng(0xd16);

  // timeline: hover → drill the shaft → drop into the cavern → face the boss
  let podY = SURFACE - podH - 12;
  let phase = 'hover';
  let f = 0;
  let idleLeft = 18;
  while (true) {
    // --- advance ---
    if (phase === 'hover' && f >= 6) phase = 'drill';
    else if (phase === 'drill') {
      podY += 16;
      if (podY >= 22 * T) phase = 'fall';
    } else if (phase === 'fall') {
      podY = Math.min(floorY, podY + 14);
      if (podY === floorY) phase = 'idle';
    } else if (phase === 'idle' && f > 6) {
      idleLeft--;
      if (idleLeft < 0) break;
    }
    for (const g of gems) {
      if (!g.got && g.c === SHAFT && phase === 'drill' && podY + podH >= g.r * T + 26) {
        g.got = true;
        cash += VALUE[g.t];
        popups.push({ x: g.c * T + 4, y: g.r * T - 6, v: VALUE[g.t], ttl: 8 });
      }
    }
    const camY = Math.max(0, Math.min(WORLD_H - VIEW_H, podY - 130));

    // --- render ---
    const s = new Sprite(W, VIEW_H);
    const r0 = Math.floor(camY / T);
    const r1 = Math.min(ROWS - 1, Math.ceil((camY + VIEW_H) / T));
    for (let r = r0; r <= r1; r++)
      for (let c = 0; c < COLS; c++) {
        const y = r * T - camY;
        const x = c * T;
        const dug = c === SHAFT && r >= 3 && r * T < podY + podH;
        if (r < 3) {
          s.rect(x, y, T, T, r === 0 ? [26, 18, 32] : r === 1 ? [45, 28, 40] : [80, 46, 44]);
        } else if (dug || inCavern(c, r)) {
          s.rect(x, y, T, T, [16, 12, 22]);
          if (lavaCells.has(`${c},${r}`)) stamp(s, frames[`lava${Math.floor(f / 3) % 4}`], x, y);
        } else if (lavaCells.has(`${c},${r}`)) {
          stamp(s, frames[`lava${Math.floor(f / 3) % 4}`], x, y);
        } else if (r === 3) {
          stamp(s, frames[c % 2 ? 'turfA' : 'turfB'], x, y);
        } else if (r === 25) {
          stamp(s, frames.bedrock, x, y);
        } else {
          stamp(s, frames[`dirt${1 + ((c * 7 + r * 13) % 5)}_p${bandFor(r)}`], x, y);
          if (boulders.has(`${c},${r}`)) stamp(s, frames[`boulder${(c + r) % 3}`], x, y);
        }
      }
    if (camY < SURFACE) {
      stamp(s, frames.building1, 18, SURFACE - frames.building1.h - camY);
      stamp(s, frames.building3, 396, SURFACE - frames.building3.h - camY);
    }
    for (const g of gems) {
      if (g.got) continue;
      const y = g.r * T - camY;
      if (y > -T && y < VIEW_H) stamp(s, frames[`gem${g.t}`], g.c * T, y);
    }
    if (camY + VIEW_H > 22 * T) {
      const boss = frames[Math.floor(f / 4) % 2 ? 'boss2_b' : 'boss2_a'];
      stamp(s, boss, 330, 25 * T - boss.h - camY);
    }
    const podFrame =
      phase === 'drill'
        ? frames[`pod_drill_down${f % 4}`]
        : phase === 'fall'
          ? frames[f % 2 ? 'pod_fly1' : 'pod_fly0']
          : frames[phase === 'hover' ? (f % 2 ? 'pod_fly1' : 'pod_fly0') : 'pod_idle'];
    stamp(s, podFrame, podX, podY - camY);
    if (phase === 'drill') {
      for (let i = 0; i < 3; i++) {
        const jx = podX + (podW >> 1) - 3 + Math.floor(rnd() * 7);
        const jy = podY + podH - 2 + Math.floor(rnd() * 4);
        s.rect(jx, jy - camY, 2, 2, i === 0 ? P.white : P.goldenFizz);
      }
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      text3(s, p.x + 1, p.y - camY + 1, `+$${p.v}`, P.black, 2);
      text3(s, p.x, p.y - camY, `+$${p.v}`, P.goldenFizz, 2);
      p.y -= 5;
      if (--p.ttl <= 0) popups.splice(i, 1);
    }
    if (phase === 'idle') {
      const msg = 'PLAY IT IN YOUR BROWSER';
      const mx = (W - text3w(msg, 2)) >> 1;
      text3(s, mx + 1, 41, msg, P.black, 2);
      text3(s, mx, 40, msg, P.goldenFizz, 2);
    }
    // HUD
    s.rect(0, 0, W, 16, [10, 8, 16]);
    s.hline(0, W - 1, 16, P.valhalla);
    const ft = Math.max(0, Math.floor((podY - SURFACE + podH) / T) * 55);
    text3(s, 6, 3, `DEPTH ${String(ft).padStart(4, '0')} FT`, P.lightSteel, 2);
    const cashTxt = `$${cash}`;
    text3(s, W - 6 - text3w(cashTxt, 2), 3, cashTxt, P.goldenFizz, 2);

    gifFrames.push(toIndexes(s, palette, lut));
    delays.push(phase === 'idle' && idleLeft === 0 ? 120 : 9);
    f++;
    if (f > 400) throw new Error('demo timeline never terminated');
  }
  writeGif(join(OUT, 'demo.gif'), W, VIEW_H, gifFrames, palette, delays);
  return { frameCount: gifFrames.length, colors: palette.length };
}

banner();
playButton();
gemRow();
const stats = demo();
console.log(`readme assets → ${OUT} (demo: ${stats.frameCount} frames, ${stats.colors} colors)`);
