import { useState } from 'react';
import { TOPIC_TAXONOMY } from '../data/topics';
import type { TimelineData } from '../types';

interface Props {
  onSelect: (topic: string, start: string, end: string) => void;
  variant?: 'button' | 'link';
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export default function SurpriseButton({ onSelect, variant = 'button' }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);

    const allTopics = shuffle(TOPIC_TAXONOMY.flatMap(cat => cat.items));

    for (const entry of allTopics.slice(0, 10)) {
      try {
        const params = new URLSearchParams({ topic: entry.topic, startYear: entry.start, endYear: entry.end });
        const res = await fetch(`/api/timeline/browse?${params}`);
        if (!res.ok) continue;
        const data = await res.json() as { cached: boolean; timeline: TimelineData };
        if (data.cached) {
          onSelect(entry.topic, entry.start, entry.end);
          setLoading(false);
          return;
        }
      } catch { continue; }
    }

    // Fallback: pick the first topic regardless of cache
    const fallback = allTopics[0]!;
    onSelect(fallback.topic, fallback.start, fallback.end);
    setLoading(false);
  };

  if (variant === 'link') {
    return (
      <button
        onClick={() => void handleClick()}
        disabled={loading}
        className="text-xs text-amber-500/60 hover:text-amber-400 transition-colors disabled:opacity-40"
      >
        {loading ? 'Finding…' : '🎲 Surprise me'}
      </button>
    );
  }

  return (
    <button
      onClick={() => void handleClick()}
      disabled={loading}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 bg-white/4 hover:bg-white/8 hover:border-white/25 text-slate-300 hover:text-white text-sm font-medium transition-all disabled:opacity-50"
    >
      {loading ? (
        <>
          <div className="w-3.5 h-3.5 border border-white/30 border-t-white/80 rounded-full animate-spin" />
          Finding…
        </>
      ) : (
        <>🎲 Surprise me</>
      )}
    </button>
  );
}
