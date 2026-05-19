interface Props {
  topic: string;
  period: string;
  description: string;
  eventCount?: number;
}

export default function TimelineSkeleton({ topic, period, description, eventCount = 6 }: Props) {
  return (
    <div className="timeline-print-container">
      <div className="pt-10 pb-16 text-center fade-up">
        <p className="text-amber-400 text-xs font-semibold tracking-[0.2em] uppercase mb-3">{period}</p>
        <h2 className="font-serif text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">{topic}</h2>
        <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed mb-6">{description}</p>
        <div className="inline-flex items-center gap-2">
          <div className="h-6 w-24 rounded-full bg-white/8 animate-pulse" />
          <div className="h-6 w-20 rounded-full bg-white/5 animate-pulse" />
        </div>
      </div>

      {/* Skeleton event cards */}
      <div className="space-y-4 max-w-xl mx-auto px-4">
        {Array.from({ length: eventCount }).map((_, i) => (
          <div
            key={i}
            className="glass rounded-xl p-4 border border-white/5 fade-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-5 w-16 rounded-full bg-amber-500/20 animate-pulse" />
              <div className="h-4 flex-1 rounded bg-white/8 animate-pulse" style={{ maxWidth: `${50 + (i * 17) % 40}%` }} />
            </div>
            <div className="space-y-2">
              <div className="h-3 rounded bg-white/5 animate-pulse" style={{ width: `${70 + (i * 13) % 25}%` }} />
              <div className="h-3 rounded bg-white/5 animate-pulse" style={{ width: `${55 + (i * 19) % 30}%` }} />
            </div>
          </div>
        ))}
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 text-slate-600 text-xs">
            <div className="w-3 h-3 border border-slate-700 border-t-amber-500 rounded-full animate-spin" />
            Generating remaining events…
          </div>
        </div>
      </div>
    </div>
  );
}
