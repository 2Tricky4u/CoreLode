#!/usr/bin/env node
/** Frame-parity guard: every atlas frame the code references must exist in game.json. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const atlas = JSON.parse(
  readFileSync(join(ROOT, 'public/atlas/game.png').replace('game.png', 'game.json'), 'utf8'),
);
const tiles = JSON.parse(readFileSync(join(ROOT, 'public/atlas/tiles.json'), 'utf8'));
const have = new Set(Object.keys(atlas.frames));

// Literal frame references in src/**.
const refs = new Set();
const litRe =
  /'atlas',\s*'([\w-]+)'|setFrame\('([\w-]+)'\)|setTexture\('atlas',\s*'([\w-]+)'\)|frame:\s*'([\w-]+)'/g;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.ts')) {
      const src = readFileSync(p, 'utf8');
      for (const m of src.matchAll(litRe)) refs.add(m[1] ?? m[2] ?? m[3] ?? m[4]);
    }
  }
}
walk(join(ROOT, 'src'));

// Dynamic frame families the code builds with template strings.
const families = [
  ...['pod_idle', 'pod_hurt'],
  ...[0, 1].map((i) => `pod_fly${i}`),
  ...[0, 1, 2, 3].flatMap((i) => [`pod_drill_down${i}`, `pod_drill_side${i}`]),
  ...[0, 1, 2, 3].flatMap((i) => [`bite_down${i}`, `bite_side${i}`]),
  'cornerCut',
  ...Array.from({ length: 6 }, (_, b) => [
    `cornerRound_p${b}`,
    ...[0, 1, 2, 3, 4].flatMap((v) => [`edgeLump${v}_p${b}`, `edgeLumpV${v}_p${b}`]),
  ]).flat(),
  ...[1, 2].flatMap((f) => [`boss${f}_a`, `boss${f}_b`]),
  ...[0, 1, 2, 3, 4].map((i) => `boom${i}`),
  ...[0, 1, 2].map((i) => `dust${i}`),
  ...Array.from({ length: 14 }, (_, i) => `gem${i}`),
  ...Array.from({ length: 14 }, (_, i) => `icon${i}`),
  ...Array.from({ length: 5 }, (_, i) => `building${i}`),
  'spark',
  'mote',
  'smoke',
  'glow32',
  'glow64',
  'fireball',
  'laserDot',
  'teleBeam',
  'guardian',
  'gasPuff',
];
for (const f of families) refs.add(f);

// Tileset names the renderer derives.
const tileNames = [
  ...Array.from({ length: 6 }, (_, b) =>
    Array.from({ length: 5 }, (_, v) => `dirt${v + 1}_p${b}`),
  ).flat(),
  'turfA',
  'turfB',
  'barrierA',
  'barrierB',
  'bedrock',
  'slate',
  ...[0, 1, 2].map((v) => `boulder${v}`),
  ...[0, 1, 2, 3].map((p) => `lava${p}`),
  ...[0, 1, 2, 3].map((p) => `gasShimmer${p}`),
];

let missing = 0;
for (const r of refs) {
  if (!have.has(r)) {
    console.error(`MISSING atlas frame: ${r}`);
    missing++;
  }
}
for (const t of tileNames) {
  if (!(t in tiles.index)) {
    console.error(`MISSING tileset cell: ${t}`);
    missing++;
  }
}
if (missing) {
  console.error(`\n${missing} missing frame(s).`);
  process.exit(1);
}
console.log(`Frames OK: ${refs.size} atlas refs + ${tileNames.length} tileset cells all present.`);
