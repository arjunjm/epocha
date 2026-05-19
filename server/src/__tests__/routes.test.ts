import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

// ── Mock all external dependencies before importing app modules ─────────────

vi.mock('../secrets.js', () => ({
  getSecret: (name: string) => {
    if (name === 'jwt-secret') return 'test-secret-key';
    return '';
  },
  loadSecrets: vi.fn(),
}));

vi.mock('../userStore.js', () => ({
  findUser: vi.fn(async (id: string) => id === 'user-1' ? mockUser : null),
  findOrCreateUser: vi.fn(async () => mockUser),
  checkAndIncrementRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9 })),
  awardXP: vi.fn(async () => mockUser),
  checkAndAwardDailyLogin: vi.fn(async () => false),
  getSavedTimelines: vi.fn(async () => []),
  saveTimeline: vi.fn(async (_uid: string, data: unknown) => ({ id: 'saved-1', userId: 'user-1', savedAt: new Date().toISOString(), ...(data as object) })),
  deleteSavedTimeline: vi.fn(async () => true),
  getCustomTopics: vi.fn(async () => []),
  saveCustomTopic: vi.fn(async (_uid: string, data: unknown) => ({ id: 'topic-1', userId: 'user-1', createdAt: new Date().toISOString(), ...(data as object) })),
  deleteCustomTopic: vi.fn(async () => true),
  unlockTheme: vi.fn(async (_uid: string, themeId: string) => ({ ...mockUser, unlockedThemes: ['midnight', themeId] })),
  setActiveTheme: vi.fn(async () => mockUser),
  DAILY_LIMIT: 10,
  MAX_USERS: 50,
}));

vi.mock('../cache.js', () => ({
  initCache: vi.fn(),
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => undefined),
  getCachedQuiz: vi.fn(async () => null),
  setCachedQuiz: vi.fn(async () => undefined),
}));

vi.mock('../quiz.js', () => ({
  generateQuizQuestions: vi.fn(async () => []),
  pickRandomQuestions: vi.fn((qs: unknown[]) => qs.slice(0, 5)),
}));

// Mock passport to avoid GoogleStrategy needing client-id
vi.mock('passport', () => {
  const passport = { initialize: () => (_req: unknown, _res: unknown, next: () => void) => next() };
  return { default: passport };
});

// ── Mock user and token ────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  picture: undefined,
  createdAt: new Date().toISOString(),
  dailyCount: 0,
  dailyResetAt: new Date().toISOString(),
  xp: 150,
  level: 2,
  lastLoginAt: new Date().toISOString(),
  activeTheme: 'midnight',
  unlockedThemes: ['midnight'],
};

// Build a minimal authenticated test app to avoid importing the full index.ts
// (which has side effects like listening on a port and loading secrets)
import jwt from 'jsonwebtoken';
import {
  findUser, getSavedTimelines, saveTimeline, deleteSavedTimeline,
  getCustomTopics, saveCustomTopic, deleteCustomTopic,
  unlockTheme, setActiveTheme, awardXP, checkAndAwardDailyLogin,
} from '../userStore.js';
import { getCached } from '../cache.js';
import { THEMES, XP_REWARDS } from '../types.js';
import type { AuthRequest } from '../auth.js';
import type { Response, NextFunction } from 'express';

function makeToken() {
  return jwt.sign({ sub: 'user-1', email: 'test@example.com', name: 'Test User' }, 'test-secret-key');
}

function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
  req.user = mockUser;
  next();
}

let app: express.Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Browse endpoint (public)
  app.get('/api/timeline/browse', async (req, res) => {
    const { topic, startYear, endYear } = req.query as { topic?: string; startYear?: string; endYear?: string };
    if (!topic || !startYear || !endYear) { res.status(400).json({ error: 'Missing params' }); return; }
    const cached = await getCached(topic, startYear, endYear);
    if (cached) res.json({ cached: true, timeline: cached });
    else res.status(404).json({ cached: false });
  });

  // Auth/me endpoint
  app.get('/api/auth/me', authMiddleware as express.RequestHandler, async (req, res) => {
    const authReq = req as AuthRequest;
    void checkAndAwardDailyLogin(authReq.user!.id);
    const user = await findUser(authReq.user!.id);
    if (!user) { res.status(401).json({ error: 'User not found' }); return; }
    res.json({ id: user.id, name: user.name, xp: user.xp, level: user.level, activeTheme: user.activeTheme, dailyCount: user.dailyCount, dailyLimit: 10, remaining: 10 - user.dailyCount, unlockedThemes: user.unlockedThemes });
  });

  // Saved timelines
  app.get('/api/saved', authMiddleware as express.RequestHandler, async (req, res) => {
    const authReq = req as AuthRequest;
    res.json(await getSavedTimelines(authReq.user!.id));
  });

  app.post('/api/saved', authMiddleware as express.RequestHandler, async (req, res) => {
    const authReq = req as AuthRequest;
    const { topic, startYear, endYear, title, description, collectionName } = req.body as Record<string, string>;
    if (!topic || !startYear || !endYear || !title) { res.status(400).json({ error: 'Missing fields' }); return; }
    const item = await saveTimeline(authReq.user!.id, { topic, startYear, endYear, title, description: description ?? '', collectionName: collectionName ?? 'General' });
    void awardXP(authReq.user!.id, XP_REWARDS.SAVE_TIMELINE);
    res.status(201).json(item);
  });

  app.delete('/api/saved/:id', authMiddleware as express.RequestHandler, async (req, res) => {
    const authReq = req as AuthRequest;
    const ok = await deleteSavedTimeline(authReq.user!.id, req.params.id as string);
    if (!ok) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ ok: true });
  });

  // Custom topics
  app.get('/api/topics/custom', authMiddleware as express.RequestHandler, async (req, res) => {
    const authReq = req as AuthRequest;
    res.json(await getCustomTopics(authReq.user!.id));
  });

  app.post('/api/topics/custom', authMiddleware as express.RequestHandler, async (req, res) => {
    const authReq = req as AuthRequest;
    const { name, icon, items } = req.body as { name: string; icon?: string; items: unknown[] };
    if (!name || !items?.length) { res.status(400).json({ error: 'name and items required' }); return; }
    res.status(201).json(await saveCustomTopic(authReq.user!.id, { name, icon: icon ?? '📌', items: items as never }));
  });

  app.delete('/api/topics/custom/:id', authMiddleware as express.RequestHandler, async (req, res) => {
    const authReq = req as AuthRequest;
    const ok = await deleteCustomTopic(authReq.user!.id, req.params.id as string);
    if (!ok) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ ok: true });
  });

  // Marketplace
  app.get('/api/marketplace/themes', (_req, res) => {
    res.json(THEMES.map(t => ({ ...t, unlocked: t.id === 'midnight' })));
  });

  app.post('/api/marketplace/unlock/:themeId', authMiddleware as express.RequestHandler, async (req, res) => {
    const authReq = req as AuthRequest;
    const themeId = req.params.themeId as string;
    const valid = THEMES.some(t => t.id === themeId);
    if (!valid) { res.status(400).json({ error: 'Unknown theme' }); return; }
    const user = await unlockTheme(authReq.user!.id, themeId);
    res.json({ ok: true, unlockedThemes: user?.unlockedThemes });
  });

  // Theme setter
  app.post('/api/user/theme', authMiddleware as express.RequestHandler, async (req, res) => {
    const authReq = req as AuthRequest;
    const { themeId } = req.body as { themeId: string };
    const user = await setActiveTheme(authReq.user!.id, themeId);
    if (!user) { res.status(400).json({ error: 'Not unlocked' }); return; }
    res.json({ ok: true, activeTheme: user.activeTheme });
  });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/timeline/browse', () => {
  it('returns 400 when params are missing', async () => {
    const res = await request(app).get('/api/timeline/browse');
    expect(res.status).toBe(400);
  });

  it('returns 404 when not cached', async () => {
    const res = await request(app).get('/api/timeline/browse?topic=Unknown&startYear=1&endYear=2');
    expect(res.status).toBe(404);
    expect(res.body.cached).toBe(false);
  });
});

describe('GET /api/auth/me', () => {
  it('returns user profile with XP fields', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('user-1');
    expect(res.body).toHaveProperty('xp');
    expect(res.body).toHaveProperty('level');
    expect(res.body).toHaveProperty('activeTheme');
    expect(res.body).toHaveProperty('remaining');
  });
});

describe('GET /api/saved', () => {
  it('returns empty array when no saves', async () => {
    const res = await request(app).get('/api/saved');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/saved', () => {
  it('saves a timeline and returns 201', async () => {
    const res = await request(app).post('/api/saved').send({
      topic: 'Ancient Rome',
      startYear: '27 BCE',
      endYear: '476 CE',
      title: 'The Roman Empire',
      description: 'Rise and fall.',
    });
    expect(res.status).toBe(201);
    expect(res.body.topic).toBe('Ancient Rome');
    expect(res.body.id).toBeDefined();
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/saved').send({ topic: 'Rome' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/saved/:id', () => {
  it('returns 200 on successful delete', async () => {
    const res = await request(app).delete('/api/saved/saved-1');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('GET /api/topics/custom', () => {
  it('returns empty array', async () => {
    const res = await request(app).get('/api/topics/custom');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/topics/custom', () => {
  it('creates a custom topic', async () => {
    const res = await request(app).post('/api/topics/custom').send({
      name: 'My History',
      icon: '📚',
      items: [{ label: 'Custom Era', topic: 'Custom Era', start: '1500', end: '1700' }],
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My History');
  });

  it('returns 400 when name or items missing', async () => {
    const res = await request(app).post('/api/topics/custom').send({ name: 'No items' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/marketplace/themes', () => {
  it('returns all 5 themes', async () => {
    const res = await request(app).get('/api/marketplace/themes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
  });

  it('midnight is unlocked by default', async () => {
    const res = await request(app).get('/api/marketplace/themes');
    const midnight = res.body.find((t: { id: string }) => t.id === 'midnight');
    expect(midnight?.unlocked).toBe(true);
  });

  it('other themes are locked by default', async () => {
    const res = await request(app).get('/api/marketplace/themes');
    const locked = res.body.filter((t: { id: string; unlocked: boolean }) => t.id !== 'midnight');
    expect(locked.every((t: { unlocked: boolean }) => !t.unlocked)).toBe(true);
  });
});

describe('POST /api/marketplace/unlock/:themeId', () => {
  it('unlocks a valid theme', async () => {
    const res = await request(app).post('/api/marketplace/unlock/sepia');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.unlockedThemes).toContain('sepia');
  });

  it('returns 400 for an unknown theme', async () => {
    const res = await request(app).post('/api/marketplace/unlock/invalid-theme');
    expect(res.status).toBe(400);
  });
});
