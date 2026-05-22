import { useState, useEffect } from 'react';
import type { QuizResult } from '../types';
import type { Completion } from '../hooks/useCompletions';
import type { HistoryEntry } from '../hooks/useHistory';

interface ServerStats {
  quizResults: QuizResult[];
  savedCount: number;
}

function loadLocalCompletions(): Completion[] {
  try { return JSON.parse(localStorage.getItem('epocha-completions') ?? '[]') as Completion[]; }
  catch { return []; }
}

function loadLocalHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem('epocha-history') ?? '[]') as HistoryEntry[]; }
  catch { return []; }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function ScoreBar({ score, total }: { score: number; total: number }) {
  const pct = Math.round((score / total) * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-300 tabular-nums">{score}/{total}</span>
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const completions = loadLocalCompletions();
  const history = loadLocalHistory();

  useEffect(() => {
    fetch('/api/stats', { credentials: 'include' })
      .then(r => r.ok ? r.json() as Promise<ServerStats> : Promise.reject())
      .then(setStats)
      .catch(() => setStats({ quizResults: [], savedCount: 0 }))
      .finally(() => setLoading(false));
  }, []);

  const quizResults = stats?.quizResults ?? [];
  const avgScore = quizResults.length
    ? Math.round(quizResults.reduce((n, r) => n + (r.score / r.total) * 100, 0) / quizResults.length)
    : null;
  const totalXpFromQuizzes = quizResults.reduce((n, r) => n + r.xpEarned, 0);

  return (
    <div className="min-h-screen px-4 py-10 lg:pl-80">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-bold text-white mb-1">Your Stats</h1>
          <p className="text-sm text-slate-500">Your learning history and quiz performance</p>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Topics explored', value: String(history.length) },
            { label: 'Topics completed', value: String(completions.length) },
            { label: 'Quizzes taken', value: loading ? '…' : String(quizResults.length) },
            { label: 'Avg quiz score', value: loading ? '…' : avgScore !== null ? `${avgScore}%` : '—' },
          ].map(s => (
            <div key={s.label} className="glass rounded-2xl border border-white/8 px-4 py-4 text-center">
              <p className="text-white font-bold text-2xl mb-0.5">{s.value}</p>
              <p className="text-slate-600 text-[11px] leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quiz history */}
        <div className="glass rounded-2xl border border-white/8 overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Quiz History</span>
            {totalXpFromQuizzes > 0 && (
              <span className="text-xs text-amber-400/70">+{totalXpFromQuizzes} XP total</span>
            )}
          </div>
          {loading ? (
            <div className="px-5 py-6 text-center text-slate-700 text-xs italic">Loading…</div>
          ) : quizResults.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-slate-600 text-sm mb-1">No quizzes taken yet</p>
              <p className="text-slate-700 text-xs">Open a timeline and tap 🧠 Quiz to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#0d1120] border-b border-white/5">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-slate-600 font-medium">Topic</th>
                    <th className="text-left px-3 py-2.5 text-slate-600 font-medium">Score</th>
                    <th className="text-left px-3 py-2.5 text-slate-600 font-medium hidden sm:table-cell">XP</th>
                    <th className="text-left px-3 py-2.5 text-slate-600 font-medium hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {quizResults.map(r => (
                    <tr key={r.id} className="border-b border-white/3 hover:bg-white/3">
                      <td className="px-4 py-2.5 text-slate-300 max-w-[180px] truncate" title={r.topic}>
                        {r.topic || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <ScoreBar score={r.score} total={r.total} />
                      </td>
                      <td className="px-3 py-2.5 text-amber-400/70 hidden sm:table-cell">+{r.xpEarned}</td>
                      <td className="px-3 py-2.5 text-slate-600 hidden sm:table-cell whitespace-nowrap">
                        {formatDate(r.takenAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Completed topics */}
        <div className="glass rounded-2xl border border-white/8 overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-white/5">
            <span className="text-xs font-semibold text-slate-300">Completed Topics</span>
            <span className="text-xs text-slate-600 ml-2">{completions.length} topic{completions.length !== 1 ? 's' : ''}</span>
          </div>
          {completions.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-slate-600 text-sm mb-1">No topics completed yet</p>
              <p className="text-slate-700 text-xs">Read all events in a timeline to mark it complete</p>
            </div>
          ) : (
            <div className="divide-y divide-white/3 max-h-[300px] overflow-y-auto scrollbar-thin">
              {completions.map((c, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-2.5 hover:bg-white/3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-emerald-500 text-xs flex-shrink-0">✓</span>
                    <span className="text-slate-300 text-xs truncate">{c.topic}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="text-slate-600 text-[11px] hidden sm:block">{c.period}</span>
                    <span className="text-slate-700 text-[11px]">{formatDate(new Date(c.completedAt).toISOString())}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent history */}
        <div className="glass rounded-2xl border border-white/8 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <span className="text-xs font-semibold text-slate-300">Recently Explored</span>
            <span className="text-xs text-slate-600 ml-2">{history.length} topic{history.length !== 1 ? 's' : ''}</span>
          </div>
          {history.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-slate-600 text-sm">No history yet — start exploring!</p>
            </div>
          ) : (
            <div className="divide-y divide-white/3">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-2.5 hover:bg-white/3">
                  <span className="text-slate-300 text-xs truncate">{h.title || h.topic}</span>
                  <span className="text-slate-700 text-[11px] flex-shrink-0 ml-3">
                    {formatDate(new Date(h.viewedAt).toISOString())}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
