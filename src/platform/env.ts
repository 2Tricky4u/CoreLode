export const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Entropy for new-run seeds — lives outside core so the sim stays pure. */
export const entropySeed = (): number => (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
