/**
 * Invite-link helpers: an offer token travels as '<base>#coop=<token>' so a
 * guest can tap a link (or scan it off the host's screen with their camera
 * app) and land in the join flow with zero typing. Pure string functions —
 * the platform supplies the base from location.origin + pathname.
 */

/** Page base for invite links — origin + path, minus a trailing 'index.html'. */
export function pageBase(origin: string, pathname: string): string {
  const path = pathname.endsWith('index.html') ? pathname.slice(0, -'index.html'.length) : pathname;
  return origin + path;
}

export function buildInviteUrl(base: string, token: string): string {
  return `${base}#coop=${token}`;
}

/** Extract the offer token from a location.hash; null when it isn't an invite. */
export function parseInviteHash(hash: string): string | null {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!h.startsWith('coop=')) return null;
  let token = h.slice('coop='.length).trim();
  try {
    token = decodeURIComponent(token);
  } catch {
    /* keep the raw text — the token decoder is the real judge */
  }
  return token.length > 0 ? token : null;
}
