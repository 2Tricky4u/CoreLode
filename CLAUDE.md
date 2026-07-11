# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # dev server at http://localhost:5173
npm test              # vitest run (all tests)
npm run test:watch    # vitest interactive watch
npx vitest run src/core/sim/sim.test.ts   # single test file
npm run build         # atlas → typecheck → production bundle (dist/)
npm run preview       # serve the production build
npm run lint          # Biome check
npm run format        # Biome format --write
npm run typecheck     # tsc --noEmit only
npm run atlas         # regenerate public/atlas/ from tools/art/ + frame-parity guard
npm run art:preview   # contact-sheet.png + mock-scene.png (set ART_OUT=dir for output path)
npm run check:layering  # enforce core/content purity (run before committing new imports)
npm run music:preview   # render all music pieces + layers to .wav + report.json (vite-node)
```

`npm run build` runs `atlas` first, so sprite changes are picked up automatically. CI runs lint → typecheck → check:layering → test → build in that order.

## Architecture

Four strictly layered modules enforced by `tools/check-layering.mjs` (breaks the build if violated):

```
src/core/      Pure TypeScript sim — zero Phaser, zero DOM, zero browser globals.
src/content/   String tables only — same purity rules as core.
src/game/      Phaser 3 presentation: tilemap, sprites, camera, audio synthesis.
src/ui/        DOM overlay: HUD, shops, modals, screens. No framework.
src/input/     InputManager: keyboard + touch + gamepad → IntentFrame.
src/platform/  Browser APIs: IndexedDB (idb-keyval), clipboard, file picker.
src/app/       App.ts — top-level orchestrator and run lifecycle.
```

Path aliases (vite.config.ts): `@core`, `@content`, `@game`, `@input`, `@ui`, `@platform`, `@app`.

### Sim / core

`src/core/index.ts` is the only allowed import surface for anything outside `src/core/`. Everything else in core is internal.

The tick pipeline (`src/core/sim/tick.ts`) runs at a fixed **42 Hz** (`DT_MS = 1000/42`). Each call takes a `GameState` (mutable, single object), an `IntentFrame` (player input snapshot), and an `EventSink` (a `SimEvent[]` that the caller owns). The sim never returns data — it pushes typed events. Commands (`applyCommand` in `commands.ts`) are the only way for the UI to mutate state, and are always applied between ticks while the sim is paused.

Data tables in `src/core/data/` are plain readonly arrays. Numbers are verbatim from the original game's bytecode — see `docs/calibration.md` before changing any constant. Items marked `[CAL]` there are still being tuned against the Ruffle-hosted original.

### GameHost

`src/game/GameHost.ts` bridges the pure sim to the Phaser render loop. It holds an accumulator, a set-based pause ledger (multiple callers can pause/resume independently without stomping each other), and fans `SimEvent[]` out to registered listeners. The accumulator clamps incoming `dtMs` to 250 ms to prevent spiral-of-death after tab-away.

### App.ts

The single orchestrator (`src/app/App.ts`) owns the title ↔ run ↔ ending flow, all save/load operations, settings, and modal coordination. It creates the `GameHost`, passes it to the Phaser scene via `scene.start('game', { host, audio, … })`, and wires the `SimEvent` fan-out to audio, HUD, and modal triggers.

### Phaser scenes

- `BootScene`: loads the two texture atlases (`public/atlas/game.json`, `tiles.json`), fires `assets-ready`.
- `GameScene`: the play field. Owns lighting (half-res canvas texture, pod headlight, arena pulse), particles (debris/thrust/smoke/motes/embers), lava palette cycling, day/night sky, and the collect-popup overlay. Visual "juice" lives here; gameplay logic does not.

### Viewport / responsiveness

The canvas fills the viewport (`Phaser.Scale.RESIZE`); `src/game/viewportPolicy.ts` is
the single source of truth for the camera zoom (`zoomForViewport` — always shows at
least the designed 550×400 view; extra screen reveals more world), the DOM `--px` UI
scale, and `coverScreenRect` (placing scrollFactor-0 overlays under zoom).
**Invariant: all world↔screen math must go through `cam.worldView`** — its x/width
differ from `scrollX`/`cam.width` whenever zoom ≠ 1 — never `scrollX + cam.width`.
Touch/HUD/screens are responsive via `--px`, safe-area insets, and two breakpoints
(≤480px width, ≤450px height) in `src/ui/styles/`.

### Audio

`AudioBus` (`src/game/audio/AudioBus.ts`) is the single audio surface. It translates `SimEvent` to:
- **ZzFX one-shots** — ~45 patches in `src/core/data/sfx.ts`, played via `src/game/audio/zzfx.ts`. A voice-pool throttle prevents the same sound playing more than once per 60 ms.
- **Procedural score** — `MusicPlayer` in `src/game/audio/music/`. Six pieces (title, three depth-reactive mine beds, two-layer boss theme, ending). The transport is a lookahead Web Audio scheduler; patterns live in `patterns.ts`, voice patches in `voices.ts`, mode tables in `scales.ts`, synthesis in `synth.ts`.
- **Ambient bed** — `AmbienceBus` generates a continuous depth-reactive drone.

Audio is unlocked on the first user gesture. `music:preview` renders every piece/layer to `.wav` with a level/clipping report.

### Art pipeline

All sprites and textures are generated procedurally — there are no hand-painted assets. `tools/gen-art.mjs` calls the sprite and texture modules, composites them into `public/atlas/game.png`, `game.json`, `tiles.png`, `tiles.json`. `tools/art/check-frames.mjs` then verifies frame-name parity between atlas and source code (a missing frame is a build error).

Art rules are in `tools/art/STYLE.md` (DB32 palette only, ≤4 shades per material, top-left single light source, selective outlines on hero sprites only, gas pockets must look identical to soil). The reference renders are `docs/art-preview.png` and `docs/art-scene.png`. Vision loop: `npm run atlas && npm run art:preview` → read PNGs → critique against STYLE.md → patch.

### Co-op

2–6 player shared-world story co-op, fully static hosting. `src/core/net/` is the pure
protocol (messages, `HostSequencer`/`BundleLedger` lockstep bookkeeping, `coopStateHash`
sentinel, exact-state `snapshot.ts` for resync); transports are `src/platform/net/`
(`RtcChannel` manual paste-code WebRTC with `iceServers: []`, `LocalChannel` over
BroadcastChannel for same-machine tabs — `?coop=host&room=dev&players=2` /
`?coop=join&room=dev&seat=1`); the driver is `src/game/LockstepHost.ts` (implements
`SimHost`, so GameScene/App don't care whether a run is solo or networked). Everyone
executes only host-sequenced bundles; commands ride the input stream; presentation
pauses are ignored in co-op ('user' pause is synchronized). Solo fidelity is enforced
by `src/core/sim/golden.test.ts` — its literals must never change. See `docs/coop.md`.

### Save / persistence

`SaveFile` (versioned, `src/core/save/schema.ts`) stores the full 36×600 world grid as RLE (`[tile, runLength, …]`) because earthquakes shift whole rows. Platform storage is `src/platform/storage.ts` (IndexedDB via idb-keyval). Every write keeps the previous copy at `<key>:prev` as a dual-write backup; loads fall back to it if validation fails.

Export codes: `CLD1.<base64url(JSON)>.<crc32-base36>` — integrity-checked, versioned, migrated on import (`src/core/save/codec.ts`). Version bumps require a migration step in `migrate.ts` plus a frozen fixture in the tests.

## Code style

Linter/formatter: **Biome** (not ESLint/Prettier). 2-space indent, single quotes, 100-char line width. Run `npm run lint` to check, `npm run format` to fix. The only linter overrides are in `zzfx.ts` (parameter reassignment and assignment-in-expression — intentional in the minified ZzFX source).

## Fidelity contract

`docs/calibration.md` is the authoritative record of every constant recovered from the original SWF bytecode. Do not change any numeric constant in `src/core/data/` without checking it there first. Items marked `[CAL]` are provisional and will be updated as they're tuned against the Ruffle-hosted original. `docs/fidelity-checklist.md` lists what the automated tests cover (`[A]`) vs. what requires manual side-by-side QA (`[M]`).

## Key invariants

- **`src/core/` and `src/content/` must stay pure** — no Phaser imports, no DOM globals, no browser APIs. `npm run check:layering` enforces this; CI fails if it breaks.
- **`src/core/index.ts` is the only core export surface** for code outside core. Do not import internal core modules from `@game/`, `@ui/`, etc.
- **The sim is the authority on all game numbers.** The presentation layer renders and reacts; it never recalculates physics, economy, or worldgen.
- **Gas tiles must render as soil** (fidelity rule — they are intentionally indistinguishable without the QoL shimmer hint, which defaults off).
