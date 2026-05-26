import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { streamGenerate, getProvider } from './llm.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { STUB_TIMELINE } from './stubData.js';
import { passport, requireAuth, optionalAuth, signToken, setAuthCookie, clearAuthCookie, configurePassport } from './auth.js';
import {
  checkAndIncrementRateLimit, findUser, DAILY_LIMIT, ADMIN_EMAILS,
  awardXP, checkAndAwardDailyLogin, unlockTheme, setActiveTheme,
  getSavedTimelines, saveTimeline, deleteSavedTimeline,
  getCustomTopics, saveCustomTopic, deleteCustomTopic,
  saveQuizResult, getQuizResults,
} from './userStore.js';
import { loadSecrets, getSecret } from './secrets.js';
import { initCache, getCached, setCached, getCachedQuiz, setCachedQuiz, trackSearch, getTrendingTopics, getAdminLog, isAdminRunning, clearAdminLog, getCacheContents, deleteCacheEntry, getAdminProgress, logSearchEvent, getAnalyticsSummary, getSemanticallyCached, storeTopicEmbedding } from './cache.js';
import { generateQuizQuestions, pickRandomQuestions } from './quiz.js';
import { THEMES, XP_REWARDS, type User, type TimelineData } from './types.js';
import type { AuthRequest } from './auth.js';
import { enqueueRelatedTopics } from './queue.js';

const auth = requireAuth as express.RequestHandler;
const optAuth = optionalAuth as express.RequestHandler;

// Forward async route handler errors to Express error middleware (Express 4 doesn't do this automatically)
const ah = (fn: express.RequestHandler): express.RequestHandler =>
  (req, res, next) => { Promise.resolve(fn(req, res, next)).catch(next); };

const USE_STUB = process.env.USE_STUB === 'true';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const _clientCandidates: string[] = [
  path.join(__dirname, '../client/dist'),
  path.join(__dirname, '../../client/dist'),
];
const clientDistPath: string = _clientCandidates.find((p: string) => fs.existsSync(p)) ?? _clientCandidates[0]!;

const app = express();

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());
app.use(express.static(clientDistPath));

// ── Health check ──────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ── Auth routes ────────────────────────────────────────────────────────────

app.get('/api/auth/google', passport.authenticate('google', { session: false }));

app.get('/api/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/?auth=failed' }),
  (req, res) => {
    const user = req.user as User;
    const token = signToken(user);
    setAuthCookie(res, token);
    res.redirect('/');
  }
);

app.get('/api/auth/me', auth, ah(async (req, res) => {
  const authReq = req as AuthRequest;
  const user = await findUser(authReq.user!.id);
  if (!user) { res.status(401).json({ error: 'User not found' }); return; }

  // Award daily login XP silently
  void checkAndAwardDailyLogin(user.id);

  const isAdmin = ADMIN_EMAILS.has(user.email);
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture,
    isAdmin,
    dailyCount: user.dailyCount,
    dailyLimit: isAdmin ? null : DAILY_LIMIT,
    remaining: isAdmin ? null : Math.max(0, DAILY_LIMIT - user.dailyCount),
    xp: user.xp ?? 0,
    level: user.level ?? 1,
    activeTheme: user.activeTheme ?? 'midnight',
    unlockedThemes: user.unlockedThemes ?? ['midnight'],
  });
}));

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

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
      "tags": ["thematic-tag-1", "thematic-tag-2"],
      "source": "https://en.wikipedia.org/wiki/Event_Title"
    }
  ],
  "relatedTopics": ["Related Topic 1", "Related Topic 2", "Related Topic 3", "Related Topic 4", "Related Topic 5"]
}

Rules:
- Include exactly 12 major events in chronological order (sorted by sortYear)
- sortYear must be a number: negative for BCE, positive for CE
- Details should be 2-3 focused paragraphs of educational content
- Tags should use kebab-case and be thematic (e.g., "philosophy", "political-change", "scientific-discovery")
- relatedTopics: 4-5 topics closely related to this one that a learner might explore next
- source: a real Wikipedia URL for the event's primary subject (use the most specific article, e.g. https://en.wikipedia.org/wiki/Battle_of_Marathon not a general history article)
- Always return ONLY the JSON object`;

// ── Timeline routes ────────────────────────────────────────────────────────

// Public trending topics — topics pre-generated beyond the default sidebar list
app.get('/api/timeline/trending', ah(async (_req, res) => {
  const topics = await getTrendingTopics(15);
  res.json(topics);
}));

// Public browse endpoint — serves cached timelines only, no auth required
app.get('/api/timeline/browse', ah(async (req, res) => {
  const { topic, startYear, endYear } = req.query as { topic?: string; startYear?: string; endYear?: string };
  if (!topic || !startYear || !endYear) {
    res.status(400).json({ error: 'Missing required params: topic, startYear, endYear' });
    return;
  }
  if (USE_STUB) {
    res.json({ cached: true, timeline: STUB_TIMELINE });
    return;
  }
  const cached = await getCached(topic, startYear, endYear);
  if (cached) {
    // Await alias before responding — quiz request may arrive immediately after browse
    // and needs the alias to exist for cache lookups using the AI's topic name.
    if (cached.topic && cached.topic.trim().toLowerCase() !== topic.trim().toLowerCase()) {
      await setCached(cached.topic, startYear, endYear, cached);
    }
    res.json({ cached: true, timeline: cached });
    void logSearchEvent({ topic, cacheHit: true, publicBrowse: true, ts: Date.now() });
    // Backfill embedding if not yet stored (covers Function-pre-generated topics)
    void storeTopicEmbedding(`timeline:${topic.toLowerCase().trim().replace(/\s+/g, '-')}:${startYear}:${endYear}`, topic);
    void enqueueRelatedTopics(cached, startYear, endYear);
  } else {
    // Exact miss — try semantic match before returning 404
    const semantic = await getSemanticallyCached(topic);
    if (semantic) {
      res.json({ cached: true, timeline: semantic, semanticMatch: true });
      void logSearchEvent({ topic, cacheHit: true, publicBrowse: true, ts: Date.now() });
    } else {
      res.status(404).json({ cached: false });
    }
  }
}));

// Authenticated generate endpoint — generates if not cached
app.post('/api/timeline', optAuth, ah(async (req, res) => {
  const authReq = req as AuthRequest;
  const { topic, startYear: rawStart, endYear: rawEnd, publicBrowse, skipCache, liteMode } =
    req.body as { topic: string; startYear?: string; endYear?: string; publicBrowse?: boolean; skipCache?: boolean; liteMode?: boolean };
  const startYear = rawStart?.trim() ?? '';
  const endYear = rawEnd?.trim() ?? '';

  if (!topic) {
    res.status(400).json({ error: 'Missing required field: topic' });
    return;
  }

  // Custom searches require authentication; public browse (sidebar/trending) does not
  if (!publicBrowse && !authReq.user) {
    res.status(401).json({ error: 'Sign in to generate custom timelines' });
    return;
  }

  const isAdmin = ADMIN_EMAILS.has(authReq.user?.email ?? '');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const periodLabel = startYear && endYear ? ` from ${startYear} to ${endYear}` : '';
  send({ type: 'status', message: `Researching "${topic}"${periodLabel}…` });

  if (USE_STUB) {
    await new Promise(r => setTimeout(r, 400));
    send({ type: 'complete', timeline: STUB_TIMELINE });
    res.end();
    return;
  }

  // Serve from cache (unless admin skip or lite mode — lite results are not cached)
  if (!liteMode && (!skipCache || !isAdmin)) {
    const cached = await getCached(topic, startYear, endYear);
    if (cached) {
      send({ type: 'status', message: 'Loading from cache…' });
      await new Promise(r => setTimeout(r, 300));
      // Resolve cache years: for old entries stored with empty years, extract from the
      // AI's period so the client uses the same key the quiz endpoint will look up.
      let hitCacheStart = startYear;
      let hitCacheEnd = endYear;
      if ((!startYear || !endYear) && cached.period) {
        const yearMatch = cached.period.match(/(\d{4})/g);
        if (yearMatch && yearMatch.length >= 1) {
          if (!startYear) hitCacheStart = yearMatch[0]!;
          if (!endYear) hitCacheEnd = yearMatch[yearMatch.length - 1]!;
        }
      }
      // Migrate old empty-year entry to extracted-year key so quiz can find it
      if (hitCacheStart !== startYear || hitCacheEnd !== endYear) {
        void setCached(topic, hitCacheStart, hitCacheEnd, cached);
        if (cached.topic && cached.topic.trim().toLowerCase() !== topic.trim().toLowerCase()) {
          void setCached(cached.topic, hitCacheStart, hitCacheEnd, cached);
        }
      }
      send({ type: 'complete', timeline: cached, cacheStartYear: hitCacheStart, cacheEndYear: hitCacheEnd });
      if (authReq.user) void awardXP(authReq.user.id, XP_REWARDS.VIEW_TIMELINE);
      void logSearchEvent({ topic, userId: authReq.user?.id, cacheHit: true, publicBrowse: !!publicBrowse, ts: Date.now() });
      void enqueueRelatedTopics(cached, hitCacheStart, hitCacheEnd);
      res.end();
      return;
    }
  }

  // Rate limit only applies to authenticated custom searches (not public browse)
  if (!USE_STUB && authReq.user && !publicBrowse) {
    const { allowed, remaining } = await checkAndIncrementRateLimit(authReq.user.id);
    if (!allowed) {
      send({ type: 'error', message: `Daily limit of ${DAILY_LIMIT} timelines reached. Resets at midnight UTC.` });
      res.end();
      return;
    }
    // X-RateLimit-Remaining cannot be set here — flushHeaders() already sent
    // headers to the client. The client reads remaining via /api/auth/me instead.
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  // Keepalive: write an SSE comment every 15s so Azure's load balancer doesn't
  // silently close the idle connection before our 90s timeout fires.
  const keepalive = setInterval(() => { res.write(': keepalive\n\n'); }, 15_000);

  try {
    const liteSuffix = liteMode
      ? '\n\nLITE MODE: Omit the "details" field for every event — do not include it in the JSON at all. Include only: date, sortYear, title, summary, significance, figures, location, tags.'
      : '';
    const userMessage = startYear && endYear
      ? `Generate a detailed timeline for: "${topic}"\nTime period: ${startYear} to ${endYear}\n\nReturn only the JSON object.${liteSuffix}`
      : `Generate a detailed timeline for: "${topic}"\nChoose the most historically significant and complete time period for this topic. Return only the JSON object.${liteSuffix}`;

    const fullText = await streamGenerate(
      SYSTEM_PROMPT,
      userMessage,
      {
        onStatus: (msg) => send({ type: 'status', message: msg }),
        onMeta: (t, period, description) => send({ type: 'meta', topic: t, period, description }),
        onEvent: (event) => send({ type: 'event', event }),
      },
      controller.signal
    );

    const stripped = fullText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not find JSON in response.');

    let jsonStr = jsonMatch[0];
    let timeline: TimelineData;
    try {
      timeline = JSON.parse(jsonStr) as TimelineData;
    } catch {
      const openBraces = (jsonStr.match(/\{/g) ?? []).length - (jsonStr.match(/\}/g) ?? []).length;
      const openBrackets = (jsonStr.match(/\[/g) ?? []).length - (jsonStr.match(/\]/g) ?? []).length;
      jsonStr += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
      timeline = JSON.parse(jsonStr) as TimelineData;
    }

    if (!Array.isArray(timeline.events) || timeline.events.length === 0) {
      throw new Error('No events were generated. Please try again.');
    }

    timeline.events.sort((a: { sortYear?: number }, b: { sortYear?: number }) =>
      (a.sortYear ?? 0) - (b.sortYear ?? 0)
    );

    const isIncomplete = timeline.events.length < 5;

    // Derive the actual years used for caching: prefer user-specified, fall back to
    // 4-digit years extracted from the AI's period string. This ensures the cache key
    // matches what the quiz endpoint will look up (which reads these back from the client).
    let cacheStart = startYear;
    let cacheEnd = endYear;
    if ((!startYear || !endYear) && timeline.period) {
      const yearMatch = timeline.period.match(/(\d{4})/g);
      if (yearMatch && yearMatch.length >= 1) {
        if (!startYear) cacheStart = yearMatch[0]!;
        if (!endYear) cacheEnd = yearMatch[yearMatch.length - 1]!;
      }
    }

    if (!isIncomplete) {
      await setCached(topic, cacheStart, cacheEnd, timeline);
      // The AI sometimes changes the topic name (e.g. adds "The " prefix). Cache under
      // both so the quiz — which uses data.topic from the rendered timeline — can find it.
      if (timeline.topic && timeline.topic.trim().toLowerCase() !== topic.trim().toLowerCase()) {
        await setCached(timeline.topic, cacheStart, cacheEnd, timeline);
      }
      if (authReq.user && !publicBrowse) void trackSearch(topic, cacheStart, cacheEnd);
    }

    // Include the resolved cache years in the complete event so the client can use them
    // verbatim for quiz lookups, instead of re-parsing the period string.
    send({ type: 'complete', timeline, cacheStartYear: cacheStart, cacheEndYear: cacheEnd, ...(isIncomplete && { warning: `Only ${timeline.events.length} events were generated — the response may be incomplete. Try regenerating for a fuller timeline.` }) });

    if (authReq.user) void awardXP(authReq.user.id, XP_REWARDS.VIEW_TIMELINE);
    void logSearchEvent({ topic, userId: authReq.user?.id, cacheHit: false, publicBrowse: !!publicBrowse, ts: Date.now() });

    // Generate quiz questions in background (don't block response)
    void generateQuizAndCache(topic, cacheStart, cacheEnd, timeline);
    if (timeline.topic && timeline.topic.trim().toLowerCase() !== topic.trim().toLowerCase()) {
      void generateQuizAndCache(timeline.topic, cacheStart, cacheEnd, timeline);
    }

    // Pre-warm related topics + next era (full mode only — lite results are transient)
    if (!isIncomplete && !liteMode) void enqueueRelatedTopics(timeline, cacheStart, cacheEnd);

  } catch (error) {
    let message = error instanceof Error ? error.message : 'An unknown error occurred';
    if (
      message.toLowerCase().includes('abort') ||
      message.includes('AbortError') ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      message = 'Request timed out after 90 seconds. Try a narrower time range.';
    } else if (message.includes('credit') || message.includes('billing') || message.includes('402') || message.includes('payment')) {
      message = getProvider() === 'azure-openai'
        ? 'Azure OpenAI quota exceeded — check your deployment limits in the Azure portal.'
        : 'Anthropic API billing error — please add credits at console.anthropic.com.';
    }
    send({ type: 'error', message });
  } finally {
    clearTimeout(timeout);
    clearInterval(keepalive);
    res.end();
  }
}));

async function generateQuizAndCache(topic: string, startYear: string, endYear: string, timeline: TimelineData) {
  const existing = await getCachedQuiz(topic, startYear, endYear);
  if (existing && existing.length >= 5) return;
  const questions = await generateQuizQuestions(timeline);
  if (questions.length > 0) {
    await setCachedQuiz(topic, startYear, endYear, questions);
    console.log(`[quiz] Cached ${questions.length} questions for "${topic}"`);
  }
}

// ── Quiz routes ────────────────────────────────────────────────────────────

app.get('/api/quiz', optAuth, ah(async (req, res) => {
  const { topic, startYear, endYear } = req.query as { topic?: string; startYear?: string; endYear?: string };
  if (!topic || !startYear || !endYear) {
    res.status(400).json({ error: 'Missing required params' });
    return;
  }

  console.log(`[quiz] lookup: "${topic}" [${startYear} → ${endYear}]`);
  let questions = await getCachedQuiz(topic, startYear, endYear);

  if (!questions || questions.length < 5) {
    // Try to generate on-demand if timeline exists in cache
    const timeline = await getCached(topic, startYear, endYear);
    if (!timeline) {
      console.warn(`[quiz] cache miss — no timeline found for "${topic}" [${startYear} → ${endYear}]`);
      res.status(404).json({ error: 'No timeline cached for this topic. View it first.' });
      return;
    }
    questions = await generateQuizQuestions(timeline);
    if (questions.length > 0) await setCachedQuiz(topic, startYear, endYear, questions);
  }

  if (!questions || questions.length === 0) {
    res.status(404).json({ error: 'Could not generate quiz questions for this topic.' });
    return;
  }

  res.json({ questions: pickRandomQuestions(questions, 5) });
}));

app.post('/api/quiz/complete', auth, ah(async (req, res) => {
  const authReq = req as AuthRequest;
  const { score, total, topic = '', startYear = '', endYear = '' } =
    req.body as { score: number; total: number; topic?: string; startYear?: string; endYear?: string };
  const xpEarned = (score / total) >= 0.6 ? XP_REWARDS.COMPLETE_QUIZ : Math.floor(XP_REWARDS.COMPLETE_QUIZ / 2);
  const [user] = await Promise.all([
    awardXP(authReq.user!.id, xpEarned),
    saveQuizResult(authReq.user!.id, { topic, startYear, endYear, score, total, xpEarned }),
  ]);
  res.json({ xpEarned, xp: user?.xp ?? 0, level: user?.level ?? 1 });
}));

// ── User profile & gamification ────────────────────────────────────────────

app.get('/api/user/profile', auth, ah(async (req, res) => {
  const authReq = req as AuthRequest;
  const user = await findUser(authReq.user!.id);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture,
    xp: user.xp ?? 0,
    level: user.level ?? 1,
    activeTheme: user.activeTheme ?? 'midnight',
    unlockedThemes: user.unlockedThemes ?? ['midnight'],
  });
}));

app.post('/api/user/theme', auth, ah(async (req, res) => {
  const authReq = req as AuthRequest;
  const { themeId } = req.body as { themeId: string };
  const user = await setActiveTheme(authReq.user!.id, themeId);
  if (!user) { res.status(400).json({ error: 'Theme not unlocked or user not found' }); return; }
  res.json({ ok: true, activeTheme: user.activeTheme });
}));

// ── Marketplace ────────────────────────────────────────────────────────────

app.get('/api/marketplace/themes', optAuth, ah(async (req, res) => {
  const authReq = req as AuthRequest;
  const unlockedThemes = authReq.user
    ? (await findUser(authReq.user.id))?.unlockedThemes ?? ['midnight']
    : ['midnight'];

  res.json(THEMES.map(t => ({ ...t, unlocked: unlockedThemes.includes(t.id) })));
}));

app.post('/api/marketplace/unlock/:themeId', auth, ah(async (req, res) => {
  const authReq = req as AuthRequest;
  const themeId = req.params.themeId as string;
  const valid = THEMES.some(t => t.id === themeId);
  if (!valid) { res.status(400).json({ error: 'Unknown theme' }); return; }
  const user = await unlockTheme(authReq.user!.id, themeId);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ ok: true, unlockedThemes: user.unlockedThemes });
}));

// ── User stats ────────────────────────────────────────────────────────────

app.get('/api/stats', auth, ah(async (req, res) => {
  const authReq = req as AuthRequest;
  const [quizResults, saved] = await Promise.all([
    getQuizResults(authReq.user!.id),
    getSavedTimelines(authReq.user!.id),
  ]);
  res.json({ quizResults, savedCount: saved.length });
}));

// ── Saved timelines ────────────────────────────────────────────────────────

app.get('/api/saved', auth, ah(async (req, res) => {
  const authReq = req as AuthRequest;
  const saved = await getSavedTimelines(authReq.user!.id);
  res.json(saved);
}));

app.post('/api/saved', auth, ah(async (req, res) => {
  const authReq = req as AuthRequest;
  const { topic, startYear, endYear, title, description, collectionName } = req.body as {
    topic: string; startYear: string; endYear: string;
    title: string; description: string; collectionName?: string;
  };
  if (!topic || !title) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  const item = await saveTimeline(authReq.user!.id, {
    topic, startYear, endYear, title, description,
    collectionName: collectionName ?? 'General',
  });
  void awardXP(authReq.user!.id, XP_REWARDS.SAVE_TIMELINE);
  res.status(201).json(item);
}));

app.delete('/api/saved/:id', auth, ah(async (req, res) => {
  const authReq = req as AuthRequest;
  const ok = await deleteSavedTimeline(authReq.user!.id, req.params.id as string);
  if (!ok) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ok: true });
}));

// ── Custom topics ──────────────────────────────────────────────────────────

app.get('/api/topics/custom', auth, ah(async (req, res) => {
  const authReq = req as AuthRequest;
  res.json(await getCustomTopics(authReq.user!.id));
}));

app.post('/api/topics/custom', auth, ah(async (req, res) => {
  const authReq = req as AuthRequest;
  const { name, icon, items } = req.body as { name: string; icon?: string; items: Array<{ label: string; topic: string; start: string; end: string }> };
  if (!name || !items?.length) { res.status(400).json({ error: 'name and items are required' }); return; }
  const topic = await saveCustomTopic(authReq.user!.id, { name, icon: icon ?? '📌', items });
  res.status(201).json(topic);
}));

app.delete('/api/topics/custom/:id', auth, ah(async (req, res) => {
  const authReq = req as AuthRequest;
  const ok = await deleteCustomTopic(authReq.user!.id, req.params.id as string);
  if (!ok) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ok: true });
}));

// ── Admin routes (admin users only) ──────────────────────────────────────

const adminAuth: express.RequestHandler = (req, res, next) => {
  const authReq = req as AuthRequest;
  if (!authReq.user || !ADMIN_EMAILS.has(authReq.user.email ?? '')) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};

const FUNC_BASE_URL = `https://${process.env.AZURE_FUNC_NAME ?? 'func-timelineapp-dev'}.azurewebsites.net/api`;

// Job log + running status + queue progress
app.get('/api/admin/status', auth, adminAuth, ah(async (_req, res) => {
  const [running, logs, progress] = await Promise.all([
    isAdminRunning(),
    getAdminLog(300),
    getAdminProgress(),
  ]);
  res.json({ running, logs, progress });
}));

app.delete('/api/admin/logs', auth, adminAuth, ah(async (_req, res) => {
  await clearAdminLog();
  res.json({ ok: true });
}));

// Trigger Azure Functions (fire-and-forget, returns 202 from function)
app.post('/api/admin/trigger/trending', auth, adminAuth, ah(async (req, res) => {
  const { forceRegenerate = false, newsSource = 'llm' } = req.body as { forceRegenerate?: boolean; newsSource?: string };
  const response = await fetch(`${FUNC_BASE_URL}/generateTrendingEvents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forceRegenerate, newsSource }),
  });
  const body = await response.json() as Record<string, unknown>;
  res.status(response.status).json(body);
}));

app.post('/api/admin/trigger/pregenerate', auth, adminAuth, ah(async (req, res) => {
  const { forceRegenerate = false } = req.body as { forceRegenerate?: boolean };
  const response = await fetch(`${FUNC_BASE_URL}/pregenerateManual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forceRegenerate }),
  });
  const body = await response.json() as Record<string, unknown>;
  res.status(response.status).json(body);
}));

// Search analytics
app.get('/api/admin/analytics', auth, adminAuth, ah(async (_req, res) => {
  const summary = await getAnalyticsSummary();
  res.json(summary);
}));

// Cache contents
app.get('/api/admin/cache', auth, adminAuth, ah(async (_req, res) => {
  const entries = await getCacheContents();
  res.json(entries);
}));

app.delete('/api/admin/cache/:key', auth, adminAuth, ah(async (req, res) => {
  const key = decodeURIComponent(req.params.key as string);
  await deleteCacheEntry(key);
  res.json({ ok: true });
}));

// ── SPA fallback — with dynamic OG meta tags for shared timeline URLs ─────

let indexHtmlTemplate: string | null = null;

function getIndexHtml(): string {
  if (!indexHtmlTemplate) {
    const indexPath = path.join(clientDistPath, 'index.html');
    try { indexHtmlTemplate = fs.readFileSync(indexPath, 'utf-8'); } catch { return ''; }
  }
  return indexHtmlTemplate;
}

function injectOgMeta(html: string, title: string, description: string): string {
  const escaped = (s: string) => s.replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const tags = [
    `<meta property="og:title" content="${escaped(title)}">`,
    `<meta property="og:description" content="${escaped(description)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="Epocha">`,
    `<meta name="description" content="${escaped(description)}">`,
    `<title>${escaped(title)}</title>`,
  ].join('\n    ');

  // Replace the default <title> tag and inject OG tags before </head>
  return html
    .replace(/<title>[^<]*<\/title>/, '')
    .replace('</head>', `    ${tags}\n  </head>`);
}

app.get('*', ah(async (req, res) => {
  const indexPath = path.join(clientDistPath, 'index.html');
  const html = getIndexHtml();

  // If URL has timeline params, try to inject OG meta from cache
  const topic = req.query.topic as string | undefined;
  const start = req.query.start as string | undefined;
  const end = req.query.end as string | undefined;

  if (html && topic && start && end) {
    const cached = await getCached(topic, start, end);
    if (cached) {
      const title = `${cached.topic} · ${start} – ${end} | Epocha`;
      const description = cached.description.slice(0, 200);
      res.setHeader('Content-Type', 'text/html');
      res.send(injectOgMeta(html, title, description));
      return;
    }
  }

  res.sendFile(indexPath, (err) => { if (err) res.status(404).send('Not found'); });
}));

// ── Global error handler ──────────────────────────────────────────────────
// Catches errors forwarded via next(err) — including passport done(err) on Cosmos DB failures

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[error]', message, err instanceof Error ? err.stack : '');
  if (!res.headersSent) {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Startup ────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 3001;

async function start() {
  console.log('[startup] Loading secrets...');
  try { await loadSecrets(); } catch (err) { console.error('[startup] loadSecrets failed:', err); }
  configurePassport();
  initCache();

  const provider = getProvider();
  console.log(`[llm] Active provider: ${provider}`);
  if (provider === 'azure-openai') {
    if (!getSecret('azure-openai-endpoint')) console.warn('[warn] azure-openai-endpoint not set');
    if (!getSecret('azure-openai-key')) console.warn('[warn] azure-openai-key not set');
  } else {
    if (!getSecret('anthropic-api-key')) console.warn('[warn] anthropic-api-key not set');
  }
  if (!getSecret('google-client-id')) console.warn('[warn] google-client-id not set');

  app.listen(Number(PORT), '0.0.0.0', () => console.log(`Timeline server running at http://localhost:${PORT}`));
}

start().catch(err => { console.error('Failed to start server:', err); process.exit(1); });
