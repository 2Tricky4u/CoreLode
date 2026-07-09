#!/usr/bin/env node
/** Atlas assembly: all frames → game.png/json (shelf-packed), tiles.png/json (grid), portraits.png strip. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { explosionFrames, miscFx, particleFrames } from './fx.mjs';
import { P } from './palette.mjs';
import { Sprite, texRng, writePng } from './png.mjs';
import { artifactFrames } from './sprites/artifacts.mjs';
import { bossFrames } from './sprites/boss.mjs';
import { buildingFrame } from './sprites/buildings.mjs';
import { carrierFrames } from './sprites/carrier.mjs';
import { podFrames } from './sprites/pod.mjs';
import { portraitFrames } from './sprites/portraits.mjs';
import { gemSprite } from './tex/gems.mjs';
import { lavaTile } from './tex/lava.mjs';
import { barrierTile, bedrockTile, boulderTile } from './tex/rocks.mjs';
import { soilTile, turfTile } from './tex/soil.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const T = 50;

export function buildFrames() {
  const frames = {};

  // --- terrain ---
  for (let band = 0; band < 6; band++)
    for (let v = 1; v <= 5; v++) frames[`dirt${v}_p${band}`] = soilTile(band, v);
  frames.turfA = turfTile(1);
  frames.turfB = turfTile(2);
  for (let v = 0; v < 3; v++) frames[`boulder${v}`] = boulderTile(v);
  for (let ph = 0; ph < 4; ph++) frames[`lava${ph}`] = lavaTile(0, ph);
  frames.barrierA = barrierTile(0);
  frames.barrierB = barrierTile(1);
  frames.bedrock = bedrockTile();

  // Gas shimmer overlay frames (QoL hint only; default hidden) — sparse twinkles.
  for (let ph = 0; ph < 4; ph++) {
    const s = new Sprite(T, T);
    const rnd = texRng(0x6a5 + 1); // same layout each phase; phase moves which twinkle is lit
    for (let i = 0; i < 4; i++) {
      const x = 6 + Math.floor(rnd() * 38);
      const y = 6 + Math.floor(rnd() * 38);
      if (i === ph) {
        s.px(x, y, P.atlantis, 200);
        s.px(x + 1, y, P.christi, 150);
        s.px(x, y + 1, P.christi, 150);
      }
    }
    frames[`gasShimmer${ph}`] = s;
  }

  // --- collectibles ---
  for (let tier = 0; tier < 10; tier++) frames[`gem${tier}`] = gemSprite(tier, T);
  Object.assign(frames, artifactFrames()); // gem10-13 + slate

  // --- icons (24px): minerals via the gem generator, artifacts via scaled grids ---
  for (let tier = 0; tier < 10; tier++) frames[`icon${tier}`] = gemSprite(tier, 24);
  for (let i = 10; i < 14; i++) {
    // downscale the 50px artifact overlay by sampling every other pixel
    const src = frames[`gem${i}`];
    const icon = new Sprite(24, 24);
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 24; x++) {
        const [r, g, b, a] = src.get(
          Math.min(src.w - 1, x * 2 + 1),
          Math.min(src.h - 1, y * 2 + 1),
        );
        if (a > 0) icon.px(x, y, [r, g, b], a);
      }
    frames[`icon${i}`] = icon;
  }

  // --- hero sprites & fx ---
  Object.assign(frames, podFrames());
  Object.assign(frames, carrierFrames());
  Object.assign(frames, bossFrames());
  Object.assign(frames, explosionFrames());
  Object.assign(frames, particleFrames());
  Object.assign(frames, miscFx());
  for (let i = 0; i < 5; i++) frames[`building${i}`] = buildingFrame(i);
  Object.assign(frames, portraitFrames());

  return frames;
}

export function compose() {
  const frames = buildFrames();
  const outDir = join(ROOT, 'public', 'atlas');
  mkdirSync(outDir, { recursive: true });

  // --- shelf-pack game.png ---
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
  const atlas = new Sprite(ATLAS_W, ATLAS_H);
  for (const name of names) atlas.blit(frames[name], placed[name].x, placed[name].y);
  writePng(join(outDir, 'game.png'), ATLAS_W, ATLAS_H, atlas.data);
  writeFileSync(
    join(outDir, 'game.json'),
    JSON.stringify({
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
    }),
  );

  // --- grid tileset (50px cells) for the Phaser tilemap ---
  const tileOrder = [];
  for (let b = 0; b < 6; b++) for (let v = 1; v <= 5; v++) tileOrder.push(`dirt${v}_p${b}`);
  tileOrder.push('turfA', 'turfB', 'barrierA', 'barrierB', 'bedrock', 'slate');
  for (let v = 0; v < 3; v++) tileOrder.push(`boulder${v}`);
  for (let ph = 0; ph < 4; ph++) tileOrder.push(`lava${ph}`);
  for (let ph = 0; ph < 4; ph++) tileOrder.push(`gasShimmer${ph}`);
  for (let i = 0; i < 14; i++) tileOrder.push(`gem${i}`);
  const COLS = 10;
  const rows = Math.ceil(tileOrder.length / COLS);
  const tileset = new Sprite(COLS * T, rows * T);
  tileOrder.forEach((name, i) => {
    tileset.blit(frames[name], (i % COLS) * T, Math.floor(i / COLS) * T);
  });
  writePng(join(outDir, 'tiles.png'), tileset.w, tileset.h, tileset.data);
  writeFileSync(
    join(outDir, 'tiles.json'),
    JSON.stringify({
      columns: COLS,
      tileSize: T,
      index: Object.fromEntries(tileOrder.map((n, i) => [n, i])),
    }),
  );

  // --- portrait strip for the DOM dialog (CSS background-position) ---
  const order = ['employer', 'employerTrue', 'minerRig7', 'static', 'dispatch', 'deity'];
  const strip = new Sprite(order.length * 48, 48);
  order.forEach((k, i) => strip.blit(frames[`portrait_${k}`], i * 48, 0));
  writePng(join(outDir, 'portraits.png'), strip.w, strip.h, strip.data);

  console.log(
    `atlas: ${names.length} frames → game.png (${ATLAS_W}×${ATLAS_H}); tileset ${tileOrder.length} cells; portraits ×${order.length}`,
  );
  return { frames, placed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) compose();
