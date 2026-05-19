/**
 * User store — uses a local JSON file in dev, Azure Cosmos DB in production.
 * Switch is controlled by the COSMOS_ENDPOINT env var being present.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { CosmosClient } from '@azure/cosmos';
import { getSecret } from './secrets.js';
import type { User } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DB_PATH = path.join(__dirname, '../../data/users.json');
const MAX_USERS = parseInt(process.env.MAX_USERS ?? '50', 10);
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT ?? '10', 10);

// ── Cosmos DB (production) ─────────────────────────────────────────────────

let cosmosContainer: ReturnType<ReturnType<CosmosClient['database']>['container']> | null = null;

async function getCosmosContainer() {
  if (cosmosContainer) return cosmosContainer;
  const client = new CosmosClient({
    endpoint: getSecret('cosmos-endpoint'),
    key: getSecret('cosmos-key'),
  });
  const { database } = await client.databases.createIfNotExists({ id: 'epocha' });
  const { container } = await database.containers.createIfNotExists({
    id: 'users',
    partitionKey: { paths: ['/id'] },
  });
  cosmosContainer = container;
  return container;
}

// ── Local JSON file (development) ─────────────────────────────────────────

async function readLocalUsers(): Promise<User[]> {
  try {
    const raw = await fs.readFile(LOCAL_DB_PATH, 'utf-8');
    return JSON.parse(raw) as User[];
  } catch {
    return [];
  }
}

async function writeLocalUsers(users: User[]): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_DB_PATH), { recursive: true });
  await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(users, null, 2));
}

// ── Public API ─────────────────────────────────────────────────────────────

const useCosmosDB = !!getSecret('cosmos-endpoint');

export async function findUser(id: string): Promise<User | null> {
  if (useCosmosDB) {
    const container = await getCosmosContainer();
    try {
      const { resource } = await container.item(id, id).read<User>();
      return resource ?? null;
    } catch {
      return null;
    }
  }
  const users = await readLocalUsers();
  return users.find(u => u.id === id) ?? null;
}

export async function countUsers(): Promise<number> {
  if (useCosmosDB) {
    const container = await getCosmosContainer();
    const { resources } = await container.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll();
    return (resources[0] as number) ?? 0;
  }
  return (await readLocalUsers()).length;
}

export async function upsertUser(user: User): Promise<User> {
  if (useCosmosDB) {
    const container = await getCosmosContainer();
    const { resource } = await container.items.upsert<User>(user);
    return resource!;
  }
  const users = await readLocalUsers();
  const idx = users.findIndex(u => u.id === user.id);
  if (idx >= 0) {
    users[idx] = user;
  } else {
    users.push(user);
  }
  await writeLocalUsers(users);
  return user;
}

/** Find-or-create a user from a Google profile. Returns null if user cap reached. */
export async function findOrCreateUser(profile: {
  id: string;
  email: string;
  name: string;
  picture?: string;
}): Promise<User | null> {
  const existing = await findUser(profile.id);
  if (existing) return existing;

  const total = await countUsers();
  if (total >= MAX_USERS) return null;

  const user: User = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    createdAt: new Date().toISOString(),
    dailyCount: 0,
    dailyResetAt: new Date().toISOString(),
  };
  return upsertUser(user);
}

/** Increment daily count. Returns false if rate limit exceeded. */
export async function checkAndIncrementRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const user = await findUser(userId);
  if (!user) return { allowed: false, remaining: 0 };

  const now = new Date();
  const resetAt = new Date(user.dailyResetAt);
  const sameDay =
    now.getUTCFullYear() === resetAt.getUTCFullYear() &&
    now.getUTCMonth() === resetAt.getUTCMonth() &&
    now.getUTCDate() === resetAt.getUTCDate();

  const currentCount = sameDay ? user.dailyCount : 0;

  if (currentCount >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  await upsertUser({
    ...user,
    dailyCount: currentCount + 1,
    dailyResetAt: sameDay ? user.dailyResetAt : now.toISOString(),
  });

  return { allowed: true, remaining: DAILY_LIMIT - currentCount - 1 };
}

export { DAILY_LIMIT, MAX_USERS };
