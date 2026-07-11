import type { NetChannel } from './channel';

/**
 * Same-machine transport over BroadcastChannel — full co-op in N browser
 * tabs with zero WebRTC. One logical pipe per guest seat: the host opens
 * `room:seat` channels, each guest tab opens exactly one with its seat.
 * Role disambiguation on the shared bus: messages are tagged with the
 * sender's side, and each end only accepts the other side's traffic.
 */
export class LocalChannel implements NetChannel {
  onMessage: ((text: string) => void) | null = null;
  onClose: (() => void) | null = null;
  private bc: BroadcastChannel;

  constructor(
    room: string,
    seat: number,
    private side: 'host' | 'guest',
  ) {
    this.bc = new BroadcastChannel(`corelode-coop:${room}:${seat}`);
    this.bc.onmessage = (ev: MessageEvent) => {
      const { from, text } = ev.data as { from: 'host' | 'guest'; text: string };
      if (from !== this.side) this.onMessage?.(text);
    };
  }

  send(text: string): void {
    this.bc.postMessage({ from: this.side, text });
  }

  close(): void {
    try {
      this.bc.postMessage({ from: this.side, text: '{"m":"bye"}' });
    } catch {
      /* channel may already be gone */
    }
    this.bc.close();
    this.onClose?.();
  }
}
