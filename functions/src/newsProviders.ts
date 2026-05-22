/**
 * News provider modules for trending topic sourcing.
 *
 * Each provider fetches current events and returns up to 10 topic names
 * suitable for timeline generation. Guardian and NewsAPI fetch real headlines
 * then use the LLM to distil them into timeline-worthy topic names.
 *
 * Key Vault secrets required:
 *   guardian-api-key  — Guardian Open Platform (free, 500 req/day)
 *   newsapi-key       — NewsAPI (free tier, 100 req/day)
 */
import Anthropic from '@anthropic-ai/sdk';
import { AzureOpenAI } from 'openai';
import { getSecret } from './secrets.js';
import { getProvider } from './generation.js';

export type NewsProvider = 'llm' | 'guardian' | 'newsapi';

export const NEWS_PROVIDER_LABELS: Record<NewsProvider, string> = {
  llm:      'LLM (GPT-4o / Haiku)',
  guardian: 'The Guardian',
  newsapi:  'NewsAPI',
};

let _anthropic: Anthropic | null = null;
let _azure: AzureOpenAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: getSecret('anthropic-api-key') });
  return _anthropic;
}

function getAzureClient(): AzureOpenAI {
  if (!_azure) {
    _azure = new AzureOpenAI({
      endpoint: getSecret('azure-openai-endpoint'),
      apiKey: getSecret('azure-openai-key'),
      apiVersion: '2024-10-21',
      deployment: getSecret('azure-openai-deployment') || 'gpt-4o',
    });
  }
  return _azure;
}

export function resetNewsClients(): void {
  _anthropic = null;
  _azure = null;
}

// ── LLM provider (existing behaviour) ────────────────────────────────────────

const LLM_PROMPT = (date: string) =>
  `You are curating current events for an educational historical timeline app.

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

async function fetchFromLlm(date: string, log: (m: string) => void): Promise<string[]> {
  try {
    let text = '';
    if (getProvider() === 'azure-openai') {
      const res = await getAzureClient().chat.completions.create({
        model: getSecret('azure-openai-deployment') || 'gpt-4o',
        max_tokens: 512,
        messages: [{ role: 'user', content: LLM_PROMPT(date) }],
      });
      text = res.choices[0]?.message?.content ?? '';
    } else {
      const res = await getAnthropicClient().messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: LLM_PROMPT(date) }],
      });
      text = res.content[0]?.type === 'text' ? res.content[0].text : '';
    }
    return parseTopicArray(text, log, 'llm');
  } catch (err) {
    log(`[news:llm] Failed: ${err}`);
    return [];
  }
}

// ── The Guardian ──────────────────────────────────────────────────────────────

async function fetchFromGuardian(date: string, log: (m: string) => void): Promise<string[]> {
  const key = getSecret('guardian-api-key');
  if (!key) throw new Error('guardian-api-key not set in Key Vault');

  const url = new URL('https://content.guardianapis.com/search');
  url.searchParams.set('api-key', key);
  url.searchParams.set('order-by', 'newest');
  url.searchParams.set('page-size', '20');
  url.searchParams.set('show-fields', 'headline');
  url.searchParams.set('section', 'world|technology|environment|politics|science');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Guardian API error: ${res.status} ${res.statusText}`);

  const data = await res.json() as { response: { results: { webTitle: string; fields?: { headline?: string } }[] } };
  const headlines = data.response.results
    .map(r => r.fields?.headline ?? r.webTitle)
    .filter(Boolean);

  log(`[news:guardian] Fetched ${headlines.length} headlines`);
  return distilHeadlines(headlines, date, log, 'guardian');
}

// ── NewsAPI ───────────────────────────────────────────────────────────────────

async function fetchFromNewsApi(date: string, log: (m: string) => void): Promise<string[]> {
  const key = getSecret('newsapi-key');
  if (!key) throw new Error('newsapi-key not set in Key Vault');

  const url = new URL('https://newsapi.org/v2/top-headlines');
  url.searchParams.set('apiKey', key);
  url.searchParams.set('pageSize', '20');
  url.searchParams.set('language', 'en');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`NewsAPI error: ${res.status} ${res.statusText}`);

  const data = await res.json() as { articles: { title: string; description?: string }[] };
  const headlines = data.articles
    .map(a => a.title)
    .filter((t): t is string => !!t && t !== '[Removed]');

  log(`[news:newsapi] Fetched ${headlines.length} headlines`);
  return distilHeadlines(headlines, date, log, 'newsapi');
}

// ── LLM distillation (shared by Guardian + NewsAPI) ───────────────────────────

async function distilHeadlines(
  headlines: string[],
  date: string,
  log: (m: string) => void,
  source: string,
): Promise<string[]> {
  const prompt = `Today is ${date}. Given these current news headlines, identify 10 distinct topics that would make compelling educational historical timelines. Group related headlines into single topics. Use concise, timeline-style names (e.g. "The Russia-Ukraine War", "Rise of Generative AI") — not raw headline text.

Headlines:
${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Return ONLY a JSON array of exactly 10 topic name strings. No extra text.`;

  try {
    let text = '';
    if (getProvider() === 'azure-openai') {
      const res = await getAzureClient().chat.completions.create({
        model: getSecret('azure-openai-deployment') || 'gpt-4o',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      });
      text = res.choices[0]?.message?.content ?? '';
    } else {
      const res = await getAnthropicClient().messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      });
      text = res.content[0]?.type === 'text' ? res.content[0].text : '';
    }
    return parseTopicArray(text, log, source);
  } catch (err) {
    log(`[news:${source}] Distillation failed: ${err}`);
    return [];
  }
}

function parseTopicArray(text: string, log: (m: string) => void, source: string): string[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) { log(`[news:${source}] No JSON array found in response`); return []; }
  try {
    const topics = (JSON.parse(match[0]) as unknown[])
      .filter((t): t is string => typeof t === 'string' && !!t.trim())
      .map(t => t.trim())
      .slice(0, 10);
    log(`[news:${source}] Got ${topics.length} topics`);
    return topics;
  } catch {
    log(`[news:${source}] Failed to parse topic array`);
    return [];
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function fetchTrendingTopics(
  provider: NewsProvider,
  date: string,
  log: (m: string) => void,
): Promise<string[]> {
  log(`[news] Using provider: ${NEWS_PROVIDER_LABELS[provider]}`);
  switch (provider) {
    case 'guardian': return fetchFromGuardian(date, log);
    case 'newsapi':  return fetchFromNewsApi(date, log);
    default:         return fetchFromLlm(date, log);
  }
}
