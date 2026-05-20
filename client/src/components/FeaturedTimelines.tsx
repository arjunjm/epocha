import { useState, useEffect } from 'react';
import type { TimelineData } from '../types';

interface Props {
  onSelect: (topic: string, startYear: string, endYear: string) => void;
}

const FEATURED = [
  { topic: 'The Roman Empire',                 startYear: '27 BCE', endYear: '476 CE' },
  { topic: 'The Space Race',                   startYear: '1950',   endYear: '1975'   },
  { topic: 'History of Artificial Intelligence', startYear: '1950', endYear: '2024'   },
  { topic: 'The French Revolution',            startYear: '1789',   endYear: '1799'   },
  { topic: 'Ancient Egypt',                    startYear: '3100 BCE', endYear: '30 BCE' },
  { topic: 'World War II',                     startYear: '1939',   endYear: '1945'   },
];

interface Preview {
  topic: string;
  startYear: string;
  endYear: string;
  period: string;
  description: string;
  eventCount: number;
}

export default function FeaturedTimelines({ onSelect }: Props) {
  const [previews, setPreviews] = useState<Preview[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const results: Preview[] = [];
      for (const f of FEATURED) {
        if (results.length >= 4) break;
        try {
          const params = new URLSearchParams({ topic: f.topic, startYear: f.startYear, endYear: f.endYear });
          const res = await fetch(`/api/timeline/browse?${params}`);
          if (!res.ok) continue;
          const { timeline } = await res.json() as { timeline: TimelineData };
          if (alive) results.push({
            topic: timeline.topic,
            startYear: f.startYear,
            endYear: f.endYear,
            period: timeline.period,
            description: timeline.description,
            eventCount: timeline.events.length,
          });
        } catch { continue; }
      }
      if (alive) setPreviews(results);
    };
    void load();
    return () => { alive = false; };
  }, []);

  if (previews.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto px-5 mt-12 mb-6 fade-up" style={{ animationDelay: '0.3s' }}>
      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4 text-center">
        Featured Timelines
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {previews.map(p => (
          <button
            key={p.topic}
            onClick={() => onSelect(p.topic, p.startYear, p.endYear)}
            className="group glass rounded-2xl p-4 text-left border border-white/8 hover:border-amber-400/25 hover:bg-white/8 transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-serif font-bold text-white text-sm leading-snug group-hover:text-amber-300 transition-colors">
                {p.topic}
              </h3>
              <span className="shrink-0 text-[10px] font-mono text-slate-600 bg-white/5 px-1.5 py-0.5 rounded-full">
                {p.eventCount}
              </span>
            </div>
            <p className="text-[10px] text-amber-400/60 font-medium mb-1.5 tracking-wide">{p.period}</p>
            <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">{p.description}</p>
            <p className="mt-2.5 text-[10px] text-slate-700 group-hover:text-amber-400/50 transition-colors">
              Explore →
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
