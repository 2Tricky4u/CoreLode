import { describe, expect, it } from 'vitest';
import { BIND_ACTIONS, keyLabel, mergeBinds, presetBinds } from './bindings';

describe('key bindings', () => {
  it('presets cover every action in both schemes', () => {
    for (const scheme of ['classic', 'vim'] as const) {
      const p = presetBinds(scheme);
      for (const a of BIND_ACTIONS) expect(p[a].length, `${scheme}:${a}`).toBeGreaterThan(0);
    }
  });

  it('vim moves on hjkl and keeps ⇧G for the core teleporter', () => {
    const p = presetBinds('vim');
    expect(p.left).toContain('KeyH');
    expect(p.left).not.toContain('KeyA');
    expect(p.coreTeleporter).toEqual(['Shift+KeyG']);
    expect(p.priorityTransporter).toEqual(['KeyG']);
  });

  it('overrides replace the preset per action — including an explicit unbind', () => {
    const merged = mergeBinds('classic', { left: ['KeyZ'], pause: [] });
    expect(merged.left).toEqual(['KeyZ']);
    expect(merged.pause).toEqual([]); // stolen-empty stays unbound
    expect(merged.right).toEqual(presetBinds('classic').right); // untouched
  });

  it('labels are compact and readable', () => {
    expect(keyLabel('KeyF')).toBe('F');
    expect(keyLabel('Digit0')).toBe('0');
    expect(keyLabel('ArrowLeft')).toBe('←');
    expect(keyLabel('Shift+KeyG')).toBe('⇧G');
    expect(keyLabel('Space')).toBe('SPACE');
  });
});
