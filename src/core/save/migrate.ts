import { WORLD_H, WORLD_W } from '../data/constants';
/**
 * Save migrations + structural validation. Every schema bump adds a migration
 * step here and a frozen fixture in tests/fixtures/saves/.
 */
import { SAVE_VERSION, type SaveFile } from './schema';

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** v(n) → v(n+1) steps, keyed by source version. */
const MIGRATIONS: Record<number, Migration> = {
  // v2: heat/relics/modules/lastDamage on pod, chain/contracts on the file,
  // bestChain/rescues in stats (all inert defaults for a v1 story run).
  1: (raw) => ({
    ...raw,
    v: 2,
    pod: {
      ...(raw.pod as Record<string, unknown>),
      heat: 0,
      relics: [],
      modules: [],
      lastDamage: null,
    },
    stats: { ...(raw.stats as Record<string, unknown>), bestChain: 0, rescues: 0 },
    chain: null,
    contracts: [],
  }),
  // v3: minimap fog of war. Pre-fog saves are grandfathered with a fully
  // revealed map — an existing mid-run player must not lose their bearings.
  2: (raw) => ({
    ...raw,
    v: 3,
    discoveredRle: [1, WORLD_W * WORLD_H],
  }),
};

export class SaveError extends Error {}

export function migrateAndValidate(rawInput: unknown): SaveFile {
  if (typeof rawInput !== 'object' || rawInput === null) throw new SaveError('not an object');
  let raw = rawInput as Record<string, unknown>;
  let v: number = typeof raw.v === 'number' ? raw.v : Number.NaN;
  if (!Number.isInteger(v) || v < 1 || v > SAVE_VERSION)
    throw new SaveError(`bad version ${String(raw.v)}`);
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new SaveError(`no migration from v${v}`);
    raw = step(raw);
    v = typeof raw.v === 'number' ? raw.v : Number.NaN;
    if (!Number.isInteger(v)) throw new SaveError('migration produced bad version');
  }
  validate(raw);
  return raw as unknown as SaveFile;
}

function req(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new SaveError(msg);
}

function validate(f: Record<string, unknown>): void {
  req(typeof f.seed === 'number', 'seed');
  req(typeof f.level === 'number' && (f.level as number) >= 1, 'level');
  req(typeof f.tick === 'number', 'tick');
  req(typeof f.rngState === 'number', 'rngState');
  const rleCovers = (rle: unknown): boolean => {
    if (!Array.isArray(rle) || rle.length % 2 !== 0) return false;
    let total = 0;
    for (let i = 1; i < rle.length; i += 2) total += rle[i];
    return total === WORLD_W * WORLD_H;
  };
  req(rleCovers(f.worldRle), 'worldRle shape/length');
  req(rleCovers(f.discoveredRle), 'discoveredRle shape/length');
  const pod = f.pod as Record<string, unknown>;
  req(typeof pod === 'object' && pod !== null, 'pod');
  for (const k of ['x', 'y', 'hp', 'fuel', 'cash', 'points'])
    req(typeof pod[k] === 'number', `pod.${k}`);
  req(typeof pod.upgrades === 'object' && pod.upgrades !== null, 'pod.upgrades');
  req(Array.isArray(pod.bayContents), 'pod.bayContents');
  req(typeof pod.heat === 'number', 'pod.heat');
  req(Array.isArray(pod.relics), 'pod.relics');
  req(Array.isArray(pod.modules), 'pod.modules');
  const story = f.story as Record<string, unknown>;
  req(typeof story === 'object' && story !== null && Array.isArray(story.fired), 'story');
  req(f.chain === null || (typeof f.chain === 'object' && f.chain !== null), 'chain');
  req(Array.isArray(f.contracts), 'contracts');
}
