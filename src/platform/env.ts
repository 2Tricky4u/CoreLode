export const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Entropy for new-run seeds — lives outside core so the sim stays pure. */
export const entropySeed = (): number => (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;

/** True while any element owns the fullscreen state. */
export const isFullscreen = (): boolean =>
  typeof document !== 'undefined' && document.fullscreenElement !== null;

/**
 * Toggle fullscreen on the game stage (must run inside a user gesture).
 * On phones we also try to lock landscape — best-effort, rejection is fine
 * (desktop browsers and iOS Safari don't support the lock).
 */
export async function toggleFullscreen(): Promise<boolean> {
  const stage = document.getElementById('stage') ?? document.documentElement;
  try {
    if (isFullscreen()) {
      await document.exitFullscreen();
      return false;
    }
    await stage.requestFullscreen();
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      if (isTouchDevice()) await orientation.lock?.('landscape');
    } catch {
      /* orientation lock is a nice-to-have */
    }
    return true;
  } catch {
    return isFullscreen();
  }
}
