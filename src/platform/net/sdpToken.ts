/**
 * Signaling-token codec: SDP blobs ride the core encodeToken envelope
 * ('<magic>.' + base64url(JSON) + '.' + crc32), deflate-compressed with the
 * native CompressionStream so QR codes stay scannable and invite links short.
 *   v2 { v: 2, z: base64url(deflated bytes) }    — normal path (~40% of raw size)
 *   v1 { v: 1, sdp }                             — minted only where CompressionStream
 *                                                  is missing; always decodable.
 */
import { decodeToken, encodeToken } from '@core/index';

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Binary base64url (same alphabet as the core codec, which is string-only). */
function bytesToB64url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
    out += ABC[b0 >> 2] + ABC[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '' : ABC[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '' : ABC[b2 & 63];
  }
  return out;
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const idx = new Map([...ABC].map((c, i) => [c, i]));
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i += 4) {
    const n0 = idx.get(s[i]);
    const n1 = idx.get(s[i + 1]);
    if (n0 === undefined || n1 === undefined) throw new Error('bad base64');
    bytes.push((n0 << 2) | (n1 >> 4));
    const n2 = idx.get(s[i + 2]);
    if (n2 !== undefined) {
      bytes.push(((n1 & 15) << 4) | (n2 >> 2));
      const n3 = idx.get(s[i + 3]);
      if (n3 !== undefined) bytes.push(((n2 & 3) << 6) | n3);
    }
  }
  return new Uint8Array(bytes);
}

async function pump(
  bytes: Uint8Array<ArrayBuffer>,
  ts: { readable: ReadableStream<Uint8Array>; writable: WritableStream<BufferSource> },
): Promise<Uint8Array> {
  const writer = ts.writable.getWriter();
  const wrote = writer.write(bytes).then(() => writer.close());
  const reader = ts.readable.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (value) chunks.push(value);
    if (done) break;
  }
  await wrote;
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

// zlib-wrapped 'deflate' (not 'deflate-raw'): identical browser support, a few
// bytes of header, and it also exists in Node 20.11 where vitest runs.
const deflate = (bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> =>
  pump(bytes, new CompressionStream('deflate'));

const inflate = (bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> =>
  pump(bytes, new DecompressionStream('deflate'));

/** Mint a signaling token — compressed v2 when the browser can, raw v1 otherwise. */
export async function encodeSdpToken(magic: string, sdp: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') return encodeToken(magic, { v: 1, sdp });
  const z = bytesToB64url(await deflate(new TextEncoder().encode(sdp)));
  return encodeToken(magic, { v: 2, z });
}

/** Inverse of encodeSdpToken — accepts both payload dialects, throws otherwise. */
export async function decodeSdpToken(magic: string, token: string): Promise<string> {
  const raw = decodeToken(magic, token) as { v?: unknown; sdp?: unknown; z?: unknown };
  if (raw.v === 1 && typeof raw.sdp === 'string') return raw.sdp;
  if (raw.v === 2 && typeof raw.z === 'string') {
    if (typeof DecompressionStream === 'undefined') throw new Error('coop-token-unsupported');
    return new TextDecoder().decode(await inflate(b64urlToBytes(raw.z)));
  }
  throw new Error('unknown signaling payload');
}
