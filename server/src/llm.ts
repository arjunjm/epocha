/**
 * LLM provider abstraction — routes to Anthropic or Azure OpenAI.
 *
 * Set llm-provider secret (Key Vault) or LLM_PROVIDER env var to
 * 'azure-openai' to switch. Defaults to 'anthropic'.
 *
 * Azure OpenAI secrets required in Key Vault:
 *   azure-openai-endpoint    e.g. https://oai-epocha-dev.openai.azure.com/
 *   azure-openai-key         API key
 *   azure-openai-deployment  deployment name, e.g. gpt-4o
 */
import Anthropic from '@anthropic-ai/sdk';
import { AzureOpenAI } from 'openai';
import { getSecret } from './secrets.js';

export type Provider = 'anthropic' | 'azure-openai';

export function getProvider(): Provider {
  const p = (getSecret('llm-provider') ?? process.env.LLM_PROVIDER ?? 'anthropic').toLowerCase();
  return p === 'azure-openai' ? 'azure-openai' : 'anthropic';
}

export interface StreamCallbacks {
  onStatus?: (message: string) => void;
  onMeta?: (topic: string, period: string, description: string) => void;
  onEvent?: (event: Record<string, unknown>) => void;
}

// ── Clients ────────────────────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: getSecret('anthropic-api-key') || undefined });
  }
  return anthropicClient;
}

let azureClient: AzureOpenAI | null = null;
function getAzureClient(): AzureOpenAI {
  if (!azureClient) {
    azureClient = new AzureOpenAI({
      endpoint: getSecret('azure-openai-endpoint') ?? '',
      apiKey: getSecret('azure-openai-key') ?? '',
      apiVersion: '2024-10-21',
      deployment: getSecret('azure-openai-deployment') ?? 'gpt-4o',
    });
  }
  return azureClient;
}

// ── Streaming generate (timeline) ─────────────────────────────────────────

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
  return provider === 'azure-openai'
    ? streamAzure(systemPrompt, userMessage, callbacks, signal)
    : streamAnthropic(systemPrompt, userMessage, callbacks, signal);
}

async function streamAnthropic(
  systemPrompt: string,
  userMessage: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<string> {
  const stream = getAnthropicClient().messages.stream({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  }, { signal });

  let fullText = '';
  let statusPhase = 0;
  let metaSent = false;
  let eventsEmitted = 0;

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
      eventsEmitted = tryEmitEvents(fullText, eventsEmitted, callbacks);
    }
  }
  return fullText;
}

async function streamAzure(
  systemPrompt: string,
  userMessage: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<string> {
  const deployment = getSecret('azure-openai-deployment') ?? 'gpt-4o';
  const stream = await getAzureClient().chat.completions.create({
    model: deployment,
    max_tokens: 4096,
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
  let eventsEmitted = 0;

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
      eventsEmitted = tryEmitEvents(fullText, eventsEmitted, callbacks);
    }
  }
  return fullText;
}

// ── Non-streaming generate (quiz) ──────────────────────────────────────────

export async function generate(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const provider = getProvider();
  if (provider === 'azure-openai') {
    const deployment = getSecret('azure-openai-deployment') ?? 'gpt-4o';
    const completion = await getAzureClient().chat.completions.create({
      model: deployment,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });
    return completion.choices[0]?.message?.content ?? '';
  }
  const response = await getAnthropicClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  });
  return response.content[0]?.type === 'text' ? response.content[0].text : '';
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Emit completed event objects as they appear in the partial JSON stream
function tryEmitEvents(text: string, emittedCount: number, callbacks: StreamCallbacks): number {
  if (!callbacks.onEvent) return emittedCount;
  const arrayStart = text.indexOf('"events":[');
  if (arrayStart < 0) return emittedCount;

  let count = 0;
  let pos = arrayStart + '"events":['.length;
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escaping = false;

  while (pos < text.length) {
    const ch = text[pos];
    if (inString) {
      if (escaping) { escaping = false; }
      else if (ch === '\\') { escaping = true; }
      else if (ch === '"') { inString = false; }
    } else {
      if (ch === '"') { inString = true; }
      else if (ch === '{') { if (depth === 0) objStart = pos; depth++; }
      else if (ch === '}') {
        depth--;
        if (depth === 0 && objStart >= 0) {
          count++;
          if (count > emittedCount) {
            try {
              const obj = JSON.parse(text.slice(objStart, pos + 1)) as Record<string, unknown>;
              if (obj['title'] && obj['date']) callbacks.onEvent!(obj);
            } catch { /* partial — skip */ }
          }
          objStart = -1;
        }
      }
    }
    pos++;
  }
  return Math.max(emittedCount, count);
}

function tryEmitMeta(text: string, callbacks: StreamCallbacks): boolean {
  const eventsIdx = text.indexOf('"events":[');
  if (eventsIdx <= 0) return false;
  try {
    const meta = JSON.parse(text.slice(0, eventsIdx) + '"events":[]}') as {
      topic?: string; period?: string; description?: string;
    };
    if (meta.topic && meta.period) {
      callbacks.onMeta?.(meta.topic, meta.period, meta.description ?? '');
      return true;
    }
  } catch { /* partial JSON — retry next chunk */ }
  return false;
}
