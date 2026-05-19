import { describe, it, expect } from 'vitest';
import { pickRandomQuestions } from '../quiz.js';
import type { QuizQuestion } from '../types.js';

const makeQuestions = (n: number): QuizQuestion[] =>
  Array.from({ length: n }, (_, i) => ({
    question: `Question ${i + 1}?`,
    options: ['A', 'B', 'C', 'D'],
    correct: 0,
    explanation: `Explanation ${i + 1}`,
  }));

describe('pickRandomQuestions', () => {
  it('returns the requested count when enough questions exist', () => {
    const qs = makeQuestions(12);
    expect(pickRandomQuestions(qs, 5)).toHaveLength(5);
  });

  it('returns all questions when fewer than requested', () => {
    const qs = makeQuestions(3);
    expect(pickRandomQuestions(qs, 5)).toHaveLength(3);
  });

  it('returns empty array for empty input', () => {
    expect(pickRandomQuestions([], 5)).toHaveLength(0);
  });

  it('returns no duplicate questions', () => {
    const qs = makeQuestions(12);
    const picked = pickRandomQuestions(qs, 5);
    const texts = picked.map(q => q.question);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('defaults to 5 questions', () => {
    const qs = makeQuestions(12);
    expect(pickRandomQuestions(qs)).toHaveLength(5);
  });

  it('does not mutate the original array', () => {
    const qs = makeQuestions(12);
    const original = [...qs];
    pickRandomQuestions(qs, 5);
    expect(qs).toEqual(original);
  });

  it('returns results in randomised order over many runs', () => {
    const qs = makeQuestions(10);
    const orders = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const picked = pickRandomQuestions(qs, 5);
      orders.add(picked.map(q => q.question).join(','));
    }
    // With 10 questions pick 5, probability of same order 20 times is astronomically low
    expect(orders.size).toBeGreaterThan(1);
  });
});
