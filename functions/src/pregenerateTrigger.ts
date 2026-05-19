import { app, type InvocationContext } from '@azure/functions';
import Anthropic from '@anthropic-ai/sdk';
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

const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function cacheKey(topic: string, startYear: string, endYear: string): string {
  return `timeline:${topic.toLowerCase().trim().replace(/\s+/g, '-')}:${startYear}:${endYear}`;
}

async function generateTimeline(client: Anthropic, job: TopicJob): Promise<string | null> {
  const stream = client.messages.stream({
    model: 'claude-haiku-4-5',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Generate a detailed timeline for: "${job.topic}"\nTime period: ${job.startYear} to ${job.endYear}\n\nReturn only the JSON object.`
    }]
  });

  let fullText = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
    }
  }

  const stripped = fullText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const timeline = JSON.parse(jsonMatch[0]);
    if (timeline.events && Array.isArray(timeline.events)) {
      timeline.events.sort((a: { sortYear?: number }, b: { sortYear?: number }) =>
        (a.sortYear ?? 0) - (b.sortYear ?? 0)
      );
    }
    return JSON.stringify(timeline);
  } catch {
    return null;
  }
}

// Timer trigger — runs daily at 2 AM UTC
app.timer('pregenerateTimelines', {
  schedule: '0 0 2 * * *',
  runOnStartup: false,
  handler: async (_myTimer: unknown, context: InvocationContext): Promise<void> => {
    context.log('Starting timeline pre-generation...');

    await loadSecrets();

    const redisUrl = getSecret('redis-url');
    const anthropicKey = getSecret('anthropic-api-key');

    if (!redisUrl || !anthropicKey) {
      context.error('Missing redis-url or anthropic-api-key secrets');
      return;
    }

    const redis = new Redis(redisUrl, {
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      connectTimeout: 5000,
      maxRetriesPerRequest: 2,
    });

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const job of ALL_TOPICS) {
      const key = cacheKey(job.topic, job.startYear, job.endYear);

      try {
        // Skip if already cached and fresh (TTL > 1 day remaining)
        const ttl = await redis.ttl(key);
        if (ttl > 86400) {
          skipped++;
          context.log(`Skipped (fresh): ${job.topic}`);
          continue;
        }

        context.log(`Generating: ${job.topic}`);
        const result = await generateTimeline(anthropic, job);

        if (result) {
          await redis.setex(key, TTL_SECONDS, result);
          generated++;
          context.log(`Cached: ${job.topic}`);
        } else {
          failed++;
          context.warn(`Failed to generate: ${job.topic}`);
        }

        // Brief pause between requests to avoid rate limiting
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        failed++;
        context.error(`Error generating ${job.topic}: ${err}`);
      }
    }

    redis.disconnect();

    context.log(`Pre-generation complete — generated: ${generated}, skipped: ${skipped}, failed: ${failed}`);
  }
});

// HTTP trigger for manual/on-demand pre-generation (useful for initial seeding)
app.http('pregenerateManual', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('Manual pre-generation triggered');

    await loadSecrets();

    const redisUrl = getSecret('redis-url');
    const anthropicKey = getSecret('anthropic-api-key');

    if (!redisUrl || !anthropicKey) {
      return { status: 500, body: 'Missing secrets' };
    }

    const redis = new Redis(redisUrl, {
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    });
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // Get optional topic filter from body
    const body = await request.json().catch(() => ({}) as Record<string, unknown>);
    const topicFilter = (body as { topics?: string[] }).topics;
    const jobs = topicFilter
      ? ALL_TOPICS.filter(j => topicFilter.includes(j.topic))
      : ALL_TOPICS;

    // Run in background — return immediately
    context.log(`Queued ${jobs.length} topics for generation`);

    void (async () => {
      for (const job of jobs) {
        const key = cacheKey(job.topic, job.startYear, job.endYear);
        const ttl = await redis.ttl(key);
        if (ttl > 86400) continue;

        const result = await generateTimeline(anthropic, job);
        if (result) await redis.setex(key, TTL_SECONDS, result);
        await new Promise(r => setTimeout(r, 2000));
      }
      redis.disconnect();
    })();

    return {
      status: 202,
      jsonBody: { message: `Queued ${jobs.length} topics`, topics: jobs.map(j => j.topic) }
    };
  }
});
