/**
 * Export/import string codec: 'CLD1.' + base64url(JSON) + '.' + crc32.
 * Compression (deflate) happens in the platform layer where CompressionStream
 * exists; this pure codec guarantees integrity and versioning.
 */
import { SaveError, migrateAndValidate } from './migrate';
import type { SaveFile } from './schema';

const MAGIC = 'CLD1';

export function crc32(str: string): number {
  let crc = ~0;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) & 0xff;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

const b64encode = (s: string): string => {
  // UTF-8 safe base64url without DOM APIs.
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.codePointAt(i)!;
    if (c > 0xffff) i++;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else
      bytes.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 63),
        0x80 | ((c >> 6) & 63),
        0x80 | (c & 63),
      );
  }
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += ABC[b0 >> 2] + ABC[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '' : ABC[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '' : ABC[b2 & 63];
  }
  return out;
};

const b64decode = (s: string): string => {
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const idx = new Map([...ABC].map((c, i) => [c, i]));
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i += 4) {
    const n0 = idx.get(s[i]);
    const n1 = idx.get(s[i + 1]);
    if (n0 === undefined || n1 === undefined) throw new SaveError('bad base64');
    bytes.push((n0 << 2) | (n1 >> 4));
    const n2 = idx.get(s[i + 2]);
    if (n2 !== undefined) {
      bytes.push(((n1 & 15) << 4) | (n2 >> 2));
      const n3 = idx.get(s[i + 3]);
      if (n3 !== undefined) bytes.push(((n2 & 3) << 6) | n3);
    }
  }
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    if (b < 0x80) {
      out += String.fromCodePoint(b);
      i++;
    } else if (b < 0xe0) {
      out += String.fromCodePoint(((b & 31) << 6) | (bytes[i + 1] & 63));
      i += 2;
    } else if (b < 0xf0) {
      out += String.fromCodePoint(
        ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63),
      );
      i += 3;
    } else {
      out += String.fromCodePoint(
        ((b & 7) << 18) |
          ((bytes[i + 1] & 63) << 12) |
          ((bytes[i + 2] & 63) << 6) |
          (bytes[i + 3] & 63),
      );
      i += 4;
    }
  }
  return out;
};

export function encodeSave(save: SaveFile): string {
  const json = JSON.stringify(save);
  const body = b64encode(json);
  return `${MAGIC}.${body}.${crc32(body).toString(36)}`;
}

export function decodeSave(text: string): SaveFile {
  const parts = text.trim().split('.');
  if (parts.length !== 3 || parts[0] !== MAGIC) throw new SaveError('not a save code');
  const [, body, crc] = parts;
  if (crc32(body).toString(36) !== crc) throw new SaveError('corrupt save (checksum)');
  const json = b64decode(body);
  return migrateAndValidate(JSON.parse(json));
}
