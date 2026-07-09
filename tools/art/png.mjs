import { writeFileSync } from 'node:fs';
/** Dependency-free PNG writer + pixel Sprite buffer (art pipeline core). */
import { deflateSync } from 'node:zlib';

const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = ~0;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

export function writePng(path, width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

export class Sprite {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4);
  }
  px(x, y, c, a = 255) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = a;
  }
  /** Alpha at (x,y) — 0 outside. */
  a(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }
  get(x, y) {
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }
  rect(x, y, w, h, c, a = 255) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c, a);
  }
  hline(x0, x1, y, c, a = 255) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.px(x, y, c, a);
  }
  circle(cx, cy, r, c, a = 255) {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) this.px(cx + x, cy + y, c, a);
  }
  /** Filled convex polygon (scanline). pts: [[x,y],...] */
  poly(pts, c, a = 255) {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const y1 = Math.min(this.h - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if (ay === by) continue;
        if ((y >= Math.min(ay, by) && y < Math.max(ay, by)) || y === Math.max(ay, by)) {
          if (y >= Math.min(ay, by) && y <= Math.max(ay, by)) {
            xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
          }
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        this.hline(Math.round(xs[i]), Math.round(xs[i + 1]), y, c, a);
      }
    }
  }
  /** Copy another sprite onto this one (alpha-over, 0/255 pixels). */
  blit(src, dx, dy) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        if (src.data[i + 3] > 0) {
          const j = ((dy + y) * this.w + (dx + x)) * 4;
          if (dx + x < 0 || dx + x >= this.w || dy + y < 0 || dy + y >= this.h) continue;
          this.data[j] = src.data[i];
          this.data[j + 1] = src.data[i + 1];
          this.data[j + 2] = src.data[i + 2];
          this.data[j + 3] = src.data[i + 3];
        }
      }
    }
  }
  clone() {
    const s = new Sprite(this.w, this.h);
    this.data.copy(s.data);
    return s;
  }
  mirrorX() {
    const s = new Sprite(this.w, this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        const j = (y * this.w + (this.w - 1 - x)) * 4;
        this.data.copy(s.data, j, i, i + 4);
      }
    return s;
  }
  /** Nearest-neighbour upscale. */
  scale(f) {
    const s = new Sprite(this.w * f, this.h * f);
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        const i = (((y / f) | 0) * this.w + ((x / f) | 0)) * 4;
        const j = (y * s.w + x) * 4;
        this.data.copy(s.data, j, i, i + 4);
      }
    return s;
  }
  /** Shift content (for derived animation frames); drops pixels off-edge. */
  shifted(dx, dy) {
    const s = new Sprite(this.w, this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.a(x, y) > 0) {
          const i = (y * this.w + x) * 4;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
          this.data.copy(s.data, (ny * this.w + nx) * 4, i, i + 4);
        }
      }
    return s;
  }
  /** Trace a 1px outline in `color` on opaque pixels that border transparency. */
  outline(color) {
    const src = this.clone();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (src.a(x, y) === 0) continue;
        if (
          src.a(x - 1, y) === 0 ||
          src.a(x + 1, y) === 0 ||
          src.a(x, y - 1) === 0 ||
          src.a(x, y + 1) === 0
        ) {
          this.px(x, y, color);
        }
      }
    return this;
  }
}

/** Tiny deterministic RNG for texture generators. */
export function texRng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a * 1103515245 + 12345) & 0x7fffffff;
    return a / 0x7fffffff;
  };
}
