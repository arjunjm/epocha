import { useState, useEffect } from 'react';
import { TOPIC_TAXONOMY, type TopicEntry } from '../data/topics';
import type { SavedTimeline } from '../types';
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
  onOpenLibrary?: () => void;
  collectionsRefreshKey?: number;
}

export default function Sidebar({ onSelect, activeTopic, isOpen, onClose, user, onSignIn, history = [], onOpenLibrary, collectionsRefreshKey }: Props) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['Philosophy', 'Science & Technology'])
  );
  const [savedTimelines, setSavedTimelines] = useState<SavedTimeline[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [openCollections, setOpenCollections] = useState<Set<string>>(new Set());
  const [trendingTopics, setTrendingTopics] = useState<Array<{ topic: string; startYear: string; endYear: string; period: string }>>([]);
  const [showTrending, setShowTrending] = useState(true);

  useEffect(() => {
    if (user) void fetchSaved();
    else setSavedTimelines([]);
  }, [user, collectionsRefreshKey]);

  useEffect(() => {
    fetch('/api/timeline/trending')
      .then(r => r.ok ? r.json() : [])
      .then((data: Array<{ topic: string; startYear: string; endYear: string; period: string }>) => setTrendingTopics(data))
      .catch(() => {});
  }, []);

  const fetchSaved = async () => {
    setCollectionsLoading(true);
    try {
      const res = await fetch('/api/saved', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as SavedTimeline[];
        setSavedTimelines(data);
        // Auto-open first collection
        const firstCol = data[0]?.collectionName ?? 'General';
        setOpenCollections(new Set([firstCol]));
      }
    } catch { /* ignore */ }
    setCollectionsLoading(false);
  };

  const collections = savedTimelines.reduce<Record<string, SavedTimeline[]>>((acc, t) => {
    const col = t.collectionName ?? 'General';
    (acc[col] ??= []).push(t);
    return acc;
  }, {});

  const toggleCollection = (name: string) => {
    setOpenCollections(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
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

  const suggestions = (() => {
    if (history.length < 2) return [];
    const viewedTopics = new Set(history.map(h => h.topic));
    // Find which categories user's history belongs to
    const categoryCounts = new Map<string, number>();
    for (const entry of history) {
      for (const cat of TOPIC_TAXONOMY) {
        if (cat.items.some(i => i.topic === entry.topic)) {
          categoryCounts.set(cat.label, (categoryCounts.get(cat.label) ?? 0) + 1);
        }
      }
    }
    // Sort categories by interest
    const rankedCats = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label);
    const picks: TopicEntry[] = [];
    for (const catLabel of rankedCats) {
      const cat = TOPIC_TAXONOMY.find(c => c.label === catLabel);
      if (!cat) continue;
      for (const item of cat.items) {
        if (!viewedTopics.has(item.topic) && !picks.some(p => p.topic === item.topic)) {
          picks.push(item);
          if (picks.length >= 3) return picks;
        }
      }
    }
    return picks;
  })();


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

          {/* Trending — topics pre-generated by the nightly function */}
          {trendingTopics.length > 0 && (
            <div className="mb-1 border-b border-white/5 pb-2">
              <button
                onClick={() => setShowTrending(s => !s)}
                className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🔥</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Trending</span>
                </div>
                <svg className={`w-3 h-3 text-slate-700 transition-transform ${showTrending ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showTrending && trendingTopics.map(t => (
                <button
                  key={`${t.topic}-${t.startYear}`}
                  onClick={() => { onSelect(t.topic, t.startYear, t.endYear); onClose(); }}
                  className={`w-full text-left px-4 py-2 pl-10 text-xs transition-all flex items-center justify-between group/item
                    ${activeTopic === t.topic ? 'text-amber-300 bg-amber-400/10 border-r-2 border-amber-400' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  <span className="leading-snug truncate">{t.topic}</span>
                  <span className="text-[10px] shrink-0 ml-2 text-slate-700 opacity-0 group-hover/item:opacity-100 transition-opacity">{t.period}</span>
                </button>
              ))}
            </div>
          )}

          {/* Personalised suggestions */}
          {suggestions.length > 0 && (
            <div className="mb-1 border-b border-white/5 pb-2">
              <p className="px-4 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">You might like</p>
              {suggestions.map(item => (
                <button
                  key={item.topic}
                  onClick={() => handleSelect(item)}
                  className="w-full text-left px-4 py-2 pl-8 text-xs transition-all flex items-center justify-between group/item text-slate-500 hover:text-slate-200 hover:bg-white/5"
                >
                  <span className="leading-snug truncate">✨ {item.label}</span>
                  <span className="text-[10px] shrink-0 ml-2 transition-opacity text-slate-700 opacity-0 group-hover/item:opacity-100">
                    {item.start}–{item.end}
                  </span>
                </button>
              ))}
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

          {/* Collections */}
          <div className="mt-2 border-t border-white/5 pt-2">
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-base">📚</span>
                <span className="text-xs font-semibold text-slate-400">Collections</span>
              </div>
              {user && onOpenLibrary && (
                <button
                  onClick={() => { onOpenLibrary(); onClose(); }}
                  className="text-[10px] text-slate-600 hover:text-amber-400 transition-colors"
                  title="Manage collections"
                >
                  Manage
                </button>
              )}
              {!user && (
                <button onClick={onSignIn} className="text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors">
                  Sign in
                </button>
              )}
            </div>

            {!user && (
              <p className="px-4 pb-2 text-[10px] text-slate-700">
                Save timelines to build your collection
              </p>
            )}

            {user && collectionsLoading && (
              <p className="px-4 pb-2 text-[10px] text-slate-700">Loading…</p>
            )}

            {user && !collectionsLoading && Object.keys(collections).length === 0 && (
              <p className="px-4 pb-2 text-[10px] text-slate-700">
                No saved timelines yet — use 🔖 Save while viewing one
              </p>
            )}

            {Object.entries(collections).map(([colName, timelines]) => {
              const isOpen = openCollections.has(colName);
              return (
                <div key={colName}>
                  <button
                    onClick={() => toggleCollection(colName)}
                    className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-slate-600 text-[10px] flex-shrink-0">
                        {isOpen ? '▾' : '▸'}
                      </span>
                      <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors truncate">
                        {colName}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-700 flex-shrink-0 ml-1">{timelines.length}</span>
                  </button>

                  {isOpen && (
                    <div className="pb-1">
                      {timelines.map(t => {
                        const isActive = activeTopic === t.topic;
                        return (
                          <button
                            key={t.id}
                            onClick={() => { onSelect(t.topic, t.startYear, t.endYear); onClose(); }}
                            className={`
                              w-full text-left px-4 py-2 pl-10 text-xs transition-all
                              flex items-center justify-between group/item
                              ${isActive
                                ? 'text-amber-300 bg-amber-400/10 border-r-2 border-amber-400'
                                : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                              }
                            `}
                          >
                            <span className="leading-snug truncate">{t.title}</span>
                            <span className={`text-[10px] shrink-0 ml-2 transition-opacity ${isActive ? 'text-amber-500 opacity-100' : 'text-slate-700 opacity-0 group-hover/item:opacity-100'}`}>
                              {t.startYear}–{t.endYear}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-white/5 flex-shrink-0">
          <p className="text-[10px] text-slate-700 leading-relaxed">
            Sidebar topics load from cache instantly.
          </p>
        </div>
      </aside>
    </>
  );
}
