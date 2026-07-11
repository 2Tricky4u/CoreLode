# Fidelity checklist — manual QA vs the Ruffle-hosted original

Run side-by-side with the official web re-release (xgenstudios.com/play/motherload) or the
archive.org SWF in Ruffle. Automated items live in the test suite (`npm test`) and are
marked [A]; manual items [M]. CAL items also update `docs/calibration.md`.

## Economy & data
- [A] All 24 collectible values/masses; upgrade grids incl. radiator's missing $750 tier and
  bay's missing $500k tier; repair $15/HP; fuel $1/L; items 2k/7.5k/2k/5k/2k/10k (+$1 hidden).
- [A] Points: dirt 25; mineral value ×5; cap at Diamond (Amazonite/artifacts = 500k).
- [A] NG+: sale ÷ level, points × level, boss HP/damage × level.
- [A] Goldium schematic specials: Phoenix Hull regen 1 HP/s; Slipstream free surface recall
  (CAL values — Goldium SWF undecompiled; designed to sit above tier 7).
- [M] Fuel dialog offers 5/10/25/50/Fill; sell is one-click whole-hold; hull purchase repairs free.

## Movement & fuel
- [A] Gravity 9.81/30 per frame, drag ×0.98, cap 20; ground friction 0.94; bounce −0.2.
- [A] Fall damage floor(yVel/2) when yVel>7 → 3-HP minimum band, 8-HP terminal cap.
- [M] CAL: horizontal accel/max speed feel vs original (side-by-side flight test).
- [A] Fuel burn: fly `P/50000`/frame, dig `P/25000`/frame, idle 0 (CAL: verify idle).
- [M] Stock rig: full 10 L tank ≈ 79 s hover / ≈ 40 s dig. Start = 6 L + "go refuel" intro.

## Drilling & world
- [A] Dig engages after >5 held frames; sideways only grounded; never up; boulders refuse
  (clink); tile breaks 15 px into a 40 px traversal.
- [A] Worldgen: exact generateEarth port — mineral seed 1/5 chains, tier spread
  `random(⌊row/65⌋+2)`, artifacts 1/500 below row 80, hazard gates H/4.5 / H/2.25 / 2H/3,
  cavern roll 1/3 on every cell, 2-tile barrier entrance at the right.
- [M] Depth-band soil palettes readable; gas pockets indistinguishable from soil (toggle the
  QoL shimmer to confirm it stays off by default).

## Hazards & story
- [A] Lava 29 × radiator per hit; gas `int(−(depth+3000)/15)` × radiator.
- [A] Earthquakes shift rows ±1 with wraparound (chance 1/(5−intensity)); pod never entombed.
- [M] CAL: quake cadence feels like the original (radio chatter at −1000 onward).
- [A] Transmissions fire once at start/−500/−1000/−1750/−2100/−2500/−3100/−3500/−4100/−4500/
  −6200/−7000 with $1k/$3k/$25k bonuses; [M] altimeter glitches below −5813 (random 5-digit),
  reads −66666 in the arena; sky eggs at +5,000 / +10,000 (Seraph halves damage) / +100,000.

## Boss & endgame
- [A] Form 1 = 1000×lvl HP, form 2 = 2000×lvl (~3 s apart); only explosives damage
  (240/120/60); leaving the arena resets; drops: suit/cane/monocle then hooves/horns/eyes/
  furnace + $1M peace reward + $25M shares.
- [M] No pause inside the arena (toast instead); laser sweeps through terrain; staff knockback
  locks items ~1.5 s; fireball bounces to ~80% arena height (all CAL timings).
- [M] Victory → epilogue → stats (score = points + cash + unsold trophies) → NG+ carry-over.

## Meta
- [M] Save only at the SaveMate station; death offers "load last save"; dual-write backup
  recovers a corrupted slot; export/import codes round-trip between browsers.
- [M] All 15 challenges winnable and losable; completing all awards the Fractal Bit.
- [M] Purist Mode: every QoL toggle forced off; all checks above still pass. The list now
  includes `fuelFailsafe` (assist tow) and `objectivesPanel`; `ambientLife` and key rebinding
  are presentation/input-only and intentionally NOT purist-gated.
- [A] Story purity guard (sim.test.ts): a default story run emits no remake-system events
  (rescue/chain/heat/relic/contract/critter) and keeps their state fields inert.
- [M] Expedition mode never leaks into story: no heat bar, chain meter, contracts panel,
  relic offers, magmites, or cores outside `mode.kind === 'expedition'`.
- [A] Co-op is remake-only and cannot move solo: the golden replay test
  (`src/core/sim/golden.test.ts`) freezes a 3,000-tick solo story run against hard-coded
  state/world hashes; the co-op purity test keeps coop-kind events out of story runs.
- [M] Co-op sanity loop: ≥3 clients (tabs or LAN), shop-while-others-dig, a death +
  respawn, a quake, an arena visit, and a save → full-crew resume — no desync dialog.
- [A] Solo expedition is frozen too: `src/core/sim/goldenExpedition.test.ts` pins a
  3,000-tick scripted expedition run (heat/chain/relic/contract/critter paths all
  exercised) to hard-coded hashes — the per-pod expedition-coop refactors cannot move it.
- [M] Expedition co-op sanity loop: 2 tabs (`?coop=host&room=dev&players=2&exp=1`), per-pod
  heat + chains + a relic offer on one seat only, a permanent death → LOST + spectate,
  wipe → identical cores banked on every client; a daily crew run writes NO daily record.
