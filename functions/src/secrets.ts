import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

const KEY_VAULT_URL = process.env.KEY_VAULT_URL;
const cache = new Map<string, string>();

const SECRET_NAMES = ['anthropic-api-key', 'redis-url'];

export async function loadSecrets(): Promise<void> {
  if (!KEY_VAULT_URL) {
    console.log('[secrets] No KEY_VAULT_URL — using env vars');
    return;
  }
  const client = new SecretClient(KEY_VAULT_URL, new DefaultAzureCredential());
  await Promise.allSettled(SECRET_NAMES.map(async (name) => {
    const s = await client.getSecret(name);
    if (s.value) cache.set(name, s.value);
  }));
}

export function getSecret(name: string): string {
  if (cache.has(name)) return cache.get(name)!;
  return process.env[name.toUpperCase().replace(/-/g, '_')] ?? '';
}
