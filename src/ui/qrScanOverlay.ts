/**
 * Camera overlay for scanning a reply QR — a plain #ui overlay like fatal.ts,
 * NOT a ModalManager modal: the modal layer stacks under the screen layer and
 * its keys are gated off while a screen (the lobby) is up.
 */
import { t } from '@content/strings';
import { startQrScan } from '@platform/qr/scan';
import { el } from './reactive';

export interface QrScanOverlayOpts {
  title: string;
  hint: string;
  /** Non-matching codes are ignored and scanning continues. */
  filter: (text: string) => boolean;
  onResult: (text: string) => void;
}

/** Open the scanner; returns a close handle (idempotent, also runs on result/cancel). */
export function openQrScanner(opts: QrScanOverlayOpts): () => void {
  const host = document.getElementById('ui') ?? document.body;
  const video = el('video', { class: 'qr-scan-video' });
  const hint = el('p', { class: 'qr-scan-hint', text: opts.hint });

  let stopScan: (() => void) | null = null;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    stopScan?.();
    panel.remove();
  };

  const panel = el(
    'div',
    { class: 'qr-scan-overlay' },
    el(
      'div',
      { class: 'qr-scan-panel' },
      el('h2', { text: opts.title }),
      video,
      hint,
      el(
        'div',
        { class: 'btn-row' },
        el('button', { class: 'btn', onclick: close }, t('coopCancel')),
      ),
    ),
  );
  host.append(panel);

  startQrScan(
    video,
    (text) => {
      close();
      opts.onResult(text);
    },
    { filter: opts.filter },
  )
    .then((stop) => {
      // Cancelled while the camera was warming up — release it right away.
      if (closed) stop();
      else stopScan = stop;
    })
    .catch(() => {
      if (closed) return;
      video.remove();
      hint.textContent = t('coopCameraDenied');
    });

  return close;
}
