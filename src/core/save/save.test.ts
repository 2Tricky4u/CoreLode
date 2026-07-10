import { describe, expect, it } from 'vitest';
import v1Fixture from '../../../tests/fixtures/saves/v1.json';
import { EMPTY_INTENTS } from '../intents';
import { createRun } from '../sim/state';
import { tick } from '../sim/tick';
import { decodeSave, encodeSave } from './codec';
import { SaveError, migrateAndValidate } from './migrate';
import { type SaveFile, deserialize, rleDecode, rleEncode, serialize } from './schema';

const makeState = () => {
  const s = createRun({ seed: 31337, mode: { kind: 'story', goldium: true } });
  for (let i = 0; i < 200; i++) tick(s, { ...EMPTY_INTENTS, down: i % 3 === 0 }, []);
  s.pod.cash = 4_567;
  s.pod.bayContents[3] = 2;
  s.pod.inventory.dynamite = 5;
  return s;
};

describe('RLE world packing', () => {
  it('roundtrips exactly', () => {
    const s = makeState();
    const rle = rleEncode(s.world.tiles);
    const back = rleDecode(rle);
    expect(Buffer.from(back.buffer).equals(Buffer.from(s.world.tiles.buffer))).toBe(true);
  });
});

describe('serialize/deserialize', () => {
  it('roundtrips the run state', () => {
    const s = makeState();
    const file = serialize(s, 1_000);
    const validated = migrateAndValidate(JSON.parse(JSON.stringify(file)));
    const back = deserialize(validated);
    expect(back.seed).toBe(s.seed);
    expect(back.level).toBe(s.level);
    expect(back.pod.cash).toBe(s.pod.cash);
    expect(back.pod.fuel).toBeCloseTo(s.pod.fuel, 6);
    expect(back.pod.bayContents).toEqual(s.pod.bayContents);
    expect(back.pod.inventory).toEqual(s.pod.inventory);
    expect(back.story.fired).toEqual(s.story.fired);
    expect(Buffer.from(back.world.tiles.buffer).equals(Buffer.from(s.world.tiles.buffer))).toBe(
      true,
    );
    expect(back.rng.state).toBe(s.rng.state);
  });
});

describe('frozen v1 fixture migration', () => {
  it('migrates v1 to the current version with inert defaults', () => {
    const f = migrateAndValidate(JSON.parse(JSON.stringify(v1Fixture)));
    expect(f.v).toBe(2);
    expect(f.seed).toBe(31337);
    expect(f.pod.heat).toBe(0);
    expect(f.pod.relics).toEqual([]);
    expect(f.pod.modules).toEqual([]);
    expect(f.pod.lastDamage).toBeNull();
    expect(f.chain).toBeNull();
    expect(f.contracts).toEqual([]);
    expect(f.stats.bestChain).toBe(0);
    expect(f.stats.rescues).toBe(0);
    // Migration never touches the world: RLE payload is carried over verbatim.
    expect(f.worldRle).toEqual(v1Fixture.worldRle);
  });

  it('produces a playable state (loads and keeps ticking)', () => {
    const f = migrateAndValidate(JSON.parse(JSON.stringify(v1Fixture)));
    const s = deserialize(f);
    expect(s.pod.cash).toBe(4_567);
    for (let i = 0; i < 100; i++) tick(s, EMPTY_INTENTS, []);
    expect(s.outcome).toBe('active');
  });

  it('decodes a v1 export code through migration', () => {
    const code = encodeSave(v1Fixture as unknown as SaveFile);
    const back = decodeSave(code);
    expect(back.v).toBe(2);
    expect(back.seed).toBe(31337);
    expect(back.pod.heat).toBe(0);
  });
});

describe('export codec', () => {
  it('roundtrips through the save-code string', () => {
    const s = makeState();
    const code = encodeSave(serialize(s, 42));
    expect(code.startsWith('CLD1.')).toBe(true);
    const back = decodeSave(code);
    expect(back.seed).toBe(s.seed);
    expect(back.pod.cash).toBe(s.pod.cash);
  });
  it('rejects tampered payloads', () => {
    const s = makeState();
    const code = encodeSave(serialize(s, 42));
    const tampered = `${code.slice(0, 20)}x${code.slice(21)}`;
    expect(() => decodeSave(tampered)).toThrow(SaveError);
  });
  it('rejects garbage and wrong versions', () => {
    expect(() => decodeSave('hello world')).toThrow(SaveError);
    expect(() => migrateAndValidate({ v: 999 })).toThrow(SaveError);
    expect(() => migrateAndValidate(null)).toThrow(SaveError);
  });
});
