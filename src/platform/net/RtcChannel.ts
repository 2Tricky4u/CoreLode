import { decodeToken, encodeToken } from '@core/index';
import type { NetChannel } from './channel';

/**
 * WebRTC DataChannel transport with MANUAL signaling — zero external services.
 * `iceServers: []` means host/mDNS candidates only: perfect on a LAN (even
 * offline); NAT traversal across the internet is out of scope for v1.
 *
 * Handshake (one paste exchange per guest):
 *   host:  createOffer() → CLDP1 token  — send it to the guest (chat/USB/paper)
 *   guest: acceptOffer(token) → CLDP2 token — send it back
 *   host:  acceptAnswer(token) — the channel opens on both ends
 */
const OFFER_MAGIC = 'CLDP1';
const ANSWER_MAGIC = 'CLDP2';
const GATHER_TIMEOUT_MS = 2_500;

interface SdpPayload {
  v: 1;
  sdp: string;
}

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

export class RtcChannel implements NetChannel {
  onMessage: ((text: string) => void) | null = null;
  onClose: (() => void) | null = null;
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private openResolvers: Array<() => void> = [];

  private constructor() {
    this.pc = new RTCPeerConnection({ iceServers: [] });
    this.pc.onconnectionstatechange = () => {
      const st = this.pc.connectionState;
      if (st === 'failed' || st === 'disconnected' || st === 'closed') this.onClose?.();
    };
  }

  private adopt(dc: RTCDataChannel): void {
    this.dc = dc;
    dc.onmessage = (ev) => this.onMessage?.(String(ev.data));
    dc.onclose = () => this.onClose?.();
    dc.onopen = () => {
      for (const r of this.openResolvers) r();
      this.openResolvers = [];
    };
  }

  /** Resolves once the data channel is open (host: after acceptAnswer). */
  waitOpen(): Promise<void> {
    if (this.dc?.readyState === 'open') return Promise.resolve();
    return new Promise((res) => this.openResolvers.push(res));
  }

  /** HOST side, step 1: create the connection and mint the offer token. */
  static async host(): Promise<{ channel: RtcChannel; offerToken: string }> {
    const ch = new RtcChannel();
    ch.adopt(ch.pc.createDataChannel('coop', { ordered: true }));
    await ch.pc.setLocalDescription(await ch.pc.createOffer());
    await gathered(ch.pc);
    const payload: SdpPayload = { v: 1, sdp: ch.pc.localDescription?.sdp ?? '' };
    return { channel: ch, offerToken: encodeToken(OFFER_MAGIC, payload) };
  }

  /** HOST side, step 3: paste the guest's answer token. */
  async acceptAnswer(answerToken: string): Promise<void> {
    const { sdp } = decodeToken(ANSWER_MAGIC, answerToken) as SdpPayload;
    await this.pc.setRemoteDescription({ type: 'answer', sdp });
  }

  /** GUEST side, step 2: paste the host's offer, mint the answer token. */
  static async join(offerToken: string): Promise<{ channel: RtcChannel; answerToken: string }> {
    const ch = new RtcChannel();
    ch.pc.ondatachannel = (ev) => ch.adopt(ev.channel);
    const { sdp } = decodeToken(OFFER_MAGIC, offerToken) as SdpPayload;
    await ch.pc.setRemoteDescription({ type: 'offer', sdp });
    await ch.pc.setLocalDescription(await ch.pc.createAnswer());
    await gathered(ch.pc);
    const payload: SdpPayload = { v: 1, sdp: ch.pc.localDescription?.sdp ?? '' };
    return { channel: ch, answerToken: encodeToken(ANSWER_MAGIC, payload) };
  }

  send(text: string): void {
    if (this.dc?.readyState === 'open') this.dc.send(text);
  }

  close(): void {
    this.dc?.close();
    this.pc.close();
  }
}
