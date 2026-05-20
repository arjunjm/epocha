import { useState, useCallback } from 'react';

const PREFIX = 'epocha-read::';

function eventId(date: string, title: string): string {
  return `${date}::${title}`;
}

function load(topic: string): Set<string> {
  try {
    const raw = localStorage.getItem(PREFIX + topic);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function persist(topic: string, ids: Set<string>) {
  try { localStorage.setItem(PREFIX + topic, JSON.stringify([...ids])); } catch { /* ignore */ }
}

export function useReadProgress(topic: string, totalEvents: number) {
  const [readIds, setReadIds] = useState<Set<string>>(() => load(topic));

  const markRead = useCallback((date: string, title: string) => {
    const id = eventId(date, title);
    setReadIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persist(topic, next);
      return next;
    });
  }, [topic]);

  const isRead = useCallback((date: string, title: string): boolean => {
    return readIds.has(eventId(date, title));
  }, [readIds]);

  const clearProgress = useCallback(() => {
    setReadIds(new Set());
    try { localStorage.removeItem(PREFIX + topic); } catch { /* ignore */ }
  }, [topic]);

  const readCount = readIds.size;
  const allRead = readCount >= totalEvents && totalEvents > 0;

  return { markRead, isRead, readCount, allRead, clearProgress };
}
