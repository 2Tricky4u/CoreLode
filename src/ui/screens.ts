import { t } from '@content/strings';
/** Full-screen DOM views: title, save slots, settings, challenge select, ending stats. */
import {
  CHALLENGES,
  COLLECTIBLES,
  type GameState,
  LOADOUTS,
  type LoadoutDef,
  type LoadoutId,
  MODULES,
  MODULE_SLOTS,
  type ModuleDef,
  type ModuleId,
  SETTING_DEFS,
  type SettingsValues,
  saleValue,
} from '@core/index';
import type {
  ChallengeRecords,
  ExpeditionProfile,
  LifetimeRecords,
  SlotMeta,
} from '@platform/storage';
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
  continueMeta?: SlotMeta | null;
  lifetime?: LifetimeRecords | null;
  onNew: () => void;
  onContinue: () => void;
  onExpedition: () => void;
  onLoad: () => void;
  onChallenges: () => void;
  onSettings: () => void;
  onHelp: () => void;
}): HTMLElement {
  const lt = opts.lifetime;
  const bests =
    lt && lt.totalRuns > 0 && lt.deepestFt < 0
      ? el('p', {
          class: 'title-bests',
          text: `${t('titleBests')}: ${Math.round(lt.deepestFt).toLocaleString('en-US')} ft · ${t('titleRichest')}: $${Math.floor(lt.mostCash).toLocaleString('en-US')}`,
        })
      : null;
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
      opts.canContinue && opts.continueMeta
        ? el('p', {
            class: 'title-continue-meta',
            text: `${Math.round(opts.continueMeta.depthFt).toLocaleString('en-US')} ft · $${opts.continueMeta.cash.toLocaleString('en-US')}${
              opts.continueMeta.summary ? ` · cargo ${opts.continueMeta.summary.cargoPct}%` : ''
            }${
              opts.continueMeta.summary?.nextUpgrade
                ? ` · ${t(`${opts.continueMeta.summary.nextUpgrade.category}${opts.continueMeta.summary.nextUpgrade.tier}`)} ${t('uiWithinReach')}`
                : ''
            }`,
          })
        : null,
      el('button', { class: 'btn primary', onclick: opts.onNew }, t('newGame')),
      el('button', { class: 'btn', onclick: opts.onExpedition }, t('expedition')),
      el('button', { class: 'btn', onclick: opts.onLoad }, t('uiLoad')),
      el('button', { class: 'btn', onclick: opts.onChallenges }, t('challenges')),
      el('button', { class: 'btn', onclick: opts.onHelp }, 'Controls & Guide'),
      el('button', { class: 'btn', onclick: opts.onSettings }, t('settings')),
    ),
    bests,
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
    const teaser = meta.summary
      ? ` · cargo ${meta.summary.cargoPct}%${
          meta.summary.nextUpgrade
            ? ` · ${t(`${meta.summary.nextUpgrade.category}${meta.summary.nextUpgrade.tier}`)} ${t('uiWithinReach')}`
            : ''
        }`
      : '';
    list.append(
      el(
        'div',
        { class: 'slot' },
        el('span', {
          text: `${key} · lvl ${meta.level} · $${meta.cash.toLocaleString('en-US')} · ${Math.round(meta.depthFt)} ft${teaser} · ${new Date(meta.updatedAt).toLocaleString()}`,
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

export function expeditionScreen(opts: {
  profile: ExpeditionProfile;
  hasSuspend: boolean;
  /** Today's daily record line, already formatted (null → none yet). */
  dailyBest: string | null;
  onStart: () => void;
  onDaily: () => void;
  onCopyResult: () => void;
  onPasteResult: () => void;
  onResume: () => void;
  onBack: () => void;
  /** Meta-shop callbacks — the app mutates the profile and re-renders. */
  onPickLoadout: (id: LoadoutId) => void;
  onToggleModule: (id: ModuleId) => void;
}): HTMLElement {
  const p = opts.profile;
  const stat = (label: string, value: string) =>
    el('div', { class: 'stat-row' }, el('span', { text: label }), el('span', { text: value }));

  const loadoutBtn = (def: LoadoutDef) => {
    const owned = p.unlocked.loadouts.includes(def.id);
    const picked = p.loadout === def.id;
    const label = owned
      ? t(def.key)
      : `${t(def.key)} — ${t('expLocked')} (${def.cost} ${t('expCores').toLowerCase()})`;
    return el(
      'button',
      {
        class: `btn tiny${picked ? ' primary' : ''}`,
        title: t(`${def.key}Blurb`),
        onclick: () => opts.onPickLoadout(def.id),
      },
      label,
    );
  };

  const moduleBtn = (def: ModuleDef) => {
    const owned = p.unlocked.modules.includes(def.id);
    const slotted = p.slotted.includes(def.id);
    const label = owned ? `${slotted ? '◉ ' : '○ '}${t(def.key)}` : `${t(def.key)} — ${def.cost}⛭`;
    return el(
      'button',
      {
        class: `btn tiny${slotted ? ' primary' : ''}`,
        title: t(`${def.key}Blurb`),
        onclick: () => opts.onToggleModule(def.id),
      },
      label,
    );
  };

  return el(
    'div',
    { class: 'panel expedition' },
    el('h2', { text: t('expTitle') }),
    el('p', { class: 'epilogue', text: t('expBlurb') }),
    stat(t('expCores'), String(p.cores)),
    stat(t('expBestDepth'), `${Math.round(p.bestDepthFt).toLocaleString('en-US')} ft`),
    stat(t('expRuns'), String(p.runs)),
    stat(t('expWins'), String(p.wins)),
    opts.dailyBest ? stat(t('expDailyBest'), opts.dailyBest) : null,
    el('h3', { class: 'exp-section', text: t('expLoadouts') }),
    el('div', { class: 'btn-row wrap' }, ...LOADOUTS.map(loadoutBtn)),
    el('h3', {
      class: 'exp-section',
      text: `${t('expModules')} (${p.slotted.length}/${MODULE_SLOTS} ${t('expSlots')})`,
    }),
    el('div', { class: 'btn-row wrap' }, ...MODULES.map(moduleBtn)),
    el('p', { class: 'exp-daily-note', text: t('expDailyNote') }),
    el(
      'div',
      { class: 'btn-col' },
      opts.hasSuspend
        ? el('button', { class: 'btn primary', onclick: opts.onResume }, t('expResume'))
        : null,
      el(
        'button',
        { class: opts.hasSuspend ? 'btn' : 'btn primary', onclick: opts.onStart },
        t('expStart'),
      ),
      el('button', { class: 'btn', onclick: opts.onDaily }, t('expDaily')),
      el(
        'div',
        { class: 'btn-row' },
        el('button', { class: 'btn tiny', onclick: opts.onCopyResult }, t('expCopyResult')),
        el('button', { class: 'btn tiny', onclick: opts.onPasteResult }, t('expPasteResult')),
      ),
      el('button', { class: 'btn', onclick: opts.onBack }, t('backToTitle')),
    ),
  );
}

export function endingScreen(opts: {
  state: GameState;
  /** Story runs offer NG+; expedition runs bank cores instead. */
  ngPlus: boolean;
  coresBanked?: number;
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
    stat('Deepest descent', `${Math.round(s.story.maxDepthFt).toLocaleString('en-US')} ft`),
    stat(
      'Time on the clock',
      `${Math.floor(s.stats.ticks / 42 / 60)}:${String(Math.floor(s.stats.ticks / 42) % 60).padStart(2, '0')}`,
    ),
    s.stats.bestChain >= 2 ? stat('Best chain', `×${s.stats.bestChain}`) : null,
    s.stats.rescues > 0 ? stat('Emergency tows', String(s.stats.rescues)) : null,
    opts.coresBanked != null ? stat(t('expCoresEarned'), `+${opts.coresBanked} cores`) : null,
    opts.ngPlus ? stat('Tour (NG+ level)', String(s.level)) : null,
    opts.ngPlus ? el('p', { class: 'ngplus', text: t('ngPlusPrompt') }) : null,
    el(
      'div',
      { class: 'btn-row' },
      opts.ngPlus
        ? el('button', { class: 'btn primary', onclick: opts.onNgPlus }, 'Sign again (NG+)')
        : null,
      el(
        'button',
        { class: opts.ngPlus ? 'btn' : 'btn primary', onclick: opts.onTitle },
        t('backToTitle'),
      ),
    ),
  );
}
