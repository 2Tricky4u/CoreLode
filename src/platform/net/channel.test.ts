import { describe, expect, it } from 'vitest';
import { CHUNK_BYTES, ChunkAssembler, chunkSplit } from './channel';

describe('payload chunker', () => {
  it('splits and reassembles a large payload exactly', () => {
    const big = 'x'.repeat(CHUNK_BYTES * 3 + 123);
    const parts = chunkSplit(big);
    expect(parts).toHaveLength(4);
    const asm = new ChunkAssembler();
    let whole: string | null = null;
    // deliver out of order
    for (const i of [2, 0, 3, 1]) whole = asm.add(i, parts.length, parts[i]);
    expect(whole).toBe(big);
  });

  it('handles a single-chunk payload and resets between payloads', () => {
    const asm = new ChunkAssembler();
    expect(asm.add(0, 1, 'hello')).toBe('hello');
    expect(asm.add(0, 2, 'a')).toBeNull();
    expect(asm.add(1, 2, 'b')).toBe('ab');
  });

  it('rejects inconsistent chunk counts and bad indices', () => {
    const asm = new ChunkAssembler();
    asm.begin(3);
    expect(asm.add(0, 2, 'a')).toBeNull(); // count mismatch
    expect(asm.add(5, 3, 'x')).toBeNull(); // index out of range
  });
});
