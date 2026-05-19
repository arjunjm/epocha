import { useState, useCallback } from 'react';

const PREFIX = 'epocha-note::';

export function useNote(noteId: string) {
  const key = PREFIX + noteId;
  const [note, setNote] = useState<string>(() => {
    try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
  });

  const saveNote = useCallback((text: string) => {
    setNote(text);
    try {
      if (text.trim()) {
        localStorage.setItem(key, text);
      } else {
        localStorage.removeItem(key);
      }
    } catch { /* ignore */ }
  }, [key]);

  return { note, saveNote };
}

export function hasNote(noteId: string): boolean {
  try { return Boolean(localStorage.getItem(PREFIX + noteId)?.trim()); } catch { return false; }
}
