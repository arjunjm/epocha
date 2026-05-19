import EventCard from './EventCard';
import type { TimelineData } from '../types';

interface Props {
  data: TimelineData;
  onReset: () => void;
}

// Era-based gradient colors for dots and accents
const ERA_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-indigo-500 to-blue-600',
  'from-blue-500 to-cyan-500',
  'from-cyan-500 to-teal-500',
  'from-teal-500 to-emerald-500',
  'from-emerald-500 to-green-500',
  'from-green-500 to-lime-500',
  'from-yellow-500 to-amber-500',
  'from-amber-500 to-orange-500',
  'from-orange-500 to-red-500',
  'from-red-500 to-rose-500',
  'from-rose-500 to-pink-500',
];

const ERA_GLOWS = [
  'shadow-violet-500/40',
  'shadow-indigo-500/40',
  'shadow-blue-500/40',
  'shadow-cyan-500/40',
  'shadow-teal-500/40',
  'shadow-emerald-500/40',
  'shadow-green-500/40',
  'shadow-yellow-500/40',
  'shadow-amber-500/40',
  'shadow-orange-500/40',
  'shadow-red-500/40',
  'shadow-rose-500/40',
];

function getGradient(index: number, total: number) {
  const i = Math.floor((index / Math.max(total - 1, 1)) * (ERA_GRADIENTS.length - 1));
  return {
    gradient: ERA_GRADIENTS[Math.min(i, ERA_GRADIENTS.length - 1)],
    glow: ERA_GLOWS[Math.min(i, ERA_GLOWS.length - 1)],
  };
}

export default function Timeline({ data, onReset }: Props) {
  const total = data.events.length;

  return (
    <div>
      {/* Header */}
      <div className="pt-10 pb-16 text-center fade-up">
        <p className="text-amber-400 text-xs font-semibold tracking-[0.2em] uppercase mb-3">
          {data.period}
        </p>
        <h2 className="font-serif text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">
          {data.topic}
        </h2>
        <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed mb-6">
          {data.description}
        </p>
        <div className="inline-flex items-center gap-4">
          <span className="px-4 py-1.5 rounded-full text-xs font-semibold text-amber-300 border border-amber-400/30 bg-amber-400/5">
            {total} events
          </span>
          <button
            onClick={onReset}
            className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors"
          >
            ← New search
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Spine line — desktop */}
        <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 timeline-line opacity-30" />

        <div className="space-y-6 lg:space-y-0">
          {data.events.map((event, index) => {
            const { gradient, glow } = getGradient(index, total);
            const isLeft = index % 2 === 0;

            return (
              <div
                key={`${event.date}-${index}`}
                className="fade-up lg:grid lg:grid-cols-2 lg:gap-8 lg:mb-6"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                {/* Desktop: alternating layout */}
                {isLeft ? (
                  <>
                    <div className="lg:text-right lg:pr-10">
                      <EventCard event={event} gradient={gradient} glow={glow} align="right" />
                    </div>
                    <div className="hidden lg:flex items-start justify-start pl-10 pt-5">
                      <DatePill date={event.date} gradient={gradient} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="hidden lg:flex items-start justify-end pr-10 pt-5">
                      <DatePill date={event.date} gradient={gradient} />
                    </div>
                    <div className="lg:pl-10">
                      <EventCard event={event} gradient={gradient} glow={glow} align="left" />
                    </div>
                  </>
                )}

                {/* Center dot — desktop */}
                <div
                  className={`hidden lg:block absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gradient-to-br ${gradient} shadow-lg ${glow} mt-6 ring-2 ring-[#0a0e1a]`}
                  style={{ top: `${index === 0 ? 24 : 0}px`, position: 'absolute', marginTop: `${index * 0}px` }}
                />

                {/* Mobile layout */}
                <div className="lg:hidden">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${gradient} flex-shrink-0`} />
                    <DatePill date={event.date} gradient={gradient} />
                  </div>
                  <div className="pl-5 border-l border-white/10">
                    <EventCard event={event} gradient={gradient} glow={glow} align="left" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-20 text-center fade-up">
        <div className="inline-block w-px h-12 bg-gradient-to-b from-white/20 to-transparent mb-6" />
        <p className="text-slate-600 text-xs uppercase tracking-widest">End of timeline</p>
        <button
          onClick={onReset}
          className="mt-8 px-8 py-3 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 transition-all shadow-lg shadow-amber-500/20"
        >
          Explore another topic
        </button>
      </div>
    </div>
  );
}

function DatePill({ date, gradient }: { date: string; gradient: string }) {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${gradient} shadow-md whitespace-nowrap`}>
      {date}
    </span>
  );
}
