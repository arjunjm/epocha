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
  ]
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

const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function cacheKey(topic: string, startYear: string, endYear: string): string {
  return `timeline:${topic.toLowerCase().trim().replace(/\s+/g, '-')}:${startYear}:${endYear}`;
}

function getProvider(): 'anthropic' | 'azure-openai' {
  const p = (getSecret('llm-provider') || 'anthropic').toLowerCase();
  return p === 'azure-openai' ? 'azure-openai' : 'anthropic';
}

// ── LLM clients ────────────────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: getSecret('anthropic-api-key') });
  return anthropicClient;
}

let azureClient: AzureOpenAI | null = null;
function getAzureClient(): AzureOpenAI {
  if (!azureClient) {
    azureClient = new AzureOpenAI({
      endpoint: getSecret('azure-openai-endpoint'),
      apiKey: getSecret('azure-openai-key'),
      apiVersion: '2024-10-21',
      deployment: getSecret('azure-openai-deployment') || 'gpt-4o',
    });
  }
  return azureClient;
}

// ── Generation helpers ─────────────────────────────────────────────────────

async function generateTimeline(job: TopicJob): Promise<string | null> {
  const userMessage = `Generate a detailed timeline for: "${job.topic}"\nTime period: ${job.startYear} to ${job.endYear}\n\nReturn only the JSON object.`;
  let fullText = '';

  if (getProvider() === 'azure-openai') {
    const deployment = getSecret('azure-openai-deployment') || 'gpt-4o';
    const stream = await getAzureClient().chat.completions.create({
      model: deployment,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMessage }],
      stream: true,
    });
    for await (const chunk of stream) {
      fullText += chunk.choices[0]?.delta?.content ?? '';
    }
  } else {
    const stream = getAnthropicClient().messages.stream({
      model: 'claude-haiku-4-5',
      max_tokens: 8192,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text;
      }
    }
  }

  const stripped = fullText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const timeline = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(timeline.events) || timeline.events.length < 5) return null;
    timeline.events.sort((a: { sortYear?: number }, b: { sortYear?: number }) =>
      (a.sortYear ?? 0) - (b.sortYear ?? 0));
    return JSON.stringify(timeline);
  } catch { return null; }
}

async function generateQuiz(timelineJson: string): Promise<string | null> {
  const timeline = JSON.parse(timelineJson);
  const summary = {
    topic: timeline.topic, period: timeline.period,
    events: (timeline.events ?? []).map((e: { date: string; title: string; summary: string; figures?: string[]; location?: string }) => ({
      date: e.date, title: e.title, summary: e.summary, figures: e.figures, location: e.location,
    })),
  };
  const userMessage = `Generate 12 quiz questions for:\n${JSON.stringify(summary)}`;

  let text = '';
  if (getProvider() === 'azure-openai') {
    const deployment = getSecret('azure-openai-deployment') || 'gpt-4o';
    const res = await getAzureClient().chat.completions.create({
      model: deployment, max_tokens: 4096,
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

  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const questions = JSON.parse(match[0]);
    return Array.isArray(questions) && questions.length > 0 ? JSON.stringify(questions) : null;
  } catch { return null; }
}

// ── Shared run logic ───────────────────────────────────────────────────────

async function runPreGeneration(jobs: TopicJob[], log: (msg: string) => void, warn: (msg: string) => void) {
  await loadSecrets();
  // Reset clients so they pick up freshly loaded secrets
  anthropicClient = null;
  azureClient = null;

  const redisUrl = getSecret('redis-url');
  if (!redisUrl) { warn('Missing redis-url secret'); return { generated: 0, skipped: 0, failed: 0 }; }

  const provider = getProvider();
  log(`[llm] Provider: ${provider}`);

  if (provider === 'azure-openai' && !getSecret('azure-openai-key')) {
    warn('Missing azure-openai-key secret'); return { generated: 0, skipped: 0, failed: 0 };
  }
  if (provider === 'anthropic' && !getSecret('anthropic-api-key')) {
    warn('Missing anthropic-api-key secret'); return { generated: 0, skipped: 0, failed: 0 };
  }

  const redis = new Redis(redisUrl, {
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    connectTimeout: 5000,
    maxRetriesPerRequest: 2,
  });

  let generated = 0, skipped = 0, failed = 0;

  for (const job of jobs) {
    const key = cacheKey(job.topic, job.startYear, job.endYear);
    try {
      const ttl = await redis.ttl(key);
      if (ttl > 86400) { skipped++; log(`Skipped (fresh): ${job.topic}`); continue; }

      log(`Generating: ${job.topic}`);
      const result = await generateTimeline(job);
      if (result) {
        await redis.setex(key, TTL_SECONDS, result);
        generated++;
        log(`Cached: ${job.topic}`);
        try {
          const quizKey = `quiz:${key}`;
          const quizTtl = await redis.ttl(quizKey);
          if (quizTtl <= 86400) {
            const quiz = await generateQuiz(result);
            if (quiz) { await redis.setex(quizKey, TTL_SECONDS, quiz); log(`Quiz cached: ${job.topic}`); }
          }
        } catch (qErr) { warn(`Quiz gen failed for ${job.topic}: ${qErr}`); }
      } else {
        failed++;
        warn(`Failed to generate: ${job.topic}`);
      }
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      failed++;
      warn(`Error generating ${job.topic}: ${err}`);
    }
  }

  redis.disconnect();
  return { generated, skipped, failed };
}

// ── Triggers ───────────────────────────────────────────────────────────────

app.timer('pregenerateTimelines', {
  schedule: '0 0 2 * * *',
  runOnStartup: false,
  handler: async (_timer: unknown, context: InvocationContext) => {
    context.log('Starting nightly timeline pre-generation...');
    const { generated, skipped, failed } = await runPreGeneration(
      ALL_TOPICS,
      (m) => context.log(m),
      (m) => context.warn(m)
    );
    context.log(`Complete — generated: ${generated}, skipped: ${skipped}, failed: ${failed}`);
  },
});

app.http('pregenerateManual', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('Manual pre-generation triggered');
    const body = await request.json().catch(() => ({}) as Record<string, unknown>);
    const topicFilter = (body as { topics?: string[] }).topics;
    const jobs = topicFilter ? ALL_TOPICS.filter(j => topicFilter.includes(j.topic)) : ALL_TOPICS;
    context.log(`Queued ${jobs.length} topics`);

    void runPreGeneration(jobs, (m) => context.log(m), (m) => context.warn(m))
      .then(({ generated, skipped, failed }) =>
        context.log(`Background complete — generated: ${generated}, skipped: ${skipped}, failed: ${failed}`)
      );

    return {
      status: 202,
      jsonBody: { message: `Queued ${jobs.length} topics`, topics: jobs.map(j => j.topic) },
    };
  },
});
