/**
 * In-page QR scanning: getUserMedia + the native BarcodeDetector where the
 * browser has it (Chromium), lazy-loaded jsQR everywhere else (Safari,
 * Firefox — the chunk only downloads on this path). The scan loop runs on an
 * interval, not rAF: decoding is expensive and display-rate buys nothing.
 */

export interface QrScanOpts {
  /** Results that don't pass are ignored and scanning continues. */
  filter?: (text: string) => boolean;
}

type Detector = (video: HTMLVideoElement) => Promise<string | null>;

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

async function nativeDetector(): Promise<Detector | null> {
  const BD = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!BD) return null;
  try {
    if (!(await BD.getSupportedFormats()).includes('qr_code')) return null;
    const det = new BD({ formats: ['qr_code'] });
    return async (video) => (await det.detect(video))[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

async function jsQrDetector(): Promise<Detector> {
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    if (!ctx || video.videoWidth === 0) return null;
    // Cap the sample around 800px: dense reply QRs still resolve, CPU stays sane.
    const scale = Math.min(1, 800 / video.videoWidth);
    const w = Math.max(1, Math.round(video.videoWidth * scale));
    const h = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    return jsQR(img.data, w, h)?.data ?? null;
  };
}

/**
 * Start the camera on `video` and scan until a (filter-passing) QR is found —
 * then stop everything and call onResult once. Resolves to a stop() handle
 * once the camera is live; rejects if getUserMedia is denied/unavailable.
 */
export async function startQrScan(
  video: HTMLVideoElement,
  onResult: (text: string) => void,
  opts: QrScanOpts = {},
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  });

  let stopped = false;
  let interval: ReturnType<typeof setInterval> | undefined;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (interval !== undefined) clearInterval(interval);
    for (const track of stream.getTracks()) track.stop();
    video.srcObject = null;
  };

  try {
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true; // iOS: without it, play() goes fullscreen or refuses
    await video.play();
    const detect = (await nativeDetector()) ?? (await jsQrDetector());

    let busy = false;
    interval = setInterval(() => {
      if (busy || stopped) return;
      busy = true;
      void detect(video)
        .then((text) => {
          if (stopped || text === null) return;
          const t = text.trim();
          if (opts.filter && !opts.filter(t)) return; // someone else's QR
          stop();
          onResult(t);
        })
        .catch(() => {
          /* one bad frame must not kill the loop */
        })
        .finally(() => {
          busy = false;
        });
    }, 180);
  } catch (err) {
    stop();
    throw err;
  }
  return stop;
}
