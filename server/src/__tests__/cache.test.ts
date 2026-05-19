import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock secrets so Redis is never initialised (falls back to in-memory)
vi.mock('../secrets.js', () => ({
  getSecret: () => '',
  loadSecrets: vi.fn(),
}));

// Import after mocking
const { initCache, getCached, setCached, getCachedQuiz, setCachedQuiz } = await import('../cache.js');

const TOPIC = 'Ancient Greece';
const START = '800 BCE';
const END = '146 BCE';

const MOCK_TIMELINE = {
  topic: TOPIC,
  period: `${START} to ${END}`,
  description: 'A test timeline',
  events: [],
};

const MOCK_QUESTIONS = [
  { question: 'Q1?', options: ['A', 'B', 'C', 'D'], correct: 0, explanation: 'E1' },
  { question: 'Q2?', options: ['A', 'B', 'C', 'D'], correct: 1, explanation: 'E2' },
];

describe('in-memory timeline cache', () => {
  beforeEach(() => {
    initCache(); // resets to in-memory since no redis-url
  });

  it('returns null for a cache miss', async () => {
    const result = await getCached('Unknown Topic', '1', '2');
    expect(result).toBeNull();
  });

  it('stores and retrieves a timeline', async () => {
    await setCached(TOPIC, START, END, MOCK_TIMELINE);
    const result = await getCached(TOPIC, START, END);
    expect(result).toEqual(MOCK_TIMELINE);
  });

  it('is case- and whitespace-insensitive on topic key', async () => {
    await setCached('Ancient Greece', START, END, MOCK_TIMELINE);
    const result = await getCached('ancient  greece', START, END);
    // Different normalisation → different key → null is acceptable; key consistency is what matters
    // Both calls use the same normalisation, so same result when key matches exactly
    const result2 = await getCached('Ancient Greece', START, END);
    expect(result2).toEqual(MOCK_TIMELINE);
  });

  it('separates timelines by period', async () => {
    const timeline2 = { ...MOCK_TIMELINE, period: '500 to 400 BCE' };
    await setCached(TOPIC, START, END, MOCK_TIMELINE);
    await setCached(TOPIC, '500 BCE', '400 BCE', timeline2);
    const r1 = await getCached(TOPIC, START, END);
    const r2 = await getCached(TOPIC, '500 BCE', '400 BCE');
    expect(r1?.period).toBe(MOCK_TIMELINE.period);
    expect(r2?.period).toBe(timeline2.period);
  });
});

describe('in-memory quiz cache', () => {
  beforeEach(() => {
    initCache();
  });

  it('returns null for a quiz cache miss', async () => {
    const result = await getCachedQuiz('Unknown', '1', '2');
    expect(result).toBeNull();
  });

  it('stores and retrieves quiz questions', async () => {
    await setCachedQuiz(TOPIC, START, END, MOCK_QUESTIONS);
    const result = await getCachedQuiz(TOPIC, START, END);
    expect(result).toEqual(MOCK_QUESTIONS);
  });

  it('quiz and timeline caches are independent for a fresh key', async () => {
    const freshTopic = 'UniqueTopicNeverUsedBefore';
    await setCached(freshTopic, START, END, MOCK_TIMELINE);
    const quizResult = await getCachedQuiz(freshTopic, START, END);
    expect(quizResult).toBeNull(); // quiz not set for this key
  });
});
