/**
 * Secrets loader — reads from Azure Key Vault when KEY_VAULT_URL is set,
 * otherwise falls back to environment variables for local dev.
 *
 * In production (App Service with Managed Identity): DefaultAzureCredential
 *   automatically uses the assigned identity — no secrets needed anywhere.
 *
 * In local dev with Key Vault: run `az login` once; DefaultAzureCredential
 *   picks up your CLI credentials automatically.
 *
 * In local dev without Key Vault: set values directly in server/.env as usual.
 *
 * Key Vault secret names map to env var names like this:
 *   anthropic-api-key  →  ANTHROPIC_API_KEY
 *   google-client-id   →  GOOGLE_CLIENT_ID
 *   etc.
 */
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

const KEY_VAULT_URL = process.env.KEY_VAULT_URL;

// Cache of secrets loaded from Key Vault at startup
const cache = new Map<string, string>();

const SECRET_NAMES = [
  'anthropic-api-key',
  'google-client-id',
  'google-client-secret',
  'google-callback-url',
  'jwt-secret',
  'cosmos-endpoint',
  'cosmos-key',
  'redis-url',
];

export async function loadSecrets(): Promise<void> {
  if (!KEY_VAULT_URL) {
    console.log('[secrets] KEY_VAULT_URL not set — using environment variables');
    return;
  }

  console.log(`[secrets] Loading from Key Vault: ${KEY_VAULT_URL}`);

  const credential = new DefaultAzureCredential();
  const client = new SecretClient(KEY_VAULT_URL, credential);

  const results = await Promise.allSettled(
    SECRET_NAMES.map(async (name) => {
      const secret = await client.getSecret(name);
      if (secret.value) cache.set(name, secret.value);
    })
  );

  const loaded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  console.log(`[secrets] Loaded ${loaded} secrets${failed > 0 ? `, ${failed} not found (will use env vars)` : ''}`);
}

/**
 * Get a secret value. Priority:
 *   1. Key Vault cache (if loaded)
 *   2. Environment variable (SCREAMING_SNAKE_CASE equivalent)
 *   3. Empty string (caller should validate)
 */
export function getSecret(name: string): string {
  if (cache.has(name)) return cache.get(name)!;
  // Convert kebab-case to SCREAMING_SNAKE_CASE for env var lookup
  const envKey = name.toUpperCase().replace(/-/g, '_');
  return process.env[envKey] ?? '';
}
