/**
 * One-shot cache seeder — generates and caches timelines for all
 * built-in topics using the real Redis + Anthropic credentials from Key Vault.
 *
 * Run: node scripts/seed-cache.mjs
 * Requires: az login (to read Key Vault secrets)
 */
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import Anthropic from '@anthropic-ai/sdk';
import Redis from 'ioredis';

const KEY_VAULT_URL = 'https://kv-timelineapp-dev.vault.azure.net';
const TTL = 60 * 60 * 24 * 7; // 7 days

// All taxonomy topics (mirrors functions/src/topics.ts)
const ALL_TOPICS = [
  { topic: 'Ancient Greece', start: '800 BCE', end: '146 BCE' },
  { topic: 'The Roman Empire', start: '27 BCE', end: '476 CE' },
  { topic: 'Ancient Egypt', start: '3100 BCE', end: '30 BCE' },
  { topic: 'Mesopotamia & Early Civilization', start: '3500 BCE', end: '500 BCE' },
  { topic: 'The Persian Empire', start: '550 BCE', end: '330 BCE' },
  { topic: 'History of Western Philosophy', start: '600 BCE', end: '400 CE' },
  { topic: 'Eastern Philosophy', start: '800 BCE', end: '200 CE' },
  { topic: 'The Renaissance', start: '1300', end: '1600' },
  { topic: 'The Scientific Revolution', start: '1543', end: '1687' },
  { topic: 'The Industrial Revolution', start: '1760', end: '1840' },
  { topic: 'History of Computing', start: '1930', end: '2000' },
  { topic: 'World War I', start: '1914', end: '1918' },
  { topic: 'World War II', start: '1939', end: '1945' },
  { topic: 'The Cold War', start: '1947', end: '1991' },
  { topic: 'The American Civil War', start: '1861', end: '1865' },
  { topic: 'The Roman Republic', start: '509 BCE', end: '27 BCE' },
  { topic: 'The Ottoman Empire', start: '1299', end: '1922' },
  { topic: 'The Mongol Empire', start: '1206', end: '1368' },
  { topic: 'The British Empire', start: '1600', end: '1997' },
  { topic: 'The Age of Exploration', start: '1400', end: '1600' },
  { topic: 'The Space Race', start: '1957', end: '1972' },
  { topic: 'The French Revolution', start: '1789', end: '1799' },
  { topic: 'The American Revolution', start: '1765', end: '1783' },
  { topic: 'The Silk Road', start: '130 BCE', end: '1450 CE' },
  { topic: 'History of Medicine', start: '400 BCE', end: '1900 CE' },
  { topic: 'The Byzantine Empire', start: '330', end: '1453' },
  { topic: 'The Vikings', start: '793', end: '1100' },
  { topic: 'The Crusades', start: '1096', end: '1291' },
  { topic: 'The Renaissance Art Movement', start: '1400', end: '1600' },
  { topic: 'History of Music', start: '1600', end: '2000' },
  { topic: 'The Great Depression', start: '1929', end: '1939' },
  { topic: 'The Civil Rights Movement', start: '1954', end: '1968' },
  { topic: 'The Meiji Restoration', start: '1868', end: '1912' },
  { topic: 'The Mughal Empire', start: '1526', end: '1857' },
  { topic: 'History of the Internet', start: '1969', end: '2010' },
  { topic: 'The Cold War Space Programs', start: '1957', end: '1991' },
  { topic: 'History of Democracy', start: '508 BCE', end: '1900 CE' },
  { topic: 'The Napoleonic Wars', start: '1803', end: '1815' },
  { topic: 'History of Climate and Environment', start: '1800', end: '2020' },
  { topic: 'The Ming Dynasty', start: '1368', end: '1644' },
];

function cacheKey(topic, start, end) {
  return `timeline:${topic.toLowerCase().trim().replace(/\s+/g, '-')}:${start}:${end}`;
}

const SYSTEM_PROMPT = `You are an expert historian and researcher. Generate a comprehensive, educational timeline for the given topic and time period.

Return ONLY a valid JSON object — no markdown, no code blocks, no preamble. Use this exact structure:
{"topic":"...","period":"...","description":"...","events":[{"date":"...","sortYear":0,"title":"...","summary":"...","details":"...","significance":"...","figures":[],"location":"...","tags":[]}],"relatedTopics":[]}

Rules:
- Include 12-20 major events in chronological order (sorted by sortYear)
- sortYear: negative for BCE, positive for CE
- Details should be substantive, 3-5 paragraphs
- Always return ONLY the JSON object`;

async function generate(anthropic, topic) {
  const stream = anthropic.messages.stream({
    model: 'claude-haiku-4-5',
    max_tokens: 8192,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Generate a detailed timeline for: "${topic.topic}"\nTime period: ${topic.start} to ${topic.end}\n\nReturn only the JSON object.`,
    }],
  });

  let fullText = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
    }
  }

  const stripped = fullText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    if (parsed.events) parsed.events.sort((a, b) => (a.sortYear ?? 0) - (b.sortYear ?? 0));
    return JSON.stringify(parsed);
  } catch { return null; }
}

async function main() {
  console.log('Loading secrets from Key Vault...');
  const credential = new DefaultAzureCredential();
  const kv = new SecretClient(KEY_VAULT_URL, credential);

  const [redisUrl, anthropicKey] = await Promise.all([
    kv.getSecret('redis-url').then(s => s.value),
    kv.getSecret('anthropic-api-key').then(s => s.value),
  ]);

  if (!redisUrl || !anthropicKey) { console.error('Missing secrets'); process.exit(1); }

  const redis = new Redis(redisUrl, {
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    connectTimeout: 5000,
    maxRetriesPerRequest: 2,
  });
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  console.log(`Starting seed for ${ALL_TOPICS.length} topics...\n`);
  let generated = 0, skipped = 0, failed = 0;

  for (const topic of ALL_TOPICS) {
    const key = cacheKey(topic.topic, topic.start, topic.end);
    const ttl = await redis.ttl(key);

    if (ttl > 86400) {
      console.log(`  SKIP  ${topic.topic} (fresh, TTL ${Math.round(ttl / 3600)}h)`);
      skipped++;
      continue;
    }

    process.stdout.write(`  GEN   ${topic.topic}...`);
    try {
      const result = await generate(anthropic, topic);
      if (result) {
        await redis.setex(key, TTL, result);
        generated++;
        console.log(' ✓');
      } else {
        failed++;
        console.log(' ✗ (no JSON)');
      }
    } catch (err) {
      failed++;
      console.log(` ✗ (${err.message?.slice(0, 60)})`);
    }

    await new Promise(r => setTimeout(r, 2000)); // rate limit pause
  }

  redis.disconnect();
  console.log(`\nDone — generated: ${generated}, skipped: ${skipped}, failed: ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
