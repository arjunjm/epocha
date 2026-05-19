import { useState, useEffect } from 'react';
import type { QuizQuestion } from '../types';

interface Props {
  topic: string;
  startYear: string;
  endYear: string;
  onClose: () => void;
  onComplete: (score: number, total: number, xpEarned: number) => void;
}

type Phase = 'loading' | 'question' | 'answered' | 'results';

export default function QuizModal({ topic, startYear, endYear, onClose, onComplete }: Props) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);

  useEffect(() => {
    void fetchQuiz();
  }, []);

  const fetchQuiz = async () => {
    try {
      const params = new URLSearchParams({ topic, startYear, endYear });
      const res = await fetch(`/api/quiz?${params}`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Failed to load quiz');
        setPhase('results');
        return;
      }
      const data = await res.json() as { questions: QuizQuestion[] };
      setQuestions(data.questions);
      setPhase('question');
    } catch {
      setError('Failed to load quiz questions');
      setPhase('results');
    }
  };

  const handleSelect = (idx: number) => {
    if (phase !== 'question') return;
    setSelected(idx);
    setPhase('answered');
  };

  const handleNext = () => {
    const isCorrect = selected === questions[current]?.correct;
    const newAnswers = [...answers, isCorrect];
    setAnswers(newAnswers);
    setSelected(null);

    if (current + 1 >= questions.length) {
      const score = newAnswers.filter(Boolean).length;
      void submitCompletion(score, newAnswers.length);
    } else {
      setCurrent(c => c + 1);
      setPhase('question');
    }
  };

  const submitCompletion = async (score: number, total: number) => {
    try {
      const res = await fetch('/api/quiz/complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, total }),
      });
      if (res.ok) {
        const data = await res.json() as { xpEarned: number };
        onComplete(score, total, data.xpEarned);
      }
    } catch { /* non-fatal */ }
    setPhase('results');
  };

  const q = questions[current];
  const score = answers.filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass rounded-2xl w-full max-w-lg p-6 border border-white/10 fade-up">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-cinzel font-bold text-white text-sm tracking-wider">KNOWLEDGE CHECK</h2>
            <p className="text-slate-500 text-xs mt-0.5">{topic}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-colors text-lg leading-none">×</button>
        </div>

        {/* Loading */}
        {phase === 'loading' && (
          <div className="py-12 text-center">
            <div className="w-10 h-10 border-2 border-t-amber-400 border-white/10 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Generating questions…</p>
          </div>
        )}

        {/* Error / Results */}
        {phase === 'results' && (
          <div className="py-6 text-center">
            {error ? (
              <>
                <div className="text-4xl mb-3">⚠️</div>
                <p className="text-red-300 text-sm">{error}</p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-3">{score >= 4 ? '🏆' : score >= 3 ? '🎯' : '📚'}</div>
                <p className="text-white font-bold text-xl mb-1">{score}/{questions.length} correct</p>
                <p className="text-slate-400 text-sm">
                  {score >= 4 ? 'Excellent! You know this topic well.' : score >= 3 ? 'Good work! Keep exploring.' : 'Keep learning — you\'ll get it next time!'}
                </p>
                <div className="mt-5 grid grid-cols-5 gap-2">
                  {answers.map((correct, i) => (
                    <div key={i} className={`h-2 rounded-full ${correct ? 'bg-emerald-500' : 'bg-red-500/60'}`} />
                  ))}
                </div>
              </>
            )}
            <button onClick={onClose} className="mt-6 px-5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-sm font-medium transition-colors">
              Close
            </button>
          </div>
        )}

        {/* Question */}
        {(phase === 'question' || phase === 'answered') && q && (
          <>
            {/* Progress */}
            <div className="flex items-center gap-2 mb-5">
              {questions.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < current ? 'bg-amber-500' : i === current ? 'bg-amber-400/60' : 'bg-white/10'}`} />
              ))}
            </div>

            <p className="text-xs text-slate-500 mb-2">Question {current + 1} of {questions.length}</p>
            <p className="text-white font-medium text-sm leading-relaxed mb-5">{q.question}</p>

            <div className="space-y-2">
              {q.options.map((opt, i) => {
                let style = 'border-white/10 hover:border-white/20 bg-white/3 hover:bg-white/5 text-slate-300 cursor-pointer';
                if (phase === 'answered') {
                  if (i === q.correct) style = 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 cursor-default';
                  else if (i === selected) style = 'border-red-500/50 bg-red-500/10 text-red-300 cursor-default';
                  else style = 'border-white/5 bg-white/2 text-slate-600 cursor-default';
                } else if (phase === 'question') {
                  style = 'border-white/10 hover:border-amber-500/40 bg-white/3 hover:bg-amber-500/10 text-slate-300 cursor-pointer transition-colors';
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(i)}
                    disabled={phase === 'answered'}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${style}`}
                  >
                    <span className="text-xs text-slate-600 mr-2">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {phase === 'answered' && (
              <div className="mt-4">
                <p className="text-xs text-slate-400 bg-white/5 rounded-lg px-3 py-2 leading-relaxed mb-4">
                  {q.explanation}
                </p>
                <button
                  onClick={handleNext}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm transition-colors"
                >
                  {current + 1 >= questions.length ? 'See Results' : 'Next Question →'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
