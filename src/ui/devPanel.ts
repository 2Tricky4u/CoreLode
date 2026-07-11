/**
 * Hidden developer panel — unlocked by typing the secret sequence on the title
 * screen (see DEV_SEQUENCE in App.ts), then opened with ` (backquote) in-game.
 * Developer-facing text is intentionally inline, not in content/strings.ts:
 * it is not player-visible content and must not ship in the fiction pack.
 */
import type { ModalManager } from './modals';
import { el } from './reactive';

export interface DevActions {
  /** One-line live status: depth/tile/seed/mode. */
  info: () => string;
  /** Networked session: hide state mutators — a host-local edit desyncs the crew. */
  lockstep?: boolean;
  give: (kind: 'cash' | 'points' | 'items' | 'upgrades' | 'blueprints' | 'refit') => void;
  /** Returns the new state of the toggle. */
  toggleGod: () => boolean;
  isGod: () => boolean;
  /** Returns the new speed. */
  cycleSpeed: () => number;
  teleportDepth: (ft: number) => void;
  revealMap: () => void;
  /** X-ray = gas shimmer + ore glyphs + minimap forced on. Returns new state. */
  toggleXray: () => boolean;
  isXray: () => boolean;
  quakeNow: () => void;
  setHeat: (v: number) => void;
  grantAllRelics: () => void;
  clearRelics: () => void;
  completeContracts: () => void;
  spawnCritter: () => void;
  weakenBoss: () => void;
  addCores: (n: number) => void;
}

export function openDevPanel(m: ModalManager, a: DevActions): void {
  const btn = (label: string, onclick: () => void) =>
    el('button', { class: 'btn tiny', onclick }, label);
  const toggleBtn = (label: () => string, onclick: () => void) => {
    const b = el('button', { class: 'btn tiny' }, label());
    b.addEventListener('click', () => {
      onclick();
      b.textContent = label();
    });
    return b;
  };
  const section = (title: string, ...kids: (HTMLElement | null)[]) =>
    el(
      'div',
      { class: 'dev-section' },
      el('h3', { class: 'dev-h', text: title }),
      el('div', { class: 'btn-row wrap' }, ...kids),
    );

  const info = el('p', { class: 'dev-info', text: a.info() });
  const refresh = () => {
    info.textContent = a.info();
  };
  const act = (fn: () => void) => () => {
    fn();
    refresh();
  };

  const speedBtn = el('button', { class: 'btn tiny' }, 'Speed ×1');
  speedBtn.addEventListener('click', () => {
    speedBtn.textContent = `Speed ×${a.cycleSpeed()}`;
    refresh();
  });

  const body = el(
    'div',
    { class: 'dialog-body dev-body' },
    info,
    section(
      'POD',
      btn(
        '+$100k',
        act(() => a.give('cash')),
      ),
      btn(
        '+100k pts',
        act(() => a.give('points')),
      ),
      btn(
        'Refuel + repair',
        act(() => a.give('refit')),
      ),
      btn(
        'Max upgrades',
        act(() => a.give('upgrades')),
      ),
      btn(
        'All blueprints',
        act(() => a.give('blueprints')),
      ),
      btn(
        'Items ×10',
        act(() => a.give('items')),
      ),
      toggleBtn(
        () => `God mode: ${a.isGod() ? 'ON' : 'off'}`,
        act(() => a.toggleGod()),
      ),
    ),
    section(
      'WORLD',
      btn(
        'Surface',
        act(() => a.teleportDepth(0)),
      ),
      btn(
        '−1,000 ft',
        act(() => a.teleportDepth(-1_000)),
      ),
      btn(
        '−3,000 ft',
        act(() => a.teleportDepth(-3_000)),
      ),
      btn(
        '−5,000 ft',
        act(() => a.teleportDepth(-5_000)),
      ),
      btn(
        'Arena',
        act(() => a.teleportDepth(-7_320)),
      ),
      btn('Depth…', () => {
        const v = Number(window.prompt('Teleport to depth (ft, negative = down):', '-2000'));
        if (Number.isFinite(v)) {
          a.teleportDepth(v);
          refresh();
        }
      }),
      btn(
        'Reveal minimap',
        act(() => a.revealMap()),
      ),
      toggleBtn(
        () => `X-ray: ${a.isXray() ? 'ON' : 'off'}`,
        act(() => a.toggleXray()),
      ),
      btn(
        'Quake now',
        act(() => a.quakeNow()),
      ),
      btn(
        'Boss → 1 HP',
        act(() => a.weakenBoss()),
      ),
    ),
    section('RUN', speedBtn),
    a.lockstep
      ? section(
          'EXPEDITION',
          el('span', { class: 'dev-note', text: 'disabled in co-op (would desync)' }),
        )
      : section(
          'EXPEDITION',
          btn(
            'Heat 0',
            act(() => a.setHeat(0)),
          ),
          btn(
            'Heat 90',
            act(() => a.setHeat(90)),
          ),
          btn(
            'All relics',
            act(() => a.grantAllRelics()),
          ),
          btn(
            'Clear relics',
            act(() => a.clearRelics()),
          ),
          btn(
            'Finish contracts',
            act(() => a.completeContracts()),
          ),
          btn(
            'Spawn magmite',
            act(() => a.spawnCritter()),
          ),
          btn(
            '+10 cores',
            act(() => a.addCores(10)),
          ),
        ),
  );

  m.open(
    el(
      'div',
      { class: 'dialog t-dev' },
      el('h2', { class: 'dialog-title', text: 'DEV PANEL' }),
      body,
      el(
        'div',
        { class: 'btn-row' },
        el('button', { class: 'btn', 'data-cancel': 'true', onclick: () => m.close() }, 'Close'),
      ),
    ),
  );
}
