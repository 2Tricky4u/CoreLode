#!/usr/bin/env node
/**
 * Layering guard: src/core/** and src/content/** must not import phaser, DOM-touching
 * layers (@game/@ui/@input/@platform/@app), or use browser globals. Keeps the sim
 * pure and unit-testable, and keeps the engine swappable.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/core', 'src/content'];
const BANNED_IMPORTS = /from\s+['"](phaser|@game\/|@ui\/|@input\/|@platform\/|@app\/)/;
const BANNED_GLOBALS =
  /\b(window|document|navigator|localStorage|indexedDB|requestAnimationFrame)\s*[.(]/;

let failures = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) {
      const src = readFileSync(p, 'utf8');
      const imp = src.match(BANNED_IMPORTS);
      if (imp) {
        console.error(`LAYERING: ${p} imports banned module: ${imp[1]}`);
        failures++;
      }
      const glob = src.match(BANNED_GLOBALS);
      if (glob) {
        console.error(`LAYERING: ${p} touches browser global: ${glob[1]}`);
        failures++;
      }
    }
  }
}
for (const root of ROOTS) {
  try {
    walk(root);
  } catch {
    /* dir may not exist yet */
  }
}
if (failures > 0) {
  console.error(`\n${failures} layering violation(s).`);
  process.exit(1);
}
console.log('Layering OK: core/content are pure.');
