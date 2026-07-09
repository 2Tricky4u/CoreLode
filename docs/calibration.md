# Phase-0 Calibration — constants recovered from the original game

Source: `motherload.swf` (free web version, archive.org item `motherload_202209`, 3,977,393 bytes,
CWS/SWF v7). Method: custom Python SWF tag walker + AS2 bytecode disassembler/miner
(no assets extracted; analysis only; the SWF is NOT in this repo). Date: 2026-07-09.

Legend: **[CODE]** = read directly from decompiled bytecode (authoritative).
**[WIKI]** = community-documented, consistent with code. **[CAL]** = still provisional.

## Engine & stage [CODE]

| Constant | Value |
|---|---|
| Frame rate | **42 fps** (fixed; all per-frame constants below are per 1/42 s) |
| Stage | 550 × 400 px |
| Tile | **50 × 50 px**; **1 ft = 4 px** (12.5 ft per tile) |
| World grid | `earthWidth = 36`, `earthHeight = 600` (incl. side walls + sky rows + hell rows; playable width 32) |
| Rows | 0–4 sky (`0`), 5 = surface turf (`-1/-2`), buildings occupy rows 3–4 as negative tiles; row `H-12 = 588` barrier band (`-6/-7`), rows below → hell/arena (`-999`, `-8` floor) |
| Boss-arena entrance | `earth[W-3][H-12] = earth[W-4][H-12] = 0` (2-tile hole, right side) |
| Altimeter | `depth = int((earthY − podY + 204) / 4)` ft; `< −7300` → displays **“-66666 ft.”**; `< −5813` → displays `"?" + (random(90000)+10000) + " ft."` |
| Day/night cycle | `dayLength = 2880` frames (~68.6 s) |
| Camera | `scrollSpeed = 10` (follow divisor), `rightLimit = 350`, `bottomLimit = 250` |

## Pod physics (per frame @42 fps, px units) [CODE]

```
xVel *= airResistance (0.98); yVel *= 0.98            // always, airborne
ground horizontal: friction = 0.94
yVel = min(yVel + gravity/30, 20)                     // gravity = 9.81 → +0.327 px/fr²; hard cap 20
                                                      // drag equilibrium ≈ 16.35 px/fr ≈ 171.7 ft/s terminal
thrust accel   = enginePower[tier] / mass / 1.5       // mass = 198 + Σ cargo mineral mass
fuel (flying)  −= enginePower[tier] / 50000  per frame   // stock 0.126 L/s … top 0.176 L/s
fuel (digging) −= enginePower[tier] / 25000  per frame   // exactly 2× flying rate
fuel (idle)     = 0 (no idle-burn site found)         // [CAL: verify 0]
landing:  if (yVel > 7) { damage(yVel / 2); }         // → min 3 HP (floor), max ~8 HP at terminal ✓ wiki bands emerge
          yVel *= −0.2                                // bounce (also on ceiling bump)
dig start: hold direction into diggable ground for > 5 frames ("launchCount")
item cooldown: 5 frames between item uses
```
Horizontal accel uses `enginePower` with the same mass division (exact clamp expression **[CAL]**,
fit vs Ruffle; use `P/(m·1.5)` with max speed **[CAL]**).

## Vehicle & economy tables [CODE]

Start: **cash $20**, hp 10, **fuel 6.0 of 10 L** (intro: “We forgot to refuel you”), mass 198 (+cargo).

| Tier | Price | Drill (px/fr) | Hull HP | Engine hp | Tank L | Bay units | Radiator ×dmg |
|---|---|---|---|---|---|---|---|
| 1 | $0 | 2 | 10 | 150 | 10 | 7 | 1.0 |
| 2 | $750 | 2.8 | 17 | 160 | 15 | 15 | — |
| 3 | $2,000 | 4 | 30 | 170 | 25 | 25 | 0.9 |
| 4 | $5,000 | 5 | 50 | 180 | 40 | 40 | 0.75 |
| 5 | $20,000 | 7 | 80 | 190 | 60 | 70 | 0.6 |
| 6 | $100,000 | 9.5 | 120 | 200 | 100 | 120 | 0.4 |
| 7 | $500,000 | 12 | 180 | 210 | 150 | — | 0.2 |

(Radiator has 6 tiers at $0/2k/5k/20k/100k/500k; Bay has 6 ending $100k. Names match wiki:
Silvide/Goldium/… drills, Ironium/…/Energy-Shielded hulls, V4–V16 engines, Micro–Liquid-Compression
tanks, Stock Fan–Tri-Turbine Freon Array, Micro–Leviathan bays.)

Minerals `mineral(index, mass, value, name)` [CODE]:

| Tile | Mineral | mass | $ |
|---|---|---|---|
| 6 | Ironium | 1 | 30 |
| 7 | Bronzium | 1 | 60 |
| 8 | Silverium | 1 | 100 |
| 9 | Goldium | 2 | 250 |
| 10 | Platinium | 3 | 750 |
| 11 | Einsteinium | 4 | 2,000 |
| 12 | Emerald | 6 | 5,000 |
| 13 | Ruby | 8 | 20,000 |
| 14 | Diamond | 10 | 100,000 |
| 15 | Amazonite | 12 | 500,000 |
| 16 | Dinosaur Bones | 1 | 1,000 |
| 17 | Treasure | 1 | 5,000 |
| 18 | Martian Skeleton | 1 | 10,000 |
| 19 | Religious Artifact | 1 | 50,000 |

**Boss drops / end rewards (indices 14–23 of the minerals list — undocumented on any wiki):**
Mr. Natas' Kevlar Suit $50,000 · Staff of Hell $100,000 · Laser Monacle $200,000 ·
Satan's Hooves $300,000 · Horns $400,000 · Evil Eye (right) $500,000 · Evil Eye (left) $500,000 ·
Boiler of Eternal Infernos $600,000 · Martian Reward for Restoring Peace $1,000,000 ·
250,000 Shares of Natas HI Inc. $25,000,000.

**Points** [CODE]: `getTilePoints(t)`: dirt (t<6) → `25 × mod`; mineral → `minerals[min(t,14)−6].value × 5 × mod`
(the `min(…,14)` cap is why Amazonite and everything rarer scores 500,000 × mod).

Items [CODE]: F Reserve Fuel $2,000 (+25 L, min-capped, anytime) · R Hull Repair Nanobots $7,500
(+30 HP, capped, anytime) · X Dynamite $2,000 (ground) · C Plastic Explosives $5,000 (ground) ·
Q Quantum Teleporter $2,000 (ground; “teleports you somewhere above surface level (results may vary)”
→ variable drop height ⇒ fall damage) · M Matter Transmitter $10,000 (ground, safe) ·
**hidden item 6: “Core Teleporter”, hotkey 0, $1, “Teleports you directly to the planet's core.”**
Blast sizes 3×3 / 5×5 [WIKI]. Repair `repairCost = 15` $/HP [CODE]. Fuel menu buttons: 5/10/25/50 L + Fill
[CODE pool]; $1/L [WIKI, CAL].

## World generation — `generateEarth()` decompiled [CODE]

```
mineralRate = 65
for x in 0..35:  for y in 0..599:
  cell = random(4) + 1                                  // dirt variant
  if y < 5: cell = 0
  elif y == 5: cell = -(random(2) + 1)                  // surface turf
  elif y == H-12: cell = -(random(2) + 6)               // barrier band
  elif y > H-11: cell = -999                            // hell walls
  elif y == H-5: cell = -8                              // hell floor band
  else:
    if random(5) == 0:                                  // ~20% mineral seed
      if random(5) == 0:
        if random(5) == 0:
          if random(4) == 0 and y > 80:                 // artifacts below row 80 (−1000 ft ✓)
            cell = 16 + random(4)                       // one of 4 artifacts
          else: cell = min(8 + random(int(y/65)+2), 15)
        else:   cell = min(7 + random(int(y/65)+2), 15)
      else:     cell = min(6 + random(int(y/65)+2), 15) // tile 6..15 = minerals by depth
    else:
      cell = random(5) + 1
      if y*1.5 > H/3:                                   // below ≈ row 133 (≈ −1660 ft)
        v = int((H-y)/H * 15)                           // shrinks with depth
        if random(v) == 0:
          if y/2*1.5 > H/3 and random(2)==0:            // below ≈ row 267 (≈ −3330 ft)
            if y/3*1.5 > H/3 and random(2)==0:          // below = row 400 (= −4937 ft)
              cell = 31                                 // GAS pocket (renders as dirt)
            else: cell = 28 + random(3)                 // LAVA variants
          else:   cell = 25 + random(3)                 // BOULDER variants (undrillable)
    if random(3) == 0: cell = 0                         // ⅓ caverns — LAST, overrides all
carve entrance: earth[33][588] = earth[32][588] = 0     // (W-3, W-4 at H-12)
```
Tile ids: 0 air · 1–5 dirt variants · 6–15 minerals · 16–19 artifacts · 25–27 boulders ·
28–30 lava · 31 gas · negatives = surface/buildings/walls (buildings placed at rows 3–4 as −125…).

## Hazards [CODE]

- Dig into lava tile: `damage(29 × radiatorCooling)` (two call sites → the known 29+29 double hit).
- Dig/blast opens gas tile: `damage(int(−(depth+3000)/15) × radiatorCooling)` — exact wiki formula.
- Boulders: `unDiggable()` (clink SFX, dig refused).
- **Earthquakes — real, undocumented mechanic:** `earthQuake(intensity)` shifts each row 11..H−15
  horizontally ±1 tile (wraparound) with chance `1/(5−intensity)` per row + screen FX.
  Trigger schedule **[CAL]** (transmission at −1000 attributes them to “core vibrations”).

## Story & difficulty [CODE — full original text recovered; remake uses rewritten clean-room script]

`transmission(index, bonus, depthFt, sender, text)`: −1 (start, “forgot to refuel… fuel station (Left)”) ·
500 (+$1,000) · 1000 (+$3,000; mentions earthquakes) · 1750 static “THE EYES!!!” ·
2100 Pod #3422-2 intro (retiring next week, wife + three daughters) · 2500 static screams ·
3100 Pod #3422-2 lava tip (twin turbines) · 3500 (+$25,000; gas warning; “altimeter rated ~6000 ft”) ·
**4100 Pod #3422-2 dies (earthquake-trapped, out of fuel, attacked)** ·
4500 Pod #10043 “I HIT THE MOTHERLOAD!!! … NO! IT CAN'T BE!!” ·
6200 “violating the terms of your employment!” · 7000 “terminated… er… as in fired!” ·
sentinel 9998 boss-intro “SEE YOU IN HELL!!!” · sentinel 9999 form-2 “BEHOLD MY TRUE FORM!!!”.

Difficulty / NG+ (`lvl` starts at 1): `difficulty[i] = { satanP1Hp: 1000·i, satanP2Hp: 2000·i,
satanP1dam: i, satanP2dam: i, mineralValueMod: i }` → boss form HP **1000/2000** at lvl 1 [CODE],
boss damage scales ×lvl, points ×mod, mineral sale value ÷mod.
Boss spawn: `satan` at px (1200, 29532) ≈ tile (24, 590); HP bar UI at (24, 349); `battleMode` flag;
`p2Head` HP-bar icon hidden until form 2.

Keys [CODE]: arrows + WASD (`kUp=[87,119,38]` etc.); I inventory; F/R/X/C/Q/M items; `0` core teleporter.
Misc [CODE]: `optMouseControl` exists; `cheating` flag → “Sorry, cheaters can't save.”; online build
posts to `/motherload/save.php`–`restore.php`; music volume 70/100; `maxDepth` watermark drives
transmissions; sale/points mods per difficulty above.

## Remaining [CAL] items (tune against Ruffle-hosted original)

Horizontal accel clamp & max speed · exact thrust clamp bound · idle fuel burn (assumed 0) ·
quake trigger schedule · Quantum Teleporter drop-height distribution · boss attack damages/timings/
projectile speeds (structure known; `satanP1dam/P2dam` multipliers known) · fuel $/L (assumed 1) ·
sky easter-egg altitudes/rewards (+5k/+10k angel/+100k msg [WIKI]) · Goldium-only content (blueprints,
challenges — not in this SWF; wiki + designed values stand).

## Deviations this remake adopts deliberately

- Seeded deterministic worldgen (original used unseeded `random()`), same algorithm otherwise.
- Sim runs at the original **42 Hz fixed timestep** (render interpolated to display rate) so every
  per-frame constant above applies verbatim — no unit conversion layer.
- Clean-room content: all names/dialog above are reference only; shipped game uses new text/names.
