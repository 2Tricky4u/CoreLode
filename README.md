# CORELODE

*Dig deep. Get rich. Read your contract.*

A **clean-room, browser-only remake** of the 2004 Flash mining classic — identical mechanics
and numbers, all-new code, art, audio, and words. TypeScript + Phaser 3, no server, no plugins.

## Play / develop

```bash
npm install
npm run dev        # → http://localhost:5173
npm test           # 52 sim tests incl. the encoded canonical ruleset
npm run build      # atlas → typecheck → production bundle in dist/
npm run preview    # serve the production build
```

Deploy: any static host (GitHub/GitLab Pages — set `BASE_PATH=/repo-name/` when building).

## Controls

Arrows / WASD — move, fly (up), and drill (down/left/right; you can never drill upward;
sideways only from a standstill). **E** interacts with the building you're standing on (a
"press [E] to interact" prompt appears). Items: **F** fuel cell · **R** nano-welders ·
**X** dynamite · **C** plastic explosive · **Q** discount teleporter · **M** priority
transporter. Esc/P pauses (not in the deep). Touch controls and gamepads are supported.
A full **Controls & Guide** screen is on the title and pause menus.

## Fidelity

The entire ruleset was recovered from the original game's bytecode and encoded as data +
CI-gated tests — see `docs/calibration.md` for every constant and its provenance
(42 Hz sim, 36×600 world, exact worldgen algorithm, physics integrator, fall-damage rule,
fuel-burn formulas, the full transmission schedule, boss tables, NG+ scaling, even the
undocumented earthquake mechanic and boss loot). Values not recoverable are marked `CAL()`
and tuned against the Ruffle-hosted original (`docs/fidelity-checklist.md`).

Quality-of-life extras (autosave, minimap, colorblind glyphs, seeded runs, speedrun timer)
all default **OFF**; Purist Mode force-disables them.

## Architecture

- `src/core/` — the whole game as pure TypeScript (zero Phaser/DOM; CI-enforced by
  `tools/check-layering.mjs`). Fixed 42 Hz tick, typed events out, commands in.
- `src/game/` — thin Phaser 3 presentation (tilemap, sprites, camera, ZzFX audio).
- `src/ui/` — DOM overlay (HUD, shops, transmissions, screens); no framework.
- `src/content/strings.ts` — every name and line of dialog (the clean-room content pack).
- `src/game/audio/` — the procedural audio: ~45 ZzFX one-shot patches, a synthesized
  score (`music/`: mode tables → voice patches → tracker patterns → a lookahead
  Web Audio transport) and a depth-reactive ambient bed. Six pieces: title, three
  mine beds that cross-fade as you descend, a two-layer boss theme (the second
  layer arrives with form 2), and an ending. `npm run music:preview` renders every
  piece and layer to `.wav` plus a `report.json` (levels, clipping, layer
  divergence) — the audio analogue of the art contact sheet.
- `tools/art/` — the procedural art pipeline: char-grid sprites + parametric texture
  generators under a strict DB32 ruleset (`tools/art/STYLE.md`), refined through a
  render→look→critique loop (previews: `docs/art-preview.png`, `docs/art-scene.png`).
  Runtime "juice" (palette-cycled lava, canvas-texture lighting, particles, glows) lives
  in `src/game/scenes/GameScene.ts`.

## License notes

Original code/art/text throughout; SFX are runtime-synthesized (ZzFX). Game mechanics and
numeric constants are not copyrightable; this project ships no asset, name, or text from the
2004 original. See `assets/CREDITS.md`.
