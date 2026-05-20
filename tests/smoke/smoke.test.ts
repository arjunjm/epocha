/**
 * Deployment smoke tests — run against the live Azure App Service after every deployment.
 *
 * These tests only verify that the surface API is responding correctly.
 * No LLM calls are made; the tests rely on cache hits or fast error paths.
 *
 * Set SMOKE_BASE_URL to override the default target, e.g.:
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
  });
});

// ── Auth ───────────────────────────────────────────────────────────────────

describe('auth endpoints', () => {
  it('GET /api/auth/me returns 401 without a cookie', async () => {
    const res = await get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

// ── Timeline — public browse ───────────────────────────────────────────────

describe('timeline browse (public)', () => {
  it('GET /api/timeline/browse with missing params returns 400', async () => {
    const res = await get('/api/timeline/browse');
    expect(res.status).toBe(400);
  });

  it('GET /api/timeline/browse returns 200 or 404 (not a server error)', async () => {
    const params = new URLSearchParams({
      topic: 'Ancient Greece',
      startYear: '800 BCE',
      endYear: '146 BCE',
    });
    const res = await get(`/api/timeline/browse?${params}`);
    expect([200, 404]).toContain(res.status);
  });

  it('GET /api/timeline/browse with a cached topic returns valid JSON', async () => {
    // Tries the Roman Empire — likely cached; falls back gracefully if not
    const params = new URLSearchParams({
      topic: 'The Roman Empire',
      startYear: '27 BCE',
      endYear: '476 CE',
    });
    const res = await get(`/api/timeline/browse?${params}`);
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const body = await res.json() as { cached: boolean; timeline?: { events: unknown[] } };
      expect(body.cached).toBe(true);
      expect(Array.isArray(body.timeline?.events)).toBe(true);
    }
  });
});

// ── Timeline — generate (custom) ──────────────────────────────────────────

describe('timeline generate (custom, requires auth)', () => {
  it('POST /api/timeline without auth returns 401', async () => {
    const res = await post('/api/timeline', { topic: 'Ancient Rome' });
    expect(res.status).toBe(401);
  });

  it('POST /api/timeline with publicBrowse=true returns SSE stream (200)', async () => {
    const res = await post('/api/timeline', {
      topic: 'The Roman Empire',
      startYear: '27 BCE',
      endYear: '476 CE',
      publicBrowse: true,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
  });

  it('POST /api/timeline publicBrowse with a cache hit sends a complete event', async () => {
    const res = await post('/api/timeline', {
      topic: 'The Roman Empire',
      startYear: '27 BCE',
      endYear: '476 CE',
      publicBrowse: true,
    });
    expect(res.status).toBe(200);
    if (!res.body) return; // environment may not support streaming reads
    const text = await res.text();
    // Must contain at least one SSE data line
    expect(text).toMatch(/^data: /m);
    // Should not be an error event if the cache is warm
    if (text.includes('"type":"complete"')) {
      const lines = text.split('\n').filter(l => l.startsWith('data: '));
      const events = lines.map(l => JSON.parse(l.slice(6)) as { type: string });
      const complete = events.find(e => e.type === 'complete');
      expect(complete).toBeDefined();
    }
  });
});

// ── Trending ───────────────────────────────────────────────────────────────

describe('trending topics', () => {
  it('GET /api/timeline/trending returns a JSON array', async () => {
    const res = await get('/api/timeline/trending');
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });
});

// ── Static assets ─────────────────────────────────────────────────────────

describe('static assets', () => {
  it('GET / returns 200 (SPA entry)', async () => {
    const res = await get('/');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<!doctype html>');
  });
});
