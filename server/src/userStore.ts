import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { CosmosClient } from '@azure/cosmos';
import { getSecret } from './secrets.js';
import { xpToLevel, XP_REWARDS, type User, type SavedTimeline, type CustomTopic } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DB_PATH = path.join(__dirname, '../../data/users.json');
const LOCAL_SAVED_PATH = path.join(__dirname, '../../data/saved-timelines.json');
const LOCAL_TOPICS_PATH = path.join(__dirname, '../../data/custom-topics.json');

const MAX_USERS = parseInt(process.env.MAX_USERS ?? '50', 10);
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT ?? '10', 10);

// ── Cosmos DB containers ───────────────────────────────────────────────────

let cosmosUsers: ReturnType<ReturnType<CosmosClient['database']>['container']> | null = null;
let cosmosSaved: ReturnType<ReturnType<CosmosClient['database']>['container']> | null = null;
let cosmosTopics: ReturnType<ReturnType<CosmosClient['database']>['container']> | null = null;

async function getCosmosContainers() {
  if (cosmosUsers) return { users: cosmosUsers, saved: cosmosSaved!, topics: cosmosTopics! };
  const client = new CosmosClient({ endpoint: getSecret('cosmos-endpoint'), key: getSecret('cosmos-key') });
  const { database } = await client.databases.createIfNotExists({ id: 'epocha' });
  const [u, s, t] = await Promise.all([
    database.containers.createIfNotExists({ id: 'users', partitionKey: { paths: ['/id'] } }),
    database.containers.createIfNotExists({ id: 'savedTimelines', partitionKey: { paths: ['/userId'] } }),
    database.containers.createIfNotExists({ id: 'customTopics', partitionKey: { paths: ['/userId'] } }),
  ]);
  cosmosUsers = u.container;
  cosmosSaved = s.container;
  cosmosTopics = t.container;
  return { users: cosmosUsers, saved: cosmosSaved, topics: cosmosTopics };
}

// ── Local JSON helpers ─────────────────────────────────────────────────────

async function readJson<T>(filePath: string): Promise<T[]> {
  try { return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T[]; } catch { return []; }
}

async function writeJson<T>(filePath: string, data: T[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// ── User helpers ───────────────────────────────────────────────────────────

const useCosmosDB = !!getSecret('cosmos-endpoint');

function defaultUser(profile: { id: string; email: string; name: string; picture?: string }): User {
  return {
    ...profile,
    createdAt: new Date().toISOString(),
    dailyCount: 0,
    dailyResetAt: new Date().toISOString(),
    xp: 0,
    level: 1,
    lastLoginAt: new Date().toISOString(),
    activeTheme: 'midnight',
    unlockedThemes: ['midnight'],
  };
}

export async function findUser(id: string): Promise<User | null> {
  if (useCosmosDB) {
    const { users } = await getCosmosContainers();
    try { const { resource } = await users.item(id, id).read<User>(); return resource ?? null; }
    catch { return null; }
  }
  const all = await readJson<User>(LOCAL_DB_PATH);
  return all.find(u => u.id === id) ?? null;
}

export async function countUsers(): Promise<number> {
  if (useCosmosDB) {
    const { users } = await getCosmosContainers();
    const { resources } = await users.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll();
    return (resources[0] as number) ?? 0;
  }
  return (await readJson<User>(LOCAL_DB_PATH)).length;
}

export async function upsertUser(user: User): Promise<User> {
  if (useCosmosDB) {
    const { users } = await getCosmosContainers();
    const { resource } = await users.items.upsert<User>(user);
    return resource!;
  }
  const all = await readJson<User>(LOCAL_DB_PATH);
  const idx = all.findIndex(u => u.id === user.id);
  if (idx >= 0) all[idx] = user; else all.push(user);
  await writeJson(LOCAL_DB_PATH, all);
  return user;
}

export async function findOrCreateUser(profile: { id: string; email: string; name: string; picture?: string }): Promise<User | null> {
  const existing = await findUser(profile.id);
  if (existing) return existing;
  const total = await countUsers();
  if (total >= MAX_USERS) return null;
  return upsertUser(defaultUser(profile));
}

export async function checkAndIncrementRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const user = await findUser(userId);
  if (!user) return { allowed: false, remaining: 0 };
  const now = new Date();
  const resetAt = new Date(user.dailyResetAt);
  const sameDay = now.getUTCFullYear() === resetAt.getUTCFullYear()
    && now.getUTCMonth() === resetAt.getUTCMonth()
    && now.getUTCDate() === resetAt.getUTCDate();
  const currentCount = sameDay ? user.dailyCount : 0;
  if (currentCount >= DAILY_LIMIT) return { allowed: false, remaining: 0 };
  await upsertUser({ ...user, dailyCount: currentCount + 1, dailyResetAt: sameDay ? user.dailyResetAt : now.toISOString() });
  return { allowed: true, remaining: DAILY_LIMIT - currentCount - 1 };
}

// ── XP & Gamification ──────────────────────────────────────────────────────

export async function awardXP(userId: string, amount: number): Promise<User | null> {
  const user = await findUser(userId);
  if (!user) return null;
  const newXp = (user.xp ?? 0) + amount;
  const newLevel = xpToLevel(newXp);
  return upsertUser({ ...user, xp: newXp, level: newLevel });
}

export async function checkAndAwardDailyLogin(userId: string): Promise<boolean> {
  const user = await findUser(userId);
  if (!user) return false;
  const now = new Date();
  const last = user.lastLoginAt ? new Date(user.lastLoginAt) : new Date(0);
  const sameDay = now.toDateString() === last.toDateString();
  if (sameDay) return false;
  await awardXP(userId, XP_REWARDS.DAILY_LOGIN);
  const refreshed = await findUser(userId);
  if (refreshed) await upsertUser({ ...refreshed, lastLoginAt: now.toISOString() });
  return true;
}

export async function unlockTheme(userId: string, themeId: string): Promise<User | null> {
  const user = await findUser(userId);
  if (!user) return null;
  const themes = user.unlockedThemes ?? ['midnight'];
  if (themes.includes(themeId)) return user;
  return upsertUser({ ...user, unlockedThemes: [...themes, themeId] });
}

export async function setActiveTheme(userId: string, themeId: string): Promise<User | null> {
  const user = await findUser(userId);
  if (!user) return null;
  const themes = user.unlockedThemes ?? ['midnight'];
  if (!themes.includes(themeId)) return null;
  return upsertUser({ ...user, activeTheme: themeId });
}

// ── Saved timelines ────────────────────────────────────────────────────────

export async function getSavedTimelines(userId: string): Promise<SavedTimeline[]> {
  if (useCosmosDB) {
    const { saved } = await getCosmosContainers();
    const { resources } = await saved.items
      .query({ query: 'SELECT * FROM c WHERE c.userId = @uid', parameters: [{ name: '@uid', value: userId }] })
      .fetchAll();
    return resources as SavedTimeline[];
  }
  const all = await readJson<SavedTimeline>(LOCAL_SAVED_PATH);
  return all.filter(t => t.userId === userId);
}

export async function saveTimeline(userId: string, data: Omit<SavedTimeline, 'id' | 'userId' | 'savedAt'>): Promise<SavedTimeline> {
  const item: SavedTimeline = { id: randomUUID(), userId, savedAt: new Date().toISOString(), ...data };
  if (useCosmosDB) {
    const { saved } = await getCosmosContainers();
    await saved.items.create(item);
  } else {
    const all = await readJson<SavedTimeline>(LOCAL_SAVED_PATH);
    all.push(item);
    await writeJson(LOCAL_SAVED_PATH, all);
  }
  return item;
}

export async function deleteSavedTimeline(userId: string, id: string): Promise<boolean> {
  if (useCosmosDB) {
    const { saved } = await getCosmosContainers();
    try { await saved.item(id, userId).delete(); return true; } catch { return false; }
  }
  const all = await readJson<SavedTimeline>(LOCAL_SAVED_PATH);
  const filtered = all.filter(t => !(t.id === id && t.userId === userId));
  if (filtered.length === all.length) return false;
  await writeJson(LOCAL_SAVED_PATH, filtered);
  return true;
}

// ── Custom topics ──────────────────────────────────────────────────────────

export async function getCustomTopics(userId: string): Promise<CustomTopic[]> {
  if (useCosmosDB) {
    const { topics } = await getCosmosContainers();
    const { resources } = await topics.items
      .query({ query: 'SELECT * FROM c WHERE c.userId = @uid', parameters: [{ name: '@uid', value: userId }] })
      .fetchAll();
    return resources as CustomTopic[];
  }
  const all = await readJson<CustomTopic>(LOCAL_TOPICS_PATH);
  return all.filter(t => t.userId === userId);
}

export async function saveCustomTopic(userId: string, data: Omit<CustomTopic, 'id' | 'userId' | 'createdAt'>): Promise<CustomTopic> {
  const item: CustomTopic = { id: randomUUID(), userId, createdAt: new Date().toISOString(), ...data };
  if (useCosmosDB) {
    const { topics } = await getCosmosContainers();
    await topics.items.create(item);
  } else {
    const all = await readJson<CustomTopic>(LOCAL_TOPICS_PATH);
    all.push(item);
    await writeJson(LOCAL_TOPICS_PATH, all);
  }
  return item;
}

export async function deleteCustomTopic(userId: string, id: string): Promise<boolean> {
  if (useCosmosDB) {
    const { topics } = await getCosmosContainers();
    try { await topics.item(id, userId).delete(); return true; } catch { return false; }
  }
  const all = await readJson<CustomTopic>(LOCAL_TOPICS_PATH);
  const filtered = all.filter(t => !(t.id === id && t.userId === userId));
  if (filtered.length === all.length) return false;
  await writeJson(LOCAL_TOPICS_PATH, filtered);
  return true;
}

export { DAILY_LIMIT, MAX_USERS };
