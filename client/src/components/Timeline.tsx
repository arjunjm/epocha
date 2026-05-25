import { useState, useEffect } from 'react';
import EventCard from './EventCard';
import QuizModal from './QuizModal';
import KeyboardHelp from './KeyboardHelp';
import TimeMachine from './TimeMachine';
import BookmarksPanel from './BookmarksPanel';
import FlashcardMode from './FlashcardMode';
import InsightsPanel from './InsightsPanel';
import HeatmapView from './HeatmapView';
import ShareModal from './ShareModal';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useBookmarks } from '../hooks/useBookmarks';
import { useReadProgress } from '../hooks/useReadProgress';
import { useCompletions } from '../hooks/useCompletions';
import { toast } from '../utils/toast';
import type { TimelineData } from '../types';
import type { AuthUser } from '../hooks/useAuth';

interface Props {
  data: TimelineData;
  onReset: () => void;
  onRelatedSelect?: (topic: string) => void;
  onContinue?: (topic: string, start: string, end: string) => void;
  onRegenerateSkipCache?: () => void;
  onUpgradeLite?: () => void;
  onSaved?: () => void;
  warning?: string;
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

export default function Timeline({ data, onReset, onRelatedSelect, onContinue, onRegenerateSkipCache, onUpgradeLite, onSaved, warning, user, onSignIn }: Props) {
  const total = data.events.length;
  const isLiteMode = data.events.some(e => !e.details);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; total: number; xpEarned: number } | null>(null);
  const [collectionName, setCollectionName] = useState('General');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [compact, setCompact] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [timeMachine, setTimeMachine] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [figureFilter, setFigureFilter] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);

  const { bookmarks, isBookmarked, toggleBookmark, removeBookmark, clearBookmarks } = useBookmarks();
  const { markRead, isRead, readCount, allRead } = useReadProgress(data.topic, total);
  const { addCompletion, hasCompleted } = useCompletions();

  useEffect(() => {
    if (allRead && !hasCompleted(data.topic, data.period)) {
      addCompletion(data.topic, data.period);
      toast.success(`🎓 ${data.topic} completed!`);
    }
  }, [allRead, data.topic, data.period, addCompletion, hasCompleted]);

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
  const figureFiltered = figureFilter
    ? tagFiltered.filter(e => e.figures?.includes(figureFilter))
    : tagFiltered;
  const visibleEvents = q === ''
    ? figureFiltered
    : figureFiltered.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.significance.toLowerCase().includes(q) ||
        e.figures?.some(f => f.toLowerCase().includes(q)) ||
        e.location?.toLowerCase().includes(q)
      );

  const handleFigureClick = (name: string) => {
    setFigureFilter(prev => prev === name ? null : name);
    setSearchQuery('');
  };

  const getRelatedEvents = (event: import('../types').TimelineEvent, max = 3) => {
    const myTags = new Set(event.tags ?? []);
    const myFigures = new Set(event.figures ?? []);
    return data.events
      .filter(e => e !== event)
      .map(e => ({
        event: e,
        score: (e.tags?.filter(t => myTags.has(t)).length ?? 0) * 2 +
               (e.figures?.filter(f => myFigures.has(f)).length ?? 0) * 3,
      }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, max)
      .map(x => ({ title: x.event.title, date: x.event.date }));
  };

  const handleScrollTo = (title: string) => {
    const el = document.querySelector(`[data-event-title="${CSS.escape(title)}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const noteId = (event: import('../types').TimelineEvent) =>
    `${data.topic}::${event.date}::${event.title}`;

  const topicParts = data.period.split(/\s+(?:to|–)\s+/);
  const startYear = topicParts[0]?.replace(/\D/g, '') || '';
  const endYear = topicParts[1]?.replace(/\D/g, '') || '';

  const nextEraPeriod = (() => {
    const s = parseInt(startYear, 10);
    const e = parseInt(endYear, 10);
    if (isNaN(s) || isNaN(e) || e >= 2100) return null;
    const span = Math.max(10, e - s);
    return { start: String(e), end: String(e + span) };
  })();

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
        onSaved?.();
      } else {
        try {
          const body = await res.json() as { error?: string };
          setSaveError(body.error ?? `Failed to save (${res.status})`);
        } catch {
          setSaveError(`Failed to save (${res.status})`);
        }
      }
    } catch (err) { setSaveError(err instanceof Error ? err.message : 'Failed to save'); }
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
      if (event.details) lines.push(event.details);
      lines.push('');
      lines.push(`**Significance:** ${event.significance}`);
      if (event.figures?.length) lines.push(`**Key Figures:** ${event.figures.join(', ')}`);
      if (event.tags?.length) lines.push(`**Tags:** ${event.tags.join(', ')}`);
      const savedNote = (() => { try { return localStorage.getItem(`epocha-note::${noteId(event)}`) ?? ''; } catch { return ''; } })();
      if (savedNote.trim()) lines.push('', `**My Notes:** ${savedNote.trim()}`);
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

  const handleHtmlExport = () => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const slug = data.topic.toLowerCase().replace(/\s+/g, '-');

    const eventsHtml = data.events.map((event, i) => {
      const paras = (event.details ?? '').split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      const savedNote = (() => { try { return localStorage.getItem(`epocha-note::${noteId(event)}`) ?? ''; } catch { return ''; } })();
      return `
      <article class="event" id="event-${i}">
        <div class="event-date">${esc(event.date)}</div>
        <h2 class="event-title">${esc(event.title)}</h2>
        ${event.location ? `<p class="event-location">📍 ${esc(event.location)}</p>` : ''}
        <p class="event-summary">${esc(event.summary)}</p>
        <div class="event-details">${paras.map(p => `<p>${esc(p)}</p>`).join('')}</div>
        <div class="significance"><strong>Historical Significance</strong><p>${esc(event.significance)}</p></div>
        ${event.figures?.length ? `<div class="figures"><strong>Key Figures:</strong> ${event.figures.map(esc).join(', ')}</div>` : ''}
        ${event.tags?.length ? `<div class="tags">${event.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        ${savedNote.trim() ? `<div class="notes"><strong>My Notes:</strong><p>${esc(savedNote.trim())}</p></div>` : ''}
      </article>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(data.topic)} — Epocha</title>
<style>
  :root { --amber: #f59e0b; --bg: #08090f; --surface: #111420; --border: rgba(255,255,255,0.08); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: #cbd5e1; font-family: Georgia, serif; line-height: 1.7; }
  .header { max-width: 720px; margin: 0 auto; padding: 4rem 2rem 2rem; text-align: center; border-bottom: 1px solid var(--border); }
  .period { color: var(--amber); font-size: .75rem; letter-spacing: .2em; text-transform: uppercase; font-family: sans-serif; }
  .topic { color: #fff; font-size: 2.5rem; font-weight: 900; margin: .75rem 0 1rem; }
  .desc { color: #94a3b8; font-size: .95rem; max-width: 600px; margin: 0 auto; }
  main { max-width: 720px; margin: 0 auto; padding: 2rem; }
  .event { border-left: 3px solid var(--amber); padding: 1.5rem 1.5rem 1.5rem 2rem; margin-bottom: 2.5rem; background: var(--surface); border-radius: 0 12px 12px 0; }
  .event-date { color: var(--amber); font-size: .8rem; letter-spacing: .15em; font-family: sans-serif; text-transform: uppercase; margin-bottom: .5rem; }
  .event-title { color: #fff; font-size: 1.4rem; font-weight: 700; margin-bottom: .75rem; }
  .event-location { color: #64748b; font-size: .8rem; margin-bottom: .75rem; font-family: sans-serif; }
  .event-summary { color: #cbd5e1; margin-bottom: 1rem; }
  .event-details p { color: #94a3b8; font-size: .9rem; margin-bottom: .5rem; }
  .significance { background: rgba(251,191,36,.06); border: 1px solid rgba(251,191,36,.2); border-radius: 8px; padding: 1rem; margin: 1rem 0; }
  .significance strong { color: var(--amber); font-size: .7rem; letter-spacing: .1em; text-transform: uppercase; display: block; margin-bottom: .4rem; font-family: sans-serif; }
  .significance p { color: #fef3c7; font-size: .88rem; }
  .figures { font-size: .82rem; color: #94a3b8; margin-top: .75rem; font-family: sans-serif; }
  .tags { margin-top: .75rem; display: flex; flex-wrap: wrap; gap: .4rem; }
  .tag { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 20px; padding: .2rem .7rem; font-size: .72rem; color: #94a3b8; font-family: sans-serif; }
  .notes { margin-top: 1rem; background: rgba(16,185,129,.06); border: 1px solid rgba(16,185,129,.2); border-radius: 8px; padding: 1rem; }
  .notes strong { color: #34d399; font-size: .7rem; letter-spacing: .1em; text-transform: uppercase; display: block; margin-bottom: .4rem; font-family: sans-serif; }
  .notes p { color: #a7f3d0; font-size: .88rem; }
  footer { text-align: center; color: #334155; font-size: .75rem; padding: 2rem; font-family: sans-serif; }
</style>
</head>
<body>
<header class="header">
  <p class="period">${esc(data.period)}</p>
  <h1 class="topic">${esc(data.topic)}</h1>
  <p class="desc">${esc(data.description)}</p>
</header>
<main>${eventsHtml}</main>
<footer>Generated by Epocha · ${new Date().toLocaleDateString()}</footer>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('HTML exported');
  };

  const handleQuizComplete = (score: number, total: number, xpEarned: number) => {
    setQuizResult({ score, total, xpEarned });
    setShowQuiz(false);
    toast.xp(`+${xpEarned} XP`, `Quiz: ${score}/${total} correct`);
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
          const wordCount = data.events.reduce((n, e) => n + (e.details ?? '').split(/\s+/).length + e.summary.split(/\s+/).length, 0);
          const mins = Math.max(1, Math.round(wordCount / 200));
          const tagCount = new Set(data.events.flatMap(e => e.tags ?? [])).size;
          return (
            <p className="text-slate-600 text-xs mb-4">
              ~{mins} min read · {total} events{tagCount > 0 ? ` · ${tagCount} themes` : ''}
            </p>
          );
        })()}

        {/* Lite mode banner */}
        {isLiteMode && (
          <div className="flex items-center justify-center gap-3 mb-4 fade-up print:hidden">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/25">
              <span className="text-amber-400 text-xs">⚡ Quick mode</span>
              <span className="text-slate-600 text-xs">— summaries only</span>
              {onUpgradeLite && (
                <button
                  onClick={onUpgradeLite}
                  className="ml-1 text-xs text-amber-400 hover:text-amber-300 underline transition-colors"
                >
                  Load full details →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Reading progress */}
        {readCount > 0 && (
          <div className="flex flex-col items-center gap-1.5 mb-4 fade-up print:hidden">
            <div className="flex items-center gap-2">
              <div className="w-32 h-1 rounded-full bg-white/8 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${allRead ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-emerald-600 to-teal-500'}`}
                  style={{ width: `${Math.round((readCount / total) * 100)}%` }}
                />
              </div>
              <span className={`text-[11px] font-medium ${allRead ? 'text-emerald-400' : 'text-slate-600'}`}>
                {allRead ? '✓ All read' : `${readCount} / ${total} read`}
              </span>
            </div>
          </div>
        )}

        {/* Action bar — primary row always visible; secondary row toggles on mobile */}
        <div className="print:hidden">
          {/* Primary actions — always visible */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="px-4 py-1.5 rounded-full text-xs font-semibold text-amber-300 border border-amber-400/30 bg-amber-400/5">
              {total} events
            </span>
            {startYear && endYear && !isLiteMode && (
              <button
                onClick={() => setShowQuiz(true)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-violet-300 border border-violet-400/30 bg-violet-400/5 hover:bg-violet-400/10 transition-colors"
              >
                🧠 Quiz
              </button>
            )}
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
              onClick={() => setShowShare(true)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-amber-300 border border-amber-400/30 bg-amber-400/5 hover:bg-amber-400/10 transition-colors"
            >
              🔗 Share
            </button>
            <button
              onClick={onReset}
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors"
            >
              ← New search
            </button>
            {/* More toggle — all breakpoints */}
            <button
              onClick={() => setShowMoreActions(m => !m)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors border ${showMoreActions ? 'border-white/20 text-white bg-white/8' : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300'}`}
            >
              {showMoreActions ? 'Less ▲' : 'More ▼'}
            </button>
          </div>

          {/* Secondary actions — hidden until "More" toggled */}
          {showMoreActions && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 fade-up">
              <button onClick={() => setTimeMachine(true)} className="px-4 py-1.5 rounded-full text-xs font-semibold text-amber-300 border border-amber-400/30 bg-amber-400/5 hover:bg-amber-400/10 transition-colors">🕰 Time Machine</button>
              <button onClick={() => setShowInsights(true)} className="px-4 py-1.5 rounded-full text-xs font-semibold text-teal-300 border border-teal-400/30 bg-teal-400/5 hover:bg-teal-400/10 transition-colors">📊 Insights</button>
              <button onClick={() => setShowHeatmap(h => !h)} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors border ${showHeatmap ? 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10' : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'}`}>🗺 Density</button>
              <button onClick={() => setShowFlashcards(true)} className="px-4 py-1.5 rounded-full text-xs font-semibold text-cyan-300 border border-cyan-400/30 bg-cyan-400/5 hover:bg-cyan-400/10 transition-colors">🃏 Flashcards</button>
              <button onClick={() => { setShowSearch(s => !s); if (showSearch) setSearchQuery(''); }} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors border ${showSearch ? 'border-amber-500/40 text-amber-300 bg-amber-500/10' : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'}`}>🔍 Search</button>
              <button onClick={() => setShowBookmarks(true)} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors border ${bookmarks.length > 0 ? 'border-amber-500/40 text-amber-300 bg-amber-500/10' : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'}`}>🔖 {bookmarks.length > 0 ? `${bookmarks.length} saved` : 'Bookmarks'}</button>
              <button onClick={() => setCompact(c => !c)} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors border ${compact ? 'border-amber-500/40 text-amber-300 bg-amber-500/10' : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'}`}>{compact ? '⊞ Full' : '≡ Compact'}</button>
              <button onClick={handlePrint} className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors">📄 PDF</button>
              <button onClick={handleMarkdownExport} className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors">↓ Markdown</button>
              <button onClick={handleHtmlExport} className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors">↓ HTML</button>
              {user?.isAdmin && onRegenerateSkipCache && (
                <button onClick={onRegenerateSkipCache} className="px-4 py-1.5 rounded-full text-xs font-semibold text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 transition-colors" title="Bypass cache and regenerate from LLM">↺ Skip cache</button>
              )}
              <button onClick={() => setShowHelp(true)} className="px-2.5 py-1.5 rounded-full text-xs text-slate-700 border border-white/8 hover:border-white/15 hover:text-slate-400 transition-colors" title="Keyboard shortcuts (?)">?</button>
            </div>
          )}
        </div>

        {/* Print-only action hint */}
        <div className="hidden print:block"></div>

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

        {/* Share modal */}
        {showShare && (
          <ShareModal
            topic={data.topic}
            period={data.period}
            firstDate={data.events[0]?.date}
            lastDate={data.events[data.events.length - 1]?.date}
            eventCount={total}
            onClose={() => setShowShare(false)}
          />
        )}

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

        {/* Tag filter — collapsed by default */}
        {allTags.length > 0 && (
          <div className="mt-4 print:hidden">
            {!showTagFilter ? (
              <div className="flex justify-center">
                <button
                  onClick={() => setShowTagFilter(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium text-slate-600 border border-white/8 hover:border-white/15 hover:text-slate-400 transition-colors"
                >
                  <span className="text-[9px]">🏷</span>
                  Filter by {allTags.length} theme{allTags.length !== 1 ? 's' : ''}
                  {activeTags.size > 0 && <span className="text-amber-400 font-bold"> · {activeTags.size} active</span>}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-1.5">
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
                <button
                  onClick={() => { setShowTagFilter(false); setActiveTags(new Set()); }}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10 text-slate-600 hover:text-slate-300 transition-colors"
                >
                  hide
                </button>
              </div>
            )}
            {activeTags.size > 0 && (
              <p className="mt-2 text-xs text-slate-600 text-center">
                {visibleEvents.length} of {data.events.length} events
              </p>
            )}
          </div>
        )}

        {/* Figure filter banner */}
        {figureFilter && (
          <div className="mt-4 fade-up flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/30">
              <span className="text-xs text-slate-500">👤 Viewing history through</span>
              <span className="text-xs font-semibold text-violet-300">{figureFilter}</span>
              <span className="text-slate-700 text-xs">· {visibleEvents.length} event{visibleEvents.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => setFigureFilter(null)}
                className="text-slate-600 hover:text-slate-300 transition-colors text-xs ml-1"
                title="Clear figure filter"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Incomplete timeline warning */}
        {warning && (
          <div className="mt-4 fade-up flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 max-w-lg">
              <span className="text-amber-400 text-sm flex-shrink-0">⚠️</span>
              <span className="text-amber-200/80 text-xs">{warning}</span>
              <button
                onClick={onReset}
                className="shrink-0 text-xs text-amber-400 hover:text-amber-300 underline transition-colors ml-1"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Quiz result banner */}
        {quizResult && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 fade-up">
            <span className="text-violet-300 text-xs">Quiz: {quizResult.score}/{quizResult.total} correct · +{quizResult.xpEarned} XP</span>
          </div>
        )}
      </div>

      {/* Heatmap density view */}
      {showHeatmap && (
        <HeatmapView
          events={data.events}
          topic={data.topic}
          period={data.period}
          onEventClick={event => {
            setShowHeatmap(false);
            setTimeout(() => {
              const cards = document.querySelectorAll('[data-event-title]');
              for (const card of cards) {
                if (card.getAttribute('data-event-title') === event.title) {
                  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  break;
                }
              }
            }, 100);
          }}
        />
      )}

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
          <div className="space-y-10 lg:space-y-0">
            {visibleEvents.map((event, index) => {
              const { gradient, glow } = getGradient(index, visibleEvents.length);
              const isLeft = index % 2 === 0;
              return (
                <div
                  key={`${event.date}-${index}`}
                  data-event-title={event.title}
                  className="fade-up lg:grid lg:grid-cols-2 lg:gap-8 lg:mb-6"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  {isLeft ? (
                    <>
                      <div className="hidden lg:block lg:text-right lg:pr-10">
                        <EventCard event={event} gradient={gradient} glow={glow} align="right" defaultExpanded={false}
                          bookmarked={isBookmarked(data.topic, event)}
                          onBookmark={e => { e.stopPropagation(); toggleBookmark(data.topic, event); toast.success(isBookmarked(data.topic, event) ? 'Bookmark removed' : '🔖 Bookmarked'); }}
                          onFigureClick={handleFigureClick} activeFigure={figureFilter}
                          noteId={noteId(event)}
                          onExpand={() => markRead(event.date, event.title)} isRead={isRead(event.date, event.title)}
                          relatedEvents={getRelatedEvents(event)} onScrollTo={handleScrollTo} />
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
                      <div className="hidden lg:block lg:pl-10">
                        <EventCard event={event} gradient={gradient} glow={glow} align="left" defaultExpanded={false}
                          bookmarked={isBookmarked(data.topic, event)}
                          onBookmark={e => { e.stopPropagation(); toggleBookmark(data.topic, event); toast.success(isBookmarked(data.topic, event) ? 'Bookmark removed' : '🔖 Bookmarked'); }}
                          onFigureClick={handleFigureClick} activeFigure={figureFilter}
                          noteId={noteId(event)}
                          onExpand={() => markRead(event.date, event.title)} isRead={isRead(event.date, event.title)}
                          relatedEvents={getRelatedEvents(event)} onScrollTo={handleScrollTo} />
                      </div>
                    </>
                  )}
                  <div
                    className={`hidden lg:block absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gradient-to-br ${gradient} shadow-lg ${glow} mt-6 ring-2 ring-[#0a0e1a]`}
                    style={{ top: `${index === 0 ? 24 : 0}px`, position: 'absolute' }}
                  />
                  <div className="lg:hidden">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${gradient} flex-shrink-0`} />
                      <DatePill date={event.date} gradient={gradient} />
                    </div>
                    <div className="pl-5 border-l border-white/10">
                      <EventCard event={event} gradient={gradient} glow={glow} align="left"
                        bookmarked={isBookmarked(data.topic, event)}
                        onBookmark={e => { e.stopPropagation(); toggleBookmark(data.topic, event); toast.success(isBookmarked(data.topic, event) ? 'Bookmark removed' : '🔖 Bookmarked'); }}
                        onFigureClick={handleFigureClick} activeFigure={figureFilter}
                        noteId={noteId(event)}
                        onExpand={() => markRead(event.date, event.title)} isRead={isRead(event.date, event.title)}
                        relatedEvents={getRelatedEvents(event)} onScrollTo={handleScrollTo} />
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

        {/* Next Era continuation */}
        {onContinue && nextEraPeriod && (
          <div className="mt-6 mb-2 print:hidden">
            <p className="text-slate-600 text-xs mb-3">Keep the story going</p>
            <button
              onClick={() => onContinue(data.topic, nextEraPeriod.start, nextEraPeriod.end)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-white/5 border border-white/15 text-slate-300 hover:bg-white/10 hover:text-white hover:border-white/25 transition-all"
            >
              {data.topic} · {nextEraPeriod.start}–{nextEraPeriod.end}
              <span className="text-slate-500">→</span>
            </button>
          </div>
        )}

        <button
          onClick={onReset}
          className="mt-8 px-8 py-3 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 transition-all shadow-lg shadow-amber-500/20 print:hidden"
        >
          Explore another topic
        </button>
      </div>

      {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}

      {timeMachine && (
        <TimeMachine
          events={visibleEvents}
          topic={data.topic}
          onClose={() => setTimeMachine(false)}
        />
      )}

      {showBookmarks && (
        <BookmarksPanel
          bookmarks={bookmarks}
          onRemove={removeBookmark}
          onClear={clearBookmarks}
          onClose={() => setShowBookmarks(false)}
        />
      )}

      {showFlashcards && (
        <FlashcardMode
          events={visibleEvents.length > 0 ? visibleEvents : data.events}
          topic={data.topic}
          onClose={() => setShowFlashcards(false)}
        />
      )}

      {showInsights && <InsightsPanel data={data} onClose={() => setShowInsights(false)} />}

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

function DatePill({ date, gradient }: { date: string; gradient: string }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${gradient} flex-shrink-0`} />
      <span className={`font-cinzel font-black text-xl tracking-widest bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}
        style={{ textShadow: 'none', filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.15))' }}>
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
            <span className={`font-cinzel font-black text-base tracking-widest bg-gradient-to-r ${gradient} bg-clip-text text-transparent whitespace-nowrap`}>
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
