import { useState, useEffect } from 'react';
import type { SavedTimeline } from '../types';

interface Props {
  onSelect: (topic: string, startYear: string, endYear: string) => void;
}

export default function SavedTimelines({ onSelect }: Props) {
  const [saved, setSaved] = useState<SavedTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { void fetchSaved(); }, []);

  const fetchSaved = async () => {
    try {
      const res = await fetch('/api/saved', { credentials: 'include' });
      if (res.ok) setSaved(await res.json() as SavedTimeline[]);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/saved/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) setSaved(prev => prev.filter(t => t.id !== id));
    } catch { /* ignore */ }
    setDeleting(null);
  };

  // Group by collection
  const groups = saved.reduce<Record<string, SavedTimeline[]>>((acc, t) => {
    const col = t.collectionName ?? 'General';
    (acc[col] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <div className="mb-8">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Library</p>
        <h1 className="font-cinzel font-bold text-white text-2xl tracking-wider">Saved Timelines</h1>
        <p className="text-slate-400 text-sm mt-2">Your personal collection of historical timelines.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="glass rounded-xl h-16 animate-pulse" />)}
        </div>
      ) : saved.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border border-white/5">
          <div className="text-5xl mb-4">📚</div>
          <p className="text-white font-medium mb-2">No saved timelines yet</p>
          <p className="text-slate-500 text-sm">View a timeline and click Save to add it here.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groups).map(([collection, items]) => (
            <div key={collection}>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span>📁</span> {collection}
              </h2>
              <div className="space-y-2">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="glass rounded-xl border border-white/5 hover:border-white/10 transition-colors p-4 flex items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onSelect(item.topic, item.startYear, item.endYear)}
                        className="text-white font-medium text-sm hover:text-amber-300 transition-colors text-left truncate block max-w-full"
                      >
                        {item.title}
                      </button>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {item.startYear} – {item.endYear} · Saved {new Date(item.savedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => void handleDelete(item.id)}
                      disabled={deleting === item.id}
                      className="text-slate-700 hover:text-red-400 transition-colors text-lg flex-shrink-0 disabled:opacity-40"
                      title="Remove"
                    >
                      {deleting === item.id ? '…' : '×'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
