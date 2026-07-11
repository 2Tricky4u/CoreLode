import { saleValue } from './data/difficulty';
import { ITEM_BY_ID, type ItemId } from './data/items';
/**
 * Shop/UI commands — applied between ticks while the sim is paused (modals).
 * Prices verbatim: upgrades per table, repair $15/HP, fuel $1/L; selling moves
 * the whole hold at value ÷ NG+ mod (points were already granted on dig).
 * Buying a hull fully repairs (authentic).
 */
import { COLLECTIBLES } from './data/minerals';
import {
  FUEL_PRICE_PER_L,
  REPAIR_COST_PER_HP,
  UPGRADES,
  type UpgradeCategory,
} from './data/upgrades';
import type { EventSink } from './events';
import { type GameState, bayUsed, maxHull, podMass, tankCapacity, wallet } from './sim/state';

export type Command =
  | { c: 'chooseRelic'; id: string }
  | { c: 'buyUpgrade'; category: UpgradeCategory }
  | { c: 'buyItem'; item: ItemId; qty: number }
  | { c: 'sellAllCargo' }
  | { c: 'refuel'; liters: number | 'full' }
  | { c: 'repair'; hp: number | 'full' }
  | { c: 'jettison'; collectibleId: number };

/**
 * Apply a shop/UI command for `player` (acting pod = s.pods[player]). Solo and
 * challenge callers pass 0. In lockstep co-op, commands ride the input stream
 * and both peers apply them at the same tick in (tick, player) order.
 */
export function applyCommand(s: GameState, cmd: Command, player: number, out: EventSink): void {
  const p = s.pods[player];
  if (!p) return; // out-of-range player index — ignore (defensive vs. bad peers)
  switch (cmd.c) {
    case 'chooseRelic': {
      // Only a relic currently offered to THIS player may be taken.
      if (!s.pendingRelicChoices[player]?.includes(cmd.id)) return;
      p.relics.push(cmd.id);
      s.pendingRelicChoices[player] = null;
      out.push({ t: 'sfx', key: 'schematic' });
      break;
    }
    case 'buyUpgrade': {
      const tiers = UPGRADES[cmd.category];
      const next = p.upgrades[cmd.category] + 1;
      if (next >= tiers.length) return;
      const price = tiers[next].price;
      if (wallet(s).cash < price) {
        out.push({ t: 'sfx', key: 'error' });
        return;
      }
      wallet(s).cash -= price;
      p.upgrades[cmd.category] = next;
      if (cmd.category === 'hull') p.hp = maxHull(p); // free full repair with a new hull
      if (cmd.category === 'fuelTank') p.fuel = Math.min(p.fuel, tankCapacity(p));
      out.push({ t: 'transaction', kind: `upgrade:${cmd.category}`, amount: -price });
      out.push({ t: 'sfx', key: 'buy' });
      break;
    }
    case 'buyItem': {
      const def = ITEM_BY_ID[cmd.item];
      const qty = Math.max(1, Math.floor(cmd.qty));
      const price = def.price * qty;
      if (wallet(s).cash < price) {
        out.push({ t: 'sfx', key: 'error' });
        return;
      }
      wallet(s).cash -= price;
      p.inventory[cmd.item] = (p.inventory[cmd.item] ?? 0) + qty;
      out.push({ t: 'transaction', kind: `item:${cmd.item}`, amount: -price });
      out.push({ t: 'sfx', key: 'buy' });
      break;
    }
    case 'sellAllCargo': {
      if (bayUsed(p) === 0) return;
      let total = 0;
      let mass = 0;
      for (let i = 0; i < p.bayContents.length; i++) {
        const n = p.bayContents[i];
        if (n === 0) continue;
        total += n * saleValue(COLLECTIBLES[i].value, s.level);
        mass += n * COLLECTIBLES[i].mass;
        s.stats.soldCount[i] = (s.stats.soldCount[i] ?? 0) + n;
        p.bayContents[i] = 0;
      }
      wallet(s).cash += total;
      if (mass > s.stats.biggestSaleMass) s.stats.biggestSaleMass = mass;
      out.push({ t: 'transaction', kind: 'sell', amount: total });
      // Expedition chain vault pays out on top of the sale, then resets.
      // Story sale math above stays byte-authentic (chains never exist there).
      if (s.mode.kind === 'expedition' && p.chain && p.chain.bankPct > 0) {
        const bonus = Math.floor((total * p.chain.bankPct) / 100);
        if (bonus > 0) {
          wallet(s).cash += bonus;
          out.push({ t: 'transaction', kind: 'chainBonus', amount: bonus });
        }
        p.chain.bankPct = 0;
      }
      out.push({ t: 'sfx', key: 'sell' });
      break;
    }
    case 'refuel': {
      const cap = tankCapacity(p);
      const want = cmd.liters === 'full' ? cap - p.fuel : Math.min(cmd.liters, cap - p.fuel);
      if (want <= 0) return;
      const affordable = Math.min(want, wallet(s).cash / FUEL_PRICE_PER_L);
      if (affordable <= 0) {
        out.push({ t: 'sfx', key: 'error' });
        return;
      }
      const cost = Math.ceil(affordable * FUEL_PRICE_PER_L);
      wallet(s).cash -= cost;
      p.fuel = Math.min(cap, p.fuel + affordable);
      if (s.mode.kind === 'expedition') p.heat = 0; // coolant comes with the fuel line
      out.push({ t: 'transaction', kind: 'fuel', amount: -cost });
      out.push({ t: 'sfx', key: 'refuel' });
      break;
    }
    case 'repair': {
      const missing = maxHull(p) - p.hp;
      const want = cmd.hp === 'full' ? missing : Math.min(cmd.hp, missing);
      if (want <= 0) return;
      const affordable = Math.min(want, Math.floor(wallet(s).cash / REPAIR_COST_PER_HP));
      if (affordable <= 0) {
        out.push({ t: 'sfx', key: 'error' });
        return;
      }
      const cost = affordable * REPAIR_COST_PER_HP;
      wallet(s).cash -= cost;
      p.hp += affordable;
      out.push({ t: 'transaction', kind: 'repair', amount: -cost });
      out.push({ t: 'sfx', key: 'nano' });
      break;
    }
    case 'jettison': {
      if ((p.bayContents[cmd.collectibleId] ?? 0) <= 0) return;
      p.bayContents[cmd.collectibleId]--;
      out.push({ t: 'transaction', kind: 'jettison', amount: 0 });
      out.push({ t: 'sfx', key: 'uiBack' });
      break;
    }
  }
  void podMass; // (mass is derived; command layer doesn't cache it)
}
