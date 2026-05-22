/**
 * Semantic topic matching via Azure OpenAI text-embedding-3-small.
 *
 * Embeddings are stored in a Redis hash (epocha:topic-embeddings) keyed by
 * cache key. On a browse cache miss we generate an embedding for the search
 * query, compute cosine similarity against all stored embeddings, and return
 * the closest match if it exceeds the similarity threshold.
 *
 * Key Vault secret required:
 *   azure-openai-embedding-deployment  e.g. "text-embedding-3-small"
 */
import { AzureOpenAI } from 'openai';
import { getSecret } from './secrets.js';

export const EMBEDDINGS_KEY = 'epocha:topic-embeddings';
const SIMILARITY_THRESHOLD = 0.88;

let client: AzureOpenAI | null = null;

function getClient(): AzureOpenAI | null {
  const endpoint = getSecret('azure-openai-endpoint');
  const apiKey = getSecret('azure-openai-key');
  const deployment = getSecret('azure-openai-embedding-deployment');
  if (!endpoint || !apiKey || !deployment) return null;
  if (!client) {
    client = new AzureOpenAI({ endpoint, apiKey, apiVersion: '2024-10-21', deployment });
  }
  return client;
}

export function resetEmbeddingClient(): void {
  client = null;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const deployment = getSecret('azure-openai-embedding-deployment') ?? 'text-embedding-3-small';
    const res = await c.embeddings.create({ model: deployment, input: text });
    return res.data[0]?.embedding ?? null;
  } catch (err) {
    console.warn('[embeddings] Failed to generate embedding:', err instanceof Error ? err.message : err);
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot  += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Find the best semantically matching cache key for a given topic name.
 * Returns { cacheKey, score } or null if no match exceeds the threshold.
 */
export async function findBestSemanticMatch(
  topicName: string,
  allEmbeddings: Record<string, string>,
  threshold = SIMILARITY_THRESHOLD,
): Promise<{ cacheKey: string; score: number } | null> {
  const queryEmbedding = await generateEmbedding(topicName);
  if (!queryEmbedding) return null;

  let bestKey = '';
  let bestScore = 0;

  for (const [key, json] of Object.entries(allEmbeddings)) {
    try {
      const embedding = JSON.parse(json) as number[];
      const score = cosineSimilarity(queryEmbedding, embedding);
      if (score > bestScore) { bestScore = score; bestKey = key; }
    } catch { /* corrupt entry — skip */ }
  }

  if (bestScore < threshold || !bestKey) return null;
  return { cacheKey: bestKey, score: bestScore };
}
