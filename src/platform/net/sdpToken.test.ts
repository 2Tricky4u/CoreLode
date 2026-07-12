import { encodeToken } from '@core/index';
import { describe, expect, it } from 'vitest';
import { decodeSdpToken, encodeSdpToken } from './sdpToken';

// Realistic datachannel-only SDP shape: repetitive field names + candidate lines
// are exactly what deflate eats, so the size assertion below is representative.
const FAKE_SDP = [
  'v=0',
  'o=- 4611731400430051336 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=ice-ufrag:F7gI',
  'a=ice-pwd:x9cml/YzichV2+XlhiMu8g',
  'a=ice-options:trickle',
  `a=fingerprint:sha-256 ${'AB:CD:'.repeat(15)}EF`,
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
  ...Array.from(
    { length: 6 },
    (_, i) =>
      `a=candidate:${2999230412 + i} 1 udp 2122260223 192.168.1.${10 + i} 5${i}552 typ host generation 0 network-id ${i + 1}`,
  ),
  '',
].join('\r\n');

describe('sdpToken', () => {
  it('round-trips a compressed v2 token and beats the raw v1 size', async () => {
    const token = await encodeSdpToken('CLDP1', FAKE_SDP);
    expect(token.startsWith('CLDP1.')).toBe(true);
    expect(await decodeSdpToken('CLDP1', token)).toBe(FAKE_SDP);
    const rawV1 = encodeToken('CLDP1', { v: 1, sdp: FAKE_SDP });
    expect(token.length).toBeLessThan(rawV1.length * 0.7);
  });

  it('still decodes a legacy v1 raw-SDP token', async () => {
    const legacy = encodeToken('CLDP2', { v: 1, sdp: FAKE_SDP });
    expect(await decodeSdpToken('CLDP2', legacy)).toBe(FAKE_SDP);
  });

  it('rejects a token with the wrong magic', async () => {
    const token = await encodeSdpToken('CLDP1', FAKE_SDP);
    await expect(decodeSdpToken('CLDP2', token)).rejects.toThrow('not a CLDP2 code');
  });

  it('rejects a corrupted body (checksum)', async () => {
    const token = await encodeSdpToken('CLDP1', FAKE_SDP);
    const [magic, body, crc] = token.split('.');
    const flipped = (body.startsWith('A') ? 'B' : 'A') + body.slice(1);
    await expect(decodeSdpToken('CLDP1', `${magic}.${flipped}.${crc}`)).rejects.toThrow('checksum');
  });

  it('rejects an unknown payload shape', async () => {
    const alien = encodeToken('CLDP1', { v: 3, blob: 'x' });
    await expect(decodeSdpToken('CLDP1', alien)).rejects.toThrow('unknown signaling payload');
  });

  it('emits only URL/hash-safe characters', async () => {
    const token = await encodeSdpToken('CLDP1', FAKE_SDP);
    expect(token).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});
