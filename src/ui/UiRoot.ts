/**
 * DOM overlay root: layer stack (hud < modal < screen < toast).
 *
 * The canvas fills the viewport (Phaser Scale.RESIZE — no letterbox), so the
 * overlay simply spans the viewport too. `--px` follows the picture zoom via
 * the shared viewport policy, so UI sizes authored in game pixels scale with
 * the play field and stay legible on touch screens (1.0 floor).
 */
import { DESIGN_H, DESIGN_W, uiScaleForViewport } from '@game/viewportPolicy';
import { el } from './reactive';

/** Design render size (the original 550×400 stage) — re-exported for UI math. */
export const GAME_W = DESIGN_W;
export const GAME_H = DESIGN_H;

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

  /** Publish the UI scale as `--px` (the overlay is already viewport-sized). */
  syncScale(): void {
    const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
    // Track canvas box changes too (Phaser RESIZE follows the viewport, but the
    // observer also catches URL-bar show/hide and fullscreen transitions).
    if (canvas && !this.observer) {
      this.observer = new ResizeObserver(() => this.applyScale());
      this.observer.observe(canvas);
    }
    this.applyScale();
  }

  private applyScale(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w < 1 || h < 1) return;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    document.documentElement.style.setProperty('--px', String(uiScaleForViewport(w, h, coarse)));
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
