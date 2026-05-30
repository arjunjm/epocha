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
import { EMBEDDINGS_KEY, generateEmbedding, findBestSemanticMatch } from './embeddings.js';

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
    if (raw) return JSON.parse(raw) as TimelineData;

    // Fallback: old entries were stored with empty years before year-extraction was added.
    // getTrendingTopics() now returns extracted years, so the client requests with those
    // years but the data lives at the empty-year key. Migrate lazily on first hit.
    if ((startYear || endYear) && redis) {
      const emptyKey = cacheKey(topic, '', '');
      if (emptyKey !== key) {
        const emptyRaw = await redis.get(emptyKey);
        if (emptyRaw) {
          void redis.setex(key, TTL_SECONDS, emptyRaw); // migrate to year-keyed entry
          return JSON.parse(emptyRaw) as TimelineData;
        }
      }
    }
    return null;
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
    // Store embedding for semantic search — fire-and-forget, non-critical
    if (redis) void storeTopicEmbedding(key, topic);
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
      .map(m => {
        try {
          const t = JSON.parse(m) as TrendingTopic;
          // Old entries (before year-extraction was added) have empty startYear/endYear.
          // Extract 4-digit years from the period string using the same logic as the Function.
          if (t && (!t.startYear || !t.endYear) && t.period) {
            const yearMatch = t.period.match(/(\d{4})/g);
            if (yearMatch && yearMatch.length >= 1) {
              if (!t.startYear) t.startYear = yearMatch[0]!;
              if (!t.endYear) t.endYear = yearMatch[yearMatch.length - 1]!;
            }
          }
          return t;
        } catch { return null; }
      })
      .filter((t): t is TrendingTopic => !!t && !!t.topic && !!t.startYear && !!t.endYear && !DEFAULT_TOPICS.has(t.topic))
      .slice(0, limit);
  } catch { return []; }
}

const SEARCH_KEY = 'epocha:popular-topics';
const TRENDING_KEY = 'epocha:trending-topics';
const TRENDING_MAX = 50;

// Sidebar default topics — excluded from trending display.
// Keep in sync with ALL_TOPICS in functions/src/topics.ts.
const DEFAULT_TOPICS = new Set([
  'Ancient Greece','The Roman Empire','Ancient Egypt','Mesopotamia & Early Civilization',
  'The Persian Empire','History of Western Philosophy','Eastern Philosophy','The Enlightenment',
  'Existentialism','History of Political Philosophy','History of Computing','The Space Race',
  'History of Physics from Newton to Quantum Mechanics','History of Evolutionary Biology',
  'History of Artificial Intelligence','History of Medicine','The French Revolution',
  'The American Revolution','The Russian Revolution','The Cold War',
  'The American Civil Rights Movement','Decolonization of Africa and Asia',
  'The Renaissance','History of Classical Music','History of Modern Art',
  'History of Cinema','History of Western Literature',
  'The Rise of Early Christianity','The Rise and Spread of Islam',
  'The Protestant Reformation','The History of Buddhism',
  'The Industrial Revolution','The Great Depression','History of Globalization',
  'The Silk Road Trade Routes','World War I','World War II',
  'The Crusades','The Napoleonic Wars','The Vietnam War',
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

function isValidQuizData(data: unknown): data is QuizQuestion[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  const first = data[0] as Record<string, unknown>;
  return typeof first === 'object' && first !== null &&
    typeof first['question'] === 'string' &&
    Array.isArray(first['options']);
}

export async function getCachedQuiz(
  topic: string, startYear: string, endYear: string
): Promise<QuizQuestion[] | null> {
  const key = `quiz:${cacheKey(topic, startYear, endYear)}`;
  try {
    const raw = redis ? await redis.get(key) : memoryCache.get(key);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isValidQuizData(parsed)) return parsed;
      // Corrupt entry — delete so the quiz endpoint regenerates it cleanly.
      console.warn(`[cache] Corrupt quiz data at ${key}, deleting`);
      void (redis ? redis.del(key) : memoryCache.delete(key));
    }

    // Fallback: quiz for old entries was stored under empty-year key — migrate lazily.
    if ((startYear || endYear) && redis) {
      const emptyKey = `quiz:${cacheKey(topic, '', '')}`;
      if (emptyKey !== key) {
        const emptyRaw = await redis.get(emptyKey);
        if (emptyRaw) {
          const emptyParsed = JSON.parse(emptyRaw) as unknown;
          if (isValidQuizData(emptyParsed)) {
            void redis.setex(key, TTL_SECONDS, emptyRaw); // migrate only if valid
            return emptyParsed;
          }
          // Corrupt empty-year quiz too — don't migrate garbage data
          console.warn(`[cache] Corrupt quiz data at empty-year key ${emptyKey}, skipping migration`);
        }
      }
    }
    return null;
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
const ADMIN_PENDING_KEY = 'epocha:admin:job-pending';
const ADMIN_TOTAL_KEY = 'epocha:admin:job-total';
const ADMIN_LOG_MAX = 500;

export async function getAdminLog(limit = 200): Promise<string[]> {
  if (!redis) return [];
  try { return await redis.lrange(ADMIN_LOG_KEY, -limit, -1); }
  catch { return []; }
}

export async function isAdminRunning(): Promise<boolean> {
  if (!redis) return false;
  try {
    const flag = await redis.get(ADMIN_RUNNING_KEY);
    if (flag !== '1') return false;
    // Stale guard: if the flag has been set for >15 minutes with no log entries,
    // the Azure Function was likely killed by the Consumption plan timeout.
    const [ttl, logLen] = await Promise.all([
      redis.ttl(ADMIN_RUNNING_KEY),
      redis.llen(ADMIN_LOG_KEY),
    ]);
    const ageSeconds = 3600 - ttl;
    if (ageSeconds > 900 && logLen === 0) {
      void redis.del(ADMIN_RUNNING_KEY); // auto-clear stale flag
      return false;
    }
    return true;
  }
  catch { return false; }
}

export async function clearAdminLog(): Promise<void> {
  if (!redis) return;
  try { await redis.del(ADMIN_LOG_KEY); }
  catch { /* non-critical */ }
}

export interface AdminProgress {
  total: number;
  pending: number;
  done: number;
}

export async function getAdminProgress(): Promise<AdminProgress> {
  if (!redis) return { total: 0, pending: 0, done: 0 };
  try {
    const [totalStr, pendingStr] = await Promise.all([
      redis.get(ADMIN_TOTAL_KEY),
      redis.get(ADMIN_PENDING_KEY),
    ]);
    const total = parseInt(totalStr ?? '0', 10) || 0;
    const pending = Math.max(0, parseInt(pendingStr ?? '0', 10) || 0);
    return { total, pending, done: total - pending };
  } catch { return { total: 0, pending: 0, done: 0 }; }
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

// ── Semantic topic matching ───────────────────────────────────────────────────

export async function storeTopicEmbedding(cacheKey: string, topicName: string): Promise<void> {
  if (!redis) return;
  try {
    const embedding = await generateEmbedding(topicName);
    if (!embedding) return;
    await redis.hset(EMBEDDINGS_KEY, cacheKey, JSON.stringify(embedding));
  } catch { /* non-critical */ }
}

/**
 * Semantic fallback for getCached — finds the closest matching cached timeline
 * by topic name embedding similarity. Returns null if no match exceeds threshold.
 */
export async function getSemanticallyCached(topic: string): Promise<TimelineData | null> {
  if (!redis) return null;
  try {
    const allEmbeddings = await redis.hgetall(EMBEDDINGS_KEY);
    if (!allEmbeddings || Object.keys(allEmbeddings).length === 0) return null;

    const match = await findBestSemanticMatch(topic, allEmbeddings);
    if (!match) return null;

    const raw = await redis.get(match.cacheKey);
    if (!raw) return null;

    console.log(`[cache] Semantic match: "${topic}" → "${match.cacheKey}" (score: ${match.score.toFixed(3)})`);
    return JSON.parse(raw) as TimelineData;
  } catch { return null; }
}

// ── Search analytics ──────────────────────────────────────────────────────────

const ANALYTICS_KEY = 'epocha:analytics:searches';
const ANALYTICS_MAX = 2000;

export interface SearchEvent {
  topic: string;
  userId?: string;
  cacheHit: boolean;
  publicBrowse: boolean;
  ts: number;
}

export interface AnalyticsSummary {
  totalSearches7d: number;
  searchesToday: number;
  cacheHitRate7d: number;
  topTopics: { topic: string; count: number }[];
  recentSearches: (SearchEvent & { time: string })[];
}

export async function logSearchEvent(event: SearchEvent): Promise<void> {
  if (!redis) return;
  try {
    await redis.zadd(ANALYTICS_KEY, event.ts, JSON.stringify(event));
    await redis.zremrangebyrank(ANALYTICS_KEY, 0, -(ANALYTICS_MAX + 1));
  } catch { /* non-critical */ }
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  if (!redis) return { totalSearches7d: 0, searchesToday: 0, cacheHitRate7d: 0, topTopics: [], recentSearches: [] };
  try {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [allEntries, recentEntries] = await Promise.all([
      redis.zrangebyscore(ANALYTICS_KEY, sevenDaysAgo, '+inf'),
      redis.zrevrange(ANALYTICS_KEY, 0, 24),
    ]);

    const events = allEntries
      .map(e => { try { return JSON.parse(e) as SearchEvent; } catch { return null; } })
      .filter((e): e is SearchEvent => !!e);

    const totalSearches7d = events.length;
    const searchesToday = events.filter(e => e.ts >= todayStart.getTime()).length;
    const cacheHits = events.filter(e => e.cacheHit).length;
    const cacheHitRate7d = totalSearches7d > 0 ? Math.round((cacheHits / totalSearches7d) * 100) : 0;

    const topicCounts: Record<string, number> = {};
    for (const e of events) topicCounts[e.topic] = (topicCounts[e.topic] ?? 0) + 1;
    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    const recentSearches = recentEntries
      .map(e => {
        try {
          const ev = JSON.parse(e) as SearchEvent;
          return { ...ev, time: new Date(ev.ts).toISOString() };
        } catch { return null; }
      })
      .filter((e): e is SearchEvent & { time: string } => !!e);

    return { totalSearches7d, searchesToday, cacheHitRate7d, topTopics, recentSearches };
  } catch { return { totalSearches7d: 0, searchesToday: 0, cacheHitRate7d: 0, topTopics: [], recentSearches: [] }; }
}
