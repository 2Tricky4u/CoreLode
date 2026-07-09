/**
 * DOM overlay root: layer stack (hud < modal < screen < toast).
 *
 * The canvas is letterboxed (fixed 550×400 aspect via Phaser Scale.FIT), so on a
 * wide monitor there are empty bars beside it. The overlay is therefore pinned to
 * the CANVAS rectangle rather than the viewport — the HUD always sits inside the
 * playfield, and only the empty sidebars grow. `--px` mirrors the canvas zoom so
 * UI sizes are authored in game pixels and scale with the picture.
 */
import { el } from './reactive';

/** Internal render size — must match createPhaserGame(). */
export const GAME_W = 550;
export const GAME_H = 400;

export class UiRoot {
  readonly root: HTMLElement;
  readonly hudLayer: HTMLElement;
  readonly modalLayer: HTMLElement;
  readonly screenLayer: HTMLElement;
  readonly toastLayer: HTMLElement;
  private observer: ResizeObserver | null = null;

  constructor() {
    this.root = document.getElementById('ui')!;
    this.hudLayer = el('div', { class: 'layer hud-layer' });
    this.modalLayer = el('div', { class: 'layer modal-layer' });
    this.screenLayer = el('div', { class: 'layer screen-layer' });
    this.toastLayer = el('div', { class: 'layer toast-layer' });
    this.root.append(this.hudLayer, this.modalLayer, this.screenLayer, this.toastLayer);
    window.addEventListener('resize', () => this.syncScale());
    this.syncScale();
  }

  /** Match the overlay box to the canvas and publish the zoom factor as `--px`. */
  syncScale(): void {
    const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
    const stage = document.getElementById('stage');
    if (!canvas || !stage) {
      // Pre-boot: fall back to the full viewport so the title/fatal panel still show.
      document.documentElement.style.setProperty('--px', '1');
      return;
    }

    // Re-sync whenever Phaser resizes the canvas (letterbox bars change width).
    if (!this.observer) {
      this.observer = new ResizeObserver(() => this.applyRect(canvas, stage));
      this.observer.observe(canvas);
    }
    this.applyRect(canvas, stage);
  }

  private applyRect(canvas: HTMLCanvasElement, stage: HTMLElement): void {
    const c = canvas.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    if (c.width < 1 || c.height < 1) return;

    const st = this.root.style;
    st.left = `${c.left - s.left}px`;
    st.top = `${c.top - s.top}px`;
    st.width = `${c.width}px`;
    st.height = `${c.height}px`;
    st.right = 'auto';
    st.bottom = 'auto';

    // Scale UI with the picture, with a floor so it stays legible on tiny windows.
    const scale = Math.max(0.75, c.width / GAME_W);
    document.documentElement.style.setProperty('--px', String(scale));
  }

  toast(text: string, ms = 2200): void {
    const t = el('div', { class: 'toast', text });
    this.toastLayer.append(t);
    setTimeout(() => {
      t.classList.add('fade');
      setTimeout(() => t.remove(), 400);
    }, ms);
  }
}
