/**
 * Timeline cache — Redis in production, in-memory Map in local dev.
 *
 * Redis is used when REDIS_URL is set (set via Key Vault in production).
 * Falls back to an in-memory Map so local dev works without Redis running.
 *
 * Cache key: timeline:<normalised-topic>:<startYear>:<endYear>
 * TTL: 7 days (historical data rarely changes)
 */
import Redis from 'ioredis';
import { getSecret } from './secrets.js';
import type { TimelineData, QuizQuestion } from './types.js';

const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

let redis: Redis | null = null;
const memoryCache = new Map<string, string>();

export function initCache(): void {
  const redisUrl = getSecret('redis-url');
  if (!redisUrl) {
    console.log('[cache] No redis-url set — using in-memory cache');
    return;
  }
  try {
    redis = new Redis(redisUrl, {
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
    });
    redis.on('connect', () => console.log('[cache] Connected to Redis'));
    redis.on('error', (err) => console.error('[cache] Redis error:', err.message));
  } catch (err) {
    console.warn('[cache] Failed to connect to Redis, falling back to in-memory:', err);
    redis = null;
  }
}

function cacheKey(topic: string, startYear: string, endYear: string): string {
  const normTopic = topic.toLowerCase().trim().replace(/\s+/g, '-');
  return `timeline:${normTopic}:${startYear}:${endYear}`;
}

export async function getCached(
  topic: string,
  startYear: string,
  endYear: string
): Promise<TimelineData | null> {
  const key = cacheKey(topic, startYear, endYear);
  try {
    const raw = redis ? await redis.get(key) : memoryCache.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as TimelineData;
  } catch {
    return null;
  }
}

export async function setCached(
  topic: string,
  startYear: string,
  endYear: string,
  timeline: TimelineData
): Promise<void> {
  const key = cacheKey(topic, startYear, endYear);
  const value = JSON.stringify(timeline);
  try {
    if (redis) {
      await redis.setex(key, TTL_SECONDS, value);
    } else {
      memoryCache.set(key, value);
      // Limit in-memory cache to 100 entries
      if (memoryCache.size > 100) {
        const firstKey = memoryCache.keys().next().value;
        if (firstKey) memoryCache.delete(firstKey);
      }
    }
    console.log(`[cache] Stored timeline for "${topic}"`);
  } catch (err) {
    console.warn('[cache] Failed to cache timeline:', err);
  }
}

const SEARCH_KEY = 'epocha:popular-topics';

export async function trackSearch(topic: string, startYear: string, endYear: string): Promise<void> {
  if (!redis) return; // only track in production (Redis present)
  const member = `${topic}|${startYear}|${endYear}`;
  try { await redis.zincrby(SEARCH_KEY, 1, member); }
  catch { /* non-critical */ }
}

export async function getPopularTopics(limit = 30): Promise<Array<{ topic: string; startYear: string; endYear: string }>> {
  if (!redis) return [];
  try {
    const members = await redis.zrevrange(SEARCH_KEY, 0, limit - 1);
    return members.map(m => {
      const [topic, startYear = '', endYear = ''] = m.split('|');
      return { topic: topic ?? '', startYear, endYear };
    }).filter(t => t.topic);
  } catch { return []; }
}

export async function getCachedQuiz(
  topic: string, startYear: string, endYear: string
): Promise<QuizQuestion[] | null> {
  const key = `quiz:${cacheKey(topic, startYear, endYear)}`;
  try {
    const raw = redis ? await redis.get(key) : memoryCache.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as QuizQuestion[];
  } catch { return null; }
}

export async function setCachedQuiz(
  topic: string, startYear: string, endYear: string, questions: QuizQuestion[]
): Promise<void> {
  const key = `quiz:${cacheKey(topic, startYear, endYear)}`;
  const value = JSON.stringify(questions);
  try {
    if (redis) await redis.setex(key, TTL_SECONDS, value);
    else memoryCache.set(key, value);
  } catch (err) {
    console.warn('[cache] Failed to cache quiz:', err);
  }
}
