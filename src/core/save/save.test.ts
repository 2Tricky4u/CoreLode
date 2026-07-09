import { describe, expect, it } from 'vitest';
import { EMPTY_INTENTS } from '../intents';
import { createRun } from '../sim/state';
import { tick } from '../sim/tick';
import { decodeSave, encodeSave } from './codec';
import { SaveError, migrateAndValidate } from './migrate';
import { deserialize, rleDecode, rleEncode, serialize } from './schema';

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
