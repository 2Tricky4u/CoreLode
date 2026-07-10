/**
 * Daily expedition seed + shareable result codes. Pure: the current date is
 * computed app-side and passed in (core never reads the clock). Everyone on
 * the same UTC day digs the same earth — the menu says "resets 00:00 UTC".
 */
import { fnv1a } from './lib/math';
import { hash32 } from './lib/rng';
import { crc32, decodeToken, encodeToken } from './save/codec';
import { SaveError } from './save/migrate';

/** YYYY-MM-DD in UTC — the shared key for a daily run. */
export const dailyKey = (now: Date): string => now.toISOString().slice(0, 10);

export const dailySeed = (key: string): number => hash32(crc32(key), 0xda11);

const RESULT_MAGIC = 'CLDR1';

export interface DailyResult {
  v: 1;
  date: string; // dailyKey
  depthFt: number;
  cash: number;
  points: number;
  ticks: number;
  bestChain: number;
  outcome: 'destroyed' | 'victory';
  /** Honor-system tamper check binding the fields to the day's seed. */
  h: number;
}

const resultHash = (r: Omit<DailyResult, 'h'>): number =>
  fnv1a([dailySeed(r.date), r.depthFt, r.cash, r.points, r.ticks, r.bestChain, crc32(r.outcome)]);

export function encodeDailyResult(r: Omit<DailyResult, 'h'>): string {
  return encodeToken(RESULT_MAGIC, { ...r, h: resultHash(r) });
}

export function decodeDailyResult(text: string): DailyResult {
  const raw = decodeToken(RESULT_MAGIC, text) as DailyResult;
  if (raw.v !== 1 || typeof raw.date !== 'string') throw new SaveError('bad result code');
  if (raw.h !== resultHash(raw)) throw new SaveError('tampered result code');
  return raw;
}

// Rule of the daily (enforced app-side at run creation): always the 'standard'
// loadout and no modules, so result codes stay comparable between players.
