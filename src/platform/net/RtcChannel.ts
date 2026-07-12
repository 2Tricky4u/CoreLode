import type { NetChannel } from './channel';
import { decodeSdpToken, encodeSdpToken } from './sdpToken';

/**
 * WebRTC DataChannel transport with MANUAL signaling — zero external services.
 * `iceServers: []` means host/mDNS candidates only: perfect on a LAN (even
 * offline); NAT traversal across the internet is out of scope for v1.
 *
 * Handshake (one exchange per guest — QR scan, invite link, or paste):
 *   host:  createOffer() → CLDP1 token  — the guest scans/taps/pastes it
 *   guest: acceptOffer(token) → CLDP2 token — send it back
 *   host:  acceptAnswer(token) — the channel opens on both ends
 * Tokens are deflate-compressed SDP (sdpToken.ts) so they fit in a QR code.
 *
 * waitOpen() rejects 'coop-closed' when the transport dies mid-handshake and
 * 'coop-timeout' past an optional deadline — a lobby must never hang silently.
 */
const OFFER_MAGIC = 'CLDP1';
const ANSWER_MAGIC = 'CLDP2';
const GATHER_TIMEOUT_MS = 2_500;

/** Wait until ICE gathering completes (or time out and ship what we have). */
async function gathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return;
  await new Promise<void>((res) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check);
      res();
    };
    const check = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    pc.addEventListener('icegatheringstatechange', check);
    setTimeout(done, GATHER_TIMEOUT_MS);
  });
}

interface OpenWaiter {
  res: () => void;
  rej: (e: Error) => void;
}

export class RtcChannel implements NetChannel {
  onMessage: ((text: string) => void) | null = null;
  onClose: (() => void) | null = null;
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private openWaiters: OpenWaiter[] = [];

  private constructor() {
    this.pc = new RTCPeerConnection({ iceServers: [] });
    this.pc.onconnectionstatechange = () => {
      const st = this.pc.connectionState;
      if (st === 'failed' || st === 'disconnected' || st === 'closed') {
        this.settleOpen(new Error('coop-closed'));
        this.onClose?.();
      }
    };
  }

  private settleOpen(err: Error | null): void {
    const waiters = this.openWaiters;
    this.openWaiters = [];
    for (const w of waiters) err ? w.rej(err) : w.res();
  }

  private adopt(dc: RTCDataChannel): void {
    this.dc = dc;
    dc.onmessage = (ev) => this.onMessage?.(String(ev.data));
    dc.onclose = () => {
      this.settleOpen(new Error('coop-closed'));
      this.onClose?.();
    };
    dc.onopen = () => this.settleOpen(null);
  }

  /**
   * Resolves once the data channel is open (host: after acceptAnswer).
   * Rejects 'coop-closed' if the connection dies first, 'coop-timeout' after
   * timeoutMs; with no timeout it waits as long as the transport lives.
   */
  waitOpen(timeoutMs?: number): Promise<void> {
    if (this.dc?.readyState === 'open') return Promise.resolve();
    return new Promise((res, rej) => {
      const w: OpenWaiter = { res, rej };
      if (timeoutMs !== undefined) {
        const timer = setTimeout(() => {
          this.openWaiters = this.openWaiters.filter((x) => x !== w);
          rej(new Error('coop-timeout'));
        }, timeoutMs);
        w.res = () => {
          clearTimeout(timer);
          res();
        };
        w.rej = (e) => {
          clearTimeout(timer);
          rej(e);
        };
      }
      this.openWaiters.push(w);
    });
  }

  /** True once an answer has been applied — a second one would be an error. */
  get hasRemoteAnswer(): boolean {
    return this.pc.signalingState === 'stable' && this.pc.remoteDescription !== null;
  }

  /** HOST side, step 1: create the connection and mint the offer token. */
  static async host(): Promise<{ channel: RtcChannel; offerToken: string }> {
    const ch = new RtcChannel();
    ch.adopt(ch.pc.createDataChannel('coop', { ordered: true }));
    await ch.pc.setLocalDescription(await ch.pc.createOffer());
    await gathered(ch.pc);
    const offerToken = await encodeSdpToken(OFFER_MAGIC, ch.pc.localDescription?.sdp ?? '');
    return { channel: ch, offerToken };
  }

  /** HOST side, step 3: apply the guest's answer token (scan or paste). */
  async acceptAnswer(answerToken: string): Promise<void> {
    const sdp = await decodeSdpToken(ANSWER_MAGIC, answerToken);
    await this.pc.setRemoteDescription({ type: 'answer', sdp });
  }

  /** GUEST side, step 2: apply the host's offer, mint the answer token. */
  static async join(offerToken: string): Promise<{ channel: RtcChannel; answerToken: string }> {
    const ch = new RtcChannel();
    ch.pc.ondatachannel = (ev) => ch.adopt(ev.channel);
    const sdp = await decodeSdpToken(OFFER_MAGIC, offerToken);
    await ch.pc.setRemoteDescription({ type: 'offer', sdp });
    await ch.pc.setLocalDescription(await ch.pc.createAnswer());
    await gathered(ch.pc);
    const answerToken = await encodeSdpToken(ANSWER_MAGIC, ch.pc.localDescription?.sdp ?? '');
    return { channel: ch, answerToken };
  }

  send(text: string): void {
    if (this.dc?.readyState === 'open') this.dc.send(text);
  }

  close(): void {
    this.dc?.close();
    this.pc.close();
  }
}
