import { t } from '@content/strings';
/** Full-screen DOM views: title, save slots, settings, challenge select, ending stats. */
import {
  CHALLENGES,
  COLLECTIBLES,
  type GameState,
  SETTING_DEFS,
  type SettingsValues,
  saleValue,
} from '@core/index';
import type { ChallengeRecords, SlotMeta } from '@platform/storage';
import { el } from './reactive';

export class ScreenHost {
  private current: HTMLElement | null = null;
  constructor(private layer: HTMLElement) {}

  show(node: HTMLElement): void {
    this.clear();
    this.current = el('div', { class: 'screen' }, node);
    this.layer.append(this.current);
  }
  clear(): void {
    this.current?.remove();
    this.current = null;
  }
  get visible(): boolean {
    return this.current !== null;
  }
}

export function titleScreen(opts: {
  canContinue: boolean;
  onNew: () => void;
  onContinue: () => void;
  onLoad: () => void;
  onChallenges: () => void;
  onSettings: () => void;
  onHelp: () => void;
}): HTMLElement {
  return el(
    'div',
    { class: 'title-screen' },
    el('h1', { class: 'game-title', text: t('title') }),
    el('p', { class: 'tagline', text: t('tagline') }),
    el(
      'div',
      { class: 'btn-col menu' },
      opts.canContinue
        ? el('button', { class: 'btn primary', onclick: opts.onContinue }, t('continueGame'))
        : null,
      el('button', { class: 'btn primary', onclick: opts.onNew }, t('newGame')),
      el('button', { class: 'btn', onclick: opts.onLoad }, t('uiLoad')),
      el('button', { class: 'btn', onclick: opts.onChallenges }, t('challenges')),
      el('button', { class: 'btn', onclick: opts.onHelp }, 'Controls & Guide'),
      el('button', { class: 'btn', onclick: opts.onSettings }, t('settings')),
    ),
    el('p', { class: 'credits', text: t('credits') }),
  );
}

export function saveSlotsScreen(opts: {
  slots: SlotMeta[];
  onLoad: (key: string) => void;
  onDelete: (key: string) => void;
  onExport: (key: string) => void;
  onImport: () => void;
  onBack: () => void;
}): HTMLElement {
  const list = el('div', { class: 'slot-list' });
  const manual = ['manual:0', 'manual:1', 'manual:2'];
  const autos = opts.slots.filter((s) => s.key.startsWith('auto')).map((s) => s.key);
  for (const key of [...manual, ...autos]) {
    const meta = opts.slots.find((s) => s.key === key);
    if (!meta) {
      list.append(
        el('div', { class: 'slot empty' }, el('span', { text: `${key} — ${t('uiEmptySlot')}` })),
      );
      continue;
    }
    list.append(
      el(
        'div',
        { class: 'slot' },
        el('span', {
          text: `${key} · lvl ${meta.level} · $${meta.cash.toLocaleString('en-US')} · ${Math.round(meta.depthFt)} ft · ${new Date(meta.updatedAt).toLocaleString()}`,
        }),
        el(
          'span',
          { class: 'slot-actions' },
          el('button', { class: 'btn tiny', onclick: () => opts.onLoad(key) }, t('uiLoad')),
          el('button', { class: 'btn tiny', onclick: () => opts.onExport(key) }, t('uiExport')),
          el(
            'button',
            { class: 'btn tiny danger', onclick: () => opts.onDelete(key) },
            t('uiDelete'),
          ),
        ),
      ),
    );
  }
  return el(
    'div',
    { class: 'panel' },
    el('h2', { text: 'Saved Games' }),
    list,
    el(
      'div',
      { class: 'btn-row' },
      el('button', { class: 'btn', onclick: opts.onImport }, t('uiImport')),
      el('button', { class: 'btn', onclick: opts.onBack }, '◀ Back'),
    ),
  );
}

export function settingsScreen(opts: {
  values: SettingsValues;
  onChange: (id: string, v: boolean | number | string) => void;
  onBack: () => void;
}): HTMLElement {
  const rows = el('div', { class: 'settings-list' });
  for (const def of SETTING_DEFS) {
    let control: HTMLElement;
    const val = opts.values[def.id];
    if (def.type === 'bool') {
      control = el('input', {
        type: 'checkbox',
        onchange: (e) => opts.onChange(def.id, (e.target as HTMLInputElement).checked),
      });
      (control as HTMLInputElement).checked = Boolean(val);
    } else if (def.type === 'range') {
      control = el('input', {
        type: 'range',
        min: def.min ?? 0,
        max: def.max ?? 1,
        step: 0.05,
        oninput: (e) => opts.onChange(def.id, Number((e.target as HTMLInputElement).value)),
      });
      (control as HTMLInputElement).value = String(val);
    } else {
      const sel = el('select', {
        onchange: (e) => opts.onChange(def.id, (e.target as HTMLSelectElement).value),
      });
      for (const o of def.options ?? []) {
        const opt = el('option', { value: o, text: o });
        if (o === val) opt.setAttribute('selected', 'selected');
        sel.append(opt);
      }
      control = sel;
    }
    rows.append(
      el(
        'label',
        { class: `setting-row ${def.affectsFidelity ? 'fidelity' : ''}` },
        el('span', { text: t(def.labelKey) }),
        control,
      ),
    );
  }
  return el(
    'div',
    { class: 'panel' },
    el('h2', { text: t('settings') }),
    rows,
    el('div', { class: 'btn-row' }, el('button', { class: 'btn', onclick: opts.onBack }, '◀ Back')),
  );
}

export function challengeScreen(opts: {
  records: ChallengeRecords;
  onPlay: (id: string) => void;
  onBack: () => void;
}): HTMLElement {
  const list = el('div', { class: 'challenge-list' });
  let completed = 0;
  for (const ch of CHALLENGES) {
    const rec = opts.records[ch.id];
    if (rec?.completions) completed++;
    list.append(
      el(
        'div',
        { class: 'challenge-row' },
        el(
          'div',
          { class: 'ch-info' },
          el('strong', { text: `${rec?.completions ? '★ ' : ''}${t(ch.key)}` }),
          el('small', { text: t(`${ch.key}Blurb`) }),
          rec?.bestTicks
            ? el('small', { class: 'muted', text: `best: ${(rec.bestTicks / 42).toFixed(1)}s` })
            : null,
        ),
        el('button', { class: 'btn', onclick: () => opts.onPlay(ch.id) }, '▶'),
      ),
    );
  }
  return el(
    'div',
    { class: 'panel' },
    el('h2', { text: `${t('challenges')} (${completed}/${CHALLENGES.length})` }),
    completed >= CHALLENGES.length ? el('p', { class: 'reward', text: t('chReward') }) : null,
    list,
    el('div', { class: 'btn-row' }, el('button', { class: 'btn', onclick: opts.onBack }, '◀ Back')),
  );
}

export function endingScreen(opts: {
  state: GameState;
  onNgPlus: () => void;
  onTitle: () => void;
}): HTMLElement {
  const s = opts.state;
  let haulValue = 0;
  s.pod.bayContents.forEach((n, i) => {
    haulValue += n * saleValue(COLLECTIBLES[i].value, s.level);
  });
  const score = s.pod.points + Math.floor(s.pod.cash) + haulValue;
  const stat = (label: string, value: string) =>
    el('div', { class: 'stat-row' }, el('span', { text: label }), el('span', { text: value }));
  return el(
    'div',
    { class: 'panel ending' },
    el('h2', { text: t('uiStats') }),
    el('p', { class: 'epilogue', text: t('epilogue') }),
    stat('Final cash', `$${Math.floor(s.pod.cash).toLocaleString('en-US')}`),
    stat('Unsold trophies', `$${haulValue.toLocaleString('en-US')}`),
    stat('Points', s.pod.points.toLocaleString('en-US')),
    stat(t('uiScore'), score.toLocaleString('en-US')),
    stat('Tiles dug', String(s.stats.tilesDug)),
    stat('Damage taken', String(s.stats.damageTaken)),
    stat('Quakes survived', String(s.stats.quakes)),
    stat('Tour (NG+ level)', String(s.level)),
    el('p', { class: 'ngplus', text: t('ngPlusPrompt') }),
    el(
      'div',
      { class: 'btn-row' },
      el('button', { class: 'btn primary', onclick: opts.onNgPlus }, 'Sign again (NG+)'),
      el('button', { class: 'btn', onclick: opts.onTitle }, t('backToTitle')),
    ),
  );
}
