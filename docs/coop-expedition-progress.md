# Expedition Co-op — progress

Plan: 2–6 player expedition on the story-co-op lockstep. Decisions locked: true single
life (permanent down, wipe ends the run); per-pod chains; per-player loadouts via lobby
`cfg` + `mode.expedition.perPod`; everyone banks identical cores; daily records solo-only.
Branch `feat/coop-expedition`; one commit per step; merge --ff-only per milestone gate.

## M1 — Freeze solo expedition + helpers

- [x] [X1] Golden solo expedition replay (goldenExpedition.test.ts, frozen literals)
- [x] [X2] podCount/isCoopRun helpers + coop-behavior gate flips (behavioral no-op)
- [x] M1 gate: full suite + build green (187 tests), merged

## M2 — Per-pod expedition systems (solo-invariant)

- [x] [X3] Heat per-pod (stepHeat loop, PodState.heatWarn, heatWarning{player})
- [x] [X4] Chain per-pod (PodState.chain, acting-pod vault payout, chain events{player})
- [x] [X5] Relics per-pod (maxDepthFt watermark, pending slots array, relicOffer{player})
- [x] [X6] Critters + contracts multi-pod (nearest-pod AI, digger-keyed spawn, bay aggregation)
- [x] [X7] Save schema v5 (SavedPod.chain/maxDepthFt, v4 fixture, migration)
- [x] [X8] createRun expedition multiplayer (players clamp, perPod rigs, daily coercion)
- [ ] [X9] True single life + twin-hash determinism suite (2 & 6 players)
- [ ] M2 gate: full suite + build, both goldens frozen, merge

## M3 — Wire, lobby, App lifecycle

- [ ] [X10] Lobby cfg message + PROTO_VERSION 2 + validator
- [ ] [X11] Expedition lobby UI + bootstrap + tab dev mode (exp=1|daily)
- [ ] [X12] Settle / suspend / resume (host-only suspend, deferred exp:0 delete, solo-only daily records)
- [ ] M3 gate: full suite + build + 2-tab smoke, merge

## M4 — HUD, rendering, spectator UX

- [ ] [X13] Seat-aware expedition HUD + relic/heat/chain event routing
- [ ] [X14] Spectator camera + LOST UX + dev-panel lockstep guard
- [ ] M4 gate: full suite + build + multi-tab death smoke, merge

## M5 — Docs + final gate

- [ ] [X15] Docs (coop.md expedition section, fidelity entry, CLAUDE.md)
- [ ] [X16] Final gate: 2/6-tab loops + solo + story-coop regression, merge --ff-only

## Notes / decisions log

- Golden expedition setup plants a carved pocket at ~−5,510 ft + 3 same-mineral tiles
  below it: deep-band digs need held keys (30-tick moves) and chains must build before
  overheat damage starts voiding them.
