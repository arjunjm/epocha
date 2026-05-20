/**
 * Producer functions — build a list of topics and enqueue them.
 * Each queued message is processed independently by generateSingle.ts.
 *
 * Triggers:
 *   pregenerateTimelines  — nightly timer, full 4-phase queue
 *   pregenerateManual     — HTTP, sidebar topics only (fast, no LLM in producer)
 *   generateTrendingEvents — HTTP, LLM-curated contemporary topics
 */
import { app, type InvocationContext } from '@azure/functions';
import { QueueServiceClient } from '@azure/storage-queue';
import Anthropic from '@anthropic-ai/sdk';
import { AzureOpenAI } from 'openai';
import Redis from 'ioredis';
import { loadSecrets, getSecret } from './secrets.js';
import { ALL_TOPICS } from './topics.js';
import type { TopicJob } from './generation.js';
import {
  getProvider as getProviderShared,
  resetClients,
  TRENDING_EVENTS_PROMPT,
  AI_SUGGEST_PROMPT,
  cacheKey,
} from './generation.js';
import { QUEUE_NAME } from './generateSingle.js';

const POPULAR_KEY = 'epocha:popular-topics';
const MAX_JOBS = 80;

const ADMIN_LOG_KEY = 'epocha:admin:job-log';
const ADMIN_RUNNING_KEY = 'epocha:admin:running';
const ADMIN_PENDING_KEY = 'epocha:admin:job-pending';
const ADMIN_TOTAL_KEY = 'epocha:admin:job-total';
const ADMIN_LOG_MAX = 500;

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

// ── LLM clients (topic suggestion only) ──────────────────────────────────

let anthropic: Anthropic | null = null;
let azure: AzureOpenAI | null = null;

function getAnthropicClient() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: getSecret('anthropic-api-key') });
  return anthropic;
}

function getAzureClient() {
  if (!azure) {
    azure = new AzureOpenAI({
      endpoint: getSecret('azure-openai-endpoint'),
      apiKey: getSecret('azure-openai-key'),
      apiVersion: '2024-10-21',
      deployment: getSecret('azure-openai-deployment') || 'gpt-4o',
    });
  }
  return azure;
}

function getProvider() {
  return getProviderShared();
}

async function fetchTrendingCurrentEvents(log: (m: string) => void): Promise<TopicJob[]> {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  try {
    let text = '';
    if (getProvider() === 'azure-openai') {
      const res = await getAzureClient().chat.completions.create({
        model: getSecret('azure-openai-deployment') || 'gpt-4o',
        max_tokens: 512,
        messages: [{ role: 'user', content: TRENDING_EVENTS_PROMPT(date) }],
      });
      text = res.choices[0]?.message?.content ?? '';
    } else {
      const res = await getAnthropicClient().messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        messages: [{ role: 'user', content: TRENDING_EVENTS_PROMPT(date) }],
      });
      text = res.content[0]?.type === 'text' ? res.content[0].text : '';
    }
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const topics = JSON.parse(match[0]) as string[];
    log(`[trending-events] Got ${topics.length} topics for ${date}`);
    return topics
      .filter(t => typeof t === 'string' && t.trim())
      .slice(0, 10)
      .map(t => ({ topic: t.trim(), startYear: '', endYear: '' }));
  } catch (err) {
    log(`[trending-events] Failed: ${err}`);
    return [];
  }
}

async function fetchAISuggestedTopics(log: (m: string) => void): Promise<TopicJob[]> {
  try {
    let text = '';
    if (getProvider() === 'azure-openai') {
      const res = await getAzureClient().chat.completions.create({
        model: getSecret('azure-openai-deployment') || 'gpt-4o',
        max_tokens: 512,
        messages: [{ role: 'user', content: AI_SUGGEST_PROMPT }],
      });
      text = res.choices[0]?.message?.content ?? '';
    } else {
      const res = await getAnthropicClient().messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        messages: [{ role: 'user', content: AI_SUGGEST_PROMPT }],
      });
      text = res.content[0]?.type === 'text' ? res.content[0].text : '';
    }
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const topics = JSON.parse(match[0]) as string[];
    log(`[ai-suggest] Got ${topics.length} AI-suggested topics`);
    return topics
      .filter(t => typeof t === 'string' && t.trim())
      .map(t => ({ topic: t.trim(), startYear: '', endYear: '' }));
  } catch (err) {
    log(`[ai-suggest] Failed: ${err}`);
    return [];
  }
}

async function buildFullQueue(redis: Redis, log: (m: string) => void): Promise<TopicJob[]> {
  const seen = new Set<string>();
  const jobs: TopicJob[] = [];
  const add = (job: TopicJob) => {
    const k = cacheKey(job.topic, job.startYear, job.endYear);
    if (!seen.has(k) && jobs.length < MAX_JOBS) {
      seen.add(k);
      jobs.push(job);
    }
  };

  for (const j of await fetchTrendingCurrentEvents(log)) add(j);

  try {
    const popular = await redis.zrevrange(POPULAR_KEY, 0, 29);
    log(`[queue] ${popular.length} popular topics from search history`);
    for (const member of popular) {
      const [topic, startYear = '', endYear = ''] = member.split('|');
      if (!topic) continue;
      add({ topic, startYear, endYear });
      const cached = await redis.get(cacheKey(topic, startYear, endYear));
      if (cached) {
        try {
          const t = JSON.parse(cached) as { relatedTopics?: string[] };
          for (const rel of t.relatedTopics ?? []) add({ topic: rel, startYear: '', endYear: '' });
        } catch { /* ignore */ }
      }
    }
  } catch (err) {
    log(`[queue] Popular topics error: ${err}`);
  }

  for (const j of await fetchAISuggestedTopics(log)) add(j);
  for (const j of ALL_TOPICS) add(j);

  log(`[queue] Total unique jobs: ${jobs.length}`);
  return jobs;
}

// ── Queue producer ────────────────────────────────────────────────────────

async function enqueueJobs(
  jobs: TopicJob[],
  forceRegenerate: boolean,
  redis: Redis,
  log: (m: string) => void
): Promise<void> {
  const connStr = process.env.AzureWebJobsStorage;
  if (!connStr) throw new Error('AzureWebJobsStorage not set');

  const queueClient = QueueServiceClient
    .fromConnectionString(connStr)
    .getQueueClient(QUEUE_NAME);
  await queueClient.createIfNotExists();

  // Reset admin state and initialise counters atomically
  await redis.pipeline()
    .del(ADMIN_LOG_KEY)
    .set(ADMIN_RUNNING_KEY, '1', 'EX', 86400)      // 24h safety TTL
    .set(ADMIN_PENDING_KEY, String(jobs.length))
    .set(ADMIN_TOTAL_KEY, String(jobs.length), 'EX', 7200)  // keep 2h for progress display
    .exec();

  // Send messages in small batches to avoid request overload
  const BATCH = 20;
  for (let i = 0; i < jobs.length; i += BATCH) {
    await Promise.all(
      jobs.slice(i, i + BATCH).map(job =>
        queueClient.sendMessage(JSON.stringify({ ...job, forceRegenerate }))
      )
    );
  }

  // Write initial log entry so the admin UI shows something immediately
  await redis.pipeline()
    .rpush(ADMIN_LOG_KEY, `[${ts()}] Enqueued ${jobs.length} jobs — watch for worker progress below`)
    .ltrim(ADMIN_LOG_KEY, -ADMIN_LOG_MAX, -1)
    .exec();

  log(`Enqueued ${jobs.length} jobs to ${QUEUE_NAME}`);
}

// ── Triggers ──────────────────────────────────────────────────────────────

app.timer('pregenerateTimelines', {
  schedule: '0 0 2 * * *',
  runOnStartup: false,
  handler: async (_t: unknown, ctx: InvocationContext) => {
    ctx.log('Starting nightly pre-generation queue build...');
    await loadSecrets();
    resetClients();
    anthropic = null;
    azure = null;
    const redisUrl = getSecret('redis-url');
    if (!redisUrl) { ctx.warn('Missing redis-url'); return; }
    const redis = new Redis(redisUrl, {
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      connectTimeout: 5000,
      maxRetriesPerRequest: 2,
    });
    try {
      const jobs = await buildFullQueue(redis, m => ctx.log(m));
      await enqueueJobs(jobs, false, redis, m => ctx.log(m));
    } finally {
      redis.disconnect();
    }
  },
});

app.http('pregenerateManual', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, ctx) => {
    ctx.log('Manual pre-generation triggered');
    await loadSecrets();
    resetClients();
    anthropic = null;
    azure = null;

    const body = await request.json().catch(() => ({}) as Record<string, unknown>);
    const { topics: topicFilter, forceRegenerate = false } = body as {
      topics?: string[];
      forceRegenerate?: boolean;
    };

    // HTTP trigger: sidebar topics only — no LLM calls in producer, returns in seconds
    const jobs: TopicJob[] = topicFilter
      ? ALL_TOPICS.filter(j => topicFilter.includes(j.topic))
      : ALL_TOPICS;

    const redisUrl = getSecret('redis-url');
    if (!redisUrl) return { status: 500, body: 'Missing redis-url' };
    const redis = new Redis(redisUrl, {
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      connectTimeout: 5000,
      maxRetriesPerRequest: 2,
    });
    try {
      await enqueueJobs(jobs, forceRegenerate, redis, m => ctx.log(m));
      return {
        status: 200,
        jsonBody: { message: `Enqueued ${jobs.length} topics`, topics: jobs.length, forceRegenerate },
      };
    } catch (err) {
      ctx.error(`Enqueue failed: ${err}`);
      return { status: 500, body: String(err) };
    } finally {
      redis.disconnect();
    }
  },
});

app.http('generateTrendingEvents', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, ctx) => {
    ctx.log('Generating trending current events...');
    await loadSecrets();
    resetClients();
    anthropic = null;
    azure = null;

    const body = await request.json().catch(() => ({}) as Record<string, unknown>);
    const { forceRegenerate = false } = body as { forceRegenerate?: boolean };

    const redisUrl = getSecret('redis-url');
    if (!redisUrl) return { status: 500, body: 'Missing redis-url' };
    const redis = new Redis(redisUrl, {
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      connectTimeout: 5000,
      maxRetriesPerRequest: 2,
    });
    try {
      const jobs = await fetchTrendingCurrentEvents(m => ctx.log(m));
      if (jobs.length === 0) return { status: 500, body: 'No trending topics returned by LLM' };
      await enqueueJobs(jobs, forceRegenerate, redis, m => ctx.log(m));
      return {
        status: 200,
        jsonBody: {
          message: `Enqueued ${jobs.length} trending topics`,
          topics: jobs.map(j => j.topic),
          forceRegenerate,
        },
      };
    } catch (err) {
      ctx.error(`Enqueue failed: ${err}`);
      return { status: 500, body: String(err) };
    } finally {
      redis.disconnect();
    }
  },
});
