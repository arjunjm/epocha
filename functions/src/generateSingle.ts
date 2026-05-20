/**
 * Queue processor — polls 'epocha-pregenerate-jobs' on a timer and processes
 * one message per invocation. Timer triggers on Consumption plan are reliable;
 * the Storage Queue trigger's scale controller has cross-region limitations.
 *
 * Schedule: every 60 seconds.
 * - If the queue is empty: exits in <1s (no cost, no LLM call).
 * - If there is a message: generates one timeline (~45s) then exits.
 * - 40 topics → ~40 minutes total (adequate for nightly pregeneration).
 */
import { app } from '@azure/functions';
import { QueueServiceClient } from '@azure/storage-queue';
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

app.timer('processPregenQueue', {
  schedule: '0 * * * * *', // every 60 seconds
  runOnStartup: false,
  handler: async (_t, ctx) => {
    await loadSecrets();

    const connStr = process.env.AzureWebJobsStorage;
    if (!connStr) { ctx.warn('[queue] AzureWebJobsStorage not set'); return; }

    const redisUrl = getSecret('redis-url');
    if (!redisUrl) { ctx.warn('[queue] redis-url not set'); return; }

    // Peek at the queue before connecting to Redis (cheap check)
    const queueClient = QueueServiceClient
      .fromConnectionString(connStr)
      .getQueueClient(QUEUE_NAME);

    const messages = await queueClient.receiveMessages({ numberOfMessages: 1, visibilityTimeout: 300 });
    if (messages.receivedMessageItems.length === 0) {
      ctx.log('[queue] Queue empty — nothing to do');
      return;
    }

    const msg = messages.receivedMessageItems[0]!;
    let job: QueueJob;
    try {
      job = JSON.parse(msg.messageText) as QueueJob;
    } catch {
      ctx.warn(`[queue] Invalid message, deleting: ${msg.messageText}`);
      await queueClient.deleteMessage(msg.messageId, msg.popReceipt);
      return;
    }

    ctx.log(`[queue] Processing: ${job.topic}`);
    resetClients();

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
          await queueClient.deleteMessage(msg.messageId, msg.popReceipt);
          return;
        }
      } else {
        await redis.del(key);
      }

      await rlog(`Generating: ${job.topic}${job.startYear ? ` (${job.startYear}–${job.endYear})` : ''}`);
      const result = await generateTimeline(job);

      if (result) {
        await redis.setex(key, TIMELINE_TTL, result);

        // Index in trending sorted set
        const parsed = JSON.parse(result) as { period?: string };
        const meta = JSON.stringify({
          topic: job.topic, startYear: job.startYear,
          endYear: job.endYear, period: parsed.period ?? '',
        });
        await redis.zadd('epocha:trending-topics', Date.now(), meta);
        await redis.zremrangebyrank('epocha:trending-topics', 0, -51);

        await rlog(`Cached: ${job.topic}`);

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

        // Success — delete message from queue
        await queueClient.deleteMessage(msg.messageId, msg.popReceipt);
      } else {
        // Failed generation — put message back (it will retry up to maxDequeueCount)
        // Visibility timeout will expire automatically; no explicit action needed
        await rlog(`Failed (incomplete response): ${job.topic} — will retry`);
        // Don't delete; message becomes visible again after visibilityTimeout
      }
    } finally {
      // Decrement pending counter; clear running flag when queue is drained
      const remaining = await redis.decr(ADMIN_PENDING_KEY);
      if (remaining <= 0) {
        await redis.del(ADMIN_RUNNING_KEY);
        await rlog(`All jobs complete!`);
      }
      redis.disconnect();
    }
  },
});
