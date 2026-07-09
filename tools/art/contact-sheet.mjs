#!/usr/bin/env node
/**
 * Vision-loop artifacts:
 *  - contact-sheet.png: every frame ×2 on dual (checker/dark) backgrounds with 3×5-font labels
 *  - mock-scene.png: composed fake screenshots (surface / mid / deep) to judge in-context contrast
 * Written to the session scratchpad (path via ART_OUT env or default ./scratchpad-art).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFrames } from './compose.mjs';
import { P, SOIL_RAMPS } from './palette.mjs';
import { Sprite, writePng } from './png.mjs';

const OUT = process.env.ART_OUT ?? join(process.cwd(), 'scratchpad-art');
mkdirSync(OUT, { recursive: true });

// --- 3×5 pixel font (uppercase + digits + _ -) ---
// biome-ignore format: glyph table
const FONT = {
  A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',
  F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',
  K:'101110100110101',L:'100100100100111',M:'101111111101101',N:'101111111111101',O:'010101101101010',
  P:'110101110100100',Q:'010101101011001',R:'110101110110101',S:'011100010001110',T:'111010010010010',
  U:'101101101101011',V:'101101101010010',W:'101101111111101',X:'101010010010101',Y:'101101010010010',
  Z:'111001010100111','0':'010101101101010','1':'010110010010111','2':'110001010100111','3':'110001010001110',
  '4':'101101111001001','5':'111100110001110','6':'011100110101010','7':'111001010010010','8':'010101010101010',
  '9':'010101011001110','_':'000000000000111','-':'000000111000000',' ':'000000000000000',
};

function drawText(s, x, y, text, color) {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const bits = FONT[ch] ?? FONT['-'];
    for (let i = 0; i < 15; i++) {
      if (bits[i] === '1') s.px(cx + (i % 3), y + Math.floor(i / 3), color);
    }
    cx += 4;
  }
}

function checker(s, x, y, w, h) {
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      const on = (Math.floor(xx / 6) + Math.floor(yy / 6)) % 2 === 0;
      s.px(x + xx, y + yy, on ? [58, 58, 70] : [40, 40, 50]);
    }
}

export function contactSheet(frames) {
  const names = Object.keys(frames).sort();
  const ZOOM = 2;
  const CELL_W = 118;
  const LABEL_H = 8;
  const COLS = 8;
  // measure row heights per band of COLS
  const rows = [];
  for (let i = 0; i < names.length; i += COLS) rows.push(names.slice(i, i + COLS));
  const rowHeights = rows.map((r) => Math.max(...r.map((n) => frames[n].h * ZOOM)) + LABEL_H + 8);
  const W = COLS * CELL_W + 8;
  const H = rowHeights.reduce((a, b) => a + b, 0) + 8;
  const s = new Sprite(W, H);
  s.rect(0, 0, W, H, [24, 22, 34]);
  let y = 4;
  rows.forEach((row, ri) => {
    row.forEach((name, ci) => {
      const f = frames[name];
      const x = 4 + ci * CELL_W;
      const fw = f.w * ZOOM;
      const fh = f.h * ZOOM;
      // split cell: left checker, right dark — sprite drawn across both
      checker(s, x, y, (Math.min(fw + 8, CELL_W - 6) / 2) | 0, fh + 4);
      s.rect(
        x + ((Math.min(fw + 8, CELL_W - 6) / 2) | 0),
        y,
        (Math.min(fw + 8, CELL_W - 6) / 2) | 0,
        fh + 4,
        [15, 12, 20],
      );
      const scaled = f.scale(ZOOM);
      s.blit(scaled, x + 4, y + 2);
      drawText(s, x, y + fh + 6, name.slice(0, 28), [203, 219, 252]);
    });
    y += rowHeights[ri];
  });
  writePng(join(OUT, 'contact-sheet.png'), W, H, s.data);
  return join(OUT, 'contact-sheet.png');
}

/** Compose three fake gameplay panels: surface, mid-depth, deep. */
export function mockScene(frames) {
  const TILE = 50;
  const VIEW_W = 11 * TILE; // 550
  const VIEW_H = 6 * TILE; // 300 per panel
  const panels = 3;
  const s = new Sprite(VIEW_W, VIEW_H * panels + (panels - 1) * 4);
  const put = (name, tx, ty, panel) => {
    const f = frames[name];
    s.blit(f, tx * TILE, panel * (VIEW_H + 4) + ty * TILE);
  };
  const sprite = (name, px, py, panel) => {
    s.blit(frames[name], px, panel * (VIEW_H + 4) + py);
  };

  // --- panel 0: surface (sky, turf, buildings, flying pod) ---
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < 11; x++) {
      // sky gradient
      const c = y === 0 ? [26, 18, 32] : y === 1 ? [45, 28, 40] : [80, 46, 44];
      s.rect(x * TILE, y * TILE, TILE, TILE, c);
    }
  for (let x = 0; x < 11; x++) put(x % 2 ? 'turfA' : 'turfB', x, 3, 0);
  for (let x = 0; x < 11; x++) put(`dirt${1 + ((x * 3) % 5)}_p0`, x, 4, 0);
  for (let x = 0; x < 11; x++) put(`dirt${1 + ((x * 7) % 5)}_p0`, x, 5, 0);
  sprite('building0', 30, 50, 0);
  sprite('building4', 360, 50, 0);
  sprite('pod_fly1', 250, 60, 0);

  // --- panel 1: mid depth (band 2, gems, boulder, drilling pod) ---
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 11; x++) put(`dirt${1 + ((x * 5 + y * 3) % 5)}_p2`, x, y, 1);
  // carved tunnel
  for (const [tx, ty] of [
    [4, 0],
    [4, 1],
    [4, 2],
    [5, 2],
    [6, 2],
  ]) {
    s.rect(tx * TILE, VIEW_H + 4 + ty * TILE, TILE, TILE, [16, 12, 22]);
  }
  put('gem2', 2, 1, 1);
  put('gem3', 8, 3, 1);
  put('gem5', 1, 4, 1);
  put('boulder1', 7, 1, 1);
  put('gem10', 9, 5, 1);
  sprite('pod_drill_side1', 6 * TILE, 2 * TILE + 4, 1);

  // --- panel 2: deep (band 4, lava, gas-identical soil, high-tier gems, boss teaser) ---
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 11; x++) put(`dirt${1 + ((x * 2 + y * 7) % 5)}_p4`, x, y, 2);
  put('lava1', 3, 4, 2);
  put('lava2', 4, 4, 2);
  put('gem8', 6, 2, 2);
  put('gem9', 9, 4, 2);
  put('gem7', 1, 2, 2);
  // a "gas" tile is literally a dirt tile — mark position only in the caption
  sprite('pod_idle', 5 * TILE, TILE + 8, 2);
  sprite('boss2_a', 380, 90, 2);

  // captions
  const label = (text, panel) => drawText(s, 4, panel * (VIEW_H + 4) + 2, text, [251, 242, 54]);
  label('SURFACE', 0);
  label('MID BAND 2 - GAS AT 8-0 LOOKS LIKE DIRT', 1);
  label('DEEP BAND 4', 2);

  writePng(join(OUT, 'mock-scene.png'), s.w, s.h, s.data);
  return join(OUT, 'mock-scene.png');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const frames = buildFrames();
  console.log(contactSheet(frames));
  console.log(mockScene(frames));
}
