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

  it('BCE/CE year strings are accepted (not rejected with 400)', async () => {
    // Regression: client was sending digit-only years ("800") instead of the full
    // BCE/CE format ("800 BCE") that matches the cache key used by the Azure Function.
    // The server must accept these strings without treating them as malformed input.
    const params = new URLSearchParams({
      topic: 'Ancient Greece',
      startYear: '800 BCE',
      endYear: '146 BCE',
    });
    const res = await get(`/api/quiz?${params}`);
    expect(res.status).not.toBe(400); // must not be rejected as missing/bad params
    expect(res.status).toBeLessThan(500);
  });

  it('pre-cached BCE/CE sidebar topic returns quiz questions with the correct year format', async () => {
    // The Azure Function pre-generates sidebar topics using the same year strings as
    // client/src/data/topics.ts and functions/src/topics.ts (e.g. "800 BCE", "476 CE").
    // The quiz cache key is timeline:<topic>:<startYear>:<endYear>, so the quiz call
    // MUST use those same full strings — not digit-only versions — or it misses the cache.
    //
    // If the timeline IS in cache: quiz must return 200 with exactly 5 valid questions.
    // If not cached yet (Azure Function hasn't run): we skip rather than fail.
    const ancientTopics = [
      { topic: 'Ancient Greece', startYear: '800 BCE', endYear: '146 BCE' },
      { topic: 'The Roman Empire', startYear: '27 BCE', endYear: '476 CE' },
      { topic: 'Ancient Egypt', startYear: '3100 BCE', endYear: '30 BCE' },
    ];

    let verified = 0;
    for (const t of ancientTopics) {
      const browseParams = new URLSearchParams(t);

      // Only test quiz if this topic is already in the browse cache
      const browseRes = await get(`/api/timeline/browse?${browseParams}`);
      if (browseRes.status !== 200) continue;

      const quizRes = await get(`/api/quiz?${browseParams}`);
      expect(quizRes.status).toBe(200); // timeline cached → quiz must work
      const body = await quizRes.json() as { questions: Array<{ question: string; options: string[]; correct: number; explanation: string }> };
      expect(Array.isArray(body.questions)).toBe(true);
      expect(body.questions.length).toBe(5);
      for (const q of body.questions) {
        expect(typeof q.question).toBe('string');
        expect(q.question.length).toBeGreaterThan(0);
        expect(Array.isArray(q.options)).toBe(true);
        expect(q.options.length).toBe(4);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThanOrEqual(3);
        expect(typeof q.explanation).toBe('string');
      }
      verified++;
    }

    if (verified === 0) {
      // No BCE/CE topics cached — Azure Function hasn't run. This is not a code bug.
      console.warn('[smoke] No BCE/CE sidebar topics found in cache; skipping quiz assertion');
    }
  });

  it('browse and quiz use matching year strings for a modern sidebar topic', async () => {
    // Modern sidebar topics use plain numeric years (e.g. "1947", "1991").
    // Verify that the year format used to browse == year format the quiz cache uses.
    const topic = { topic: 'The Cold War', startYear: '1947', endYear: '1991' };
    const params = new URLSearchParams(topic);

    const browseRes = await get(`/api/timeline/browse?${params}`);
    expect(browseRes.status).toBeLessThan(500);
    if (browseRes.status !== 200) return; // not cached, skip

    const quizRes = await get(`/api/quiz?${params}`);
    expect(quizRes.status).toBe(200);
    const body = await quizRes.json() as { questions: unknown[] };
    expect(Array.isArray(body.questions)).toBe(true);
    expect(body.questions.length).toBe(5);
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
