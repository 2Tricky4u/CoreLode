/**
 * Controls & Guide screen — reachable from the title and the pause menu.
 * Everything here is descriptive; names come from the content pack so the
 * clean-room rename stays in one place.
 */
import { t } from '@content/strings';
import { BUILDINGS, FUEL_PRICE_PER_L, ITEMS, REPAIR_COST_PER_HP } from '@core/index';
import { INTERACT_LABEL } from '@input/InputManager';
import { el } from './reactive';

const key = (k: string) => el('kbd', { class: 'key', text: k });

const row = (keys: string[], desc: string) =>
  el(
    'div',
    { class: 'help-row' },
    el('span', { class: 'help-keys' }, ...keys.map(key)),
    el('span', { class: 'help-desc', text: desc }),
  );

const section = (title: string, ...children: HTMLElement[]) =>
  el('section', { class: 'help-section' }, el('h3', { text: title }), ...children);

const bullet = (text: string) => el('li', { text });

export function helpScreen(onBack: () => void): HTMLElement {
  const movement = section(
    'Controls',
    row(['←', '→', 'A', 'D'], 'Move — or drill sideways when standing on the ground'),
    row(['↓', 'S'], 'Drill straight down'),
    row(['↑', 'W'], 'Fire the thruster and fly (burns fuel)'),
    row([INTERACT_LABEL], 'Interact — open the building you are standing on'),
    row(['Esc', 'P'], 'Pause (disabled during the final fight)'),
    el('p', {
      class: 'help-note',
      text: 'You can never drill upward, and sideways drilling only works from a standstill. Hold a direction for a moment and the drill bites in.',
    }),
  );

  const itemRows = ITEMS.filter((i) => i.shopVisible).map((i) =>
    row([i.hotkey], `${t(i.key)} — $${i.price.toLocaleString('en-US')}`),
  );
  const items = section(
    'Item hotkeys',
    ...itemRows,
    el('p', {
      class: 'help-note',
      text: 'Explosives and teleporters only work while grounded. Fuel cells and welders work anywhere, even mid-fall.',
    }),
  );

  const goal = section(
    'Your contract',
    el(
      'ul',
      { class: 'help-list' },
      bullet('Dig down, fill your hold with minerals, and fly back to the surface to sell them.'),
      bullet(
        'Spend the money on a better drill, hull, engine, fuel tank, radiator and cargo hold.',
      ),
      bullet('Rarer minerals only exist deeper — but so do the things that kill you.'),
      bullet(`Your employer keeps in touch as you descend. Listen to what the other rigs say.`),
      bullet(
        'Reach the bottom (−7,300 ft), find the way through the barrier, and end the contract.',
      ),
    ),
  );

  const dangers = section(
    'What kills you',
    el(
      'ul',
      { class: 'help-list' },
      bullet(
        'Fuel — an empty tank underground means the rig is lost. Watch the gauge, not the clock.',
      ),
      bullet('Falling — long drops damage the hull. Brake with the thruster before you land.'),
      bullet('Rock — undrillable boulders appear below ~1,500 ft. Blast them or go around.'),
      bullet('Lava — visible, and it scorches. A better radiator cuts the damage.'),
      bullet(
        'Gas pockets — invisible, they look exactly like soil, and they get deadlier with depth.',
      ),
      bullet('Quakes — the ground shifts. Do not be somewhere stupid when it does.'),
      bullet('At 0 hull the rig explodes and you reload your last save.'),
    ),
  );

  const buildings = section(
    'The surface',
    el(
      'ul',
      { class: 'help-list' },
      ...BUILDINGS.map((b) => bullet(`${t(b.key)} — ${t(`${b.key}Blurb`)}`)),
      bullet(
        `Fuel costs $${FUEL_PRICE_PER_L}/litre; hull repair costs $${REPAIR_COST_PER_HP}/point.`,
      ),
      bullet('Saving happens only at the save station. Use it every trip.'),
    ),
  );

  const extras = section(
    'Beyond the contract',
    el(
      'ul',
      { class: 'help-list' },
      bullet('Selling your whole hold is one click — jettison anything you want to keep first.'),
      bullet('A full hold destroys whatever you mine next, so surface before you fill up.'),
      bullet('Relic Schematics are buried deep: one per world, stronger than anything for sale.'),
      bullet('The Proving Grounds hold 15 timed trials; clear them all for a unique drill.'),
      bullet('Finish the game and sign again — the pay halves, the glory doubles.'),
      bullet('The sky is not a wall. Some people have flown a very long way up.'),
    ),
  );

  return el(
    'div',
    { class: 'panel help-panel' },
    el('h2', { text: 'Controls & Guide' }),
    el('div', { class: 'help-grid' }, movement, items, goal, dangers, buildings, extras),
    el('div', { class: 'btn-row' }, el('button', { class: 'btn', onclick: onBack }, '◀ Back')),
  );
}
