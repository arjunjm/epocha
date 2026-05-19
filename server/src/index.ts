import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { STUB_TIMELINE } from './stubData.js';
import { passport, requireAuth, optionalAuth, signToken, setAuthCookie, clearAuthCookie, configurePassport } from './auth.js';
import {
  checkAndIncrementRateLimit, findUser, DAILY_LIMIT,
  awardXP, checkAndAwardDailyLogin, unlockTheme, setActiveTheme,
  getSavedTimelines, saveTimeline, deleteSavedTimeline,
  getCustomTopics, saveCustomTopic, deleteCustomTopic,
} from './userStore.js';
import { loadSecrets, getSecret } from './secrets.js';
import { initCache, getCached, setCached, getCachedQuiz, setCachedQuiz } from './cache.js';
import { generateQuizQuestions, pickRandomQuestions } from './quiz.js';
import { THEMES, XP_REWARDS, type User, type TimelineData } from './types.js';
import type { AuthRequest } from './auth.js';

const auth = requireAuth as express.RequestHandler;
const optAuth = optionalAuth as express.RequestHandler;

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

app.get('/api/auth/me', auth, async (req, res) => {
  const authReq = req as AuthRequest;
  const user = await findUser(authReq.user!.id);
  if (!user) { res.status(401).json({ error: 'User not found' }); return; }

  // Award daily login XP silently
  void checkAndAwardDailyLogin(user.id);

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture,
    dailyCount: user.dailyCount,
    dailyLimit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - user.dailyCount),
    xp: user.xp ?? 0,
    level: user.level ?? 1,
    activeTheme: user.activeTheme ?? 'midnight',
    unlockedThemes: user.unlockedThemes ?? ['midnight'],
  });
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// ── Anthropic client ───────────────────────────────────────────────────────

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
  ],
  "relatedTopics": ["Related Topic 1", "Related Topic 2", "Related Topic 3", "Related Topic 4", "Related Topic 5"]
}

Rules:
- Include 12-20 major events in chronological order (sorted by sortYear)
- sortYear must be a number: negative for BCE, positive for CE
- Details should be substantive, 3-5 paragraphs of educational content
- Tags should use kebab-case and be thematic (e.g., "philosophy", "political-change", "scientific-discovery")
- relatedTopics: 4-5 topics closely related to this one that a learner might explore next
- Always return ONLY the JSON object`;

// ── Timeline routes ────────────────────────────────────────────────────────

// Public browse endpoint — serves cached timelines only, no auth required
app.get('/api/timeline/browse', async (req, res) => {
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
    res.json({ cached: true, timeline: cached });
  } else {
    res.status(404).json({ cached: false });
  }
});

// Authenticated generate endpoint — generates if not cached
app.post('/api/timeline', auth, async (req, res) => {
  const authReq = req as AuthRequest;
  const { topic, startYear, endYear } = req.body as { topic: string; startYear: string; endYear: string };

  if (!topic || !startYear || !endYear) {
    res.status(400).json({ error: 'Missing required fields: topic, startYear, endYear' });
    return;
  }

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

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  send({ type: 'status', message: `Researching "${topic}" from ${startYear} to ${endYear}…` });

  if (USE_STUB) {
    await new Promise(r => setTimeout(r, 400));
    send({ type: 'complete', timeline: STUB_TIMELINE });
    res.end();
    return;
  }

  const cached = await getCached(topic, startYear, endYear);
  if (cached) {
    send({ type: 'status', message: 'Loading from cache…' });
    await new Promise(r => setTimeout(r, 300));
    send({ type: 'complete', timeline: cached });
    // Award XP for viewing
    void awardXP(authReq.user!.id, XP_REWARDS.VIEW_TIMELINE);
    res.end();
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const stream = getAnthropicClient().messages.stream({
      model: 'claude-haiku-4-5',
      max_tokens: 8192,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `Generate a detailed timeline for: "${topic}"\nTime period: ${startYear} to ${endYear}\n\nReturn only the JSON object.` }],
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

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'thinking') {
          send({ type: 'status', message: 'Thinking through the historical context…' });
        } else if (event.content_block.type === 'text') {
          send({ type: 'status', message: statusMessages[statusPhase % statusMessages.length] });
          statusPhase++;
        }
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text;
        if (fullText.length % 1000 < 20 && statusPhase < statusMessages.length) {
          send({ type: 'status', message: statusMessages[statusPhase % statusMessages.length] });
          statusPhase++;
        }
      }
    }

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

    if (timeline.events && Array.isArray(timeline.events)) {
      timeline.events.sort((a: { sortYear?: number }, b: { sortYear?: number }) =>
        (a.sortYear ?? 0) - (b.sortYear ?? 0)
      );
    }

    await setCached(topic, startYear, endYear, timeline);
    send({ type: 'complete', timeline });

    // Award XP for generating a new timeline
    void awardXP(authReq.user!.id, XP_REWARDS.VIEW_TIMELINE);

    // Generate quiz questions in background (don't block response)
    void generateQuizAndCache(topic, startYear, endYear, timeline);

  } catch (error) {
    let message = error instanceof Error ? error.message : 'An unknown error occurred';
    if (message.includes('abort') || message.includes('AbortError')) {
      message = 'Request timed out after 90 seconds. Try a narrower time range.';
    } else if (message.includes('credit') || message.includes('billing') || message.includes('402') || message.includes('payment')) {
      message = 'Anthropic API billing error — please add credits at console.anthropic.com.';
    }
    send({ type: 'error', message });
  } finally {
    clearTimeout(timeout);
    res.end();
  }
});

async function generateQuizAndCache(topic: string, startYear: string, endYear: string, timeline: TimelineData) {
  const existing = await getCachedQuiz(topic, startYear, endYear);
  if (existing && existing.length >= 5) return;
  const questions = await generateQuizQuestions(getAnthropicClient(), timeline);
  if (questions.length > 0) {
    await setCachedQuiz(topic, startYear, endYear, questions);
    console.log(`[quiz] Cached ${questions.length} questions for "${topic}"`);
  }
}

// ── Quiz routes ────────────────────────────────────────────────────────────

app.get('/api/quiz', optAuth, async (req, res) => {
  const { topic, startYear, endYear } = req.query as { topic?: string; startYear?: string; endYear?: string };
  if (!topic || !startYear || !endYear) {
    res.status(400).json({ error: 'Missing required params' });
    return;
  }

  let questions = await getCachedQuiz(topic, startYear, endYear);

  if (!questions || questions.length < 5) {
    // Try to generate on-demand if timeline exists
    const timeline = await getCached(topic, startYear, endYear);
    if (!timeline) { res.status(404).json({ error: 'No timeline cached for this topic. View it first.' }); return; }
    questions = await generateQuizQuestions(getAnthropicClient(), timeline);
    if (questions.length > 0) await setCachedQuiz(topic, startYear, endYear, questions);
  }

  if (!questions || questions.length === 0) {
    res.status(404).json({ error: 'Could not generate quiz questions for this topic.' });
    return;
  }

  res.json({ questions: pickRandomQuestions(questions, 5) });
});

app.post('/api/quiz/complete', auth, async (req, res) => {
  const authReq = req as AuthRequest;
  const { score, total } = req.body as { score: number; total: number };
  // Award full XP if 3+ correct out of 5 (60%), else half
  const xpEarned = (score / total) >= 0.6 ? XP_REWARDS.COMPLETE_QUIZ : Math.floor(XP_REWARDS.COMPLETE_QUIZ / 2);
  const user = await awardXP(authReq.user!.id, xpEarned);
  res.json({ xpEarned, xp: user?.xp ?? 0, level: user?.level ?? 1 });
});

// ── User profile & gamification ────────────────────────────────────────────

app.get('/api/user/profile', auth, async (req, res) => {
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
});

app.post('/api/user/theme', auth, async (req, res) => {
  const authReq = req as AuthRequest;
  const { themeId } = req.body as { themeId: string };
  const user = await setActiveTheme(authReq.user!.id, themeId);
  if (!user) { res.status(400).json({ error: 'Theme not unlocked or user not found' }); return; }
  res.json({ ok: true, activeTheme: user.activeTheme });
});

// ── Marketplace ────────────────────────────────────────────────────────────

app.get('/api/marketplace/themes', optAuth, async (req, res) => {
  const authReq = req as AuthRequest;
  const unlockedThemes = authReq.user
    ? (await findUser(authReq.user.id))?.unlockedThemes ?? ['midnight']
    : ['midnight'];

  res.json(THEMES.map(t => ({ ...t, unlocked: unlockedThemes.includes(t.id) })));
});

app.post('/api/marketplace/unlock/:themeId', auth, async (req, res) => {
  const authReq = req as AuthRequest;
  const themeId = req.params.themeId as string;
  const valid = THEMES.some(t => t.id === themeId);
  if (!valid) { res.status(400).json({ error: 'Unknown theme' }); return; }
  const user = await unlockTheme(authReq.user!.id, themeId);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ ok: true, unlockedThemes: user.unlockedThemes });
});

// ── Saved timelines ────────────────────────────────────────────────────────

app.get('/api/saved', auth, async (req, res) => {
  const authReq = req as AuthRequest;
  const saved = await getSavedTimelines(authReq.user!.id);
  res.json(saved);
});

app.post('/api/saved', auth, async (req, res) => {
  const authReq = req as AuthRequest;
  const { topic, startYear, endYear, title, description, collectionName } = req.body as {
    topic: string; startYear: string; endYear: string;
    title: string; description: string; collectionName?: string;
  };
  if (!topic || !startYear || !endYear || !title) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  const item = await saveTimeline(authReq.user!.id, {
    topic, startYear, endYear, title, description,
    collectionName: collectionName ?? 'General',
  });
  void awardXP(authReq.user!.id, XP_REWARDS.SAVE_TIMELINE);
  res.status(201).json(item);
});

app.delete('/api/saved/:id', auth, async (req, res) => {
  const authReq = req as AuthRequest;
  const ok = await deleteSavedTimeline(authReq.user!.id, req.params.id as string);
  if (!ok) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ok: true });
});

// ── Custom topics ──────────────────────────────────────────────────────────

app.get('/api/topics/custom', auth, async (req, res) => {
  const authReq = req as AuthRequest;
  res.json(await getCustomTopics(authReq.user!.id));
});

app.post('/api/topics/custom', auth, async (req, res) => {
  const authReq = req as AuthRequest;
  const { name, icon, items } = req.body as { name: string; icon?: string; items: Array<{ label: string; topic: string; start: string; end: string }> };
  if (!name || !items?.length) { res.status(400).json({ error: 'name and items are required' }); return; }
  const topic = await saveCustomTopic(authReq.user!.id, { name, icon: icon ?? '📌', items });
  res.status(201).json(topic);
});

app.delete('/api/topics/custom/:id', auth, async (req, res) => {
  const authReq = req as AuthRequest;
  const ok = await deleteCustomTopic(authReq.user!.id, req.params.id as string);
  if (!ok) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ok: true });
});

// ── SPA fallback ───────────────────────────────────────────────────────────

app.get('*', (_req, res) => {
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => { if (err) res.status(404).send('Not found'); });
});

// ── Startup ────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 3001;

async function start() {
  console.log('[startup] Loading secrets...');
  try { await loadSecrets(); } catch (err) { console.error('[startup] loadSecrets failed:', err); }
  configurePassport();
  initCache();

  if (!getSecret('anthropic-api-key')) console.warn('[warn] anthropic-api-key not set');
  if (!getSecret('google-client-id')) console.warn('[warn] google-client-id not set');

  app.listen(Number(PORT), '0.0.0.0', () => console.log(`Timeline server running at http://localhost:${PORT}`));
}

start().catch(err => { console.error('Failed to start server:', err); process.exit(1); });
