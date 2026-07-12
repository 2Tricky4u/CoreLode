import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { Ecc, QrCode, type QrCodeSymbol } from './qrcodegen';

/** Paint the module matrix as RGBA the way render.ts will (scale 4, border 4). */
function rasterize(qr: QrCodeSymbol, scale = 4, border = 4) {
  const size = (qr.size + border * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / scale) - border;
      const my = Math.floor(y / scale) - border;
      const dark = mx >= 0 && my >= 0 && mx < qr.size && my < qr.size && qr.getModule(mx, my);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = dark ? 0 : 255;
      data[i + 3] = 255;
    }
  }
  return { data, width: size, height: size };
}

const roundTrip = (text: string): string | null => {
  const qr = QrCode.encodeText(text, Ecc.LOW);
  expect(qr.size).toBeLessThanOrEqual(177); // ≤ version 40
  const { data, width, height } = rasterize(qr);
  return jsQR(data, width, height)?.data ?? null;
};

// Deterministic token-alphabet filler (no Math.random in tests).
const filler = (n: number): string => {
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < n; i++) out += ABC[(i * 31 + 7) % ABC.length];
  return out;
};

describe('vendored qrcodegen ↔ jsQR', () => {
  it('round-trips a short invite URL', () => {
    const text = `https://x.github.io/CoreLode/#coop=CLDP1.${filler(80)}.z9`;
    expect(roundTrip(text)).toBe(text);
  });

  it('round-trips a full-size compressed reply token', () => {
    const text = `CLDP2.${filler(1300)}.1a2b3c`;
    expect(roundTrip(text)).toBe(text);
  });
});
