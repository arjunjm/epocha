import type { TimelineEvent } from '../types';

interface Props {
  events: TimelineEvent[];
  topic: string;
  period: string;
  onEventClick: (event: TimelineEvent) => void;
}

function parseYear(event: TimelineEvent): number {
  if (event.sortYear !== undefined) return event.sortYear;
  const m = event.date.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function bucketLabel(year: number, bucketSize: number): string {
  if (bucketSize >= 1000) {
    const millennium = Math.floor(year / 1000);
    if (year < 0) return `${Math.abs(millennium + 1) + 1}th millennium BCE`;
    return `${millennium + 1}th millennium`;
  }
  if (bucketSize >= 100) {
    const c = Math.floor(year / 100);
    if (year < 0) return `${Math.abs(c)}00s BCE`;
    const suffix = c + 1 === 1 ? 'st' : c + 1 === 2 ? 'nd' : c + 1 === 3 ? 'rd' : 'th';
    return `${c + 1}${suffix} century`;
  }
  if (bucketSize >= 50) return `${year < 0 ? Math.abs(year) + ' BCE' : year}s`;
  if (bucketSize >= 10) {
    const decade = Math.floor(year / 10) * 10;
    return `${decade < 0 ? Math.abs(decade) + ' BCE' : decade}s`;
  }
  return year < 0 ? `${Math.abs(year)} BCE` : String(year);
}

export default function HeatmapView({ events, onEventClick }: Props) {
  if (events.length === 0) return null;

  const years = events.map(parseYear);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const span = maxYear - minYear || 1;

  // Pick a bucket size that gives 8–20 buckets
  const targetBuckets = Math.min(20, Math.max(6, events.length));
  const rawSize = span / targetBuckets;
  const bucketSizes = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2000];
  const bucketSize = bucketSizes.find(s => s >= rawSize) ?? 2000;

  // Build buckets
  const bucketMap = new Map<number, TimelineEvent[]>();
  for (const event of events) {
    const y = parseYear(event);
    const key = Math.floor(y / bucketSize) * bucketSize;
    const bucket = bucketMap.get(key) ?? [];
    bucket.push(event);
    bucketMap.set(key, bucket);
  }

  const sortedKeys = [...bucketMap.keys()].sort((a, b) => a - b);
  const maxCount = Math.max(...sortedKeys.map(k => bucketMap.get(k)!.length));

  const INTENSITY = [
    'bg-white/5 border-white/6',
    'bg-teal-900/40 border-teal-700/30',
    'bg-teal-700/50 border-teal-500/40',
    'bg-teal-500/60 border-teal-400/50',
    'bg-teal-400/80 border-teal-300/60',
  ];

  function intensityClass(count: number): string {
    if (count === 0) return INTENSITY[0]!;
    const ratio = count / maxCount;
    if (ratio <= 0.2) return INTENSITY[1]!;
    if (ratio <= 0.4) return INTENSITY[2]!;
    if (ratio <= 0.7) return INTENSITY[3]!;
    return INTENSITY[4]!;
  }

  return (
    <div className="py-6 print:hidden">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Event Density
        </p>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-700">
          <span>sparse</span>
          {INTENSITY.slice(1).map((cls, i) => (
            <div key={i} className={`w-3 h-3 rounded-sm border ${cls}`} />
          ))}
          <span>dense</span>
        </div>
      </div>

      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(72px, 1fr))` }}>
        {sortedKeys.map(key => {
          const bucket = bucketMap.get(key)!;
          const label = bucketLabel(key, bucketSize);
          return (
            <div key={key} className="group relative">
              <div
                className={`rounded-lg border p-2 cursor-default transition-all hover:scale-105 ${intensityClass(bucket.length)}`}
                title={`${label}: ${bucket.length} event${bucket.length !== 1 ? 's' : ''}`}
              >
                <p className="text-[9px] font-medium text-slate-400 truncate leading-tight mb-1">{label}</p>
                <p className="text-base font-black text-white leading-none">{bucket.length}</p>
              </div>

              {/* Hover tooltip showing event titles */}
              <div className="absolute bottom-full left-0 mb-1 z-20 hidden group-hover:block w-48 glass rounded-xl border border-white/12 p-2 shadow-2xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">{label}</p>
                <ul className="space-y-0.5">
                  {bucket.slice(0, 5).map((evt, i) => (
                    <li key={i}>
                      <button
                        onClick={() => onEventClick(evt)}
                        className="text-[10px] text-slate-300 hover:text-white text-left w-full truncate transition-colors"
                      >
                        {evt.title}
                      </button>
                    </li>
                  ))}
                  {bucket.length > 5 && (
                    <li className="text-[10px] text-slate-600">+{bucket.length - 5} more</li>
                  )}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-700 mt-3 text-center">
        Hover a cell to see events · Click an event title to scroll to it
      </p>
    </div>
  );
}
