/**
 * Storage Queue consumer — processes one pregeneration job per invocation.
 * Triggered by the 'epocha-pregenerate-jobs' queue.
 * Each message = one topic. No timeout risk: a single generation takes ~45s.
 */
import { app } from '@azure/functions';
import Redis from 'ioredis';
import { loadSecrets, getSecret } from './secrets.js';
import { generateTimeline, generateQuiz, cacheKey, resetClients, TIMELINE_TTL } from './generation.js';

export const QUEUE_NAME = 'epocha-pregenerate-jobs';

const ADMIN_LOG_KEY = 'epocha:admin:job-log';
const ADMIN_RUNNING_KEY = 'epocha:admin:running';
const ADMIN_PENDING_KEY = 'epocha:admin:job-pending';
const ADMIN_LOG_MAX = 500;

interface QueueJob {
  topic: string;
  startYear: string;
  endYear: string;
  forceRegenerate: boolean;
}

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

app.storageQueue('generateSingleTimeline', {
  queueName: QUEUE_NAME,
  connection: 'AzureWebJobsStorage',
  handler: async (queueItem: unknown, ctx) => {
    await loadSecrets();
    resetClients(); // ensure fresh clients per cold-start invocation

    const job = queueItem as QueueJob;
    ctx.log(`[queue] Processing: ${job.topic}`);

    const redisUrl = getSecret('redis-url');
    if (!redisUrl) {
      ctx.warn('[queue] Missing redis-url — skipping');
      return;
    }

    const redis = new Redis(redisUrl, {
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      connectTimeout: 5000,
      maxRetriesPerRequest: 2,
    });

    const rlog = async (msg: string) => {
      ctx.log(msg);
      try {
        await redis.pipeline()
          .rpush(ADMIN_LOG_KEY, `[${ts()}] ${msg}`)
          .ltrim(ADMIN_LOG_KEY, -ADMIN_LOG_MAX, -1)
          .exec();
      } catch { /* non-critical */ }
    };

    try {
      const key = cacheKey(job.topic, job.startYear, job.endYear);

      if (!job.forceRegenerate) {
        const ttl = await redis.ttl(key);
        if (ttl > 86400) {
          await rlog(`Skipped (fresh, ${Math.round(ttl / 3600)}h left): ${job.topic}`);
          return; // message consumed successfully — no retry
        }
      } else {
        await redis.del(key);
      }

      await rlog(`Generating: ${job.topic}${job.startYear ? ` (${job.startYear}–${job.endYear})` : ''}`);
      const result = await generateTimeline(job);

      if (result) {
        await redis.setex(key, TIMELINE_TTL, result);

        // Index in trending sorted set (sidebar display)
        const parsed = JSON.parse(result) as { period?: string };
        const meta = JSON.stringify({
          topic: job.topic, startYear: job.startYear,
          endYear: job.endYear, period: parsed.period ?? '',
        });
        await redis.zadd('epocha:trending-topics', Date.now(), meta);
        await redis.zremrangebyrank('epocha:trending-topics', 0, -51);

        await rlog(`Cached: ${job.topic}`);

        // Generate quiz alongside (best-effort, failure doesn't retry the timeline)
        try {
          const quizKey = `quiz:${key}`;
          if (job.forceRegenerate || await redis.ttl(quizKey) <= 86400) {
            if (job.forceRegenerate) await redis.del(quizKey);
            const quiz = await generateQuiz(result);
            if (quiz) await redis.setex(quizKey, TIMELINE_TTL, quiz);
          }
        } catch (qErr) {
          await rlog(`Quiz failed for ${job.topic}: ${qErr}`);
        }
      } else {
        // Throw so the message returns to queue and retries (up to maxDequeueCount)
        throw new Error(`Timeline generation returned no result for: ${job.topic}`);
      }
    } finally {
      // Decrement pending counter; clear running flag when all jobs are done
      const remaining = await redis.decr(ADMIN_PENDING_KEY);
      if (remaining <= 0) {
        await redis.del(ADMIN_RUNNING_KEY);
        await rlog(`All jobs complete!`);
      }
      redis.disconnect();
    }
  },
});
