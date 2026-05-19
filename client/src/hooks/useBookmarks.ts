import { useState, useCallback } from 'react';
import type { TimelineEvent } from '../types';

export interface Bookmark {
  id: string;
  topic: string;
  event: TimelineEvent;
  savedAt: number;
}

const STORAGE_KEY = 'epocha-bookmarks';

function makeId(topic: string, event: TimelineEvent): string {
  return `${topic}::${event.date}::${event.title}`;
}

function load(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Bookmark[]) : [];
  } catch { return []; }
}

function persist(bookmarks: Bookmark[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks)); } catch { /* ignore */ }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(load);

  const isBookmarked = useCallback((topic: string, event: TimelineEvent): boolean => {
    const id = makeId(topic, event);
    return bookmarks.some(b => b.id === id);
  }, [bookmarks]);

  const toggleBookmark = useCallback((topic: string, event: TimelineEvent) => {
    const id = makeId(topic, event);
    setBookmarks(prev => {
      const exists = prev.some(b => b.id === id);
      const next = exists
        ? prev.filter(b => b.id !== id)
        : [{ id, topic, event, savedAt: Date.now() }, ...prev];
      persist(next);
      return next;
    });
  }, []);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks(prev => {
      const next = prev.filter(b => b.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const clearBookmarks = useCallback(() => {
    setBookmarks([]);
    persist([]);
  }, []);

  return { bookmarks, isBookmarked, toggleBookmark, removeBookmark, clearBookmarks };
}
