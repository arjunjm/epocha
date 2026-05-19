import { useCallback } from 'react';
import type { TimelineData } from '../types';

const STORAGE_KEY = 'epocha-session';

interface SessionData {
  topic: string;
  startYear: string;
  endYear: string;
  timeline: TimelineData;
  savedAt: number;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function saveSession(topic: string, startYear: string, endYear: string, timeline: TimelineData) {
  try {
    const data: SessionData = { topic, startYear, endYear, timeline, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded — ignore */ }
}

export function loadSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionData;
    if (Date.now() - data.savedAt > SESSION_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch { return null; }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useSession() {
  const save = useCallback(saveSession, []);
  const clear = useCallback(clearSession, []);
  return { save, clear, load: loadSession };
}
