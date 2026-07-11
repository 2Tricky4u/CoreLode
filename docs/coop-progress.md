# Co-op implementation progress — 2–6 player lockstep (feat/coop)

Plan: `~/.claude/plans/make-a-solid-and-quizzical-crane.md`. One commit per step; tick the
box in that commit. Per-commit: lint + typecheck + check:layering + touched suites.
Milestone gates: full `npm test` + `npm run build`, push, `merge --ff-only` to main.
Autonomous sessions resume at the first unchecked step; genuine design forks go to
`docs/plan-questions.md` with a provisional default.

## M1 — Determinism hardening + golden guard

- [x] [N1] Golden solo replay test (frozen hash literals — the solo fidelity contract)
- [x] [N2] Replace Math.hypot ×5 with sqrt form (boss/critters/explosives)
- [x] [N3] Deterministic atan2d in lib/math + boss laser swap + unit tests
- [x] M1 gate: full suite + build, merge to main

## M2 — pods[] refactor (solo-invariant)

- [x] [N4] pods array + pod alias + wallet/podAlive helpers + invariant test
- [x] [N5] Route all cash through wallet(s)
- [x] [N6] Per-pod parameterization of pod systems + player? on events
- [x] [N7] tick(s, inputs: IntentFrame[], out) + per-pod pipeline loop
- [x] [N8] Save schema v4 (pods[]) + frozen v3 fixture + migration
- [x] M2 gate: full suite + build green (139 tests); manual solo smoke pending user QA, merge

## M3 — Co-op sim rules

- [x] [N9] kind 'coop' + N-pod createRun + story gates + COOP constants
- [x] [N10] applyCommand(s, cmd, player, out)
- [x] [N11] Death → respawn-with-fee; all-down wipe; podDown/podRespawned events
- [x] [N12] Boss + explosives co-op rules (Charge.owner, nearest-living targeting)
- [x] [N13] Quake entombment for all pods; guardian to triggering pod; pass-through test
- [x] [N14] Co-op determinism + purity suite (2 and 6 players)
- [x] M3 gate: full suite + build green (157 tests), merged

## M4 — Lockstep core + channels + tab play

- [x] [N15] Pure protocol: messages + HostSequencer + BundleLedger + coopStateHash + tests
- [x] [N16] SimHost interface extraction (type-only refactor)
- [x] [N17] NetChannel iface + LocalChannel (BroadcastChannel) + 16 KB chunker
- [x] [N18] LockstepHost (host/guest roles) + N-host in-memory tests
- [x] [N19] App wiring, coop pause gating, shop re-render on events, multi-tab dev entry
- [x] M4 gate: full suite + build green (174 tests); multi-tab smoke pending user QA at ?coop=host&room=dev&players=2, merged

## M5 — WebRTC + UI + rendering

- [x] [N20] RtcChannel (manual SDP tokens CLDP1/CLDP2, iceServers: [])
- [ ] [N21] Co-op menu + lobby (per-seat offers, ready states)
- [ ] [N22] Session bootstrap end-to-end (start / chunked SaveFile, version handshake)
- [ ] [N23] Rendering: PodView per pod + tints, local camera, per-pod FX
- [ ] [N24] HUD: local player bars, SHARED wallet, teammate list, minimap dots
- [ ] [N25] Connection lifecycle UX (waiting overlay, drop handling, bye)
- [ ] M5 gate: full suite + build + ≥3-client LAN playthrough, merge

## M6 — Resilience + deploy + docs

- [ ] [N26] Desync recovery (halt + host resync via chunked SaveFile)
- [ ] [N27] Co-op save/resume (host-only SaveMate, coop slot badge, lobby preload)
- [ ] [N28] GitHub Pages deploy workflow (.github/workflows/pages.yml, BASE_PATH)
- [ ] [N29] Docs: docs/coop.md, README, fidelity-checklist, CLAUDE.md notes
- [ ] [N30] Final gate: 6-tab loop + LAN loop + solo regression, merge

## Notes / decisions log

(append as work proceeds)
