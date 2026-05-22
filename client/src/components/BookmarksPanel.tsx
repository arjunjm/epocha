import { useState } from 'react';
import type { Bookmark } from '../hooks/useBookmarks';

interface Props {
  bookmarks: Bookmark[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}

function formatDate(savedAt: number): string {
  return new Date(savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function exportMarkdown(bookmarks: Bookmark[]): void {
  const byTopic = bookmarks.reduce<Record<string, Bookmark[]>>((acc, b) => {
    (acc[b.topic] ??= []).push(b);
    return acc;
  }, {});

  const lines: string[] = ['# My Bookmarks', ''];
  for (const [topic, items] of Object.entries(byTopic)) {
    lines.push(`## ${topic}`, '');
    for (const { event } of items) {
      lines.push(`### ${event.title} — ${event.date}`, '');
      if (event.location) lines.push(`📍 *${event.location}*`, '');
      lines.push(event.summary, '', event.details ?? '', '', `**Significance:** ${event.significance}`, '', '---', '');
    }
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'epocha-bookmarks.md';
  a.click();
  URL.revokeObjectURL(url);
}

export default function BookmarksPanel({ bookmarks, onRemove, onClear, onClose }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const byTopic = bookmarks.reduce<Record<string, Bookmark[]>>((acc, b) => {
    (acc[b.topic] ??= []).push(b);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-sm h-full bg-[#0d1020] border-l border-white/8 flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-base">🔖</span>
            <h2 className="text-white font-semibold text-sm">Bookmarks</h2>
            <span className="text-xs text-slate-600 font-mono">{bookmarks.length}</span>
          </div>
          <div className="flex items-center gap-2">
            {bookmarks.length > 0 && (
              <button
                onClick={() => exportMarkdown(bookmarks)}
                className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                title="Export as Markdown"
              >
                ↓ Export
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-600 hover:text-slate-300 transition-colors p-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {bookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <span className="text-4xl opacity-30">🔖</span>
              <p className="text-slate-500 text-sm">No bookmarks yet</p>
              <p className="text-slate-700 text-xs">Click the bookmark icon on any event to save it here</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {Object.entries(byTopic).map(([topic, items]) => (
                <div key={topic}>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2 px-1">
                    {topic}
                  </p>
                  <div className="space-y-1.5">
                    {items.map(({ id, event, savedAt }) => (
                      <div
                        key={id}
                        className="group glass rounded-xl overflow-hidden border border-white/6 hover:border-white/12 transition-all"
                      >
                        <button
                          className="w-full text-left px-3 py-2.5"
                          onClick={() => setExpandedId(expandedId === id ? null : id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-white text-xs font-semibold leading-snug truncate">{event.title}</p>
                              <p className="text-slate-600 text-[10px] mt-0.5">{event.date} · saved {formatDate(savedAt)}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={e => { e.stopPropagation(); onRemove(id); }}
                                className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-rose-400 transition-all p-0.5"
                                title="Remove bookmark"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                              <svg
                                className={`w-3 h-3 text-slate-600 transition-transform ${expandedId === id ? 'rotate-180' : ''}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </button>

                        {expandedId === id && (
                          <div className="px-3 pb-3 border-t border-white/5 pt-2.5">
                            {event.location && (
                              <p className="text-[10px] text-slate-600 mb-2">📍 {event.location}</p>
                            )}
                            <p className="text-slate-400 text-xs leading-relaxed mb-2">{event.summary}</p>
                            <div className="rounded-lg px-3 py-2 bg-amber-400/5 border border-amber-400/15">
                              <p className="text-amber-100/70 text-[11px] leading-relaxed">{event.significance}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {bookmarks.length > 0 && (
          <div className="px-4 py-3 border-t border-white/8 flex-shrink-0">
            {confirmClear ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Clear all bookmarks?</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { onClear(); setConfirmClear(false); }}
                    className="text-xs text-rose-400 hover:text-rose-300 transition-colors px-2 py-1"
                  >
                    Clear all
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="text-[11px] text-slate-700 hover:text-slate-500 transition-colors"
              >
                Clear all bookmarks
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
