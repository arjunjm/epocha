import { describe, it, expect } from 'vitest';
import { xpToLevel, LEVEL_THRESHOLDS, XP_REWARDS, THEMES } from '../types.js';

describe('xpToLevel', () => {
  it('returns level 1 at 0 XP', () => {
    expect(xpToLevel(0)).toBe(1);
  });

  it('returns level 1 just below first threshold', () => {
    expect(xpToLevel(99)).toBe(1);
  });

  it('returns level 2 at exactly the threshold', () => {
    expect(xpToLevel(100)).toBe(2);
  });

  it('correctly levels up at each threshold', () => {
    LEVEL_THRESHOLDS.forEach((threshold, i) => {
      const expectedLevel = i + 1;
      expect(xpToLevel(threshold)).toBe(expectedLevel);
    });
  });

  it('returns level 20 at max threshold', () => {
    expect(xpToLevel(22000)).toBe(20);
  });

  it('caps at level 20 even with huge XP', () => {
    expect(xpToLevel(999999)).toBe(20);
  });

  it('handles mid-level XP correctly', () => {
    // Between L9 (2500) and L10 (3200) → level 9
    expect(xpToLevel(2800)).toBe(9);
  });
});

describe('LEVEL_THRESHOLDS', () => {
  it('has exactly 20 entries', () => {
    expect(LEVEL_THRESHOLDS).toHaveLength(20);
  });

  it('starts at 0', () => {
    expect(LEVEL_THRESHOLDS[0]).toBe(0);
  });

  it('is strictly increasing', () => {
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      expect(LEVEL_THRESHOLDS[i]).toBeGreaterThan(LEVEL_THRESHOLDS[i - 1]!);
    }
  });
});

describe('XP_REWARDS', () => {
  it('has all required reward types', () => {
    expect(XP_REWARDS.VIEW_TIMELINE).toBeGreaterThan(0);
    expect(XP_REWARDS.COMPLETE_QUIZ).toBeGreaterThan(0);
    expect(XP_REWARDS.SAVE_TIMELINE).toBeGreaterThan(0);
    expect(XP_REWARDS.DAILY_LOGIN).toBeGreaterThan(0);
  });

  it('quiz reward is higher than view reward', () => {
    expect(XP_REWARDS.COMPLETE_QUIZ).toBeGreaterThan(XP_REWARDS.VIEW_TIMELINE);
  });
});

describe('THEMES', () => {
  it('has exactly 5 themes', () => {
    expect(THEMES).toHaveLength(5);
  });

  it('includes midnight as the first theme', () => {
    expect(THEMES[0]?.id).toBe('midnight');
  });

  it('all themes have required fields', () => {
    for (const theme of THEMES) {
      expect(theme.id).toBeTruthy();
      expect(theme.name).toBeTruthy();
      expect(theme.description).toBeTruthy();
    }
  });

  it('has no duplicate theme ids', () => {
    const ids = THEMES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
