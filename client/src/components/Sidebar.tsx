import { useState } from 'react';
import { TOPIC_TAXONOMY, type TopicEntry } from '../data/topics';

interface Props {
  onSelect: (topic: string, start: string, end: string) => void;
  activeTopic?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ onSelect, activeTopic, isOpen, onClose }: Props) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['Philosophy', 'Science & Technology']) // open by default
  );

  const toggleSection = (label: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const handleSelect = (item: TopicEntry) => {
    onSelect(item.topic, item.start, item.end);
    onClose(); // close drawer on mobile
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-[52px] left-0 z-40 h-[calc(100vh-52px)] w-64
          bg-[#0d1120] border-r border-white/5
          flex flex-col overflow-hidden
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Sidebar header */}
        <div className="px-4 py-4 border-b border-white/5 flex-shrink-0">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Browse Topics
          </p>
        </div>

        {/* Scrollable topic list */}
        <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
          {TOPIC_TAXONOMY.map((category) => {
            const isOpen = openSections.has(category.label);
            return (
              <div key={category.label}>
                {/* Category header */}
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
                    className={`w-3.5 h-3.5 text-slate-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Sub-topics */}
                {isOpen && (
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
        </div>

        {/* Bottom hint */}
        <div className="px-4 py-3 border-t border-white/5 flex-shrink-0">
          <p className="text-[10px] text-slate-700 leading-relaxed">
            Click any topic to generate a timeline, or use the search form for custom queries.
          </p>
        </div>
      </aside>
    </>
  );
}
