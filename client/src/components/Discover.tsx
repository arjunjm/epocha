import { useState } from 'react';
import { TOPIC_TAXONOMY } from '../data/topics';
import SurpriseButton from './SurpriseButton';

interface Props {
  onSelect: (topic: string, start: string, end: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Ancient History':       'from-amber-900/40 to-stone-900/40 border-amber-700/20 hover:border-amber-600/40',
  'Philosophy':            'from-violet-900/40 to-purple-900/40 border-violet-700/20 hover:border-violet-600/40',
  'Science & Technology':  'from-cyan-900/40 to-blue-900/40 border-cyan-700/20 hover:border-cyan-600/40',
  'World Wars & Conflict': 'from-red-900/40 to-rose-900/40 border-red-700/20 hover:border-red-600/40',
  'Empires & Dynasties':   'from-yellow-900/40 to-amber-900/40 border-yellow-700/20 hover:border-yellow-600/40',
  'Art & Culture':         'from-pink-900/40 to-fuchsia-900/40 border-pink-700/20 hover:border-pink-600/40',
  'Economics & Trade':     'from-green-900/40 to-emerald-900/40 border-green-700/20 hover:border-green-600/40',
  'Exploration & Discovery':'from-teal-900/40 to-cyan-900/40 border-teal-700/20 hover:border-teal-600/40',
};

const CATEGORY_ACCENT: Record<string, string> = {
  'Ancient History':        'text-amber-400',
  'Philosophy':             'text-violet-400',
  'Science & Technology':   'text-cyan-400',
  'World Wars & Conflict':  'text-red-400',
  'Empires & Dynasties':    'text-yellow-400',
  'Art & Culture':          'text-pink-400',
  'Economics & Trade':      'text-green-400',
  'Exploration & Discovery':'text-teal-400',
};

export default function Discover({ onSelect }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = TOPIC_TAXONOMY.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      !search || item.label.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat =>
    (!activeCategory || cat.label === activeCategory) && cat.items.length > 0
  );

  const totalTopics = TOPIC_TAXONOMY.reduce((n, c) => n + c.items.length, 0);

  return (
    <div className="max-w-5xl mx-auto px-5 py-10">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Discover</p>
        <h1 className="font-cinzel font-bold text-white text-2xl tracking-wider">Explore History</h1>
        <div className="flex items-center gap-4 mt-2">
          <p className="text-slate-400 text-sm">
            {totalTopics} curated timelines, ready instantly — no sign-in required.
          </p>
          <SurpriseButton onSelect={onSelect} variant="link" />
        </div>
      </div>

      {/* Search + category filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search topics…"
          className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500/40"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              !activeCategory ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/5 text-slate-500 border border-white/8 hover:border-white/15 hover:text-slate-300'
            }`}
          >
            All
          </button>
          {TOPIC_TAXONOMY.map(cat => (
            <button
              key={cat.label}
              onClick={() => setActiveCategory(a => a === cat.label ? null : cat.label)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeCategory === cat.label
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-white/5 text-slate-500 border border-white/8 hover:border-white/15 hover:text-slate-300'
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Topic grid */}
      <div className="space-y-10">
        {filtered.map(category => (
          <div key={category.label}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">{category.icon}</span>
              <h2 className={`font-bold text-sm tracking-wide ${CATEGORY_ACCENT[category.label] ?? 'text-slate-300'}`}>
                {category.label}
              </h2>
              <div className="flex-1 h-px bg-white/5 ml-2" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {category.items.map(item => (
                <button
                  key={item.label}
                  onClick={() => onSelect(item.topic, item.start, item.end)}
                  className={`
                    text-left p-4 rounded-xl border bg-gradient-to-br transition-all group
                    ${CATEGORY_COLORS[category.label] ?? 'from-slate-900/40 to-slate-800/40 border-white/8 hover:border-white/20'}
                  `}
                >
                  <p className="text-white font-medium text-sm leading-snug group-hover:text-amber-200 transition-colors">
                    {item.label}
                  </p>
                  <p className="text-slate-600 text-xs mt-1 group-hover:text-slate-500 transition-colors">
                    {item.start} – {item.end}
                  </p>
                  <p className={`text-[10px] mt-2 font-semibold opacity-0 group-hover:opacity-100 transition-opacity ${CATEGORY_ACCENT[category.label] ?? 'text-slate-400'}`}>
                    View timeline →
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-slate-600 text-sm">No topics match "{search}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
