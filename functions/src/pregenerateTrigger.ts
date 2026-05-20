import { app, type InvocationContext } from '@azure/functions';
import Anthropic from '@anthropic-ai/sdk';
import { AzureOpenAI } from 'openai';
import Redis from 'ioredis';
import { loadSecrets, getSecret } from './secrets.js';
import { ALL_TOPICS, type TopicJob } from './topics.js';

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
  "relatedTopics": ["Related Topic 1", "Related Topic 2", "Related Topic 3"]
}

Rules:
- Include 12-20 major events in chronological order (sorted by sortYear)
- sortYear must be a number: negative for BCE, positive for CE
- Details should be substantive, 3-5 paragraphs of educational content
- Tags should use kebab-case and be thematic
- Always return ONLY the JSON object`;

const QUIZ_PROMPT = `You are creating a multiple-choice quiz about a historical timeline.
Generate exactly 12 multiple-choice questions. Return ONLY a valid JSON array:
[{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}]`;

const AI_SUGGEST_PROMPT = `You are curating topics for an educational historical timeline app.

Suggest 15 topics that would make for compelling, educational timelines. Mix:
- Major world events and wars not covered by basic history curricula
- Rise and fall of civilisations or empires
- Scientific or technological revolutions
- Social and political movements
- Contemporary history (last 50 years) that already has historical perspective
- Underrepresented regions or cultures

Return ONLY a JSON array of topic name strings, e.g.:
["The Mongol Empire", "The Cold War Space Race", "The Green Revolution"]

No years, no descriptions — just topic names. 15 topics.`;

const TTL = 60 * 60 * 24 * 7;
const POPULAR_KEY = 'epocha:popular-topics';
const MAX_JOBS = 80;

function cacheKey(topic: string, startYear: string, endYear: string): string {
  return `timeline:${topic.toLowerCase().trim().replace(/\s+/g, '-')}:${startYear}:${endYear}`;
}

function getProvider(): 'anthropic' | 'azure-openai' {
  return (getSecret('llm-provider') || 'anthropic').toLowerCase() === 'azure-openai'
    ? 'azure-openai' : 'anthropic';
}

// ── Clients ────────────────────────────────────────────────────────────────

let anthropic: Anthropic | null = null;
let azure: AzureOpenAI | null = null;

function getAnthropicClient() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: getSecret('anthropic-api-key') });
  return anthropic;
}

function getAzureClient() {
  if (!azure) azure = new AzureOpenAI({
    endpoint: getSecret('azure-openai-endpoint'),
    apiKey: getSecret('azure-openai-key'),
    apiVersion: '2024-10-21',
    deployment: getSecret('azure-openai-deployment') || 'gpt-4o',
  });
  return azure;
}

// ── Generation ─────────────────────────────────────────────────────────────

async function generateTimeline(job: TopicJob): Promise<string | null> {
  const userMessage = job.startYear && job.endYear
    ? `Generate a detailed timeline for: "${job.topic}"\nTime period: ${job.startYear} to ${job.endYear}\n\nReturn only the JSON object.`
    : `Generate a detailed timeline for: "${job.topic}"\nChoose the most historically significant and complete time period. Return only the JSON object.`;

  let fullText = '';

  if (getProvider() === 'azure-openai') {
    const stream = await getAzureClient().chat.completions.create({
      model: getSecret('azure-openai-deployment') || 'gpt-4o',
      max_tokens: 8192,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMessage }],
      stream: true,
    });
    for await (const chunk of stream) fullText += chunk.choices[0]?.delta?.content ?? '';
  } else {
    const stream = getAnthropicClient().messages.stream({
      model: 'claude-haiku-4-5', max_tokens: 8192,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta')
        fullText += event.delta.text;
    }
  }

  const stripped = fullText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const t = JSON.parse(match[0]);
    if (!Array.isArray(t.events) || t.events.length < 5) return null;
    t.events.sort((a: { sortYear?: number }, b: { sortYear?: number }) => (a.sortYear ?? 0) - (b.sortYear ?? 0));
    return JSON.stringify(t);
  } catch { return null; }
}

async function generateQuiz(timelineJson: string): Promise<string | null> {
  const t = JSON.parse(timelineJson);
  const summary = { topic: t.topic, period: t.period, events: t.events?.map((e: { date: string; title: string; summary: string; figures?: string[]; location?: string }) => ({ date: e.date, title: e.title, summary: e.summary, figures: e.figures, location: e.location })) };
  const userMessage = `Generate 12 quiz questions for:\n${JSON.stringify(summary)}`;
  let text = '';

  if (getProvider() === 'azure-openai') {
    const res = await getAzureClient().chat.completions.create({
      model: getSecret('azure-openai-deployment') || 'gpt-4o', max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: QUIZ_PROMPT }, { role: 'user', content: userMessage }],
    });
    text = res.choices[0]?.message?.content ?? '';
  } else {
    const res = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-5', max_tokens: 4096,
      system: [{ type: 'text', text: QUIZ_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });
    text = res.content[0]?.type === 'text' ? res.content[0].text : '';
  }

  const match = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const q = JSON.parse(match[0]);
    return Array.isArray(q) && q.length > 0 ? JSON.stringify(q) : null;
  } catch { return null; }
}

// ── AI topic suggestions ───────────────────────────────────────────────────

async function fetchAISuggestedTopics(log: (m: string) => void): Promise<TopicJob[]> {
  try {
    let text = '';
    if (getProvider() === 'azure-openai') {
      const res = await getAzureClient().chat.completions.create({
        model: getSecret('azure-openai-deployment') || 'gpt-4o', max_tokens: 512,
        messages: [{ role: 'user', content: AI_SUGGEST_PROMPT }],
      });
      text = res.choices[0]?.message?.content ?? '';
    } else {
      const res = await getAnthropicClient().messages.create({
        model: 'claude-haiku-4-5', max_tokens: 512,
        messages: [{ role: 'user', content: AI_SUGGEST_PROMPT }],
      });
      text = res.content[0]?.type === 'text' ? res.content[0].text : '';
    }
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const topics = JSON.parse(match[0]) as string[];
    log(`[ai-suggest] Got ${topics.length} AI-suggested topics`);
    return topics.filter(t => typeof t === 'string' && t.trim()).map(t => ({ topic: t.trim(), startYear: '', endYear: '' }));
  } catch (err) {
    log(`[ai-suggest] Failed: ${err}`);
    return [];
  }
}

// ── Queue builder ──────────────────────────────────────────────────────────

async function buildJobQueue(redis: Redis, log: (m: string) => void): Promise<TopicJob[]> {
  const seen = new Set<string>();
  const jobs: TopicJob[] = [];

  const add = (job: TopicJob) => {
    const key = cacheKey(job.topic, job.startYear, job.endYear);
    if (!seen.has(key) && jobs.length < MAX_JOBS) {
      seen.add(key);
      jobs.push(job);
    }
  };

  // Phase 1: popular user searches + their related topics
  try {
    const popular = await redis.zrevrange(POPULAR_KEY, 0, 29);
    log(`[queue] ${popular.length} popular topics from search history`);
    for (const member of popular) {
      const [topic, startYear = '', endYear = ''] = member.split('|');
      if (!topic) continue;
      const job = { topic, startYear, endYear };
      add(job);

      // Pull related topics from cached timeline if available
      const cached = await redis.get(cacheKey(topic, startYear, endYear));
      if (cached) {
        try {
          const t = JSON.parse(cached) as { relatedTopics?: string[] };
          for (const rel of t.relatedTopics ?? []) {
            add({ topic: rel, startYear: '', endYear: '' });
          }
        } catch { /* ignore */ }
      }
    }
  } catch (err) { log(`[queue] Popular topics error: ${err}`); }

  // Phase 2: AI-suggested topics
  const aiTopics = await fetchAISuggestedTopics(log);
  for (const job of aiTopics) add(job);

  // Phase 3: sidebar topics (always keep these fresh)
  for (const job of ALL_TOPICS) add(job);

  log(`[queue] Total unique jobs: ${jobs.length}`);
  return jobs;
}

// ── Shared run logic ───────────────────────────────────────────────────────

async function runPreGeneration(
  overrideJobs: TopicJob[] | null,
  log: (m: string) => void,
  warn: (m: string) => void
) {
  await loadSecrets();
  anthropic = null; azure = null;

  const redisUrl = getSecret('redis-url');
  if (!redisUrl) { warn('Missing redis-url'); return; }

  const provider = getProvider();
  log(`[llm] Provider: ${provider}`);

  const redis = new Redis(redisUrl, { tls: redisUrl.startsWith('rediss://') ? {} : undefined, connectTimeout: 5000, maxRetriesPerRequest: 2 });

  const jobs = overrideJobs ?? await buildJobQueue(redis, log);

  let generated = 0, skipped = 0, failed = 0;

  for (const job of jobs) {
    const key = cacheKey(job.topic, job.startYear, job.endYear);
    try {
      const ttl = await redis.ttl(key);
      if (ttl > 86400) { skipped++; log(`Skipped (fresh): ${job.topic}`); continue; }

      log(`Generating: ${job.topic}${job.startYear ? ` (${job.startYear}–${job.endYear})` : ''}`);
      const result = await generateTimeline(job);

      if (result) {
        await redis.setex(key, TTL, result);
        generated++;
        log(`Cached: ${job.topic}`);
        try {
          const quizKey = `quiz:${key}`;
          if (await redis.ttl(quizKey) <= 86400) {
            const quiz = await generateQuiz(result);
            if (quiz) { await redis.setex(quizKey, TTL, quiz); }
          }
        } catch (qErr) { warn(`Quiz failed for ${job.topic}: ${qErr}`); }
      } else {
        failed++;
        warn(`Failed (incomplete): ${job.topic}`);
      }
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      failed++;
      warn(`Error: ${job.topic}: ${err}`);
    }
  }

  redis.disconnect();
  log(`Complete — generated: ${generated}, skipped: ${skipped}, failed: ${failed}`);
}

// ── Triggers ───────────────────────────────────────────────────────────────

app.timer('pregenerateTimelines', {
  schedule: '0 0 2 * * *',
  runOnStartup: false,
  handler: async (_t: unknown, ctx: InvocationContext) => {
    ctx.log('Starting nightly pre-generation...');
    await runPreGeneration(null, m => ctx.log(m), m => ctx.warn(m));
  },
});

app.http('pregenerateManual', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, ctx) => {
    ctx.log('Manual pre-generation triggered');
    const body = await request.json().catch(() => ({}) as Record<string, unknown>);
    const topicFilter = (body as { topics?: string[] }).topics;
    const overrideJobs = topicFilter
      ? ALL_TOPICS.filter(j => topicFilter.includes(j.topic))
      : null; // null = use full dynamic queue

    const jobCount = overrideJobs?.length ?? MAX_JOBS;
    ctx.log(`Queued up to ${jobCount} topics`);
    void runPreGeneration(overrideJobs, m => ctx.log(m), m => ctx.warn(m));

    return { status: 202, jsonBody: { message: `Pre-generation started`, mode: topicFilter ? 'filtered' : 'full-dynamic-queue' } };
  },
});
