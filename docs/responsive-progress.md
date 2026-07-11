# Responsive overhaul — progress

Plan: full-bleed mobile canvas (Phaser RESIZE + camera zoom), smaller touch controls,
global responsive UI, fullscreen/PWA polish. Branch `feat/responsive`; one commit per
step; per-commit lint + typecheck + check:layering + tests; milestone gates run the
full suite + build + the manual smoke matrix, then merge `--ff-only` to main and push.

Autonomous sessions: resume at the first unchecked step.

## M1 — Full-bleed canvas: RESIZE + camera zoom + world↔screen math

- [x] [R0] Branch + this checklist
- [x] [R1] viewportPolicy.ts pure module (zoomForViewport / uiScaleForViewport / coverScreenRect) + tests
- [x] [R2] Phaser RESIZE bootstrap + GameScene resize handler (zoom + sky/light/vignette re-cover)
- [x] [R3] World↔screen math via cam.worldView (drawLight, corners/glyphs culling, FaunaLayer, BossView HP bar)
- [x] [R4] UiRoot inset:0 + --px policy; viewport-fit=cover; 100dvh stage
- [x] M1 gate: suite + build green (183 tests); smoke matrix pending user QA, merged

## M2 — Touch controls: smaller, dimmer, configurable

- [x] [R5] touch.css restyle (clamp sizing, idle opacity 0.45, safe-area offsets)
- [x] [R6] touchSize setting (small/medium/large) wired settings → TouchControls → App
- [x] [R7] De-collide interact prompt + hotbar on coarse pointers
- [x] M2 gate: suite + build green; 3-sizes × 2-layouts emulation pending user QA, merged

## M3 — Global responsive pass

- [x] [R8] Safe-area foundations (.hud/.screen/toast padding)
- [x] [R9] Narrow-portrait breakpoint (max-width: 480px)
- [ ] [R10] Short-landscape breakpoint (max-height: 450px)
- [ ] [R11] Modal min-width fixes for 360px screens
- [ ] [R12] Screens + co-op lobby phone layout
- [ ] M3 gate: full matrix walk of every screen/modal/lobby, merge, push

## M4 — Fullscreen + PWA polish

- [ ] [R13] Fullscreen helpers + title-screen button (+ optional orientation lock)
- [ ] [R14] manifest.webmanifest + procedural icons (gen-icons.mjs in npm run atlas)
- [ ] [R15] Docs: README mobile note, CLAUDE.md RESIZE/worldView invariant
- [ ] M4 gate: suite + build + device smoke, merge --ff-only, push

## Notes / decisions log

- Zoom policy: `max(0.5, floorToStep(min(w/550, h/400), 0.125))` — visible world is
  always ≥ the designed 550×400 view; extra screen = more world, never a crop.
- All world↔screen math must go through `cam.worldView`, never `scrollX + cam.width`.
