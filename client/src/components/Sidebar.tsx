import { useState, useEffect } from 'react';
import { TOPIC_TAXONOMY, type TopicEntry } from '../data/topics';
import type { CustomTopic } from '../types';
import type { AuthUser } from '../hooks/useAuth';
import type { HistoryEntry } from '../hooks/useHistory';

interface Props {
  onSelect: (topic: string, start: string, end: string) => void;
  activeTopic?: string;
  isOpen: boolean;
  onClose: () => void;
  user?: AuthUser | null;
  onSignIn?: () => void;
  history?: HistoryEntry[];
}

export default function Sidebar({ onSelect, activeTopic, isOpen, onClose, user, onSignIn, history = [] }: Props) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['Philosophy', 'Science & Technology'])
  );
  const [customTopics, setCustomTopics] = useState<CustomTopic[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTopic, setNewTopic] = useState({ name: '', icon: '📌', label: '', start: '', end: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (user) void fetchCustomTopics();
  }, [user]);

  const fetchCustomTopics = async () => {
    try {
      const res = await fetch('/api/topics/custom', { credentials: 'include' });
      if (res.ok) setCustomTopics(await res.json() as CustomTopic[]);
    } catch { /* ignore */ }
  };

  const toggleSection = (label: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const handleSelect = (item: TopicEntry) => {
    onSelect(item.topic, item.start, item.end);
    onClose();
  };

  const handleAddCustomTopic = async () => {
    if (!newTopic.name || !newTopic.label || !newTopic.start || !newTopic.end) return;
    setAdding(true);
    try {
      const res = await fetch('/api/topics/custom', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTopic.name,
          icon: newTopic.icon || '📌',
          items: [{ label: newTopic.label, topic: newTopic.label, start: newTopic.start, end: newTopic.end }],
        }),
      });
      if (res.ok) {
        const created = await res.json() as CustomTopic;
        setCustomTopics(prev => [...prev, created]);
        setNewTopic({ name: '', icon: '📌', label: '', start: '', end: '' });
        setShowAddForm(false);
      }
    } catch { /* ignore */ }
    setAdding(false);
  };

  const handleDeleteCustomTopic = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/topics/custom/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) setCustomTopics(prev => prev.filter(t => t.id !== id));
    } catch { /* ignore */ }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed top-[52px] left-0 z-40 h-[calc(100vh-52px)] w-64
        bg-[#0d1120] border-r border-white/5
        flex flex-col overflow-hidden
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="px-4 py-4 border-b border-white/5 flex-shrink-0">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Browse Topics</p>
        </div>

        <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
          {/* Recently viewed */}
          {history.length > 0 && (
            <div className="mb-1 border-b border-white/5 pb-2">
              <p className="px-4 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Recent</p>
              {history.slice(0, 5).map(entry => {
                const isActive = activeTopic === entry.topic;
                return (
                  <button
                    key={`${entry.topic}-${entry.start}`}
                    onClick={() => { onSelect(entry.topic, entry.start, entry.end); onClose(); }}
                    className={`
                      w-full text-left px-4 py-2 pl-8 text-xs transition-all
                      flex items-center justify-between group/item
                      ${isActive
                        ? 'text-amber-300 bg-amber-400/10 border-r-2 border-amber-400'
                        : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                      }
                    `}
                  >
                    <span className="leading-snug truncate">🕐 {entry.title}</span>
                    <span className={`text-[10px] shrink-0 ml-2 transition-opacity text-slate-700 opacity-0 group-hover/item:opacity-100`}>
                      {entry.start}–{entry.end}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Built-in topic taxonomy */}
          {TOPIC_TAXONOMY.map((category) => {
            const isExpanded = openSections.has(category.label);
            return (
              <div key={category.label}>
                <button
                  onClick={() => toggleSection(category.label)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{category.icon}</span>
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                      {category.label}
                    </span>
                  </div>
                  <svg
                    className={`w-3.5 h-3.5 text-slate-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="pb-1">
                    {category.items.map((item) => {
                      const isActive = activeTopic === item.topic;
                      return (
                        <button
                          key={item.label}
                          onClick={() => handleSelect(item)}
                          className={`
                            w-full text-left px-4 py-2 pl-10 text-xs transition-all
                            flex items-center justify-between group/item
                            ${isActive
                              ? 'text-amber-300 bg-amber-400/10 border-r-2 border-amber-400'
                              : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                            }
                          `}
                        >
                          <span className="leading-snug">{item.label}</span>
                          <span className={`text-[10px] shrink-0 ml-2 transition-opacity ${isActive ? 'text-amber-500 opacity-100' : 'text-slate-700 opacity-0 group-hover/item:opacity-100'}`}>
                            {item.start}–{item.end}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Custom topics section */}
          <div className="mt-2 border-t border-white/5 pt-2">
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-base">📌</span>
                <span className="text-xs font-semibold text-slate-400">My Topics</span>
              </div>
              {user ? (
                <button
                  onClick={() => setShowAddForm(s => !s)}
                  className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:text-amber-400 hover:bg-white/5 transition-colors text-sm"
                  title="Add custom topic"
                >
                  +
                </button>
              ) : (
                <button onClick={onSignIn} className="text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors">
                  Sign in
                </button>
              )}
            </div>

            {/* Add form */}
            {showAddForm && user && (
              <div className="px-4 pb-3 space-y-2 fade-up">
                <input
                  type="text" placeholder="Category name" value={newTopic.name}
                  onChange={e => setNewTopic(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs placeholder-slate-700 focus:outline-none focus:border-amber-500/40"
                />
                <input
                  type="text" placeholder="Topic label" value={newTopic.label}
                  onChange={e => setNewTopic(p => ({ ...p, label: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs placeholder-slate-700 focus:outline-none focus:border-amber-500/40"
                />
                <div className="flex gap-1.5">
                  <input
                    type="text" placeholder="From year" value={newTopic.start}
                    onChange={e => setNewTopic(p => ({ ...p, start: e.target.value }))}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs placeholder-slate-700 focus:outline-none focus:border-amber-500/40"
                  />
                  <input
                    type="text" placeholder="To year" value={newTopic.end}
                    onChange={e => setNewTopic(p => ({ ...p, end: e.target.value }))}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs placeholder-slate-700 focus:outline-none focus:border-amber-500/40"
                  />
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => void handleAddCustomTopic()}
                    disabled={adding}
                    className="flex-1 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {adding ? 'Adding…' : 'Add'}
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 text-slate-500 text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Custom topic items */}
            {customTopics.length === 0 && !showAddForm && (
              <p className="px-4 py-2 text-[10px] text-slate-700">
                {user ? 'Add your own topics above' : 'Sign in to add custom topics'}
              </p>
            )}
            {customTopics.map(cat => (
              <div key={cat.id}>
                <div className="flex items-center gap-2.5 px-4 py-2">
                  <span className="text-sm">{cat.icon}</span>
                  <span className="text-xs font-medium text-slate-400 flex-1 truncate">{cat.name}</span>
                  <button
                    onClick={(e) => void handleDeleteCustomTopic(cat.id, e)}
                    className="text-[10px] text-slate-700 hover:text-red-400 transition-colors"
                  >
                    ×
                  </button>
                </div>
                {cat.items.map(item => {
                  const isActive = activeTopic === item.topic;
                  return (
                    <button
                      key={item.label}
                      onClick={() => { onSelect(item.topic, item.start, item.end); onClose(); }}
                      className={`
                        w-full text-left px-4 py-2 pl-10 text-xs transition-all
                        flex items-center justify-between
                        ${isActive
                          ? 'text-amber-300 bg-amber-400/10 border-r-2 border-amber-400'
                          : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                        }
                      `}
                    >
                      <span className="leading-snug truncate">{item.label}</span>
                      <span className="text-[10px] text-slate-700 ml-2 flex-shrink-0">{item.start}–{item.end}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-white/5 flex-shrink-0">
          <p className="text-[10px] text-slate-700 leading-relaxed">
            Sidebar topics load from cache instantly. Custom topics require sign-in.
          </p>
        </div>
      </aside>
    </>
  );
}
