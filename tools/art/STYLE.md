# CORELODE art style ruleset

Every sprite and texture in `tools/art/` follows these rules; every vision-critique round
checks against them (docs/art-preview.png + docs/art-scene.png are the frozen references).

1. **DB32 palette only** (`palette.mjs`), ≤4 shades per material: shadow / base / light + outline.
2. **One light source: top-left.** Highlights NW, shadows SE — on sprites AND texture clods.
3. **Selective 1px outlines**: hero sprites (pod, boss, gems, pickups, buildings' key props)
   outline in the ramp's darkest; terrain textures never outline.
4. **Silhouette first**: a sprite must read as a flat black shape before shading is added.
   Char-grids (`grid.mjs`) are authored at half resolution and upscaled ×2 so the silhouette
   is visible in the source code itself.
5. **Contrast tiers**: terrain low-contrast/desaturated < interactables (gems/hazards)
   high-contrast + outline < hero (pod/boss) highest contrast + specular star.
6. **Dither only inside large soil fields**, never on sprites. Deep bands (3+) use fewer,
   larger, shadow-only clods (full rims read as noise in the dark).
7. **No hard tile edges** — the world must read as one continuous soil field (learned in
   round 1: per-tile edge lines draw a graph-paper grid over the whole world).
8. **Danger owns the saturated warm range** (lava/explosions/gas flashes); soil stays muted
   so hazards pop. Gas pockets render EXACTLY as soil (fidelity mechanic — never "fix" this).

## The vision loop

```
npm run atlas             # rebuild + frame-parity guard
npm run art:preview       # contact-sheet.png + mock-scene.png (set ART_OUT=dir)
# → Read both PNGs, critique against the rules above, patch, repeat.
```

Round history: round 0 critiqued the blind v1 atlas (flat, noisy, gridded, unreadable gems);
round 1 rebuilt everything (grids + parametric systems); round 2 fixed the tile-grid seams,
deep-band noise, boulder/barrier/bedrock shapes, boss faces, gem silhouettes; round 3 froze.
