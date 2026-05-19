import { useState, type FormEvent } from 'react';

interface Props {
  onSubmit: (topic: string, startYear: string, endYear: string) => void;
}

export default function TimelineForm({ onSubmit }: Props) {
  const [topic, setTopic] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !startYear.trim() || !endYear.trim()) return;
    onSubmit(topic.trim(), startYear.trim(), endYear.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 sm:p-8">
      <div className="mb-5">
        <label htmlFor="topic" className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
          Topic
        </label>
        <input
          id="topic"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., History of Western Philosophy"
          className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10 outline-none text-white placeholder:text-slate-600 transition-all text-sm"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="startYear" className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            From
          </label>
          <input
            id="startYear"
            type="text"
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
            placeholder="e.g., 600 BCE"
            className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10 outline-none text-white placeholder:text-slate-600 transition-all text-sm"
            required
          />
        </div>
        <div>
          <label htmlFor="endYear" className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            To
          </label>
          <input
            id="endYear"
            type="text"
            value={endYear}
            onChange={(e) => setEndYear(e.target.value)}
            placeholder="e.g., 400 CE"
            className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10 outline-none text-white placeholder:text-slate-600 transition-all text-sm"
            required
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full py-4 rounded-xl font-semibold text-sm tracking-wide text-black bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 active:scale-[0.98] transition-all shadow-lg shadow-amber-500/20"
      >
        Generate Timeline →
      </button>
    </form>
  );
}
