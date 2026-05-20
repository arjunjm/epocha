import { useState, useEffect, useRef } from 'react';

interface JobStatus {
  running: boolean;
  logs: string[];
}

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
    description: 'Ask the LLM for today\'s 10 most significant global events and generate timelines for each. Populates the Trending sidebar section.',
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
  const [triggering, setTriggering] = useState<Record<string, boolean>>({});
  const [triggerResult, setTriggerResult] = useState<string | null>(null);
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
      const res = await fetch(card.endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRegenerate: forceRegen[card.id] }),
      });
      const body = await res.json() as { message?: string; error?: string };
      if (res.ok) {
        setTriggerResult(`Started: ${body.message ?? 'OK'}`);
        await fetchStatus();
      } else {
        setTriggerResult(`Error: ${body.error ?? res.statusText}`);
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
      </div>
    </div>
  );
}
