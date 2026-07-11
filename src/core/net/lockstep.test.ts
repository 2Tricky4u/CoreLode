import { describe, expect, it } from 'vitest';
import { EMPTY_INTENTS } from '../intents';
import { createRun } from '../sim/state';
import { coopStateHash } from './lockstep';
import { BundleLedger, HostSequencer } from './lockstep';
import { INPUT_DELAY_TICKS, decodeMsg, encodeMsg } from './messages';

const frameL = { ...EMPTY_INTENTS, left: true };
const frameR = { ...EMPTY_INTENTS, right: true };

describe('HostSequencer', () => {
  it('pre-seeds the warm-up ticks with EMPTY for everyone', () => {
    const seq = new HostSequencer(3);
    for (let t = 0; t < INPUT_DELAY_TICKS; t++) {
      expect(seq.ready()).toBe(true);
      const b = seq.take();
      expect(b?.t).toBe(t);
      expect(b?.frames).toEqual([EMPTY_INTENTS, EMPTY_INTENTS, EMPTY_INTENTS]);
      expect(b?.cmds).toEqual([[], [], []]);
    }
    expect(seq.ready()).toBe(false); // real inputs needed from here on
  });

  it('emits strictly ordered bundles once every player reported, out-of-order safe', () => {
    const seq = new HostSequencer(2);
    for (let t = 0; t < INPUT_DELAY_TICKS; t++) seq.take();
    const T = INPUT_DELAY_TICKS;
    seq.put(1, T + 1, frameR, []); // out of order: future tick first
    seq.put(0, T, frameL, []);
    expect(seq.ready()).toBe(false); // player 1 missing for T
    seq.put(1, T, frameR, [{ c: 'sellAllCargo' }]);
    const b = seq.take();
    expect(b?.t).toBe(T);
    expect(b?.frames[0].left).toBe(true);
    expect(b?.frames[1].right).toBe(true);
    expect(b?.cmds[1]).toEqual([{ c: 'sellAllCargo' }]);
    expect(seq.ready()).toBe(false); // T+1 still missing player 0
    seq.put(0, T + 1, frameL, []);
    expect(seq.take()?.t).toBe(T + 1);
  });

  it('substitutes EMPTY for dropped players', () => {
    const seq = new HostSequencer(2);
    for (let t = 0; t < INPUT_DELAY_TICKS; t++) seq.take();
    const T = INPUT_DELAY_TICKS;
    seq.put(0, T, frameL, []);
    expect(seq.ready()).toBe(false);
    seq.drop(1);
    expect(seq.ready()).toBe(true);
    const b = seq.take();
    expect(b?.frames[1]).toEqual(EMPTY_INTENTS);
  });

  it('ignores stale and out-of-range inputs', () => {
    const seq = new HostSequencer(2);
    for (let t = 0; t < INPUT_DELAY_TICKS; t++) seq.take();
    seq.put(0, 0, frameL, []); // stale — already emitted
    seq.put(7, INPUT_DELAY_TICKS, frameL, []); // no such player
    expect(seq.ready()).toBe(false);
  });
});

describe('BundleLedger', () => {
  it('releases bundles in strict tick order regardless of arrival order', () => {
    const led = new BundleLedger();
    led.put({ t: 1, frames: [frameR], cmds: [[]] });
    expect(led.canExec()).toBe(false); // waiting for t=0
    led.put({ t: 0, frames: [frameL], cmds: [[]] });
    expect(led.take()?.t).toBe(0);
    expect(led.take()?.t).toBe(1);
    expect(led.take()).toBeNull();
    expect(led.nextTick).toBe(2);
  });

  it('drops stale bundles and resets cleanly', () => {
    const led = new BundleLedger();
    led.put({ t: 0, frames: [], cmds: [] });
    led.take();
    led.put({ t: 0, frames: [], cmds: [] }); // stale replay — ignored
    expect(led.canExec()).toBe(false);
    led.reset();
    led.put({ t: 0, frames: [], cmds: [] });
    expect(led.canExec()).toBe(true);
  });
});

describe('coopStateHash + message codec', () => {
  it('hash is stable for identical states and differs after divergence', () => {
    const a = createRun({ seed: 9, mode: { kind: 'coop', goldium: true, players: 2 } });
    const b = createRun({ seed: 9, mode: { kind: 'coop', goldium: true, players: 2 } });
    expect(coopStateHash(a)).toBe(coopStateHash(b));
    b.pods[1].cash += 1;
    expect(coopStateHash(a)).not.toBe(coopStateHash(b));
  });

  it('messages round-trip and garbage decodes to null', () => {
    const msg = { m: 'in' as const, t: 7, frame: frameL, cmds: [] };
    expect(decodeMsg(encodeMsg(msg))).toEqual(msg);
    expect(decodeMsg('not json')).toBeNull();
    expect(decodeMsg('42')).toBeNull();
  });
});
