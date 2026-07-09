# Save format

Current version: **1** (`src/core/save/schema.ts`). Migration ladder in `migrate.ts` —
every version bump adds a step there plus a frozen fixture in the tests.

- Storage: IndexedDB via idb-keyval. Keys: `save:manual:0..2`, `save:auto:0..2` (QoL),
  `records` (challenge bests), `settings`. Every write keeps the previous copy at
  `<key>:prev` (dual-write); loads fall back to it if validation fails.
- World: the full 36×600 grid, RLE-packed as `[tile, runLength, …]` (earthquakes shift whole
  rows, so a diff-vs-seed would balloon; RLE of the sparse grid stays a few KB).
- RNG state, story flags (`fired`), depth/altitude watermarks, quake schedule, pod loadout,
  bay contents, inventory, NG+ level, and stats are stored verbatim; the pod re-settles to the
  ground on the first tick after load.
- Export codes: `CLD1.<base64url(JSON)>.<crc32 base36>` — integrity-checked, versioned, and
  migrated on import (`codec.ts`).
