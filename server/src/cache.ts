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
    // Note: trending set is written only by the Azure Function (pregenerateTrigger),
    // not here, to avoid user searches polluting the Trending sidebar section.
  } catch (err) {
    console.warn('[cache] Failed to cache timeline:', err);
  }
}

export interface TrendingTopic {
  topic: string;
  startYear: string;
  endYear: string;
  period: string;
}

export async function getTrendingTopics(limit = 20): Promise<TrendingTopic[]> {
  if (!redis) return [];
  try {
    const members = await redis.zrevrange(TRENDING_KEY, 0, limit * 2 - 1); // fetch extra, some may be filtered
    return members
      .map(m => { try { return JSON.parse(m) as TrendingTopic; } catch { return null; } })
      .filter((t): t is TrendingTopic => !!t && !!t.topic && !DEFAULT_TOPICS.has(t.topic))
      .slice(0, limit);
  } catch { return []; }
}

const SEARCH_KEY = 'epocha:popular-topics';
const TRENDING_KEY = 'epocha:trending-topics';
const TRENDING_MAX = 50;

// Sidebar default topics — excluded from trending display
const DEFAULT_TOPICS = new Set([
  'Ancient Greece','The Roman Empire','Ancient Egypt','Mesopotamia & Early Civilization',
  'The Persian Empire','History of Western Philosophy','Eastern Philosophy','The Enlightenment',
  'Existentialism','History of Political Philosophy','History of Computing','The Space Race',
  'History of Physics from Newton to Quantum Mechanics','History of Evolutionary Biology',
  'History of Artificial Intelligence','History of Medicine','The French Revolution',
  'The American Revolution','The Russian Revolution','The Cold War','World War I','World War II',
  'The Civil Rights Movement','The Renaissance','The Age of Exploration','The Industrial Revolution',
  'The Ottoman Empire','The Mughal Empire','The Ming Dynasty','The Byzantine Empire',
  'Ancient India','Ancient China','The Viking Age','The Crusades','The Silk Road',
  'The British Empire','The Mongol Empire','The Islamic Golden Age',
]);

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

export async function deleteCached(topic: string, startYear: string, endYear: string): Promise<void> {
  const key = cacheKey(topic, startYear, endYear);
  try {
    if (redis) await redis.del(key);
    else memoryCache.delete(key);
  } catch { /* non-critical */ }
}

// ── Admin job log (written by Azure Function, read by server admin routes) ──

const ADMIN_LOG_KEY = 'epocha:admin:job-log';
const ADMIN_RUNNING_KEY = 'epocha:admin:running';
const ADMIN_LOG_MAX = 500;

export async function getAdminLog(limit = 200): Promise<string[]> {
  if (!redis) return [];
  try { return await redis.lrange(ADMIN_LOG_KEY, -limit, -1); }
  catch { return []; }
}

export async function isAdminRunning(): Promise<boolean> {
  if (!redis) return false;
  try { return (await redis.get(ADMIN_RUNNING_KEY)) === '1'; }
  catch { return false; }
}

export async function clearAdminLog(): Promise<void> {
  if (!redis) return;
  try { await redis.del(ADMIN_LOG_KEY); }
  catch { /* non-critical */ }
}

// ── Cache contents (admin view) ───────────────────────────────────────────

export interface CacheEntry {
  key: string;
  topic: string;
  startYear: string;
  endYear: string;
  ttlSeconds: number;
  source: 'sidebar' | 'trending' | 'user';
}

export async function getCacheContents(): Promise<CacheEntry[]> {
  if (!redis) return [];
  try {
    // SCAN for all timeline keys (non-blocking, cursor-based)
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await redis.scan(cursor, 'MATCH', 'timeline:*', 'COUNT', 200);
      cursor = next;
      keys.push(...batch);
    } while (cursor !== '0');

    if (keys.length === 0) return [];

    // Fetch TTLs in a single pipeline
    const pipeline = redis.pipeline();
    for (const k of keys) pipeline.ttl(k);
    const results = await pipeline.exec();

    return keys.map((key, i) => {
      const ttl = (results?.[i]?.[1] as number) ?? -2;
      // key format: timeline:<norm-topic>:<startYear>:<endYear>
      const parts = key.split(':');
      const normTopic = parts[1] ?? '';
      const startYear = parts[2] ?? '';
      const endYear = parts[3] ?? '';
      // Reconstruct display-friendly topic name
      const topic = normTopic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      // Classify source: empty years = trending/user search, known years = sidebar/pregenerated
      const source: CacheEntry['source'] = (!startYear && !endYear) ? 'trending'
        : DEFAULT_TOPICS.has(topic) ? 'sidebar'
        : 'user';

      return { key, topic, startYear, endYear, ttlSeconds: ttl, source };
    }).sort((a, b) => a.topic.localeCompare(b.topic));
  } catch { return []; }
}

export async function deleteCacheEntry(key: string): Promise<void> {
  if (!redis) return;
  // Safety: only allow deleting timeline keys
  if (!key.startsWith('timeline:')) return;
  try { await redis.del(key); }
  catch { /* non-critical */ }
}
