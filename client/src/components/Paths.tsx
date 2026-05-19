import { useState, useEffect } from 'react';
import { LEARNING_PATHS, type LearningPath } from '../data/paths';

const PROGRESS_KEY = 'epocha-path-progress';

function loadProgress(): Record<string, Set<string>> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, new Set(v)]));
  } catch { return {}; }
}

function saveProgress(progress: Record<string, Set<string>>) {
  const serialisable = Object.fromEntries(
    Object.entries(progress).map(([k, v]) => [k, [...v]])
  );
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(serialisable));
}

interface Props {
  onSelect: (topic: string, start: string, end: string) => void;
}

export default function Paths({ onSelect }: Props) {
  const [progress, setProgress] = useState<Record<string, Set<string>>>({});
  const [expanded, setExpanded] = useState<string | null>(LEARNING_PATHS[0]?.id ?? null);

  useEffect(() => { setProgress(loadProgress()); }, []);

  const markViewed = (pathId: string, topic: string) => {
    setProgress(prev => {
      const next = { ...prev, [pathId]: new Set([...(prev[pathId] ?? []), topic]) };
      saveProgress(next);
      return next;
    });
  };

  const handleStepClick = (path: LearningPath, topic: string, start: string, end: string) => {
    markViewed(path.id, topic);
    onSelect(topic, start, end);
  };

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <div className="mb-8">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Learning Paths</p>
        <h1 className="font-cinzel font-bold text-white text-2xl tracking-wider">Guided Journeys</h1>
        <p className="text-slate-400 text-sm mt-2">
          Curated sequences of timelines for structured historical learning. Your progress is saved.
        </p>
      </div>

      <div className="space-y-4">
        {LEARNING_PATHS.map(path => {
          const viewed = progress[path.id] ?? new Set<string>();
          const done = path.steps.filter(s => viewed.has(s.topic)).length;
          const pct = Math.round((done / path.steps.length) * 100);
          const isExpanded = expanded === path.id;

          return (
            <div
              key={path.id}
              className={`rounded-2xl border overflow-hidden transition-all bg-gradient-to-br ${path.color} ${
                isExpanded ? 'border-white/15' : 'border-white/8 hover:border-white/12'
              }`}
            >
              {/* Path header */}
              <button
                className="w-full text-left p-5 flex items-start gap-4"
                onClick={() => setExpanded(e => e === path.id ? null : path.id)}
              >
                <span className="text-3xl flex-shrink-0 mt-0.5">{path.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <h2 className={`font-bold text-base ${path.accentColor}`}>{path.title}</h2>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-slate-500">{done}/{path.steps.length}</span>
                      <svg
                        className={`w-4 h-4 text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed mb-3">{path.description}</p>
                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {pct === 100 && <span className="text-[10px] text-emerald-400 font-bold flex-shrink-0">✓ Complete</span>}
                  </div>
                </div>
              </button>

              {/* Steps */}
              {isExpanded && (
                <div className="border-t border-white/8 divide-y divide-white/5">
                  {path.steps.map((step, i) => {
                    const seen = viewed.has(step.topic);
                    return (
                      <button
                        key={step.topic}
                        onClick={() => handleStepClick(path, step.topic, step.start, step.end)}
                        className="w-full text-left px-5 py-3.5 flex items-center gap-4 hover:bg-white/4 transition-colors group"
                      >
                        {/* Step number / checkmark */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border transition-all ${
                          seen
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-white/5 border-white/15 text-slate-500 group-hover:border-amber-500/40 group-hover:text-amber-400'
                        }`}>
                          {seen ? '✓' : i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium transition-colors ${seen ? 'text-slate-400' : 'text-slate-200 group-hover:text-white'}`}>
                            {step.label}
                          </p>
                          <p className="text-[10px] text-slate-600 mt-0.5">{step.start} – {step.end}</p>
                        </div>
                        <svg className="w-3.5 h-3.5 text-slate-700 group-hover:text-amber-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
