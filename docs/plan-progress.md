# Implementation progress — Expedition mode + QoL master plan

Plan: `~/.claude/plans/make-a-solid-and-quizzical-crane.md`. Branch: `feat/expedition-and-qol`.
One commit per step. Update this file in each step's commit. Autonomous sessions: resume at the
first unchecked step; if blocked >3 attempts or facing a genuine game-design fork, append the
question to `docs/plan-questions.md` (create it if missing), pick a provisional default if
possible, and continue; otherwise stop.

## Phase 1 — Foundation + story-safe quick wins

- [x] [C1] Save schema v2 + migration + frozen v1 fixture (`tests/fixtures/saves/v1.json`)
- [x] [C2] Dug-tunnel round-trip regression test (onboarding toast moved to C5 — needs lifetime store)
- [x] [C3] Fuel failsafe assist (rescue tow), setting + `rescue` event + tests
- [x] [C4] Implement declared blueprint effects: phoenixHull regen, slipstream free recall
- [x] [C5] Strata names + run-summary stats + lifetime records store (+ C2's onboarding toast)
- [x] [C6] Death-cause explanations + first-encounter hazard log
- [x] [C7] Session-close hooks: `slotSummary`, richer slot meta, post-death autosave prompt
- [x] [C8] Phase 1 gate: story no-new-events guard test, full suite + build green

## Phase 2 — Expedition foundation

- [x] [C9] Expedition mode core: ModeConfig, profile store, title entry, suspend save
- [x] [C10] Heat system (second tension axis) + HUD bar + warnings
- [x] [C11] Chain/combo system (sim + juice; expedition-only payout)
- [x] [C12] Daily seed + local daily records + CLDR1 share codes
- [x] [C13] Objective refactor (`objectiveMet`) + expedition contracts
- [x] [C14] Phase 2 gate: full regression incl. expedition determinism hash

## Phase 3 — Expedition content

- [ ] [C15] Loadouts + re-slottable modules (cores economy)
- [ ] [C16] Relic pool + depth-milestone offers + `chooseRelic` command + modal
- [ ] [C17] Story objectives panel (informational, QoL toggle)
- [ ] [C18] Magmite critters (expedition sim) + CritterView
- [ ] [C19] Seismic scanner relic (presentation reuse of gas hint)
- [ ] Phase 3 gate: full regression

## Phase 4 — Polish

- [ ] [C20] Juice pass: heartbeat, landing squash, chain polish, ambient fauna layer
- [ ] [C21] Battered-hull pod frames (WAIT for user's uncommitted art/atlas work to land)
- [ ] [C22] Key remapping + modal keyboard parity + fidelity-checklist doc update
- [ ] Phase 4 gate: full regression + manual purist-mode pass

## Notes / decisions log

- C2: the autosave-onboarding toast depends on the lifetime-records store that C5 introduces,
  so that half ships with C5. C2 is the persistence regression test only.
- User directive (2026-07-10): push after commits; merge the branch into main at each
  phase gate (starting with the Phase 1 gate, C8).
- C11 decision: the chain tracker is expedition-only in the SIM (not "runs everywhere,
  pays only in expedition" as first sketched) — the C8 story purity guard forbids chain
  events in story, and a story-mode chain meter would need sim events to drive it. The
  planned `chainMeter` story toggle is therefore dropped; the meter is always-on in
  expedition and story stays byte-pure.
