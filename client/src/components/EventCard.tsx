import { useState } from 'react';
import type { TimelineEvent } from '../types';
import { useNote, hasNote } from '../hooks/useNote';

interface Props {
  event: TimelineEvent;
  gradient: string;
  glow: string;
  align: 'left' | 'right';
  defaultExpanded?: boolean;
  bookmarked?: boolean;
  onBookmark?: (e: React.MouseEvent) => void;
  onFigureClick?: (name: string) => void;
  activeFigure?: string | null;
  noteId?: string;
  onExpand?: () => void;
  isRead?: boolean;
}

const TAG_STYLES = [
  'text-violet-300 border-violet-400/30 bg-violet-400/5',
  'text-blue-300 border-blue-400/30 bg-blue-400/5',
  'text-cyan-300 border-cyan-400/30 bg-cyan-400/5',
  'text-emerald-300 border-emerald-400/30 bg-emerald-400/5',
  'text-amber-300 border-amber-400/30 bg-amber-400/5',
  'text-rose-300 border-rose-400/30 bg-rose-400/5',
];

function formatEventText(event: TimelineEvent): string {
  const lines = [
    `${event.title} (${event.date})`,
    event.location ? `📍 ${event.location}` : '',
    '',
    event.summary,
    '',
    event.details,
    '',
    `Historical Significance: ${event.significance}`,
  ];
  if (event.figures?.length) lines.push('', `Key Figures: ${event.figures.join(', ')}`);
  if (event.tags?.length) lines.push('', `Tags: ${event.tags.join(', ')}`);
  return lines.filter(l => l !== undefined).join('\n').trim();
}

const TAGS_PREF_KEY = 'epocha-tags-expanded';

export default function EventCard({ event, gradient, align, defaultExpanded = false, bookmarked, onBookmark, onFigureClick, activeFigure, noteId, onExpand, isRead }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(() => {
    try { return localStorage.getItem(TAGS_PREF_KEY) === 'true'; } catch { return false; }
  });

  const { note, saveNote } = useNote(noteId ?? '');
  const noteExists = noteId ? hasNote(noteId) || note.trim().length > 0 : false;

  const toggleTags = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !tagsOpen;
    setTagsOpen(next);
    try { localStorage.setItem(TAGS_PREF_KEY, String(next)); } catch { /* ignore */ }
  };

  const paragraphs = event.details
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(Boolean);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(formatEventText(event));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`group glass rounded-2xl overflow-hidden glass-hover cursor-pointer ${align === 'right' ? 'lg:text-left' : ''} ${isRead ? 'opacity-90' : ''}`}
      onClick={() => { if (!expanded) onExpand?.(); setExpanded(e => !e); }}
    >
      {/* Top accent bar */}
      <div className={`h-0.5 w-full bg-gradient-to-r ${gradient}`} />

      <div className="p-5 sm:p-6">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-serif text-lg sm:text-xl font-bold text-white leading-snug">
            {event.title}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            {isRead && !expanded && (
              <span className="text-emerald-700 text-[10px]" title="Read">✓</span>
            )}
            {noteId && noteExists && !expanded && (
              <span className="text-[9px] text-emerald-600" title="Has notes">📝</span>
            )}
            {onBookmark && (
              <button
                onClick={onBookmark}
                className={`transition-colors p-0.5 ${bookmarked ? 'text-amber-400' : 'text-slate-700 hover:text-slate-400'}`}
                title={bookmarked ? 'Remove bookmark' : 'Bookmark this event'}
              >
                <svg className="w-3.5 h-3.5" fill={bookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
              </button>
            )}
            <div className={`transition-transform duration-300 text-slate-500 ${expanded ? 'rotate-180' : ''}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Location */}
        {event.location && (
          <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
            <span>📍</span> {event.location}
          </p>
        )}

        {/* Summary */}
        <p className="text-slate-300 text-sm leading-relaxed mb-4">
          {event.summary}
        </p>

        {/* Tags — collapsed by default, preference persisted */}
        {event.tags && event.tags.length > 0 && (
          <div>
            {tagsOpen ? (
              <div className="flex flex-wrap gap-1.5">
                {event.tags.map((tag, i) => (
                  <span
                    key={tag}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${TAG_STYLES[i % TAG_STYLES.length]}`}
                  >
                    {tag}
                  </span>
                ))}
                <button
                  onClick={toggleTags}
                  className="px-2 py-0.5 rounded-full text-[10px] text-slate-600 hover:text-slate-400 border border-white/8 hover:border-white/15 transition-colors"
                >
                  hide
                </button>
              </div>
            ) : (
              <button
                onClick={toggleTags}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-slate-600 border border-white/8 hover:border-white/15 hover:text-slate-400 transition-colors"
              >
                <span className="text-[9px]">🏷</span>
                {event.tags.length} tag{event.tags.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="card-details border-t border-white/5 px-5 sm:px-6 pb-6 pt-5" onClick={e => e.stopPropagation()}>
          {/* Details */}
          <div className="space-y-3 mb-5">
            {paragraphs.map((para, i) => (
              <p key={i} className="text-slate-400 text-sm leading-relaxed">
                {para}
              </p>
            ))}
          </div>

          {/* Significance */}
          <div className="rounded-xl p-4 border border-amber-400/20 bg-amber-400/5 mb-4">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">
              Historical Significance
            </p>
            <p className="text-amber-100/80 text-sm leading-relaxed">
              {event.significance}
            </p>
          </div>

          {/* Key figures */}
          {event.figures && event.figures.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                Key Figures {onFigureClick && <span className="font-normal text-slate-700 normal-case">· click to explore</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {event.figures.map(figure => (
                  onFigureClick ? (
                    <button
                      key={figure}
                      onClick={e => { e.stopPropagation(); onFigureClick(figure); }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                        activeFigure === figure
                          ? 'bg-violet-500/20 border-violet-400/50 text-violet-300'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-violet-500/10 hover:border-violet-400/30 hover:text-violet-300'
                      }`}
                    >
                      <span className="text-slate-500">👤</span>
                      {figure}
                    </button>
                  ) : (
                    <span
                      key={figure}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-slate-300 bg-white/5 border border-white/10"
                    >
                      <span className="text-slate-500">👤</span>
                      {figure}
                    </span>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Personal notes */}
          {noteId && (
            <div className="mt-4 border-t border-white/5 pt-4" onClick={e => e.stopPropagation()}>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1.5">My Notes</p>
              <textarea
                value={note}
                onChange={e => saveNote(e.target.value)}
                placeholder="Add your own notes about this event…"
                rows={note.trim() ? Math.min(6, note.split('\n').length + 1) : 2}
                className="w-full bg-white/3 border border-white/8 focus:border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-700 outline-none resize-none transition-colors leading-relaxed"
              />
              {note.trim() && (
                <p className="text-[10px] text-slate-700 mt-1 text-right">auto-saved</p>
              )}
            </div>
          )}

          {/* Copy button */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all print:hidden ${
                copied
                  ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/30'
                  : 'text-slate-600 bg-white/4 border border-white/8 hover:text-slate-300 hover:border-white/15'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
