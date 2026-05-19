import { useState } from 'react';
import EventCard from './EventCard';
import QuizModal from './QuizModal';
import KeyboardHelp from './KeyboardHelp';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { toast } from '../utils/toast';
import type { TimelineData } from '../types';
import type { AuthUser } from '../hooks/useAuth';

interface Props {
  data: TimelineData;
  onReset: () => void;
  onRelatedSelect?: (topic: string) => void;
  user?: AuthUser | null;
  onSignIn?: () => void;
}

const ERA_GRADIENTS = [
  'from-violet-500 to-purple-600', 'from-indigo-500 to-blue-600',
  'from-blue-500 to-cyan-500', 'from-cyan-500 to-teal-500',
  'from-teal-500 to-emerald-500', 'from-emerald-500 to-green-500',
  'from-green-500 to-lime-500', 'from-yellow-500 to-amber-500',
  'from-amber-500 to-orange-500', 'from-orange-500 to-red-500',
  'from-red-500 to-rose-500', 'from-rose-500 to-pink-500',
];

const ERA_GLOWS = [
  'shadow-violet-500/40', 'shadow-indigo-500/40', 'shadow-blue-500/40',
  'shadow-cyan-500/40', 'shadow-teal-500/40', 'shadow-emerald-500/40',
  'shadow-green-500/40', 'shadow-yellow-500/40', 'shadow-amber-500/40',
  'shadow-orange-500/40', 'shadow-red-500/40', 'shadow-rose-500/40',
];

function getGradient(index: number, total: number) {
  const i = Math.floor((index / Math.max(total - 1, 1)) * (ERA_GRADIENTS.length - 1));
  return {
    gradient: ERA_GRADIENTS[Math.min(i, ERA_GRADIENTS.length - 1)]!,
    glow: ERA_GLOWS[Math.min(i, ERA_GLOWS.length - 1)]!,
  };
}

export default function Timeline({ data, onReset, onRelatedSelect, user, onSignIn }: Props) {
  const total = data.events.length;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; total: number; xpEarned: number } | null>(null);
  const [collectionName, setCollectionName] = useState('General');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [compact, setCompact] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useKeyboardShortcuts({
    onQuiz:    () => setShowQuiz(true),
    onSave:    () => { if (!saved) setShowSaveForm(s => !s); },
    onReset:   onReset,
    onCompact: () => setCompact(c => !c),
    onHelp:    () => setShowHelp(h => !h),
    onEscape:  () => {
      setShowQuiz(false); setShowHelp(false); setShowSaveForm(false);
      setShowSearch(false); setSearchQuery('');
    },
  }, true);

  const allTags = Array.from(new Set(data.events.flatMap(e => e.tags ?? []))).sort();

  const toggleTag = (tag: string) => {
    setActiveTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  };

  const q = searchQuery.trim().toLowerCase();
  const tagFiltered = activeTags.size === 0
    ? data.events
    : data.events.filter(e => e.tags?.some(t => activeTags.has(t)));
  const visibleEvents = q === ''
    ? tagFiltered
    : tagFiltered.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.significance.toLowerCase().includes(q) ||
        e.figures?.some(f => f.toLowerCase().includes(q)) ||
        e.location?.toLowerCase().includes(q)
      );

  const topicParts = data.period.split(' to ');
  const startYear = topicParts[0]?.replace(/\D/g, '') ?? '0';
  const endYear = topicParts[1]?.replace(/\D/g, '') ?? '9999';

  const handleSave = async () => {
    if (!user) { onSignIn?.(); return; }
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/saved', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: data.topic, startYear, endYear,
          title: data.topic,
          description: data.description.slice(0, 200),
          collectionName,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setShowSaveForm(false);
        toast.xp('+5 XP', 'Timeline saved');
      } else {
        setSaveError('Failed to save');
      }
    } catch { setSaveError('Failed to save'); }
    setSaving(false);
  };

  const handlePrint = () => { window.print(); };

  const handleMarkdownExport = () => {
    const lines: string[] = [
      `# ${data.topic}`,
      `**Period:** ${data.period}`,
      '',
      data.description,
      '',
      '---',
      '',
    ];
    for (const event of data.events) {
      lines.push(`## ${event.title} — ${event.date}`);
      if (event.location) lines.push(`📍 *${event.location}*`);
      lines.push('');
      lines.push(event.summary);
      lines.push('');
      lines.push(event.details);
      lines.push('');
      lines.push(`**Significance:** ${event.significance}`);
      if (event.figures?.length) lines.push(`**Key Figures:** ${event.figures.join(', ')}`);
      if (event.tags?.length) lines.push(`**Tags:** ${event.tags.join(', ')}`);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
    if (data.relatedTopics?.length) {
      lines.push('## Related Topics');
      data.relatedTopics.forEach(t => lines.push(`- ${t}`));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.topic.toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Markdown downloaded');
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuizComplete = (score: number, total: number, xpEarned: number) => {
    setQuizResult({ score, total, xpEarned });
    setShowQuiz(false);
    toast.xp(`+${xpEarned} XP`, `Quiz: ${score}/${total} correct`);
  };

  const handleSaveWithToast = async () => {
    await handleSave();
    // handleSave sets saved=true on success; toast fires after
  };

  return (
    <div className="timeline-print-container">
      {/* Header */}
      <div className="pt-10 pb-16 text-center fade-up">
        <p className="text-amber-400 text-xs font-semibold tracking-[0.2em] uppercase mb-3">{data.period}</p>
        <h2 className="font-serif text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">{data.topic}</h2>
        <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed mb-6">{data.description}</p>

        {/* Reading stats */}
        {(() => {
          const wordCount = data.events.reduce((n, e) => n + e.details.split(/\s+/).length + e.summary.split(/\s+/).length, 0);
          const mins = Math.max(1, Math.round(wordCount / 200));
          const tagCount = new Set(data.events.flatMap(e => e.tags ?? [])).size;
          return (
            <p className="text-slate-600 text-xs mb-4">
              ~{mins} min read · {total} events{tagCount > 0 ? ` · ${tagCount} themes` : ''}
            </p>
          );
        })()}

        {/* Action bar */}
        <div className="inline-flex flex-wrap items-center justify-center gap-2">
          <span className="px-4 py-1.5 rounded-full text-xs font-semibold text-amber-300 border border-amber-400/30 bg-amber-400/5">
            {total} events
          </span>
          <button
            onClick={() => setShowQuiz(true)}
            className="px-4 py-1.5 rounded-full text-xs font-semibold text-violet-300 border border-violet-400/30 bg-violet-400/5 hover:bg-violet-400/10 transition-colors"
          >
            🧠 Take Quiz
          </button>
          {!saved ? (
            <button
              onClick={() => setShowSaveForm(s => !s)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-300 border border-white/15 hover:border-white/25 hover:text-white transition-colors"
            >
              {saving ? 'Saving…' : '🔖 Save'}
            </button>
          ) : (
            <span className="px-4 py-1.5 rounded-full text-xs font-semibold text-emerald-400 border border-emerald-400/30 bg-emerald-400/5">
              ✓ Saved
            </span>
          )}
          <button
            onClick={() => { setShowSearch(s => !s); if (showSearch) setSearchQuery(''); }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors print:hidden border ${showSearch ? 'border-amber-500/40 text-amber-300 bg-amber-500/10' : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'}`}
            title="Search events"
          >
            🔍 Search
          </button>
          <button
            onClick={() => setCompact(c => !c)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors print:hidden border ${compact ? 'border-amber-500/40 text-amber-300 bg-amber-500/10' : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'}`}
            title="Toggle compact view (C)"
          >
            {compact ? '⊞ Full' : '≡ Compact'}
          </button>
          <button
            onClick={() => void handleCopyLink()}
            className="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors print:hidden border border-white/10 hover:border-white/20 hover:text-white text-slate-400"
          >
            {copied ? '✓ Copied!' : '🔗 Share'}
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors print:hidden"
          >
            📄 PDF
          </button>
          <button
            onClick={handleMarkdownExport}
            className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors print:hidden"
          >
            ↓ Markdown
          </button>
          <button
            onClick={onReset}
            className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors print:hidden"
          >
            ← New search
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="px-2.5 py-1.5 rounded-full text-xs text-slate-700 border border-white/8 hover:border-white/15 hover:text-slate-400 transition-colors print:hidden"
            title="Keyboard shortcuts (?)"
          >
            ?
          </button>
        </div>

        {/* Save form */}
        {showSaveForm && !saved && (
          <div className="mt-4 inline-flex items-center gap-2 fade-up">
            <input
              type="text"
              value={collectionName}
              onChange={e => setCollectionName(e.target.value)}
              placeholder="Collection name"
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-slate-300 text-xs focus:outline-none focus:border-amber-500/50 w-36"
            />
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? '…' : 'Save'}
            </button>
            <button onClick={() => setShowSaveForm(false)} className="text-slate-600 hover:text-slate-400 text-xs">Cancel</button>
          </div>
        )}
        {saveError && <p className="mt-2 text-red-400 text-xs">{saveError}</p>}

        {/* Social share */}
        <div className="mt-4 flex justify-center gap-2 print:hidden">
          <SocialShareButtons topic={data.topic} period={data.period} />
        </div>

        {/* Event search */}
        {showSearch && (
          <div className="mt-4 fade-up flex justify-center">
            <div className="relative w-full max-w-sm">
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search events…"
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/15 focus:border-amber-500/50 text-slate-200 text-sm placeholder-slate-600 outline-none transition-colors"
              />
              <svg className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-600 hover:text-slate-300 text-xs transition-colors">×</button>
              )}
            </div>
          </div>
        )}
        {q && (
          <p className="mt-1.5 text-xs text-slate-600 text-center">
            {visibleEvents.length} of {data.events.length} events matching &ldquo;{q}&rdquo;
          </p>
        )}

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-1.5 print:hidden">
            {allTags.map(tag => {
              const active = activeTags.has(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                    active
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-white/3 border-white/10 text-slate-600 hover:border-white/20 hover:text-slate-400'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
            {activeTags.size > 0 && (
              <button
                onClick={() => setActiveTags(new Set())}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10 text-slate-600 hover:text-slate-300 transition-colors"
              >
                × clear
              </button>
            )}
          </div>
        )}
        {activeTags.size > 0 && (
          <p className="mt-2 text-xs text-slate-600 text-center">
            {visibleEvents.length} of {data.events.length} events
          </p>
        )}

        {/* Quiz result banner */}
        {quizResult && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 fade-up">
            <span className="text-violet-300 text-xs">Quiz: {quizResult.score}/{quizResult.total} correct · +{quizResult.xpEarned} XP</span>
          </div>
        )}
      </div>

      {/* Timeline events — compact or full view */}
      {compact ? (
        <div className="space-y-1 py-4">
          {visibleEvents.map((event, index) => {
            const { gradient } = getGradient(index, visibleEvents.length);
            return <CompactRow key={`${event.date}-${index}`} event={event} gradient={gradient} index={index} />;
          })}
        </div>
      ) : (
        <div className="relative">
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 timeline-line opacity-30" />
          <div className="space-y-6 lg:space-y-0">
            {visibleEvents.map((event, index) => {
              const { gradient, glow } = getGradient(index, visibleEvents.length);
              const isLeft = index % 2 === 0;
              return (
                <div
                  key={`${event.date}-${index}`}
                  className="fade-up lg:grid lg:grid-cols-2 lg:gap-8 lg:mb-6"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  {isLeft ? (
                    <>
                      <div className="lg:text-right lg:pr-10">
                        <EventCard event={event} gradient={gradient} glow={glow} align="right" />
                      </div>
                      <div className="hidden lg:flex items-start justify-start pl-10 pt-5">
                        <DatePill date={event.date} gradient={gradient} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="hidden lg:flex items-start justify-end pr-10 pt-5">
                        <DatePill date={event.date} gradient={gradient} />
                      </div>
                      <div className="lg:pl-10">
                        <EventCard event={event} gradient={gradient} glow={glow} align="left" />
                      </div>
                    </>
                  )}
                  <div
                    className={`hidden lg:block absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gradient-to-br ${gradient} shadow-lg ${glow} mt-6 ring-2 ring-[#0a0e1a]`}
                    style={{ top: `${index === 0 ? 24 : 0}px`, position: 'absolute' }}
                  />
                  <div className="lg:hidden">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${gradient} flex-shrink-0`} />
                      <DatePill date={event.date} gradient={gradient} />
                    </div>
                    <div className="pl-5 border-l border-white/10">
                      <EventCard event={event} gradient={gradient} glow={glow} align="left" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Related Topics */}
      {data.relatedTopics && data.relatedTopics.length > 0 && onRelatedSelect && (
        <div className="mt-20 pb-8 fade-up print:hidden">
          <div className="text-center mb-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Keep Exploring</p>
            <h3 className="text-white font-serif text-lg">Related Topics</h3>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {data.relatedTopics.map(topic => (
              <button
                key={topic}
                onClick={() => onRelatedSelect(topic)}
                className="px-4 py-2 rounded-full text-sm text-slate-300 border border-white/10 bg-white/3 hover:bg-white/8 hover:text-white hover:border-white/20 transition-all"
              >
                {topic} →
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-10 text-center fade-up">
        <div className="inline-block w-px h-12 bg-gradient-to-b from-white/20 to-transparent mb-6" />
        <p className="text-slate-600 text-xs uppercase tracking-widest">End of timeline</p>
        <button
          onClick={onReset}
          className="mt-8 px-8 py-3 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 transition-all shadow-lg shadow-amber-500/20 print:hidden"
        >
          Explore another topic
        </button>
      </div>

      {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}

      {showQuiz && (
        <QuizModal
          topic={data.topic}
          startYear={startYear}
          endYear={endYear}
          onClose={() => setShowQuiz(false)}
          onComplete={handleQuizComplete}
        />
      )}
    </div>
  );
}

function SocialShareButtons({ topic, period }: { topic: string; period: string }) {
  const url = encodeURIComponent(window.location.href);
  const text = encodeURIComponent(`Exploring "${topic}" (${period}) on Epocha — fascinating historical timeline!`);
  return (
    <>
      <a
        href={`https://twitter.com/intent/tweet?text=${text}&url=${url}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium text-slate-500 border border-white/8 hover:border-white/20 hover:text-slate-300 transition-all"
        title="Share on X (Twitter)"
        onClick={e => e.stopPropagation()}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.849L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Share
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${url}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium text-slate-500 border border-white/8 hover:border-white/20 hover:text-slate-300 transition-all"
        title="Share on LinkedIn"
        onClick={e => e.stopPropagation()}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
        Share
      </a>
    </>
  );
}

function DatePill({ date, gradient }: { date: string; gradient: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-br ${gradient} flex-shrink-0`} />
      <span className={`font-cinzel font-bold text-sm tracking-wide bg-gradient-to-r ${gradient} bg-clip-text text-transparent drop-shadow-sm`}>
        {date}
      </span>
    </span>
  );
}

function CompactRow({ event, gradient, index }: { event: import('../types').TimelineEvent; gradient: string; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="fade-up" style={{ animationDelay: `${index * 25}ms` }}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/4 transition-colors group"
      >
        <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 bg-gradient-to-br ${gradient}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`font-cinzel font-bold text-sm tracking-wide bg-gradient-to-r ${gradient} bg-clip-text text-transparent whitespace-nowrap`}>
              {event.date}
            </span>
            <span className="text-slate-200 text-sm font-medium leading-snug group-hover:text-white transition-colors">
              {event.title}
            </span>
            {event.location && <span className="text-slate-700 text-[10px] hidden sm:inline">· {event.location}</span>}
          </div>
          {event.tags && event.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {event.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-slate-600">{tag}</span>
              ))}
            </div>
          )}
        </div>
        <span className="text-slate-700 text-xs flex-shrink-0 group-hover:text-slate-500 mt-0.5">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="mx-3 mb-2 p-3 rounded-xl bg-white/3 border border-white/5 text-xs leading-relaxed card-details">
          <p className="text-white/80 font-medium mb-1">{event.summary}</p>
          <p className="text-slate-500 line-clamp-3">{event.significance}</p>
          {event.figures && event.figures.length > 0 && (
            <p className="mt-2 text-slate-700">Figures: {event.figures.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}
