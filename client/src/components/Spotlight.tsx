import { useState, useEffect } from 'react';
import { TOPIC_TAXONOMY } from '../data/topics';
import type { TimelineData, TimelineEvent } from '../types';

interface Props {
  onSelect: (topic: string, start: string, end: string) => void;
}

interface SpotlightData {
  event: TimelineEvent;
  topic: string;
  start: string;
  end: string;
  topicLabel: string;
  categoryIcon: string;
}

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export default function Spotlight({ onSelect }: Props) {
  const [spotlight, setSpotlight] = useState<SpotlightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    // Build a shuffled flat list of all topics
    const allTopics = shuffle(
      TOPIC_TAXONOMY.flatMap(cat =>
        cat.items.map(item => ({ ...item, categoryIcon: cat.icon }))
      )
    );

    // Try up to 8 topics to find a cached one
    for (const entry of allTopics.slice(0, 8)) {
      try {
        const params = new URLSearchParams({ topic: entry.topic, startYear: entry.start, endYear: entry.end });
        const res = await fetch(`/api/timeline/browse?${params}`);
        if (!res.ok) continue;

        const data = await res.json() as { cached: boolean; timeline: TimelineData };
        if (!data.cached || !data.timeline.events.length) continue;

        // Pick a random event, prefer ones with longer details
        const candidates = data.timeline.events.filter(e => e.details.length > 100);
        const pool = candidates.length ? candidates : data.timeline.events;
        const event = pool[Math.floor(Math.random() * pool.length)]!;

        setSpotlight({
          event,
          topic: entry.topic,
          start: entry.start,
          end: entry.end,
          topicLabel: entry.label,
          categoryIcon: entry.categoryIcon,
        });
        setLoading(false);
        return;
      } catch { continue; }
    }
    setLoading(false); // no cached topics found
  };

  if (loading) {
    return (
      <div className="w-full max-w-lg mx-auto mb-8 glass rounded-2xl p-5 border border-white/5 animate-pulse h-32" />
    );
  }
  if (!spotlight) return null;

  const { event, topic, start, end, topicLabel, categoryIcon } = spotlight;

  return (
    <div className="w-full max-w-lg mx-auto mb-8 fade-up" style={{ animationDelay: '0.1s' }}>
      <button
        onClick={() => onSelect(topic, start, end)}
        className="w-full text-left glass rounded-2xl p-5 border border-white/8 hover:border-amber-500/25 hover:bg-white/5 transition-all group"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">{categoryIcon}</span>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Historical Spotlight</span>
          </div>
          <span className="text-[10px] text-amber-500/50 group-hover:text-amber-400 transition-colors font-medium">
            Explore →
          </span>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 whitespace-nowrap">
              {event.date}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-snug group-hover:text-amber-200 transition-colors truncate">
              {event.title}
            </p>
            <p className="text-slate-500 text-xs mt-1 line-clamp-2 leading-relaxed">
              {event.summary}
            </p>
          </div>
        </div>

        <p className="mt-2.5 text-[10px] text-slate-700 truncate">
          {topicLabel} · {start} – {end}
        </p>
      </button>
    </div>
  );
}
