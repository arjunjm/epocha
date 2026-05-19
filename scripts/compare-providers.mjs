/**
 * Side-by-side quality comparison: Anthropic claude-haiku-4-5 vs Azure OpenAI gpt-4o
 *
 * Run from server/ directory:
 *   node --experimental-global-webcrypto ../scripts/compare-providers.mjs
 *
 * Generates the same timeline with both providers and prints key metrics.
 */
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import Anthropic from '@anthropic-ai/sdk';
import { AzureOpenAI } from 'openai';

const KEY_VAULT_URL = 'https://kv-timelineapp-dev.vault.azure.net';

const SYSTEM_PROMPT = `You are an expert historian and researcher. Generate a comprehensive, educational timeline for the given topic and time period.

Return ONLY a valid JSON object — no markdown, no code blocks, no preamble. Use this exact structure:
{"topic":"...","period":"...","description":"...","events":[{"date":"...","sortYear":0,"title":"...","summary":"...","details":"...","significance":"...","figures":[],"location":"...","tags":[]}],"relatedTopics":[]}

Rules:
- Include 12-20 major events in chronological order (sorted by sortYear)
- sortYear: negative for BCE, positive for CE
- Details should be substantive, 3-5 paragraphs
- relatedTopics: 4-5 related topics
- Always return ONLY the JSON object`;

const TEST_TOPICS = [
  { topic: 'The French Revolution', start: '1789', end: '1799' },
  { topic: 'The Space Race', start: '1957', end: '1972' },
];

async function loadSecrets() {
  const credential = new DefaultAzureCredential();
  const kv = new SecretClient(KEY_VAULT_URL, credential);
  const [anthropicKey, azureEndpoint, azureKey, azureDeployment] = await Promise.all([
    kv.getSecret('anthropic-api-key').then(s => s.value ?? ''),
    kv.getSecret('azure-openai-endpoint').then(s => s.value ?? ''),
    kv.getSecret('azure-openai-key').then(s => s.value ?? ''),
    kv.getSecret('azure-openai-deployment').then(s => s.value ?? 'gpt-4o'),
  ]);
  return { anthropicKey, azureEndpoint, azureKey, azureDeployment };
}

async function generateAnthropic(anthropic, topic) {
  const start = Date.now();
  const stream = anthropic.messages.stream({
    model: 'claude-haiku-4-5',
    max_tokens: 8192,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Generate a detailed timeline for: "${topic.topic}"\nTime period: ${topic.start} to ${topic.end}\n\nReturn only the JSON object.` }],
  });
  let text = '';
  for await (const e of stream) {
    if (e.type === 'content_block_delta' && e.delta.type === 'text_delta') text += e.delta.text;
  }
  const usage = (await stream.finalMessage()).usage;
  return { text, ms: Date.now() - start, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens };
}

async function generateAzureOAI(azure, deployment, topic) {
  const start = Date.now();
  const stream = await azure.chat.completions.create({
    model: deployment,
    max_tokens: 8192,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Generate a detailed timeline for: "${topic.topic}"\nTime period: ${topic.start} to ${topic.end}\n\nReturn only the JSON object.` },
    ],
    stream: true,
    stream_options: { include_usage: true },
  });
  let text = '';
  let usage = { prompt_tokens: 0, completion_tokens: 0 };
  for await (const chunk of stream) {
    text += chunk.choices[0]?.delta?.content ?? '';
    if (chunk.usage) usage = chunk.usage;
  }
  return { text, ms: Date.now() - start, inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens };
}

function parseTimeline(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch { return null; }
}

function scoreTimeline(tl) {
  if (!tl) return { score: 0, issues: ['Parse failed'] };
  const issues = [];
  if (!tl.topic) issues.push('Missing topic');
  if (!tl.period) issues.push('Missing period');
  if (!tl.description) issues.push('Missing description');
  if (!Array.isArray(tl.events)) { issues.push('No events array'); return { score: 0, issues }; }
  if (tl.events.length < 10) issues.push(`Only ${tl.events.length} events (expected 12-20)`);
  const hasDetails = tl.events.filter(e => e.details?.length > 200).length;
  if (hasDetails < tl.events.length * 0.8) issues.push(`${tl.events.length - hasDetails} events have thin details`);
  const hasSortYear = tl.events.filter(e => typeof e.sortYear === 'number').length;
  if (hasSortYear < tl.events.length) issues.push(`${tl.events.length - hasSortYear} events missing sortYear`);
  const hasRelated = Array.isArray(tl.relatedTopics) && tl.relatedTopics.length >= 3;
  if (!hasRelated) issues.push('Missing or sparse relatedTopics');
  const avgDetailLen = tl.events.reduce((n, e) => n + (e.details?.length ?? 0), 0) / tl.events.length;
  const score = 100
    - issues.length * 10
    + Math.min(20, Math.round(avgDetailLen / 50));
  return { score: Math.max(0, score), issues, eventCount: tl.events.length, avgDetailLen: Math.round(avgDetailLen) };
}

function printResult(label, topic, result) {
  const tl = parseTimeline(result.text);
  const { score, issues, eventCount, avgDetailLen } = scoreTimeline(tl);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${label}  ·  ${topic.topic}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  ⏱  ${(result.ms / 1000).toFixed(1)}s   📥 ${result.inputTokens} in   📤 ${result.outputTokens} out`);
  console.log(`  📊 Score: ${score}/120   Events: ${eventCount ?? '?'}   Avg detail: ${avgDetailLen ?? '?'} chars`);
  if (issues.length) console.log(`  ⚠️  ${issues.join(' · ')}`);
  else console.log(`  ✓  No issues`);
  if (tl?.description) console.log(`  📝 "${tl.description.slice(0, 120)}…"`);
}

async function main() {
  console.log('Loading secrets…');
  const { anthropicKey, azureEndpoint, azureKey, azureDeployment } = await loadSecrets();

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const azure = new AzureOpenAI({ endpoint: azureEndpoint, apiKey: azureKey, apiVersion: '2024-10-21', deployment: azureDeployment });

  console.log(`\nProviders: Anthropic claude-haiku-4-5  vs  Azure OpenAI ${azureDeployment}`);
  console.log(`Topics: ${TEST_TOPICS.map(t => t.topic).join(', ')}\n`);

  for (const topic of TEST_TOPICS) {
    process.stdout.write(`Generating with Anthropic: ${topic.topic}… `);
    try {
      const aResult = await generateAnthropic(anthropic, topic);
      console.log(`done (${(aResult.ms/1000).toFixed(1)}s)`);
      printResult('ANTHROPIC  claude-haiku-4-5', topic, aResult);
    } catch (e) { console.log(`FAILED: ${e.message}`); }

    await new Promise(r => setTimeout(r, 2000));

    process.stdout.write(`Generating with Azure OAI: ${topic.topic}… `);
    try {
      const oResult = await generateAzureOAI(azure, azureDeployment, topic);
      console.log(`done (${(oResult.ms/1000).toFixed(1)}s)`);
      printResult(`AZURE OAI  ${azureDeployment}`, topic, oResult);
    } catch (e) { console.log(`FAILED: ${e.message}`); }

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('Done. Review the output above to compare quality.');
  console.log('To switch the app to Azure OpenAI, set LLM_PROVIDER=azure-openai');
  console.log('in the App Service config or kv-timelineapp-dev/llm-provider secret.');
}

main().catch(e => { console.error(e); process.exit(1); });
