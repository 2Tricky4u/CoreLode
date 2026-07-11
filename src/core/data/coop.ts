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
