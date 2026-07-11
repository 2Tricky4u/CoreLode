/**
 * Co-op tuning — remake-only constants (never calibration data). Co-op runs
 * the story world with 2–6 pods in deterministic lockstep; solo story is
 * untouched (the golden replay test enforces it).
 */
export const COOP = {
  maxPlayers: 6,
  /** Ticks until a destroyed pod respawns at the surface (~10 s @ 42 Hz). */
  respawnTicks: 420,
  /** Share of the team wallet charged when a pod goes down. */
  respawnFeePct: 0.2,
  /** Liters in the tank after a respawn (capped by tank capacity). */
  respawnFuelLiters: 25,
  /** Spawn column spacing: pod i starts at SPAWN_COL + i * 2. */
  spawnColStride: 2,
} as const;

/** Per-player accent tints (index = player; 0 = untinted). Same on every peer. */
export const PLAYER_TINTS = [0xffffff, 0x99e550, 0x5fcde4, 0xd77bba, 0xfbf236, 0xdf7126] as const;
