import { useState, useEffect, useCallback } from 'react';
import type { TimelineEvent } from '../types';

interface Props {
  events: TimelineEvent[];
  topic: string;
  onClose: () => void;
}

type Answer = 'known' | 'missed' | null;

export default function FlashcardMode({ events, topic, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>(() => new Array(events.length).fill(null));
  const [done, setDone] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [flipClass, setFlipClass] = useState('');

  const event = events[index]!;
  const total = events.length;
  const answered = answers.filter(a => a !== null).length;
  const known = answers.filter(a => a === 'known').length;
  const missed = answers.filter(a => a === 'missed').length;
  const pct = (answered / total) * 100;

  const advance = useCallback((answer: Answer) => {
    if (animating) return;
    setAnswers(prev => {
      const next = [...prev];
      next[index] = answer;
      return next;
    });
    setAnimating(true);
    setFlipClass('opacity-0 scale-95');
    setTimeout(() => {
      const next = index + 1;
      if (next >= total) {
        setDone(true);
      } else {
        setIndex(next);
        setRevealed(false);
        setFlipClass('opacity-0 scale-105');
        setTimeout(() => {
          setFlipClass('');
          setAnimating(false);
        }, 50);
      }
      if (next < total) return;
      setAnimating(false);
    }, 200);
  }, [animating, index, total]);

  const reveal = useCallback(() => {
    if (!revealed) {
      setFlipClass('opacity-0 scale-98');
      setTimeout(() => {
        setRevealed(true);
        setFlipClass('');
      }, 150);
    }
  }, [revealed]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        if (!revealed) reveal();
        else advance('known');
      } else if (e.key === 'ArrowLeft' || e.key === 'x' || e.key === 'X') {
        if (revealed) advance('missed');
      } else if (e.key === 'ArrowRight' || e.key === 'c' || e.key === 'C') {
        if (revealed) advance('known');
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [revealed, reveal, advance, onClose]);

  const scoreColor = known / total >= 0.8 ? 'text-emerald-400' : known / total >= 0.5 ? 'text-amber-400' : 'text-rose-400';
  const scorePct = Math.round((known / total) * 100);

  if (done) {
    return (
      <div className="fixed inset-0 z-50 bg-[#060810] flex flex-col items-center justify-center px-6" onClick={e => e.stopPropagation()}>
        <div className="w-full max-w-md text-center fade-up">
          <p className="font-cinzel text-xs text-slate-500 tracking-widest uppercase mb-8">{topic}</p>

          <div className="glass rounded-3xl p-8 mb-8 border border-white/8">
            <p className="text-slate-500 text-sm mb-3">Final Score</p>
            <p className={`font-cinzel font-black text-7xl mb-2 ${scoreColor}`}>{scorePct}<span className="text-4xl">%</span></p>
            <p className="text-slate-400 text-sm">
              {known} known · {missed} missed · {total} total
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="glass rounded-2xl p-4 border border-emerald-500/15">
              <p className="text-emerald-400 text-2xl font-black">{known}</p>
              <p className="text-slate-500 text-xs mt-1">✓ Knew it</p>
            </div>
            <div className="glass rounded-2xl p-4 border border-rose-500/15">
              <p className="text-rose-400 text-2xl font-black">{missed}</p>
              <p className="text-slate-500 text-xs mt-1">✗ Missed</p>
            </div>
          </div>

          {scorePct < 100 && (
            <p className="text-slate-600 text-xs mb-6">
              {scorePct >= 80 ? 'Excellent recall!' : scorePct >= 60 ? 'Good work — review the ones you missed.' : 'Keep studying — try again to improve your score.'}
            </p>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setIndex(0); setRevealed(false); setAnswers(new Array(events.length).fill(null)); setDone(false); }}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-white/5 border border-white/15 text-slate-300 hover:text-white hover:border-white/25 transition-all"
            >
              ↩ Retry all
            </button>
            {missed > 0 && (
              <button
                onClick={() => {
                  const missedIndices = answers.map((a, i) => a === 'missed' ? i : -1).filter(i => i >= 0);
                  const missedEvents = missedIndices.map(i => events[i]!);
                  // Reset to study only missed events — achieved by closing and reopening with filtered set
                  // For simplicity: reset state and jump to first missed
                  setIndex(missedIndices[0] ?? 0);
                  setRevealed(false);
                  setAnswers(new Array(events.length).fill(null));
                  setDone(false);
                  void missedEvents;
                }}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-all"
              >
                Review {missed} missed
              </button>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-white/5 border border-white/15 text-slate-300 hover:text-white hover:border-white/25 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-emerald-500">{known}✓</span>
          <span className="text-rose-500">{missed}✗</span>
          <span className="text-slate-600">{index + 1}/{total}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-white/5 flex-shrink-0">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-hidden">
        <div className={`w-full max-w-xl transition-all duration-150 ease-out ${flipClass}`}>

          {/* Mode hint */}
          <p className="text-center text-[11px] text-slate-700 uppercase tracking-widest mb-5">
            {revealed ? 'How well did you know this?' : 'Do you know what happened on this date?'}
          </p>

          <div className="glass rounded-2xl border border-white/8 overflow-hidden">
            {/* Always shown: title */}
            <div className="p-6 sm:p-8 text-center">
              <h2 className="font-serif font-black text-2xl sm:text-3xl text-white leading-tight mb-4">
                {event.title}
              </h2>
              {event.location && (
                <p className="text-slate-600 text-sm flex items-center justify-center gap-1.5 mb-3">
                  <span>📍</span> {event.location}
                </p>
              )}
            </div>

            {/* Revealed content */}
            {revealed ? (
              <div className="border-t border-white/8 px-6 sm:px-8 pb-6 pt-5">
                <p className="font-cinzel font-black text-2xl text-center mb-5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent tracking-widest">
                  {event.date}
                </p>
                <p className="text-slate-300 text-sm leading-relaxed text-center mb-4">
                  {event.summary}
                </p>
                <div className="rounded-xl p-3 bg-amber-400/5 border border-amber-400/15">
                  <p className="text-amber-100/70 text-xs leading-relaxed text-center">{event.significance}</p>
                </div>
              </div>
            ) : (
              <div className="border-t border-white/5 px-6 pb-6 pt-5 text-center">
                <button
                  onClick={reveal}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-white/8 border border-white/15 text-slate-300 hover:text-white hover:bg-white/12 hover:border-white/25 transition-all"
                >
                  Reveal answer
                  <span className="ml-2 text-[10px] text-slate-600">Space</span>
                </button>
              </div>
            )}
          </div>

          {/* Score buttons — shown after reveal */}
          {revealed && (
            <div className="flex gap-3 justify-center mt-5">
              <button
                onClick={() => advance('missed')}
                className="flex-1 max-w-[160px] flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl text-sm font-semibold bg-rose-500/10 border border-rose-500/25 text-rose-300 hover:bg-rose-500/20 transition-all"
              >
                <span className="text-lg">✗</span>
                <span>Missed it</span>
                <span className="text-[10px] text-rose-700">← X</span>
              </button>
              <button
                onClick={() => advance('known')}
                className="flex-1 max-w-[160px] flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl text-sm font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20 transition-all"
              >
                <span className="text-lg">✓</span>
                <span>Knew it</span>
                <span className="text-[10px] text-emerald-700">→ C</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/5 flex-shrink-0 flex justify-center">
        <div className="hidden sm:flex items-center gap-1 max-w-xs overflow-hidden">
          {events.map((_, i) => {
            const a = answers[i];
            return (
              <div
                key={i}
                className={`rounded-full flex-shrink-0 transition-all ${
                  i === index ? 'w-4 h-2 bg-white/50' :
                  a === 'known' ? 'w-1.5 h-1.5 bg-emerald-500' :
                  a === 'missed' ? 'w-1.5 h-1.5 bg-rose-500' :
                  'w-1.5 h-1.5 bg-white/12'
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
