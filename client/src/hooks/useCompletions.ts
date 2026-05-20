import { useState, useCallback } from 'react';

export interface Completion {
  topic: string;
  period: string;
  completedAt: number;
}

const KEY = 'epocha-completions';

function load(): Completion[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Completion[]; }
  catch { return []; }
}

function persist(items: Completion[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

export function useCompletions() {
  const [completions, setCompletions] = useState<Completion[]>(load);

  const addCompletion = useCallback((topic: string, period: string) => {
    setCompletions(prev => {
      if (prev.some(c => c.topic === topic && c.period === period)) return prev;
      const next = [{ topic, period, completedAt: Date.now() }, ...prev];
      persist(next);
      return next;
    });
  }, []);

  const hasCompleted = useCallback((topic: string, period: string): boolean => {
    return completions.some(c => c.topic === topic && c.period === period);
  }, [completions]);

  return { completions, addCompletion, hasCompleted };
}
