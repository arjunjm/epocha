/**
 * Parallel queue processor — polls 'epocha-pregenerate-jobs' aggressively
 * and processes up to 10 topics concurrently per invocation.
 *
 * Timer triggers are reliable on Consumption plan (unlike the Storage Queue
 * trigger's scale controller which has cross-region limitations).
 *
 * Schedule: every 10 seconds. Azure's blob lease ensures mutual exclusion —
 * if a batch is still running when the next tick fires, that tick is skipped.
 * The next invocation starts at the first tick AFTER the previous one finishes,
 * so the gap between batches is at most 10 seconds regardless of batch duration.
 *
 * Throughput: 10 topics × ~10s gap = ~4.5 min for 39 sidebar topics.
 */
import { app } from '@azure/functions';
import { QueueServiceClient, type ReceivedMessageItem } from '@azure/storage-queue';
import Redis from 'ioredis';
import { loadSecrets, getSecret } from './secrets.js';
import { generateTimeline, generateQuiz, cacheKey, resetClients, TIMELINE_TTL } from './generation.js';

export const QUEUE_NAME = 'epocha-pregenerate-jobs';
const BATCH_SIZE = 10;

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

async function makePipeline(redis: Redis, msg: string) {
  try {
    await redis.pipeline()
      .rpush(ADMIN_LOG_KEY, `[${ts()}] ${msg}`)
      .ltrim(ADMIN_LOG_KEY, -ADMIN_LOG_MAX, -1)
      .exec();
  } catch { /* non-critical */ }
}

async function processOne(
  queueMsg: ReceivedMessageItem,
  queueClient: ReturnType<InstanceType<typeof QueueServiceClient>['getQueueClient']>,
  redis: Redis,
  log: (m: string) => void,
): Promise<void> {
  let job: QueueJob;
  try {
    job = JSON.parse(queueMsg.messageText) as QueueJob;
  } catch {
    log(`[queue] Invalid message, discarding: ${queueMsg.messageText}`);
    await queueClient.deleteMessage(queueMsg.messageId, queueMsg.popReceipt);
    await redis.decr(ADMIN_PENDING_KEY);
    return;
  }

  try {
    const key = cacheKey(job.topic, job.startYear, job.endYear);

    if (!job.forceRegenerate) {
      const ttl = await redis.ttl(key);
      if (ttl > 86400) {
        await makePipeline(redis, `Skipped (fresh, ${Math.round(ttl / 3600)}h left): ${job.topic}`);
        await queueClient.deleteMessage(queueMsg.messageId, queueMsg.popReceipt);
        return;
      }
    } else {
      await redis.del(key);
    }

    await makePipeline(redis, `Generating: ${job.topic}${job.startYear ? ` (${job.startYear}–${job.endYear})` : ''}`);
    const result = await generateTimeline(job);

    if (result) {
      const parsed = JSON.parse(result) as { period?: string; topic?: string };

      // For trending topics without explicit years, extract from the period
      let finalStartYear = job.startYear;
      let finalEndYear = job.endYear;
      if (!job.startYear && !job.endYear && parsed.period) {
        const yearMatch = parsed.period.match(/(\d{4})/g);
        if (yearMatch && yearMatch.length >= 1) {
          finalStartYear = yearMatch[0]!;
          // Use the last year found, or fallback to the first year if only one was found
          finalEndYear = yearMatch.length >= 2 ? yearMatch[yearMatch.length - 1]! : yearMatch[0]!;
        } else {
          // No years found in period — fallback to reasonable defaults
          // This prevents empty years which would fail validation
          finalStartYear = new Date().getFullYear().toString();
          finalEndYear = finalStartYear;
        }
      }

      // Re-create cache key with extracted years (important for trending topics)
      const finalKey = cacheKey(job.topic, finalStartYear, finalEndYear);
      await redis.setex(finalKey, TIMELINE_TTL, result);

      // The AI sometimes changes the topic name (e.g. adds "The " prefix). Cache under
      // the AI's name too so the quiz — which uses data.topic from the timeline — can find it.
      const aiTopic = parsed.topic;
      if (aiTopic && aiTopic.trim().toLowerCase() !== job.topic.trim().toLowerCase()) {
        const aiKey = cacheKey(aiTopic, finalStartYear, finalEndYear);
        if (aiKey !== finalKey) await redis.setex(aiKey, TIMELINE_TTL, result);
      }

      // Use the AI's topic name in trending metadata for consistency with quiz lookups
      const trendingTopic = aiTopic || job.topic;
      const meta = JSON.stringify({
        topic: trendingTopic, startYear: finalStartYear,
        endYear: finalEndYear, period: parsed.period ?? '',
      });
      await redis.zadd('epocha:trending-topics', Date.now(), meta);
      await redis.zremrangebyrank('epocha:trending-topics', 0, -51);

      await makePipeline(redis, `Cached: ${job.topic}`);

      try {
        const quizKey = `quiz:${finalKey}`;
        if (job.forceRegenerate || await redis.ttl(quizKey) <= 86400) {
          if (job.forceRegenerate) await redis.del(quizKey);
          const quiz = await generateQuiz(result);
          if (quiz) {
            await redis.setex(quizKey, TIMELINE_TTL, quiz);
            // Also store quiz under AI's topic key for consistent lookup
            if (aiTopic && aiTopic.trim().toLowerCase() !== job.topic.trim().toLowerCase()) {
              const aiQuizKey = `quiz:${cacheKey(aiTopic, finalStartYear, finalEndYear)}`;
              if (aiQuizKey !== quizKey) await redis.setex(aiQuizKey, TIMELINE_TTL, quiz);
            }
          }
        }
      } catch (qErr) {
        await makePipeline(redis, `Quiz failed for ${job.topic}: ${qErr}`);
      }

      await queueClient.deleteMessage(queueMsg.messageId, queueMsg.popReceipt);
    } else {
      // Make the message visible again in 30s for a fast retry rather than
      // waiting for the full visibilityTimeout (typically caused by rate limits
      // or the LLM returning incomplete JSON under load).
      await makePipeline(redis, `Failed (no result): ${job.topic} — retrying in 30s`);
      try {
        await queueClient.updateMessage(
          queueMsg.messageId,
          queueMsg.popReceipt,
          queueMsg.messageText,
          30  // visible again in 30 seconds
        );
      } catch { /* message may have already expired — will retry naturally */ }
    }
  } finally {
    // Atomic decrement — safe to call concurrently from multiple workers
    const remaining = await redis.decr(ADMIN_PENDING_KEY);
    if (remaining <= 0) {
      await redis.del(ADMIN_RUNNING_KEY);
      await makePipeline(redis, `All jobs complete!`);
    }
  }
}

app.timer('processPregenQueue', {
  schedule: '*/10 * * * * *', // every 10s — blob lease skips ticks while previous batch runs
  runOnStartup: false,
  handler: async (_t, ctx) => {
    await loadSecrets();
    resetClients();

    const connStr = process.env.AzureWebJobsStorage;
    if (!connStr) { ctx.warn('[queue] AzureWebJobsStorage not set'); return; }

    const redisUrl = getSecret('redis-url');
    if (!redisUrl) { ctx.warn('[queue] redis-url not set'); return; }

    const queueClient = QueueServiceClient
      .fromConnectionString(connStr)
      .getQueueClient(QUEUE_NAME);

    const received = await queueClient.receiveMessages({
      numberOfMessages: BATCH_SIZE,
      visibilityTimeout: 120, // 2 min — covers generation + quiz; on failure we shorten to 30s explicitly
    });

    if (received.receivedMessageItems.length === 0) {
      ctx.log('[queue] Queue empty — nothing to do');
      return;
    }

    const count = received.receivedMessageItems.length;
    ctx.log(`[queue] Processing ${count} topic(s) in parallel`);

    const redis = new Redis(redisUrl, {
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      connectTimeout: 5000,
      maxRetriesPerRequest: 2,
    });

    try {
      // Process all messages concurrently; allSettled so one failure doesn't abort others
      const results = await Promise.allSettled(
        received.receivedMessageItems.map(msg =>
          processOne(msg, queueClient, redis, m => ctx.log(m))
        )
      );

      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        ctx.warn(`[queue] ${failed.length}/${count} tasks threw unexpectedly`);
        failed.forEach(r => ctx.warn((r as PromiseRejectedResult).reason));
      }
    } finally {
      redis.disconnect();
    }
  },
});
