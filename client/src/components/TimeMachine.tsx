import { useState, useEffect, useCallback } from 'react';
import type { TimelineEvent } from '../types';

interface Props {
  events: TimelineEvent[];
  topic: string;
  onClose: () => void;
}

export default function TimeMachine({ events, topic, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev' | null>(null);
  const [animating, setAnimating] = useState(false);

  const event = events[index]!;
  const total = events.length;

  const navigate = useCallback((dir: 'next' | 'prev') => {
    if (animating) return;
    const next = dir === 'next' ? index + 1 : index - 1;
    if (next < 0 || next >= total) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setIndex(next);
      setShowDetails(false);
      setDirection(null);
      setAnimating(false);
    }, 220);
  }, [animating, index, total]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate('next');
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigate('prev');
      else if (e.key === ' ' || e.key === 'Enter') setShowDetails(d => !d);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, onClose]);

  const pct = ((index + 1) / total) * 100;
  const slideClass = animating
    ? direction === 'next' ? 'opacity-0 translate-x-4' : 'opacity-0 -translate-x-4'
    : 'opacity-100 translate-x-0';

  const paragraphs = event.details?.split(/\n\n+/).map(p => p.trim()).filter(Boolean) ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-[#060810] flex flex-col" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors text-sm">
            ← Exit
          </button>
          <span className="text-slate-700 text-xs">|</span>
          <span className="font-cinzel text-xs text-slate-500 tracking-widest uppercase">{topic}</span>
        </div>
        <span className="text-slate-600 text-xs font-mono">{index + 1} / {total}</span>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-white/5 flex-shrink-0">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Main card */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-hidden">
        <div className={`w-full max-w-2xl transition-all duration-200 ease-out ${slideClass}`}>
          {/* Date */}
          <p className="font-cinzel font-black text-3xl sm:text-4xl text-center mb-6 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent tracking-widest">
            {event.date}
          </p>

          {/* Title */}
          <h2 className="font-serif font-black text-2xl sm:text-3xl text-white text-center leading-tight mb-6">
            {event.title}
          </h2>

          {/* Location */}
          {event.location && (
            <p className="text-slate-500 text-sm text-center mb-4 flex items-center justify-center gap-1.5">
              <span>📍</span> {event.location}
            </p>
          )}

          {/* Summary */}
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed text-center max-w-xl mx-auto mb-6">
            {event.summary}
          </p>

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {event.tags.map(tag => (
                <span key={tag} className="px-2.5 py-0.5 rounded-full text-xs text-slate-500 border border-white/8 bg-white/3">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Details toggle */}
          <div className="flex justify-center mb-6">
            <button
              onClick={() => setShowDetails(d => !d)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all border ${
                showDetails
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              {showDetails ? '↑ Hide details' : '↓ Show details'}
              <span className="ml-2 text-[10px] text-slate-600">Space</span>
            </button>
          </div>

          {/* Expanded details */}
          {showDetails && (
            <div className="glass rounded-2xl p-5 sm:p-6 border border-white/8 mb-6 text-left">
              <div className="space-y-3 mb-4">
                {paragraphs.map((p, i) => (
                  <p key={i} className="text-slate-400 text-sm leading-relaxed">{p}</p>
                ))}
              </div>
              <div className="rounded-xl p-4 bg-amber-400/5 border border-amber-400/15">
                <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1.5">Significance</p>
                <p className="text-amber-100/75 text-sm leading-relaxed">{event.significance}</p>
              </div>
              {event.figures && event.figures.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {event.figures.map(f => (
                    <span key={f} className="text-xs text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/8">
                      👤 {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-6 py-5 border-t border-white/5 flex-shrink-0">
        <button
          onClick={() => navigate('prev')}
          disabled={index === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-20 disabled:cursor-default"
        >
          <span>←</span> Previous
          <span className="text-[10px] text-slate-700 ml-1">←</span>
        </button>

        {/* Dot navigator */}
        <div className="hidden sm:flex items-center gap-1 max-w-xs overflow-hidden">
          {events.map((_, i) => (
            <button
              key={i}
              onClick={() => { setIndex(i); setShowDetails(false); }}
              className={`rounded-full transition-all flex-shrink-0 ${
                i === index ? 'w-4 h-2 bg-amber-400' : 'w-1.5 h-1.5 bg-white/15 hover:bg-white/30'
              }`}
            />
          ))}
        </div>

        {index === total - 1 ? (
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-all"
          >
            Finish ✓
          </button>
        ) : (
          <button
            onClick={() => navigate('next')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all"
          >
            Next <span>→</span>
            <span className="text-[10px] text-slate-700 ml-1">→</span>
          </button>
        )}
      </div>
    </div>
  );
}
