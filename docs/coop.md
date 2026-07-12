# Co-op — 2–6 players, one shared mine, no server

Co-op runs the full story world (transmissions, quakes, the boss, victory) with 2–6 pods
in **deterministic lockstep**: every machine runs the identical 42 Hz sim and only inputs
travel. One player hosts; everyone else connects **directly to the host over WebRTC** —
GitHub Pages (or any static host) only serves the files. There is no game server, no
signaling server, no accounts.

## Rules of the crew

- **One shared wallet.** Cash is the crew's; fuel, hull, cargo, upgrades and items are
  per pod. Anyone can shop — the mine keeps running while they do (no pause).
- **Down, not out.** A destroyed pod forfeits its cargo, charges 20% of the wallet, and
  respawns at its surface spawn ~10 s later with 25 L in the tank. The run only ends if
  **every** pod is down at once — or in glory, at the goldium.
- **The boss fights everyone.** It targets the nearest living pod in the arena; trophies
  go to whoever landed the killing charge.
- **Pods pass through each other.** Collision is tile-only; you cannot block a teammate.
- **Pause is synchronized.** Esc pauses the whole crew. Shops, transmissions, and
  inventories don't.

## Hosting a session (scan-first, paste as fallback)

WebRTC needs one out-of-band message exchange per guest. Same-room phones do it with
zero typing and zero app switching (backgrounding a mobile browser mid-handshake kills
the connection, so the flow is designed to never require it):

1. **Host:** title → **CO-OP** → *Host a crew* → each waiting seat shows its invite as
   a **QR code** (plus *Share link* / *Copy link*). *Add a seat* per extra player (≤5).
2. **Guest:** scan the host's screen with the **normal camera app** (or tap the shared
   link) — the game opens already joining (`#coop=<token>` in the URL) and shows a
   **reply QR**. Nothing to type; a mid-join reload recovers by itself because the
   token is still in the hash.
3. **Host:** tap **Scan reply** and point the camera at the guest's screen →
   ✓ connected. When every seat is green, **Start digging**.

On desktop the classic path remains: copy the invite code (`CLDP1.…`), paste the reply
(`CLDP2.…`). One invite = one guest — if two people scan the same seat, mint a *New
code* for the second. A dead connection flips the seat to a lost row (*New code* /
*Remove*); the guest side gets *Start over*.

Tokens are CRC-checked, **deflate-compressed** (`{v:2, z}` via CompressionStream —
roughly half the size, which is what keeps the QR codes scannable), and the first
in-band message carries a protocol + save-version handshake; mismatched builds are
rejected with a clear message rather than a desync. A pre-compression build shown a
compressed token fails with the ordinary bad-code toast. In-page scanning uses the
native BarcodeDetector where available and a lazy-loaded jsQR chunk elsewhere; camera
permission is only requested when *Scan reply* is tapped (HTTPS or localhost required —
GitHub Pages qualifies), and denying it just leaves the paste box.

### Why the reply QR sometimes "refreshes"

ICE starts probing the moment the guest mints its reply, but the host can't answer the
probes until the reply is scanned — and browsers give up after ~15 s. When that
happens the guest automatically remints against the same offer and swaps the QR in
place (up to ~10 attempts ≈ 3 min), so whatever the host finally scans is always
fresh. Only after that does the guest surface *Connection lost → Start over*.

### LAN / offline caveat

Connections use `iceServers: []` — host/mDNS candidates only. This works great on a LAN
(even fully offline: `npm run build && npx serve dist`), which is the supported v1 target.
NAT traversal across the open internet (STUN/TURN) is intentionally out of scope.
Beware **phone hotspots and guest Wi-Fi**: they commonly enable client isolation, which
blocks device-to-device traffic entirely — pairing will always fail there no matter how
the codes are exchanged. Use a regular router (mDNS/multicast must also be allowed).

### Same-machine tabs (dev mode)

Zero-WebRTC co-op for testing, over BroadcastChannel:

- host tab: `?coop=host&room=dev&players=3`
- guest tabs: `?coop=join&room=dev&seat=1`, `…&seat=2`

## How the lockstep works

Host-relay star, host-sequenced: guests send `in {tick, frame, commands}` to the host;
the host aggregates one authoritative `bundle` per tick and every peer — host included —
executes only from bundles. Input delay is 3 ticks (~71 ms of headroom); commands
(purchases, sales, item use) ride the same stream and apply in (tick, player) order, so
a shop transaction lands on the exact same tick everywhere. If a peer's inputs stop
arriving, everyone stalls behind a "Waiting for…" overlay rather than drifting.

### Desync detection and recovery

Every 42 ticks each guest sends a state hash (pod kinematics + economy + rng + the whole
world grid); the host compares. On a mismatch the host gets a **SYNC LOST** dialog — both
hashes go to the console — and **Resync** ships the host's exact state (a snapshot that
keeps every transient field, unlike a surface save) to all guests in chunks; the timeline
rebases and play resumes within a second or two.

### Drops

- **Guest drops:** their pod idles (EMPTY inputs), an OFFLINE badge appears in the
  teammate list, and the run continues. Their pod counts toward the all-down wipe only
  if it is actually destroyed.
- **Host drops:** the session is over for everyone (the host is the sequencer) — guests
  get a modal back to the title.

## Saving and resuming

Only the **host** can save (guests get a toast at the SaveMate). Co-op slots show a
`CO-OP ×N` badge; loading one routes into the host lobby, which stays locked until the
same crew size has reconnected (fresh scan/paste handshake), then ships the save to every
guest so all sims resume from the identical file. NG+ is solo-only in v1.

## Expedition co-op (2–6 players, one life each)

The full roguelike runs on the same lockstep: pick **Expedition** (or **Daily**) at the
top of the host lobby. Everything expedition is per-pod in a crew:

- **One life each.** A destroyed pod is permanently out — no fee, no respawn. It
  spectates (the camera follows the nearest living teammate under a red LOST banner);
  the run ends when the last pod falls, or in glory at the boss.
- **Your own rig.** Every player picks a loadout + modules from their OWN local unlocks
  in the lobby (buy gear on the Expedition screen; unlocks never transfer). Rigs travel
  to the host as a `cfg` message — validated for shape (known ids, ≤2 modules), with
  ownership deliberately trusted; an invalid rig falls back to a badged standard rig.
- **Your own heat, chains, and relics.** Each pod cooks by its own depth, builds its own
  chain (vault banks into the shared wallet at that pod's sale), and earns relic offers
  at its own depth milestones — the choice modal opens only on the earning player's
  machine while everyone else keeps digging. Contracts stay team goals paid to the
  shared wallet (split hauls count), and magmites chase whoever is closest.
- **Everyone banks the same cores.** Settlement is computed from the shared
  deterministic state, so every machine banks the identical payout into its own local
  profile. **Co-op dailies are never recorded** — the daily board stays a solo
  leaderboard.
- **Suspend/resume is the host's.** Any pod docking suspends the run to the host's
  `exp:0` slot; resuming routes through the lobby (crew size must match) and the slot
  only burns when the session actually starts — an abandoned lobby can't eat the run.
- The dev panel's expedition mutators are disabled in any co-op session (a host-local
  edit would desync the crew).

Wire note: the rig exchange bumped `PROTO_VERSION` to 2 — mixed builds refuse each
other cleanly at the `hi` handshake.

## Fidelity note

Co-op is **remake-only** — nothing here exists in the 2004 original, and none of it can
leak into solo: the golden replay test freezes a 3,000-tick solo story run against
hard-coded hashes, and `goldenExpedition.test.ts` does the same for a solo expedition
run (heat, chains, relics, contracts, critters), so any change that would alter solo
behavior — story or roguelike — fails CI.
