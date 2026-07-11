/**
 * Transport abstraction for lockstep co-op. One NetChannel = one reliable,
 * ordered, string-message pipe between the host and ONE guest (star topology:
 * the host holds an array of these). Implementations: RtcChannel (WebRTC
 * DataChannel, manual paste signaling) and LocalChannel (BroadcastChannel —
 * same-machine tabs, used for dev and testing).
 */
export interface NetChannel {
  send(text: string): void;
  onMessage: ((text: string) => void) | null;
  onClose: (() => void) | null;
  close(): void;
}

/** Chunk large payloads (the ~105 KB resume SaveFile) for DataChannel safety. */
export const CHUNK_BYTES = 16_000;

export function chunkSplit(data: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < data.length; i += CHUNK_BYTES) out.push(data.slice(i, i + CHUNK_BYTES));
  return out;
}

/** Reassembles an n-part chunked payload; returns the whole once complete. */
export class ChunkAssembler {
  private parts: (string | null)[] = [];
  private expect = 0;

  begin(n: number): void {
    this.parts = new Array(n).fill(null);
    this.expect = n;
  }

  add(i: number, n: number, data: string): string | null {
    if (this.expect === 0) this.begin(n);
    if (n !== this.expect || i < 0 || i >= n) return null;
    this.parts[i] = data;
    if (this.parts.some((p) => p === null)) return null;
    const whole = this.parts.join('');
    this.parts = [];
    this.expect = 0;
    return whole;
  }
}
