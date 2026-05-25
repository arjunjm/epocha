import { describe, it, expect } from 'vitest';

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

describe('Quiz endpoint with trending topics', () => {
  it('retrieves trending topics and verifies quiz can be requested', async () => {
    // Fetch trending topics
    const trendinRes = await fetch(`${API_BASE}/api/timeline/trending`);
    expect(trendinRes.status).toBe(200);

    const trendinData = await trendinRes.json() as Array<{
      topic: string;
      startYear: string;
      endYear: string;
      period: string;
    }>;

    expect(trendinData.length).toBeGreaterThan(0);

    // For each trending topic, verify quiz endpoint works
    for (const topic of trendinData.slice(0, 3)) {
      // Verify required fields exist and are not empty
      expect(topic.topic).toBeTruthy();
      expect(topic.startYear).toBeTruthy();
      expect(topic.endYear).toBeTruthy();

      // Attempt to fetch quiz questions
      const quizParams = new URLSearchParams({
        topic: topic.topic,
        startYear: topic.startYear,
        endYear: topic.endYear,
      });

      const quizRes = await fetch(`${API_BASE}/api/quiz?${quizParams}`);

      // Should not get "Missing required params" error
      expect(quizRes.status).not.toBe(400);

      if (quizRes.status === 200) {
        const quizData = await quizRes.json() as { questions: unknown[] };
        expect(Array.isArray(quizData.questions)).toBe(true);
      } else if (quizRes.status === 404) {
        // Timeline not cached yet, which is acceptable
        const errorData = await quizRes.json() as { error?: string };
        expect(errorData.error).not.toContain('Missing required params');
      }
    }
  }, 30000);

  it('sidebar topics have valid years for quiz', async () => {
    // Import sidebar topics
    const { TOPIC_TAXONOMY } = await import('../../client/src/data/topics');

    // Get all sidebar topics
    const sidebarTopics = TOPIC_TAXONOMY.flatMap(cat => cat.items).slice(0, 5);

    for (const topic of sidebarTopics) {
      expect(topic.start).toBeTruthy();
      expect(topic.end).toBeTruthy();
      // Years should be non-empty strings
      expect(typeof topic.start).toBe('string');
      expect(typeof topic.end).toBe('string');
    }
  });
});
