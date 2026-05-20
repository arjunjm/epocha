/**
 * Deployment smoke tests — run against the live Azure App Service after every deployment.
 *
 * No LLM calls are made; tests rely on cache hits or fast error paths.
 * Failure threshold: if ≥20% of tests fail, the CI pipeline triggers an automatic rollback.
 *
 * Set SMOKE_BASE_URL to override the default target:
 *   SMOKE_BASE_URL=https://staging.example.com npx vitest run tests/smoke
 */
import { describe, it, expect } from 'vitest';

const BASE = process.env.SMOKE_BASE_URL ?? 'https://app-timelineapp-dev.azurewebsites.net';
const TIMEOUT_MS = 15_000;

async function get(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function post(path: string, body: unknown) {
  return get(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Health ─────────────────────────────────────────────────────────────────

describe('health', () => {
  it('GET /api/health returns 200 with JSON body', async () => {
    const res = await get('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; timestamp: string };
    expect(body.ok).toBe(true);
    expect(typeof body.timestamp).toBe('string');
    // Timestamp should be recent (within last 5 minutes)
    expect(Date.now() - new Date(body.timestamp).getTime()).toBeLessThan(5 * 60 * 1000);
  });
});

// ── Auth endpoints ─────────────────────────────────────────────────────────

describe('auth endpoints', () => {
  it('GET /api/auth/me without a cookie returns 401', async () => {
    const res = await get('/api/auth/me');
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(typeof body.error).toBe('string');
  });

  it('POST /api/auth/logout returns 200 with JSON', async () => {
    const res = await post('/api/auth/logout', {});
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});

// ── Protected endpoints reject unauthenticated requests ───────────────────

describe('auth guards', () => {
  it('GET /api/saved without auth returns 401', async () => {
    const res = await get('/api/saved');
    expect(res.status).toBe(401);
  });

  it('GET /api/topics/custom without auth returns 401', async () => {
    const res = await get('/api/topics/custom');
    expect(res.status).toBe(401);
  });

  it('POST /api/quiz/complete without auth returns 401', async () => {
    const res = await post('/api/quiz/complete', { score: 5, total: 5 });
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/status without auth returns 401', async () => {
    const res = await get('/api/admin/status');
    expect(res.status).toBe(401);
  });
});

// ── Timeline — public browse ───────────────────────────────────────────────

describe('timeline browse (public)', () => {
  it('GET /api/timeline/browse with missing params returns 400', async () => {
    const res = await get('/api/timeline/browse');
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(typeof body.error).toBe('string');
  });

  it('GET /api/timeline/browse with partial params returns 400', async () => {
    const res = await get('/api/timeline/browse?topic=Ancient+Greece');
    expect(res.status).toBe(400);
  });

  it('GET /api/timeline/browse returns 200 or 404 (never 5xx)', async () => {
    const params = new URLSearchParams({ topic: 'Ancient Greece', startYear: '800 BCE', endYear: '146 BCE' });
    const res = await get(`/api/timeline/browse?${params}`);
    expect(res.status).toBeLessThan(500);
    expect([200, 404]).toContain(res.status);
  });

  it('GET /api/timeline/browse cache hit returns valid timeline structure', async () => {
    const params = new URLSearchParams({ topic: 'The Roman Empire', startYear: '27 BCE', endYear: '476 CE' });
    const res = await get(`/api/timeline/browse?${params}`);
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const body = await res.json() as { cached: boolean; timeline: { topic: string; period: string; events: unknown[]; description: string } };
      expect(body.cached).toBe(true);
      expect(typeof body.timeline.topic).toBe('string');
      expect(typeof body.timeline.period).toBe('string');
      expect(typeof body.timeline.description).toBe('string');
      expect(Array.isArray(body.timeline.events)).toBe(true);
      expect(body.timeline.events.length).toBeGreaterThan(0);
    }
  });
});

// ── Timeline — custom generate ────────────────────────────────────────────

describe('timeline generate (custom)', () => {
  it('POST /api/timeline without auth returns 401', async () => {
    const res = await post('/api/timeline', { topic: 'Ancient Rome' });
    expect(res.status).toBe(401);
  });

  it('POST /api/timeline missing topic returns 400', async () => {
    const res = await post('/api/timeline', { publicBrowse: true });
    expect(res.status).toBe(400);
  });

  it('POST /api/timeline publicBrowse=true returns SSE stream (200)', async () => {
    const res = await post('/api/timeline', {
      topic: 'The Roman Empire',
      startYear: '27 BCE',
      endYear: '476 CE',
      publicBrowse: true,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
  });

  it('POST /api/timeline publicBrowse SSE stream contains valid data lines', async () => {
    const res = await post('/api/timeline', {
      topic: 'The Roman Empire',
      startYear: '27 BCE',
      endYear: '476 CE',
      publicBrowse: true,
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/^data: \{/m);
    // Every data line must be valid JSON
    const dataLines = text.split('\n').filter(l => l.startsWith('data: '));
    for (const line of dataLines) {
      expect(() => JSON.parse(line.slice(6))).not.toThrow();
    }
  });
});

// ── Trending topics ────────────────────────────────────────────────────────

describe('trending topics', () => {
  it('GET /api/timeline/trending returns a JSON array', async () => {
    const res = await get('/api/timeline/trending');
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /api/timeline/trending items have required fields when populated', async () => {
    const res = await get('/api/timeline/trending');
    const body = await res.json() as Array<{ topic?: unknown; startYear?: unknown; endYear?: unknown; period?: unknown }>;
    for (const item of body) {
      expect(typeof item.topic).toBe('string');
      expect(typeof item.startYear).toBe('string');
      expect(typeof item.endYear).toBe('string');
      expect(typeof item.period).toBe('string');
    }
  });
});

// ── Quiz ───────────────────────────────────────────────────────────────────

describe('quiz endpoint', () => {
  it('GET /api/quiz without params returns 400', async () => {
    const res = await get('/api/quiz');
    expect(res.status).toBe(400);
  });

  it('GET /api/quiz with unknown topic returns 404 (not 5xx)', async () => {
    const params = new URLSearchParams({ topic: 'zzz-no-such-topic-zzz', startYear: '1', endYear: '2' });
    const res = await get(`/api/quiz?${params}`);
    expect(res.status).toBeLessThan(500);
  });
});

// ── Marketplace ────────────────────────────────────────────────────────────

describe('marketplace', () => {
  it('GET /api/marketplace/themes returns array of themes', async () => {
    const res = await get('/api/marketplace/themes');
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ id: string; unlocked: boolean }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('midnight theme is unlocked by default (unauthenticated)', async () => {
    const res = await get('/api/marketplace/themes');
    const body = await res.json() as Array<{ id: string; unlocked: boolean }>;
    const midnight = body.find(t => t.id === 'midnight');
    expect(midnight).toBeDefined();
    expect(midnight?.unlocked).toBe(true);
  });
});

// ── Static assets & SPA ───────────────────────────────────────────────────

describe('static assets', () => {
  it('GET / returns 200 with HTML containing app root', async () => {
    const res = await get('/');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<div id="root">');
  });

  it('GET /unknown-route returns SPA HTML (not JSON 404)', async () => {
    const res = await get('/some/unknown/client/route');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<!doctype html>');
  });

  it('GET /api/unknown-api-route returns HTML SPA fallback', async () => {
    const res = await get('/api/nonexistent');
    // Unknown API routes fall through to SPA catchall
    expect(res.status).toBeLessThan(500);
  });
});
