import { useState } from 'react';
import type { TimelineEvent } from '../types';

interface Props {
  event: TimelineEvent;
  gradient: string;
  glow: string;
  align: 'left' | 'right';
  defaultExpanded?: boolean;
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

export default function EventCard({ event, gradient, align, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

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
      className={`group glass rounded-2xl overflow-hidden glass-hover cursor-pointer ${align === 'right' ? 'lg:text-left' : ''}`}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Top accent bar */}
      <div className={`h-0.5 w-full bg-gradient-to-r ${gradient}`} />

      <div className="p-5 sm:p-6">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-serif text-lg sm:text-xl font-bold text-white leading-snug">
            {event.title}
          </h3>
          <div className={`shrink-0 mt-1 transition-transform duration-300 text-slate-500 ${expanded ? 'rotate-180' : ''}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
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

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {event.tags.map((tag, i) => (
              <span
                key={tag}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${TAG_STYLES[i % TAG_STYLES.length]}`}
              >
                {tag}
              </span>
            ))}
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
                Key Figures
              </p>
              <div className="flex flex-wrap gap-2">
                {event.figures.map(figure => (
                  <span
                    key={figure}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-slate-300 bg-white/5 border border-white/10"
                  >
                    <span className="text-slate-500">👤</span>
                    {figure}
                  </span>
                ))}
              </div>
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
