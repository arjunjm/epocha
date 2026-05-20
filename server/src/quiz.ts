import { generate } from './llm.js';
import type { TimelineData, QuizQuestion } from './types.js';

const QUIZ_PROMPT = `You are creating a multiple-choice quiz about a historical timeline.

Given the timeline data below, generate exactly 12 multiple-choice questions that test understanding of the events, people, dates, and significance.

Return ONLY a valid JSON array — no markdown, no preamble. Use this exact structure:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "explanation": "Brief explanation of why the correct answer is right."
  }
]

Rules:
- "correct" is the 0-based index of the correct option
- Questions should vary: dates, people, causes, consequences, significance
- All 4 options should be plausible but only one correct
- Keep questions concise and clear`;

export async function generateQuizQuestions(timeline: TimelineData): Promise<QuizQuestion[]> {
  const timelineSummary = {
    topic: timeline.topic,
    period: timeline.period,
    events: timeline.events.map(e => ({
      date: e.date,
      title: e.title,
      summary: e.summary,
      figures: e.figures,
      location: e.location,
    })),
  };

  try {
    const text = await generate(
      QUIZ_PROMPT,
      `Generate 12 quiz questions for this timeline:\n${JSON.stringify(timelineSummary, null, 2)}`
    );
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const jsonMatch = stripped.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const questions = JSON.parse(jsonMatch[0]) as QuizQuestion[];
    return Array.isArray(questions) ? questions.slice(0, 12) : [];
  } catch (err) {
    console.warn('[quiz] Failed to generate questions:', err);
    return [];
  }
}

export function pickRandomQuestions(questions: QuizQuestion[], count = 5): QuizQuestion[] {
  return [...questions].sort(() => Math.random() - 0.5).slice(0, count);
}
