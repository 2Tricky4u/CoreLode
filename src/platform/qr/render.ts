/**
 * Paint a QR symbol onto a canvas at its natural pixel size (scale 4, quiet
 * zone 4 modules — the spec minimum); CSS scales it up and
 * image-rendering: pixelated keeps the modules crisp. Black on white
 * deliberately: scanners need contrast, not theme colors.
 */
import { Ecc, QrCode } from './qrcodegen';

const SCALE = 4;
const BORDER = 4;

/** False when the text exceeds QR capacity — caller keeps the textarea only. */
export function drawQrCanvas(canvas: HTMLCanvasElement, text: string): boolean {
  let qr: ReturnType<typeof QrCode.encodeText>;
  try {
    // Ecc.LOW fits the most data; boostEcl (default) raises it back up when
    // the chosen version has slack.
    qr = QrCode.encodeText(text, Ecc.LOW);
  } catch {
    return false;
  }
  const size = (qr.size + BORDER * 2) * SCALE;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000';
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.getModule(x, y)) {
        ctx.fillRect((x + BORDER) * SCALE, (y + BORDER) * SCALE, SCALE, SCALE);
      }
    }
  }
  return true;
}
