import { describe, it, expect } from 'vitest';
import { xpToLevel, xpForNextLevel, LEVEL_THRESHOLDS } from '../types';

describe('xpToLevel', () => {
  it('level 1 at 0 XP', () => expect(xpToLevel(0)).toBe(1));
  it('level 2 at 100 XP', () => expect(xpToLevel(100)).toBe(2));
  it('level 10 at 3200 XP', () => expect(xpToLevel(3200)).toBe(10));
  it('level 20 at max XP', () => expect(xpToLevel(22000)).toBe(20));
  it('caps at 20', () => expect(xpToLevel(999999)).toBe(20));
  it('stays at 1 just below first threshold', () => expect(xpToLevel(99)).toBe(1));
});

describe('xpForNextLevel', () => {
  it('returns threshold for level 2 when at level 1', () => {
    expect(xpForNextLevel(1)).toBe(LEVEL_THRESHOLDS[1]);
  });

  it('returns max threshold at level 20', () => {
    expect(xpForNextLevel(20)).toBe(LEVEL_THRESHOLDS[19]);
  });

  it('always returns a positive number', () => {
    for (let level = 1; level <= 20; level++) {
      expect(xpForNextLevel(level)).toBeGreaterThan(0);
    }
  });
});
