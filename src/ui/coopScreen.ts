import { t } from '@content/strings';
/**
 * Co-op lobby: host mints one offer token per seat and pastes each guest's
 * answer back; guests paste the offer and return their answer. All state
 * lives in App (which re-renders this screen on every lobby change).
 */
import { el } from './reactive';

export interface CoopSeatView {
  status: 'waiting' | 'connected';
  offerToken: string;
  label: string;
  /** Expedition sessions: the rig this seat mailed in (badge text), if any. */
  rig?: string | null;
}

export type CoopSessionMode = 'story' | 'exp' | 'daily';

/** My local rig picker (unlocked gear only — purchases live on the Expedition screen). */
export interface CoopRigView {
  loadouts: Array<{ id: string; label: string; active: boolean }>;
  modules: Array<{ id: string; label: string; slotted: boolean }>;
}

export interface CoopScreenOpts {
  view: 'menu' | 'host' | 'join';
  status: string;
  seats: CoopSeatView[];
  canStart: boolean;
  canAddSeat: boolean;
  /** Guest: the minted answer token to send back (null until an offer is pasted). */
  answerToken: string | null;
  /** Host: which session flavor Start will launch. */
  mode: CoopSessionMode;
  /** My rig (shown on the host view in expedition modes, and on the join view). */
  rig: CoopRigView | null;
  onMode: (m: CoopSessionMode) => void;
  onPickLoadout: (id: string) => void;
  onToggleModule: (id: string) => void;
  onHost: () => void;
  onJoin: () => void;
  onAddSeat: () => void;
  onAnswerPaste: (seat: number, text: string) => void;
  onOfferPaste: (text: string) => void;
  onCopy: (text: string) => void;
  onStart: () => void;
  onBack: () => void;
}

const tokenBox = (value: string, onCopy: () => void): HTMLElement => {
  const ta = el('textarea', { class: 'coop-token', readonly: 'readonly' }) as HTMLTextAreaElement;
  ta.value = value;
  ta.rows = 3;
  ta.addEventListener('focus', () => ta.select());
  return el(
    'div',
    { class: 'coop-token-row' },
    ta,
    el('button', { class: 'btn tiny', onclick: onCopy }, t('coopCopy')),
  );
};

const pasteBox = (placeholder: string, onSubmit: (text: string) => void): HTMLElement => {
  const ta = el('textarea', { class: 'coop-token' }) as HTMLTextAreaElement;
  ta.rows = 3;
  ta.placeholder = placeholder;
  return el(
    'div',
    { class: 'coop-token-row' },
    ta,
    el(
      'button',
      {
        class: 'btn tiny primary',
        onclick: () => {
          if (ta.value.trim()) onSubmit(ta.value.trim());
        },
      },
      t('coopAccept'),
    ),
  );
};

const rigSection = (o: CoopScreenOpts): HTMLElement | null => {
  if (!o.rig) return null;
  return el(
    'div',
    { class: 'coop-rig' },
    el('p', { class: 'exp-daily-note', text: t('coopMyRig') }),
    el(
      'div',
      { class: 'btn-row wrap' },
      ...o.rig.loadouts.map((l) =>
        el(
          'button',
          { class: `btn tiny${l.active ? ' primary' : ''}`, onclick: () => o.onPickLoadout(l.id) },
          l.label,
        ),
      ),
    ),
    el(
      'div',
      { class: 'btn-row wrap' },
      ...o.rig.modules.map((m) =>
        el(
          'button',
          {
            class: `btn tiny${m.slotted ? ' primary' : ''}`,
            onclick: () => o.onToggleModule(m.id),
          },
          m.label,
        ),
      ),
    ),
  );
};

export function coopScreen(o: CoopScreenOpts): HTMLElement {
  const kids: (HTMLElement | null)[] = [
    el('h2', { text: t('coopTitle') }),
    el('p', { class: 'epilogue', text: t('coopBlurb') }),
    el('p', { class: 'coop-status', text: o.status }),
  ];

  if (o.view === 'menu') {
    kids.push(
      el(
        'div',
        { class: 'btn-col' },
        el('button', { class: 'btn primary', onclick: o.onHost }, t('coopHost')),
        el('button', { class: 'btn primary', onclick: o.onJoin }, t('coopJoin')),
        el('p', { class: 'exp-daily-note', text: t('coopLanNote') }),
        el('button', { class: 'btn', onclick: o.onBack }, t('backToTitle')),
      ),
    );
  } else if (o.view === 'host') {
    // Session flavor: story co-op, expedition, or the (unrecorded) daily.
    kids.push(
      el(
        'div',
        { class: 'btn-row' },
        ...(
          [
            ['story', t('coopModeStory')],
            ['exp', t('coopModeExp')],
            ['daily', t('coopModeDaily')],
          ] as Array<[CoopSessionMode, string]>
        ).map(([m, label]) =>
          el(
            'button',
            { class: `btn tiny${o.mode === m ? ' primary' : ''}`, onclick: () => o.onMode(m) },
            label,
          ),
        ),
      ),
    );
    if (o.mode === 'daily')
      kids.push(el('p', { class: 'exp-daily-note', text: t('coopDailyNote') }));
    if (o.mode === 'exp') {
      const rig = rigSection(o);
      if (rig) kids.push(rig);
    }
    const seatRows = o.seats.map((seat, i) =>
      el(
        'div',
        { class: 'coop-seat' },
        el('strong', { text: seat.label }),
        seat.status === 'connected'
          ? el('span', {
              class: 'coop-ok',
              text: ` ${t('coopConnected')}${seat.rig ? ` · ${seat.rig}` : ''}`,
            })
          : el(
              'div',
              {},
              el('p', { class: 'exp-daily-note', text: t('coopSendOffer') }),
              tokenBox(seat.offerToken, () => o.onCopy(seat.offerToken)),
              el('p', { class: 'exp-daily-note', text: t('coopPasteAnswer') }),
              pasteBox(t('coopAnswerPh'), (text) => o.onAnswerPaste(i, text)),
            ),
      ),
    );
    kids.push(
      el('div', { class: 'coop-seats' }, ...seatRows),
      el(
        'div',
        { class: 'btn-row' },
        o.canAddSeat
          ? el('button', { class: 'btn', onclick: o.onAddSeat }, t('coopAddSeat'))
          : null,
        el(
          'button',
          { class: `btn${o.canStart ? ' primary' : ''}`, onclick: o.onStart },
          t('coopStart'),
        ),
        el('button', { class: 'btn', onclick: o.onBack }, t('backToTitle')),
      ),
    );
  } else {
    // join view
    if (o.answerToken === null) {
      kids.push(
        el('p', { class: 'exp-daily-note', text: t('coopPasteOffer') }),
        pasteBox(t('coopOfferPh'), o.onOfferPaste),
      );
    } else {
      kids.push(
        el('p', { class: 'exp-daily-note', text: t('coopSendAnswer') }),
        tokenBox(o.answerToken, () => o.onCopy(o.answerToken ?? '')),
      );
    }
    // The guest's rig rides along in case the host starts an expedition.
    const rig = rigSection(o);
    if (rig) {
      kids.push(el('p', { class: 'exp-daily-note', text: t('coopRigNote') }), rig);
    }
    kids.push(
      el(
        'div',
        { class: 'btn-row' },
        el('button', { class: 'btn', onclick: o.onBack }, t('backToTitle')),
      ),
    );
  }

  return el('div', { class: 'panel coop' }, ...kids);
}
