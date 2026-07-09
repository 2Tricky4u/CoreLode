/** Virtual d-pad + item hotbar for touch devices; writes into InputManager. */
import type { InputManager } from '@input/InputManager';
import { el } from './reactive';

export class TouchControls {
  readonly node: HTMLElement;

  constructor(input: InputManager, layout: 'left' | 'right' = 'right') {
    const dir = (cls: string, key: 'left' | 'right' | 'up' | 'down', label: string) => {
      const btn = el('button', { class: `tc-btn ${cls}`, text: label });
      const on = (e: Event) => {
        e.preventDefault();
        input.touch[key] = true;
      };
      const off = (e: Event) => {
        e.preventDefault();
        input.touch[key] = false;
      };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointerleave', off);
      btn.addEventListener('pointercancel', off);
      return btn;
    };
    const pad = el(
      'div',
      { class: 'tc-pad' },
      dir('tc-up', 'up', '▲'),
      el(
        'div',
        { class: 'tc-mid' },
        dir('tc-left', 'left', '◀'),
        dir('tc-down', 'down', '▼'),
        dir('tc-right', 'right', '▶'),
      ),
    );
    this.node = el('div', { class: `touch-controls layout-${layout}` }, pad);
  }

  setVisible(on: boolean): void {
    this.node.style.display = on ? '' : 'none';
  }
}
