import { useState, useEffect, useRef } from 'react';
import type { SavedTimeline } from '../types';

interface Props {
  onSelect: (topic: string, startYear: string, endYear: string) => void;
}

const ORDER_PREFIX = 'epocha-col-order:';

function loadOrder(col: string): string[] {
  try { return JSON.parse(localStorage.getItem(ORDER_PREFIX + col) ?? '[]') as string[]; }
  catch { return []; }
}
function saveOrder(col: string, ids: string[]) {
  try { localStorage.setItem(ORDER_PREFIX + col, JSON.stringify(ids)); } catch { /* ignore */ }
}

function applyOrder(items: SavedTimeline[], order: string[]): SavedTimeline[] {
  if (!order.length) return items;
  const map = new Map(items.map(i => [i.id, i]));
  const ordered = order.map(id => map.get(id)).filter(Boolean) as SavedTimeline[];
  const rest = items.filter(i => !order.includes(i.id));
  return [...ordered, ...rest];
}

export default function SavedTimelines({ onSelect }: Props) {
  const [saved, setSaved] = useState<SavedTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [orders, setOrders] = useState<Record<string, string[]>>({});
  const dragId = useRef<string | null>(null);
  const dragCol = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => { void fetchSaved(); }, []);

  const fetchSaved = async () => {
    try {
      const res = await fetch('/api/saved', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as SavedTimeline[];
        setSaved(data);
        // Load saved orders for each collection
        const cols = [...new Set(data.map(t => t.collectionName ?? 'General'))];
        const loaded: Record<string, string[]> = {};
        cols.forEach(c => { loaded[c] = loadOrder(c); });
        setOrders(loaded);
      }
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

  const handleDragStart = (id: string, col: string) => {
    dragId.current = id;
    dragCol.current = col;
  };

  const handleDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    setDragOverId(overId);
  };

  const handleDrop = (e: React.DragEvent, targetId: string, col: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (!dragId.current || dragId.current === targetId || dragCol.current !== col) return;

    const colItems = applyOrder(
      saved.filter(t => (t.collectionName ?? 'General') === col),
      orders[col] ?? []
    );
    const ids = colItems.map(i => i.id);
    const fromIdx = ids.indexOf(dragId.current);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;

    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragId.current);
    saveOrder(col, ids);
    setOrders(prev => ({ ...prev, [col]: ids }));
    dragId.current = null;
  };

  const handleDragEnd = () => {
    dragId.current = null;
    dragCol.current = null;
    setDragOverId(null);
  };

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
        <p className="text-slate-400 text-sm mt-2">Your personal collection of historical timelines. Drag to reorder within collections.</p>
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
          {Object.entries(groups).map(([col, items]) => {
            const ordered = applyOrder(items, orders[col] ?? []);
            return (
              <div key={col}>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span>📁</span> {col}
                  <span className="text-slate-700 font-normal normal-case tracking-normal">· drag to reorder</span>
                </h2>
                <div className="space-y-1">
                  {ordered.map(item => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => handleDragStart(item.id, col)}
                      onDragOver={e => handleDragOver(e, item.id)}
                      onDrop={e => handleDrop(e, item.id, col)}
                      onDragEnd={handleDragEnd}
                      className={`glass rounded-xl border transition-all p-4 flex items-center gap-3 cursor-grab active:cursor-grabbing select-none ${
                        dragOverId === item.id
                          ? 'border-amber-500/40 bg-amber-500/5 scale-[1.01]'
                          : 'border-white/5 hover:border-white/10'
                      }`}
                    >
                      {/* Drag handle */}
                      <div className="text-slate-700 hover:text-slate-500 transition-colors flex-shrink-0 cursor-grab">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                          <circle cx="5" cy="4" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="5" cy="12" r="1.2"/>
                          <circle cx="11" cy="4" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
                        </svg>
                      </div>

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
            );
          })}
        </div>
      )}
    </div>
  );
}
