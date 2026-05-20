import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../auth.js';

vi.mock('../secrets.js', () => ({
  getSecret: (name: string) => {
    if (name === 'jwt-secret') return 'test-secret-key';
    return '';
  },
  loadSecrets: vi.fn(),
}));

vi.mock('../userStore.js', () => ({
  findOrCreateUser: vi.fn(),
  findUser: vi.fn(),
  checkAndIncrementRateLimit: vi.fn(),
  awardXP: vi.fn(),
  checkAndAwardDailyLogin: vi.fn(),
  getSavedTimelines: vi.fn(),
  saveTimeline: vi.fn(),
  deleteSavedTimeline: vi.fn(),
  getCustomTopics: vi.fn(),
  saveCustomTopic: vi.fn(),
  deleteCustomTopic: vi.fn(),
  unlockTheme: vi.fn(),
  setActiveTheme: vi.fn(),
  DAILY_LIMIT: 10,
  ADMIN_EMAILS: new Set(),
}));

// passport mock to prevent GoogleStrategy from needing real credentials
vi.mock('passport', () => {
  const p = {
    initialize: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    use: vi.fn(),
    serializeUser: vi.fn(),
    deserializeUser: vi.fn(),
    authenticate: vi.fn(),
  };
  return { default: p };
});

vi.mock('passport-google-oauth20', () => ({
  Strategy: vi.fn(),
}));

import jwt from 'jsonwebtoken';
import { requireAuth, optionalAuth, signToken } from '../auth.js';

const SECRET = 'test-secret-key';

function makeReq(token?: string): AuthRequest {
  return {
    cookies: token ? { timeline_token: token } : {},
  } as unknown as AuthRequest;
}

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

const next = vi.fn() as unknown as NextFunction;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireAuth', () => {
  it('returns 401 when no cookie is present', () => {
    const req = makeReq();
    const res = makeRes();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and attaches user when token is valid', () => {
    const token = jwt.sign({ sub: 'u1', email: 'a@b.com', name: 'Alice' }, SECRET);
    const req = makeReq(token);
    const res = makeRes();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user?.id).toBe('u1');
    expect(req.user?.email).toBe('a@b.com');
  });

  it('returns 401 when token is signed with the wrong secret', () => {
    const token = jwt.sign({ sub: 'u1', email: 'a@b.com', name: 'Alice' }, 'wrong-secret');
    const req = makeReq(token);
    const res = makeRes();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token has expired', () => {
    const token = jwt.sign({ sub: 'u1', email: 'a@b.com', name: 'Alice' }, SECRET, { expiresIn: -1 });
    const req = makeReq(token);
    const res = makeRes();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('optionalAuth', () => {
  it('calls next with no user when no cookie is present', () => {
    const req = makeReq();
    const res = makeRes();
    optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('attaches user when a valid token is present', () => {
    const token = jwt.sign({ sub: 'u2', email: 'b@c.com', name: 'Bob' }, SECRET);
    const req = makeReq(token);
    const res = makeRes();
    optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user?.id).toBe('u2');
  });

  it('still calls next with no user when token is invalid', () => {
    const req = makeReq('not-a-jwt');
    const res = makeRes();
    optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});

describe('signToken', () => {
  it('produces a verifiable JWT with the user id as sub', () => {
    const user = {
      id: 'u3', email: 'c@d.com', name: 'Charlie',
      createdAt: new Date().toISOString(),
      dailyCount: 0, dailyResetAt: new Date().toISOString(),
      xp: 0, level: 1, lastLoginAt: new Date().toISOString(),
      activeTheme: 'midnight', unlockedThemes: ['midnight'],
    };
    const token = signToken(user);
    const payload = jwt.verify(token, SECRET) as { sub: string; email: string };
    expect(payload.sub).toBe('u3');
    expect(payload.email).toBe('c@d.com');
  });
});
