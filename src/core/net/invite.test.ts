import { describe, expect, it } from 'vitest';
import { buildInviteUrl, pageBase, parseInviteHash } from './invite';

const TOKEN = 'CLDP1.eyJ2IjoyLCJ6IjoiYWJjIn0.1a2b3c';

describe('invite links', () => {
  it('round-trips a token through build → parse', () => {
    const url = buildInviteUrl('https://x.github.io/CoreLode/', TOKEN);
    expect(url).toBe(`https://x.github.io/CoreLode/#coop=${TOKEN}`);
    expect(parseInviteHash(new URL(url).hash)).toBe(TOKEN);
  });

  it('derives the page base under both dev and Pages roots', () => {
    expect(pageBase('http://localhost:5173', '/')).toBe('http://localhost:5173/');
    expect(pageBase('https://x.github.io', '/CoreLode/')).toBe('https://x.github.io/CoreLode/');
    expect(pageBase('https://x.github.io', '/CoreLode/index.html')).toBe(
      'https://x.github.io/CoreLode/',
    );
  });

  it('rejects hashes that are not invites', () => {
    expect(parseInviteHash('')).toBeNull();
    expect(parseInviteHash('#')).toBeNull();
    expect(parseInviteHash('#other=x')).toBeNull();
    expect(parseInviteHash('#coop=')).toBeNull();
    expect(parseInviteHash('#coop=   ')).toBeNull();
  });

  it('accepts the hash with or without the leading #', () => {
    expect(parseInviteHash(`coop=${TOKEN}`)).toBe(TOKEN);
    expect(parseInviteHash(`#coop=${TOKEN}`)).toBe(TOKEN);
  });

  it('tolerates a URL-encoded token', () => {
    expect(parseInviteHash(`#coop=${encodeURIComponent(TOKEN)}`)).toBe(TOKEN);
  });
});
