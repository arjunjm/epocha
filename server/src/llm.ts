/**
 * LLM provider abstraction.
 *
 * Set LLM_PROVIDER=azure-openai in environment (or Key Vault) to use
 * Azure OpenAI instead of the default Anthropic.  Falls back to Anthropic
 * when the env var is absent or set to "anthropic".
 *
 * Azure OpenAI secrets needed in Key Vault:
 *   azure-openai-endpoint   — e.g. https://oai-epocha-dev.openai.azure.com/
 *   azure-openai-key        — API key
 *   azure-openai-deployment — deployment name, e.g. gpt-4o
 */
import Anthropic from '@anthropic-ai/sdk';
import { AzureOpenAI } from 'openai';
import { getSecret } from './secrets.js';

export type Provider = 'anthropic' | 'azure-openai';

export function getProvider(): Provider {
  const p = (getSecret('llm-provider') || process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
  return p === 'azure-openai' ? 'azure-openai' : 'anthropic';
}

// ── Shared types ───────────────────────────────────────────────────────────

export interface StreamCallbacks {
  onStatus?: (message: string) => void;
  onMeta?: (topic: string, period: string, description: string) => void;
}

export interface GenerateResult {
  text: string;
}

// ── Anthropic client ───────────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: getSecret('anthropic-api-key') || undefined });
  }
  return anthropicClient;
}

// ── Azure OpenAI client ────────────────────────────────────────────────────

let azureClient: AzureOpenAI | null = null;
function getAzureClient(): AzureOpenAI {
  if (!azureClient) {
    azureClient = new AzureOpenAI({
      endpoint: getSecret('azure-openai-endpoint'),
      apiKey: getSecret('azure-openai-key'),
      apiVersion: '2024-10-21',
      deployment: getSecret('azure-openai-deployment') || 'gpt-4o',
    });
  }
  return azureClient;
}

// ── Unified streaming generate ─────────────────────────────────────────────

const STATUS_MESSAGES = [
  'Analyzing historical sources…',
  'Identifying key events and turning points…',
  'Researching figures and their contributions…',
  'Compiling chronological narrative…',
  'Finalizing timeline…',
];

export async function streamGenerate(
  systemPrompt: string,
  userMessage: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<string> {
  const provider = getProvider();
  console.log(`[llm] Provider: ${provider}`);

  if (provider === 'azure-openai') {
    return streamAzureOpenAI(systemPrompt, userMessage, callbacks, signal);
  }
  return streamAnthropic(systemPrompt, userMessage, callbacks, signal);
}

async function streamAnthropic(
  systemPrompt: string,
  userMessage: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<string> {
  const stream = getAnthropicClient().messages.stream({
    model: 'claude-haiku-4-5',
    max_tokens: 8192,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  }, { signal });

  let fullText = '';
  let statusPhase = 0;
  let metaSent = false;

  for await (const event of stream) {
    if (event.type === 'content_block_start' && event.content_block.type === 'text') {
      callbacks.onStatus?.(STATUS_MESSAGES[statusPhase % STATUS_MESSAGES.length]!);
      statusPhase++;
    } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
      if (fullText.length % 1000 < 20 && statusPhase < STATUS_MESSAGES.length) {
        callbacks.onStatus?.(STATUS_MESSAGES[statusPhase % STATUS_MESSAGES.length]!);
        statusPhase++;
      }
      if (!metaSent) metaSent = tryEmitMeta(fullText, callbacks);
    }
  }
  return fullText;
}

async function streamAzureOpenAI(
  systemPrompt: string,
  userMessage: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<string> {
  const deployment = getSecret('azure-openai-deployment') || 'gpt-4o';
  const stream = await getAzureClient().chat.completions.create({
    model: deployment,
    max_tokens: 8192,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    stream: true,
  }, { signal });

  let fullText = '';
  let statusPhase = 0;
  let metaSent = false;

  callbacks.onStatus?.(STATUS_MESSAGES[0]!);

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (delta) {
      fullText += delta;
      if (fullText.length % 800 < delta.length && statusPhase < STATUS_MESSAGES.length - 1) {
        statusPhase++;
        callbacks.onStatus?.(STATUS_MESSAGES[statusPhase]!);
      }
      if (!metaSent) metaSent = tryEmitMeta(fullText, callbacks);
    }
  }
  return fullText;
}

// Emit topic/period/description as soon as they appear in the partial JSON
function tryEmitMeta(text: string, callbacks: StreamCallbacks): boolean {
  const eventsIdx = text.indexOf('"events":[');
  if (eventsIdx <= 0) return false;
  try {
    const metaStr = text.slice(0, eventsIdx) + '"events":[]}';
    const meta = JSON.parse(metaStr) as { topic?: string; period?: string; description?: string };
    if (meta.topic && meta.period) {
      callbacks.onMeta?.(meta.topic, meta.period, meta.description ?? '');
      return true;
    }
  } catch { /* partial JSON — retry next chunk */ }
  return false;
}
