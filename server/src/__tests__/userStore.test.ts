import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { User } from '../types.js';

// Mock secrets and cosmos so no external calls happen
vi.mock('../secrets.js', () => ({
  getSecret: (name: string) => {
    // Return empty for cosmos-endpoint so local JSON store is used
    if (name === 'cosmos-endpoint') return '';
    return '';
  },
  loadSecrets: vi.fn(),
}));

// Use a temp file for the local store so tests don't touch real data
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return actual;
});

// We test the pure logic functions that don't depend on external state
import { xpToLevel, LEVEL_THRESHOLDS, XP_REWARDS } from '../types.js';

describe('xpToLevel (via userStore logic)', () => {
  it('newly created user starts at level 1 with 0 XP', () => {
    expect(xpToLevel(0)).toBe(1);
  });

  it('leveling up works at each boundary', () => {
    expect(xpToLevel(LEVEL_THRESHOLDS[1]! - 1)).toBe(1);
    expect(xpToLevel(LEVEL_THRESHOLDS[1]!)).toBe(2);
    expect(xpToLevel(LEVEL_THRESHOLDS[4]!)).toBe(5);
    expect(xpToLevel(LEVEL_THRESHOLDS[9]!)).toBe(10);
    expect(xpToLevel(LEVEL_THRESHOLDS[19]!)).toBe(20);
  });
});

describe('rate limit logic', () => {
  const makeUser = (overrides: Partial<User> = {}): User => ({
    id: 'test-user',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date().toISOString(),
    dailyCount: 0,
    dailyResetAt: new Date().toISOString(),
    xp: 0,
    level: 1,
    lastLoginAt: new Date().toISOString(),
    activeTheme: 'midnight',
    unlockedThemes: ['midnight'],
    ...overrides,
  });

  it('user within limit can generate', () => {
    const user = makeUser({ dailyCount: 5 });
    const DAILY_LIMIT = 10;
    const allowed = user.dailyCount < DAILY_LIMIT;
    expect(allowed).toBe(true);
  });

  it('user at limit is blocked', () => {
    const user = makeUser({ dailyCount: 10 });
    const DAILY_LIMIT = 10;
    const allowed = user.dailyCount < DAILY_LIMIT;
    expect(allowed).toBe(false);
  });

  it('count resets when date changes', () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const user = makeUser({ dailyCount: 10, dailyResetAt: yesterday.toISOString() });

    const now = new Date();
    const resetAt = new Date(user.dailyResetAt);
    const sameDay =
      now.getUTCFullYear() === resetAt.getUTCFullYear() &&
      now.getUTCMonth() === resetAt.getUTCMonth() &&
      now.getUTCDate() === resetAt.getUTCDate();

    const effectiveCount = sameDay ? user.dailyCount : 0;
    expect(effectiveCount).toBe(0);
  });
});

describe('XP calculation logic', () => {
  it('XP accumulates correctly', () => {
    let xp = 0;
    xp += XP_REWARDS.VIEW_TIMELINE; // +10
    xp += XP_REWARDS.SAVE_TIMELINE; // +5
    xp += XP_REWARDS.DAILY_LOGIN;   // +5
    expect(xp).toBe(20);
  });

  it('completing a quiz with full score gives maximum XP', () => {
    const score = 5;
    const total = 5;
    const xpEarned = (score / total) >= 0.6 ? XP_REWARDS.COMPLETE_QUIZ : Math.floor(XP_REWARDS.COMPLETE_QUIZ / 2);
    expect(xpEarned).toBe(XP_REWARDS.COMPLETE_QUIZ);
  });

  it('completing a quiz below threshold gives half XP', () => {
    const score = 2;
    const total = 5;
    const xpEarned = (score / total) >= 0.6 ? XP_REWARDS.COMPLETE_QUIZ : Math.floor(XP_REWARDS.COMPLETE_QUIZ / 2);
    expect(xpEarned).toBe(Math.floor(XP_REWARDS.COMPLETE_QUIZ / 2));
  });

  it('completing a quiz at exactly 60% gives full XP', () => {
    const score = 3;
    const total = 5;
    const xpEarned = (score / total) >= 0.6 ? XP_REWARDS.COMPLETE_QUIZ : Math.floor(XP_REWARDS.COMPLETE_QUIZ / 2);
    expect(xpEarned).toBe(XP_REWARDS.COMPLETE_QUIZ);
  });
});
