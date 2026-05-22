import { useState, type FormEvent } from 'react';
import { TOPIC_TAXONOMY } from '../data/topics';

interface Props {
  onSubmit: (topic: string, startYear: string, endYear: string, liteMode: boolean) => void;
  remaining?: number;
  dailyLimit?: number;
}

export default function TimelineForm({ onSubmit, remaining, dailyLimit }: Props) {
  const [topic, setTopic] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [liteMode, setLiteMode] = useState(true);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    onSubmit(topic.trim(), startYear.trim(), endYear.trim(), liteMode);
  };

  const used = dailyLimit != null && remaining != null ? dailyLimit - remaining : null;
  const pct = used != null && dailyLimit ? used / dailyLimit : 0;
  const isLow = remaining != null && remaining <= 2;
  const isOut = remaining === 0;

  return (
    <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 sm:p-8">
      <div className="mb-5">
        <label htmlFor="topic" className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
          Topic
        </label>
        <input
          id="topic"
          type="text"
          list="topic-suggestions"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., History of Western Philosophy"
          className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10 outline-none text-white placeholder:text-slate-600 transition-all text-sm"
          required
          autoComplete="off"
        />
        <datalist id="topic-suggestions">
          {TOPIC_TAXONOMY.flatMap(cat => cat.items).map(item => (
            <option key={item.topic} value={item.topic} />
          ))}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="startYear" className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            From <span className="text-slate-600 normal-case font-normal tracking-normal">optional</span>
          </label>
          <input
            id="startYear"
            type="text"
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
            placeholder="e.g., 600 BCE"
            className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10 outline-none text-white placeholder:text-slate-600 transition-all text-sm"
          />
        </div>
        <div>
          <label htmlFor="endYear" className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            To <span className="text-slate-600 normal-case font-normal tracking-normal">optional</span>
          </label>
          <input
            id="endYear"
            type="text"
            value={endYear}
            onChange={(e) => setEndYear(e.target.value)}
            placeholder="e.g., 400 CE"
            className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10 outline-none text-white placeholder:text-slate-600 transition-all text-sm"
          />
        </div>
      </div>

      {/* Lite mode toggle */}
      <label className="flex items-center justify-between mb-4 cursor-pointer select-none group">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Full details</span>
          <p className="text-[11px] text-slate-600 mt-0.5">
            {liteMode ? 'Summaries only — ~2× faster' : 'Full paragraphs per event — slower'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!liteMode}
          onClick={() => setLiteMode(m => !m)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
            !liteMode ? 'bg-amber-500' : 'bg-white/10'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              !liteMode ? 'translate-x-4.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </label>

      <button
        type="submit"
        disabled={isOut}
        className="w-full py-4 rounded-xl font-semibold text-sm tracking-wide text-black bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 active:scale-[0.98] transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isOut ? 'Daily limit reached' : liteMode ? 'Quick explore →' : 'Explore (full details) →'}
      </button>

      {/* Daily usage bar */}
      {used != null && dailyLimit != null && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] text-slate-600">Daily generations</span>
            <span className={`text-[10px] font-semibold ${isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-slate-600'}`}>
              {used}/{dailyLimit}
              {isOut && ' · Resets at midnight UTC'}
            </span>
          </div>
          <div className="h-1 rounded-full bg-white/8 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isOut ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(pct * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </form>
  );
}
