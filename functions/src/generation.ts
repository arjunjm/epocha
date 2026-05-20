/**
 * Shared LLM generation logic — used by both the producer (pregenerateTrigger)
 * and the consumer (generateSingle).
 */
import Anthropic from '@anthropic-ai/sdk';
import { AzureOpenAI } from 'openai';
import { getSecret } from './secrets.js';

export interface TopicJob {
  topic: string;
  startYear: string;
  endYear: string;
}

export const TIMELINE_TTL = 60 * 60 * 24 * 7; // 7 days

export function cacheKey(topic: string, startYear: string, endYear: string): string {
  return `timeline:${topic.toLowerCase().trim().replace(/\s+/g, '-')}:${startYear}:${endYear}`;
}

export function getProvider(): 'anthropic' | 'azure-openai' {
  return (getSecret('llm-provider') || 'anthropic').toLowerCase() === 'azure-openai'
    ? 'azure-openai' : 'anthropic';
}

// ── LLM clients (module-level singletons, reset between cold starts) ────────

let anthropic: Anthropic | null = null;
let azure: AzureOpenAI | null = null;

export function resetClients() {
  anthropic = null;
  azure = null;
}

function getAnthropicClient() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: getSecret('anthropic-api-key') });
  return anthropic;
}

function getAzureClient() {
  if (!azure) azure = new AzureOpenAI({
    endpoint: getSecret('azure-openai-endpoint'),
    apiKey: getSecret('azure-openai-key'),
    apiVersion: '2024-10-21',
    deployment: getSecret('azure-openai-deployment') || 'gpt-4o',
  });
  return azure;
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert historian and researcher. Generate a comprehensive, educational timeline for the given topic and time period.

Return ONLY a valid JSON object — no markdown, no code blocks, no preamble. Use this exact structure:

{
  "topic": "The topic name",
  "period": "Start period to End period",
  "description": "2-3 sentence overview of this topic and its historical significance",
  "events": [
    {
      "date": "Year or date (e.g., '470 BCE', '1687 CE', 'circa 1200', '1789')",
      "sortYear": -470,
      "title": "Event title (concise, 3-8 words)",
      "summary": "1-2 sentence overview of the event",
      "details": "3-5 paragraphs with rich historical context, causes, consequences, and connections to other events",
      "significance": "Why this event was historically significant — its lasting impact",
      "figures": ["Key Person 1", "Key Person 2"],
      "location": "Geographic location",
      "tags": ["thematic-tag-1", "thematic-tag-2"]
    }
  ],
  "relatedTopics": ["Related Topic 1", "Related Topic 2", "Related Topic 3"]
}

Rules:
- Include 12-20 major events in chronological order (sorted by sortYear)
- sortYear must be a number: negative for BCE, positive for CE
- Details should be substantive, 3-5 paragraphs of educational content
- Tags should use kebab-case and be thematic
- Always return ONLY the JSON object`;

const QUIZ_PROMPT = `You are creating a multiple-choice quiz about a historical timeline.
Generate exactly 12 multiple-choice questions. Return ONLY a valid JSON array:
[{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}]`;

export const TRENDING_EVENTS_PROMPT = (date: string) => `You are curating current events for an educational historical timeline app.

Today's date: ${date}

Identify the 10 most significant contemporary events or ongoing situations from the past 3 years that are widely discussed worldwide right now. Focus on:
- Active geopolitical conflicts or developments
- Major political transitions or elections
- Significant technological or economic shifts (AI, energy, markets)
- Social movements with broad global impact
- Major humanitarian or environmental crises

Return ONLY a JSON array of 10 topic name strings, e.g.:
["The Russia-Ukraine War", "Rise of Generative AI", "2024 US Presidential Election"]

No years, no descriptions — just the 10 topic names.`;

export const AI_SUGGEST_PROMPT = `You are curating topics for an educational historical timeline app.

Suggest 15 topics that would make for compelling, educational timelines. Mix:
- Major world events and wars not covered by basic history curricula
- Rise and fall of civilisations or empires
- Scientific or technological revolutions
- Social and political movements
- Contemporary history (last 50 years) that already has historical perspective
- Underrepresented regions or cultures

Return ONLY a JSON array of topic name strings, e.g.:
["The Mongol Empire", "The Cold War Space Race", "The Green Revolution"]

No years, no descriptions — just topic names. 15 topics.`;

// ── Timeline generation ───────────────────────────────────────────────────────

export async function generateTimeline(job: TopicJob): Promise<string | null> {
  const userMessage = job.startYear && job.endYear
    ? `Generate a detailed timeline for: "${job.topic}"\nTime period: ${job.startYear} to ${job.endYear}\n\nReturn only the JSON object.`
    : `Generate a detailed timeline for: "${job.topic}"\nChoose the most historically significant and complete time period. Return only the JSON object.`;

  let fullText = '';
  const provider = getProvider();

  if (provider === 'azure-openai') {
    const stream = await getAzureClient().chat.completions.create({
      model: getSecret('azure-openai-deployment') || 'gpt-4o',
      max_tokens: 8192,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMessage }],
      stream: true,
    });
    for await (const chunk of stream) fullText += chunk.choices[0]?.delta?.content ?? '';
  } else {
    const stream = getAnthropicClient().messages.stream({
      model: 'claude-haiku-4-5', max_tokens: 8192,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta')
        fullText += event.delta.text;
    }
  }

  const stripped = fullText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const t = JSON.parse(match[0]);
    if (!Array.isArray(t.events) || t.events.length < 5) return null;
    t.events.sort((a: { sortYear?: number }, b: { sortYear?: number }) => (a.sortYear ?? 0) - (b.sortYear ?? 0));
    return JSON.stringify(t);
  } catch { return null; }
}

export async function generateQuiz(timelineJson: string): Promise<string | null> {
  const t = JSON.parse(timelineJson);
  const summary = {
    topic: t.topic, period: t.period,
    events: t.events?.map((e: { date: string; title: string; summary: string; figures?: string[]; location?: string }) => ({
      date: e.date, title: e.title, summary: e.summary, figures: e.figures, location: e.location,
    })),
  };
  const userMessage = `Generate 12 quiz questions for:\n${JSON.stringify(summary)}`;
  let text = '';
  const provider = getProvider();

  if (provider === 'azure-openai') {
    const res = await getAzureClient().chat.completions.create({
      model: getSecret('azure-openai-deployment') || 'gpt-4o', max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: QUIZ_PROMPT }, { role: 'user', content: userMessage }],
    });
    text = res.choices[0]?.message?.content ?? '';
  } else {
    const res = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-5', max_tokens: 4096,
      system: [{ type: 'text', text: QUIZ_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });
    text = res.content[0]?.type === 'text' ? res.content[0].text : '';
  }

  const match = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const q = JSON.parse(match[0]);
    return Array.isArray(q) && q.length > 0 ? JSON.stringify(q) : null;
  } catch { return null; }
}
