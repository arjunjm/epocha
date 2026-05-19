import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { STUB_TIMELINE } from './stubData.js';
import { passport, requireAuth, signToken, setAuthCookie, clearAuthCookie, configurePassport } from './auth.js';
import { checkAndIncrementRateLimit, findUser, DAILY_LIMIT } from './userStore.js';
import { loadSecrets, getSecret } from './secrets.js';
import { initCache, getCached, setCached } from './cache.js';
import type { AuthRequest } from './auth.js';

// Cast helper — lets us use AuthRequest handlers on Express routes without type gymnastics
const auth = requireAuth as express.RequestHandler;

const USE_STUB = process.env.USE_STUB === 'true';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Client build is at different relative paths in dev vs production:
// Dev:  server/dist/index.js → ../../client/dist
// Prod: wwwroot/dist/index.js → ../client/dist
const _clientCandidates: string[] = [
  path.join(__dirname, '../client/dist'),    // production (Azure wwwroot/dist/)
  path.join(__dirname, '../../client/dist'), // local dev (server/dist/)
];
const clientDistPath: string = _clientCandidates.find((p: string) => fs.existsSync(p))
  ?? _clientCandidates[0]!;

const app = express();

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());
app.use(express.static(clientDistPath));

// ── Auth routes ────────────────────────────────────────────────────────────

// Start Google OAuth flow
app.get('/api/auth/google', passport.authenticate('google', { session: false }));

// Google OAuth callback
app.get('/api/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/?auth=failed' }),
  (req, res) => {
    const user = req.user as import('./types.js').User;
    const token = signToken(user);
    setAuthCookie(res, token);
    res.redirect('/');
  }
);

// Get current user
app.get('/api/auth/me', auth, async (req, res) => {
  const user = await findUser((req as AuthRequest).user!.id);
  if (!user) { res.status(401).json({ error: 'User not found' }); return; }
  const { dailyCount } = user;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture,
    dailyCount,
    dailyLimit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - dailyCount),
  });
});

// Sign out
app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Anthropic client — initialised after loadSecrets() so the api key is available
let client: Anthropic;
function getAnthropicClient() {
  if (!client) client = new Anthropic({ apiKey: getSecret('anthropic-api-key') || undefined });
  return client;
}

const SYSTEM_PROMPT = `You are an expert historian and researcher. Generate a comprehensive, educational timeline for the given topic and time period.

Return ONLY a valid JSON object — no markdown, no code blocks, no preamble. Use this exact structure:

{
  "topic": "The topic name",
  "period": "Start period to End period",
  "description": "2-3 sentence overview of this topic and its historical significance",
  "events": [
    {
      "date": "Year or date (e.g., '470 BCE', '1687 CE', 'circa 1200', '1789')",
      "sortYear": -470,
      "title": "Event title (concise, 3-8 words)",
      "summary": "1-2 sentence overview of the event",
      "details": "3-5 paragraphs with rich historical context, causes, consequences, and connections to other events",
      "significance": "Why this event was historically significant — its lasting impact",
      "figures": ["Key Person 1", "Key Person 2"],
      "location": "Geographic location",
      "tags": ["thematic-tag-1", "thematic-tag-2"]
    }
  ]
}

Rules:
- Include 12-20 major events in chronological order (sorted by sortYear)
- sortYear must be a number: negative for BCE, positive for CE
- Details should be substantive, 3-5 paragraphs of educational content
- Tags should use kebab-case and be thematic (e.g., "philosophy", "political-change", "scientific-discovery")
- Always return ONLY the JSON object`;

app.post('/api/timeline', auth, async (req, res) => {
  const authReq = req as AuthRequest;
  const { topic, startYear, endYear } = req.body as { topic: string; startYear: string; endYear: string };

  if (!topic || !startYear || !endYear) {
    res.status(400).json({ error: 'Missing required fields: topic, startYear, endYear' });
    return;
  }

  // Rate limit check (skip in stub mode)
  if (!USE_STUB) {
    const { allowed, remaining } = await checkAndIncrementRateLimit(authReq.user!.id);
    if (!allowed) {
      res.status(429).json({ error: `Daily limit of ${DAILY_LIMIT} timelines reached. Resets at midnight UTC.` });
      return;
    }
    res.setHeader('X-RateLimit-Remaining', String(remaining));
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send({ type: 'status', message: `Researching "${topic}" from ${startYear} to ${endYear}…` });

  // Stub mode: return pre-built data instantly, no API call
  if (USE_STUB) {
    await new Promise(r => setTimeout(r, 400));
    send({ type: 'complete', timeline: STUB_TIMELINE });
    res.end();
    return;
  }

  // Cache check — return instantly if we've generated this timeline before
  const cached = await getCached(topic, startYear, endYear);
  if (cached) {
    console.log(`[cache] Hit for "${topic}"`);
    send({ type: 'status', message: 'Loading from cache…' });
    await new Promise(r => setTimeout(r, 300));
    send({ type: 'complete', timeline: cached });
    res.end();
    return;
  }

  console.log(`[timeline] Cache miss — generating for "${topic}" ${startYear}–${endYear}`);
  console.log(`[timeline] API key present: ${!!process.env.ANTHROPIC_API_KEY}`);

  // Abort controller for timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.log('[timeline] Timeout triggered after 90s');
    controller.abort();
  }, 90_000);

  try {
    console.log('[timeline] Starting Claude stream...');
    const stream = getAnthropicClient().messages.stream({
      model: 'claude-haiku-4-5',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Generate a detailed timeline for: "${topic}"\nTime period: ${startYear} to ${endYear}\n\nReturn only the JSON object.`
      }]
    }, { signal: controller.signal });

    let fullText = '';
    let statusPhase = 0;
    const statusMessages = [
      'Analyzing historical sources…',
      'Identifying key events and turning points…',
      'Researching figures and their contributions…',
      'Compiling chronological narrative…',
      'Finalizing timeline…',
    ];

    console.log('[timeline] Stream started, waiting for events...');
    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'thinking') {
          send({ type: 'status', message: 'Thinking through the historical context…' });
        } else if (event.content_block.type === 'text') {
          send({ type: 'status', message: statusMessages[statusPhase % statusMessages.length] });
          statusPhase++;
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullText += event.delta.text;
          // Send incremental status updates
          if (fullText.length % 1000 < 20 && statusPhase < statusMessages.length) {
            send({ type: 'status', message: statusMessages[statusPhase % statusMessages.length] });
            statusPhase++;
          }
        }
      }
    }

    // Strip markdown code fences if present (e.g. ```json ... ```)
    const stripped = fullText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    // Extract the JSON object
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[timeline] Raw response:', fullText.slice(0, 500));
      throw new Error('Could not find JSON in response. The model may not have followed formatting instructions.');
    }

    let jsonStr = jsonMatch[0];

    // If JSON appears truncated, try to close it gracefully
    let timeline;
    try {
      timeline = JSON.parse(jsonStr);
    } catch {
      // Attempt to salvage truncated JSON by closing open structures
      const openBraces = (jsonStr.match(/\{/g) ?? []).length - (jsonStr.match(/\}/g) ?? []).length;
      const openBrackets = (jsonStr.match(/\[/g) ?? []).length - (jsonStr.match(/\]/g) ?? []).length;
      jsonStr += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
      try {
        timeline = JSON.parse(jsonStr);
      } catch {
        console.error('[timeline] Could not parse even after repair. Raw:', fullText.slice(0, 500));
        throw new Error('Response was incomplete or malformed. Try a shorter time range.');
      }
    }

    // Ensure events are sorted by sortYear
    if (timeline.events && Array.isArray(timeline.events)) {
      timeline.events.sort((a: { sortYear?: number }, b: { sortYear?: number }) =>
        (a.sortYear ?? 0) - (b.sortYear ?? 0)
      );
    }

    // Store in cache for future requests
    await setCached(topic, startYear, endYear, timeline);

    send({ type: 'complete', timeline });
  } catch (error) {
    console.error('[timeline] Error:', error);
    let message = error instanceof Error ? error.message : 'An unknown error occurred';
    if (message.includes('abort') || message.includes('AbortError')) {
      message = 'Request timed out after 90 seconds. Try a narrower time range.';
    } else if (message.includes('credit') || message.includes('billing') || message.includes('402') || message.includes('payment')) {
      message = 'Anthropic API billing error — please add credits at console.anthropic.com.';
    }
    send({ type: 'error', message });
  } finally {
    clearTimeout(timeout);
  }

  res.end();
});

// SPA fallback
app.get('*', (_req, res) => {
  const indexPath = path.join(__dirname, '../../client/dist/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) res.status(404).send('Not found');
  });
});

// ── Startup: load secrets first, then configure auth, then listen ──────────
const PORT = process.env.PORT ?? 3001;

async function start() {
  console.log('[startup] Loading secrets...');
  try {
    await loadSecrets();
  } catch (err) {
    console.error('[startup] loadSecrets failed:', err);
    // Non-fatal — continue with env vars
  }
  console.log('[startup] Configuring passport...');
  configurePassport();
  initCache();         // Passport Google strategy (needs secrets ready)

  if (!getSecret('anthropic-api-key')) {
    console.warn('[warn] anthropic-api-key not set — timeline generation will fail');
  }
  if (!getSecret('google-client-id')) {
    console.warn('[warn] google-client-id not set — Google login will not work');
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Timeline server running at http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
