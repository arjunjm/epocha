import { useState, useEffect, useRef, useCallback } from 'react';

interface AdminProgress {
  total: number;
  pending: number;
  done: number;
}

interface JobStatus {
  running: boolean;
  logs: string[];
  progress?: AdminProgress;
}

interface SearchEvent {
  topic: string;
  userId?: string;
  cacheHit: boolean;
  publicBrowse: boolean;
  ts: number;
  time: string;
}

interface AnalyticsSummary {
  totalSearches7d: number;
  searchesToday: number;
  cacheHitRate7d: number;
  topTopics: { topic: string; count: number }[];
  recentSearches: SearchEvent[];
}

interface CacheEntry {
  key: string;
  topic: string;
  startYear: string;
  endYear: string;
  ttlSeconds: number;
  source: 'sidebar' | 'trending' | 'user';
}

function formatTtl(secs: number): string {
  if (secs < 0) return 'expired';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

type NewsSource = 'llm' | 'guardian' | 'newsapi' | 'rss';

const NEWS_SOURCE_OPTIONS: { value: NewsSource; label: string; note?: string }[] = [
  { value: 'llm',      label: 'LLM (GPT-4o / Haiku)' },
  { value: 'rss',      label: 'RSS Feeds',      note: 'BBC World · Al Jazeera · NPR — no API key needed' },
  { value: 'guardian', label: 'The Guardian',   note: 'requires guardian-api-key in Key Vault' },
  { value: 'newsapi',  label: 'NewsAPI',         note: 'requires newsapi-key in Key Vault (localhost only on free tier)' },
];

interface TriggerCard {
  id: 'trending' | 'pregenerate';
  title: string;
  description: string;
  endpoint: string;
}

const TRIGGERS: TriggerCard[] = [
  {
    id: 'trending',
    title: 'Trending Events',
    description: 'Fetch today\'s 10 most significant global events and generate timelines for each. Populates the Trending sidebar section.',
    endpoint: '/api/admin/trigger/trending',
  },
  {
    id: 'pregenerate',
    title: 'Full Pre-generation',
    description: 'Run the 3-phase queue: trending events → popular user searches → AI-suggested topics → sidebar topics. Up to 80 timelines.',
    endpoint: '/api/admin/trigger/pregenerate',
  },
];

export default function AdminPage() {
  const [status, setStatus] = useState<JobStatus>({ running: false, logs: [] });
  const [forceRegen, setForceRegen] = useState<Record<string, boolean>>({ trending: false, pregenerate: false });
  const [newsSource, setNewsSource] = useState<NewsSource>('llm');
  const [triggering, setTriggering] = useState<Record<string, boolean>>({});
  const [triggerResult, setTriggerResult] = useState<string | null>(null);
  const [cache, setCache] = useState<CacheEntry[] | null>(null);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [cacheFilter, setCacheFilter] = useState<'all' | 'sidebar' | 'trending' | 'user'>('all');
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/status', { credentials: 'include' });
      if (res.ok) setStatus(await res.json() as JobStatus);
    } catch { /* ignore */ }
  };

  // Auto-scroll log to bottom on new entries
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [status.logs.length]);

  // Poll status — faster while running
  useEffect(() => {
    void fetchStatus();
    const schedule = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        void fetchStatus().then(() => {
          // Re-schedule with correct interval based on new running state
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = setInterval(() => void fetchStatus(), status.running ? 2000 : 10000);
        });
      }, status.running ? 2000 : 10000);
    };
    schedule();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status.running]); // eslint-disable-line react-hooks/exhaustive-deps

  const trigger = async (card: TriggerCard) => {
    setTriggering(p => ({ ...p, [card.id]: true }));
    setTriggerResult(null);
    try {
      const payload: Record<string, unknown> = { forceRegenerate: forceRegen[card.id] };
      if (card.id === 'trending') payload.newsSource = newsSource;
      const res = await fetch(card.endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resBody = await res.json() as { message?: string; error?: string };
      if (res.ok) {
        setTriggerResult(`Started: ${resBody.message ?? 'OK'}`);
        await fetchStatus();
      } else {
        setTriggerResult(`Error: ${resBody.error ?? res.statusText}`);
      }
    } catch (err) {
      setTriggerResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTriggering(p => ({ ...p, [card.id]: false }));
    }
  };

  const clearLogs = async () => {
    await fetch('/api/admin/logs', { method: 'DELETE', credentials: 'include' });
    setStatus(p => ({ ...p, logs: [] }));
  };

  const fetchCache = async () => {
    setCacheLoading(true);
    try {
      const res = await fetch('/api/admin/cache', { credentials: 'include' });
      if (res.ok) setCache(await res.json() as CacheEntry[]);
    } catch { /* ignore */ }
    setCacheLoading(false);
  };

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch('/api/admin/analytics', { credentials: 'include' });
      if (res.ok) setAnalytics(await res.json() as AnalyticsSummary);
    } catch { /* ignore */ }
    setAnalyticsLoading(false);
  }, []);

  const deleteEntry = async (key: string) => {
    setDeletingKey(key);
    try {
      await fetch(`/api/admin/cache/${encodeURIComponent(key)}`, { method: 'DELETE', credentials: 'include' });
      setCache(prev => prev?.filter(e => e.key !== key) ?? null);
    } catch { /* ignore */ }
    setDeletingKey(null);
  };

  return (
    <div className="min-h-screen bg-[#080c18] px-4 py-8 lg:pl-80">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-bold text-white mb-1">Admin Console</h1>
          <p className="text-sm text-slate-500">Manage Azure Function jobs and cache</p>
        </div>

        {/* Trigger cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {TRIGGERS.map(card => (
            <div key={card.id} className="glass rounded-2xl p-5 border border-white/8">
              <h2 className="text-sm font-semibold text-white mb-1">{card.title}</h2>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">{card.description}</p>

              {/* News source selector — Trending Events only */}
              {card.id === 'trending' && (
                <div className="mb-4">
                  <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-1.5">News source</p>
                  <div className="flex flex-col gap-1.5">
                    {NEWS_SOURCE_OPTIONS.map(opt => (
                      <label key={opt.value} className="flex items-start gap-2 cursor-pointer group">
                        <input
                          type="radio"
                          name="newsSource"
                          value={opt.value}
                          checked={newsSource === opt.value}
                          onChange={() => setNewsSource(opt.value)}
                          className="mt-0.5 accent-amber-400"
                        />
                        <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors leading-snug">
                          {opt.label}
                          {opt.note && <span className="block text-[10px] text-slate-700">{opt.note}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 mb-4 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={forceRegen[card.id] ?? false}
                  onChange={e => setForceRegen(p => ({ ...p, [card.id]: e.target.checked }))}
                  className="w-3.5 h-3.5 accent-amber-400"
                />
                <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">
                  Force regenerate <span className="text-slate-600">(ignore TTL, flush cache)</span>
                </span>
              </label>

              <button
                onClick={() => void trigger(card)}
                disabled={triggering[card.id] || status.running}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all
                  bg-amber-400/10 text-amber-300 border border-amber-400/20
                  hover:bg-amber-400/20 hover:border-amber-400/40
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {triggering[card.id] ? (
                  <>
                    <span className="w-3 h-3 rounded-full border-2 border-amber-400/40 border-t-amber-400 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <span className="text-base leading-none">▶</span>
                    Run
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        {triggerResult && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-xs border ${
            triggerResult.startsWith('Error')
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}>
            {triggerResult}
          </div>
        )}

        {/* Job log */}
        <div className="glass rounded-2xl border border-white/8 overflow-hidden">
          {/* Progress bar — visible when total > 0 */}
          {status.progress && status.progress.total > 0 && (
            <div className="px-5 pt-3 pb-2 border-b border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400">
                  {status.running
                    ? `Generating… ${status.progress.done} / ${status.progress.total}`
                    : `Complete — ${status.progress.done} / ${status.progress.total}`}
                </span>
                <span className="text-xs text-slate-600">
                  {Math.round((status.progress.done / status.progress.total) * 100)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    status.running ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.round((status.progress.done / status.progress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-300">Job Log</span>
              {status.running && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Running
                </span>
              )}
              {!status.running && status.logs.length > 0 && (
                <span className="text-xs text-slate-600">{status.logs.length} entries</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => void fetchStatus()}
                className="text-xs text-slate-600 hover:text-amber-400 transition-colors"
              >
                Refresh
              </button>
              <button
                onClick={() => void clearLogs()}
                disabled={status.logs.length === 0}
                className="text-xs text-slate-600 hover:text-red-400 transition-colors disabled:opacity-30"
              >
                Clear
              </button>
            </div>
          </div>

          <div
            ref={logRef}
            className="h-96 overflow-y-auto bg-black/30 p-4 font-mono text-[11px] leading-relaxed scrollbar-thin"
          >
            {status.logs.length === 0 ? (
              <p className="text-slate-700 italic">No log entries yet. Trigger a job to see progress here.</p>
            ) : (
              status.logs.map((line, i) => {
                const isWarn = line.toLowerCase().includes('warn') || line.toLowerCase().includes('failed') || line.toLowerCase().includes('error');
                const isGood = line.toLowerCase().includes('cached:') || line.toLowerCase().includes('complete');
                return (
                  <div
                    key={i}
                    className={`${isWarn ? 'text-amber-400/80' : isGood ? 'text-emerald-400/80' : 'text-slate-400'}`}
                  >
                    {line}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Cache contents */}
        <div className="glass rounded-2xl border border-white/8 overflow-hidden mt-6">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-300">Cached Timelines</span>
              {cache !== null && (
                <span className="text-xs text-slate-600">{cache.length} entries</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Source filter */}
              {cache !== null && (
                <div className="flex gap-1">
                  {(['all', 'sidebar', 'trending', 'user'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setCacheFilter(f)}
                      className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                        cacheFilter === f
                          ? 'bg-amber-400/20 text-amber-300'
                          : 'text-slate-600 hover:text-slate-400'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => void fetchCache()}
                disabled={cacheLoading}
                className="text-xs text-slate-600 hover:text-amber-400 transition-colors disabled:opacity-40"
              >
                {cacheLoading ? 'Loading…' : 'Load'}
              </button>
            </div>
          </div>

          {cache === null ? (
            <div className="px-5 py-6 text-xs text-slate-700 text-center italic">
              Click Load to view the current Redis cache contents
            </div>
          ) : cache.length === 0 ? (
            <div className="px-5 py-6 text-xs text-slate-700 text-center italic">
              No timeline entries in cache
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#0d1120] border-b border-white/5">
                  <tr>
                    <th className="text-left px-4 py-2 text-slate-600 font-medium">Topic</th>
                    <th className="text-left px-3 py-2 text-slate-600 font-medium">Period</th>
                    <th className="text-left px-3 py-2 text-slate-600 font-medium">Source</th>
                    <th className="text-left px-3 py-2 text-slate-600 font-medium">TTL</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {cache
                    .filter(e => cacheFilter === 'all' || e.source === cacheFilter)
                    .map(entry => {
                      const ttlPct = Math.max(0, Math.min(100, (entry.ttlSeconds / (7 * 86400)) * 100));
                      const ttlColor = ttlPct > 50 ? 'text-emerald-400/70' : ttlPct > 20 ? 'text-amber-400/70' : 'text-red-400/70';
                      return (
                        <tr key={entry.key} className="border-b border-white/3 hover:bg-white/3 group">
                          <td className="px-4 py-2 text-slate-300 max-w-[220px] truncate" title={entry.topic}>
                            {entry.topic}
                          </td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                            {entry.startYear && entry.endYear ? `${entry.startYear} – ${entry.endYear}` : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              entry.source === 'sidebar' ? 'bg-blue-500/10 text-blue-400/80' :
                              entry.source === 'trending' ? 'bg-amber-500/10 text-amber-400/80' :
                              'bg-white/5 text-slate-500'
                            }`}>
                              {entry.source}
                            </span>
                          </td>
                          <td className={`px-3 py-2 font-mono whitespace-nowrap ${ttlColor}`}>
                            {formatTtl(entry.ttlSeconds)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => void deleteEntry(entry.key)}
                              disabled={deletingKey === entry.key}
                              className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-700 hover:text-red-400 transition-all disabled:opacity-40"
                              title="Remove from cache"
                            >
                              {deletingKey === entry.key ? '…' : '✕'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Search analytics */}
        <div className="glass rounded-2xl border border-white/8 overflow-hidden mt-6">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
            <span className="text-xs font-semibold text-slate-300">Search Analytics</span>
            <button
              onClick={() => void fetchAnalytics()}
              disabled={analyticsLoading}
              className="text-xs text-slate-600 hover:text-amber-400 transition-colors disabled:opacity-40"
            >
              {analyticsLoading ? 'Loading…' : 'Load'}
            </button>
          </div>

          {analytics === null ? (
            <div className="px-5 py-6 text-xs text-slate-700 text-center italic">
              Click Load to view search analytics (last 7 days)
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* Stat cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Searches today', value: String(analytics.searchesToday) },
                  { label: 'Searches (7d)', value: String(analytics.totalSearches7d) },
                  { label: 'Cache hit rate', value: `${analytics.cacheHitRate7d}%` },
                ].map(s => (
                  <div key={s.label} className="rounded-xl bg-white/4 border border-white/8 px-3 py-3 text-center">
                    <p className="text-white font-bold text-lg">{s.value}</p>
                    <p className="text-slate-600 text-[10px] mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Top topics */}
              {analytics.topTopics.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Top topics (7d)</p>
                  <div className="space-y-1.5">
                    {analytics.topTopics.map(({ topic, count }) => {
                      const pct = Math.round((count / (analytics.topTopics[0]?.count ?? 1)) * 100);
                      return (
                        <div key={topic} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-slate-300 text-[11px] truncate">{topic}</span>
                              <span className="text-slate-600 text-[10px] ml-2 flex-shrink-0">{count}</span>
                            </div>
                            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full rounded-full bg-amber-400/50" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent searches */}
              {analytics.recentSearches.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Recent searches</p>
                  <div className="space-y-1">
                    {analytics.recentSearches.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.cacheHit ? 'bg-emerald-500' : 'bg-amber-500'}`} title={s.cacheHit ? 'cache hit' : 'LLM generated'} />
                        <span className="text-slate-300 flex-1 truncate">{s.topic}</span>
                        <span className="text-slate-700 flex-shrink-0">{s.publicBrowse ? 'public' : 'auth'}</span>
                        <span className="text-slate-700 flex-shrink-0 font-mono">{new Date(s.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-700">● green = cache hit · ● amber = LLM generated</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
