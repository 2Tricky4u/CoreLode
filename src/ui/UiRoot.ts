/**
 * DOM overlay root: layer stack (hud < modal < screen < toast) and pixel-scale
 * sync — UI dimensions are authored in game pixels × var(--px).
 */
import { el } from './reactive';

export class UiRoot {
  readonly root: HTMLElement;
  readonly hudLayer: HTMLElement;
  readonly modalLayer: HTMLElement;
  readonly screenLayer: HTMLElement;
  readonly toastLayer: HTMLElement;

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

  /** Mirror the canvas zoom into a CSS var so DOM pixels track game pixels. */
  syncScale(): void {
    const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
    const gameW = 550;
    const w = canvas?.clientWidth ?? window.innerWidth;
    document.documentElement.style.setProperty('--px', String(Math.max(1, w / gameW)));
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
