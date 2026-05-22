import type { TimelineData, TimelineEvent } from '../types';

interface Props {
  data: TimelineData;
  onClose: () => void;
}

function topN<T extends string>(items: T[], n: number): { value: T; count: number }[] {
  const freq = new Map<T, number>();
  for (const item of items) freq.set(item, (freq.get(item) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value, count]) => ({ value, count }));
}

function centuryLabel(event: TimelineEvent): string {
  const raw = event.sortYear ?? parseInt(event.date.replace(/\D.*/, ''), 10);
  if (isNaN(raw)) return 'Unknown';
  if (raw <= 0) return `${Math.ceil(Math.abs(raw) / 100)}th c. BCE`;
  const c = Math.ceil(raw / 100);
  const suffix = c === 1 ? 'st' : c === 2 ? 'nd' : c === 3 ? 'rd' : 'th';
  return `${c}${suffix} c.`;
}

function Bar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = Math.max(4, Math.round((count / max) * 100));
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400 text-xs w-32 shrink-0 truncate" title={label}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/6 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-slate-600 text-xs font-mono w-4 text-right shrink-0">{count}</span>
    </div>
  );
}

export default function InsightsPanel({ data, onClose }: Props) {
  const events = data.events;

  const wordCount = events.reduce((n, e) =>
    n + (e.details ?? '').split(/\s+/).length + e.summary.split(/\s+/).length, 0);
  const readMins = Math.max(1, Math.round(wordCount / 200));

  const allFigures = events.flatMap(e => e.figures ?? []);
  const topFigures = topN(allFigures, 6);

  const allTags = events.flatMap(e => e.tags ?? []);
  const topTags = topN(allTags, 6);

  const allLocations = events.map(e => e.location).filter((l): l is string => Boolean(l));
  const topLocations = topN(allLocations, 5);

  const centuryCounts = new Map<string, number>();
  for (const e of events) {
    const c = centuryLabel(e);
    centuryCounts.set(c, (centuryCounts.get(c) ?? 0) + 1);
  }
  const centuries = [...centuryCounts.entries()].map(([label, count]) => ({ label, count }));

  const maxFig = topFigures[0]?.count ?? 1;
  const maxTag = topTags[0]?.count ?? 1;
  const maxLoc = topLocations[0]?.count ?? 1;
  const maxCentury = Math.max(...centuries.map(c => c.count), 1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto glass rounded-2xl border border-white/10 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/8 bg-[#0d1020]/90 backdrop-blur-sm rounded-t-2xl">
          <div>
            <h2 className="text-white font-semibold text-base">Timeline Insights</h2>
            <p className="text-slate-500 text-xs mt-0.5">{data.topic} · {data.period}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-300 transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Events', value: events.length, sub: 'total' },
              { label: 'Reading time', value: `~${readMins}`, sub: 'minutes' },
              { label: 'Words', value: wordCount.toLocaleString(), sub: 'across all events' },
              { label: 'Locations', value: allLocations.length, sub: `${new Set(allLocations).size} unique` },
            ].map(({ label, value, sub }) => (
              <div key={label} className="glass rounded-xl p-4 border border-white/6 text-center">
                <p className="text-white font-black text-2xl">{value}</p>
                <p className="text-slate-400 text-xs font-medium mt-0.5">{label}</p>
                <p className="text-slate-700 text-[10px] mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Events per century bar chart */}
          {centuries.length > 0 && (
            <div className="glass rounded-xl p-4 border border-white/6">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Events by Century</p>
              <div className="space-y-2">
                {centuries.map(({ label, count }) => (
                  <Bar key={label} label={label} count={count} max={maxCentury} color="bg-gradient-to-r from-amber-500 to-orange-400" />
                ))}
              </div>
            </div>
          )}

          {/* Top figures */}
          {topFigures.length > 0 && (
            <div className="glass rounded-xl p-4 border border-white/6">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                Most Mentioned Figures
                <span className="ml-2 text-slate-700 font-normal normal-case">({allFigures.length} total mentions)</span>
              </p>
              <div className="space-y-2">
                {topFigures.map(({ value, count }) => (
                  <Bar key={value} label={value} count={count} max={maxFig} color="bg-gradient-to-r from-violet-500 to-purple-400" />
                ))}
              </div>
            </div>
          )}

          {/* Top tags */}
          {topTags.length > 0 && (
            <div className="glass rounded-xl p-4 border border-white/6">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                Top Themes
                <span className="ml-2 text-slate-700 font-normal normal-case">({new Set(allTags).size} unique themes)</span>
              </p>
              <div className="space-y-2">
                {topTags.map(({ value, count }) => (
                  <Bar key={value} label={value} count={count} max={maxTag} color="bg-gradient-to-r from-cyan-500 to-teal-400" />
                ))}
              </div>
            </div>
          )}

          {/* Top locations */}
          {topLocations.length > 0 && (
            <div className="glass rounded-xl p-4 border border-white/6">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                Key Locations
                <span className="ml-2 text-slate-700 font-normal normal-case">({new Set(allLocations).size} unique)</span>
              </p>
              <div className="space-y-2">
                {topLocations.map(({ value, count }) => (
                  <Bar key={value} label={`📍 ${value}`} count={count} max={maxLoc} color="bg-gradient-to-r from-emerald-500 to-green-400" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
