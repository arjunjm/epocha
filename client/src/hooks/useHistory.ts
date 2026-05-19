import { useState, useCallback } from 'react';

export interface HistoryEntry {
  topic: string;
  start: string;
  end: string;
  title: string;
  viewedAt: number;
}

const STORAGE_KEY = 'epocha-history';
const MAX_ENTRIES = 8;

function load(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as HistoryEntry[]; }
  catch { return []; }
}

function save(entries: HistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>(load);

  const push = useCallback((entry: Omit<HistoryEntry, 'viewedAt'>) => {
    setHistory(prev => {
      // Deduplicate by topic key, move to front
      const filtered = prev.filter(e => !(e.topic === entry.topic && e.start === entry.start && e.end === entry.end));
      const next = [{ ...entry, viewedAt: Date.now() }, ...filtered].slice(0, MAX_ENTRIES);
      save(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  return { history, push, clear };
}
