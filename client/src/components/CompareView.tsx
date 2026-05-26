import { useState, useMemo } from 'react';
import type { TimelineData, TimelineEvent } from '../types';

interface Props {
  left: TimelineData;
  leftYears: { start: string; end: string };
  right: TimelineData;
  rightYears: { start: string; end: string };
  onExit: () => void;
}

interface ExpandedEvent {
  side: 'left' | 'right';
  index: number;
}

function buildAxis(left: TimelineData, right: TimelineData) {
  const allYears = [
    ...left.events.map(e => e.sortYear ?? 0),
    ...right.events.map(e => e.sortYear ?? 0),
  ].filter(y => y !== 0);
  if (allYears.length === 0) return { min: 0, max: 0, range: 1 };
  const min = Math.min(...allYears);
  const max = Math.max(...allYears);
  return { min, max, range: max - min || 1 };
}

function pct(sortYear: number | undefined, min: number, range: number) {
  if (sortYear === undefined) return null;
  return ((sortYear - min) / range) * 100;
}

function yearLabel(y: number) {
  return y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`;
}

function EventRow({ event, expanded, onToggle, side }: {
  event: TimelineEvent;
  expanded: boolean;
  onToggle: () => void;
  side: 'left' | 'right';
}) {
  const isLeft = side === 'left';
  const dotColor = isLeft ? 'bg-violet-400' : 'bg-amber-400';
  const expandedBg = isLeft ? 'bg-violet-500/5 border-violet-500/15' : 'bg-amber-500/5 border-amber-500/15';

  return (
    <div
      className={`rounded-xl border transition-all cursor-pointer ${
        expanded
          ? `${expandedBg} border`
          : 'border-white/5 bg-white/2 hover:bg-white/4 hover:border-white/10'
      }`}
      onClick={onToggle}
    >
      <div className="px-3.5 py-3 flex items-start gap-3">
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0 mt-1.5`} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-slate-600 leading-none mb-1">{event.date}</p>
          <p className="text-sm font-semibold text-white leading-snug">{event.title}</p>
          {!expanded && event.summary && (
            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed line-clamp-1">{event.summary}</p>
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-slate-600 shrink-0 mt-1 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-3 fade-up" onClick={e => e.stopPropagation()}>
          {event.summary && (
            <p className="text-xs text-slate-400 leading-relaxed pl-4.5">{event.summary}</p>
          )}
          {event.significance && (
            <div className="rounded-lg px-3 py-2.5 bg-amber-400/8 border border-amber-400/15 ml-4">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Significance</p>
              <p className="text-xs text-amber-100/70 leading-relaxed">{event.significance}</p>
            </div>
          )}
          {event.figures && event.figures.length > 0 && (
            <div className="flex flex-wrap gap-1 pl-4">
              {event.figures.map(f => (
                <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">{f}</span>
              ))}
            </div>
          )}
          {event.source && (
            <a
              href={event.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-amber-400 transition-colors pl-4"
            >
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Wikipedia
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function Column({ data, years, side, expanded, onToggle }: {
  data: TimelineData;
  years: { start: string; end: string };
  side: 'left' | 'right';
  expanded: ExpandedEvent | null;
  onToggle: (index: number) => void;
}) {
  const isLeft = side === 'left';
  const accentBar = isLeft ? 'from-violet-600 to-violet-400' : 'from-amber-500 to-orange-400';
  const accentText = isLeft ? 'text-violet-400' : 'text-amber-400';
  const badgeBg = isLeft ? 'bg-violet-500/10 text-violet-300 border-violet-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Accent bar */}
      <div className={`h-0.5 w-full bg-gradient-to-r ${accentBar} shrink-0`} />

      {/* Column header */}
      <div className="px-5 py-4 border-b border-white/5 shrink-0">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${accentText} mb-1`}>
          {isLeft ? 'Timeline A' : 'Timeline B'}
        </p>
        <h3 className="text-base font-bold text-white leading-snug">{data.topic}</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">{data.period}</p>
        <div className="flex items-center gap-2 mt-2.5">
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${badgeBg}`}>
            {data.events.length} events
          </span>
          {(years.start || years.end) && (
            <span className="text-[10px] text-slate-600">{years.start}{years.start && years.end ? ' – ' : ''}{years.end}</span>
          )}
        </div>
      </div>

      {/* Scrollable event list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 min-h-0">
        {data.events.map((event, i) => (
          <EventRow
            key={i}
            event={event}
            side={side}
            expanded={expanded?.side === side && expanded.index === i}
            onToggle={() => onToggle(i)}
          />
        ))}
      </div>
    </div>
  );
}

export default function CompareView({ left, leftYears, right, rightYears, onExit }: Props) {
  const [expanded, setExpanded] = useState<ExpandedEvent | null>(null);
  const [activeTab, setActiveTab] = useState<'left' | 'right'>('left');
  const axis = useMemo(() => buildAxis(left, right), [left, right]);

  const toggle = (side: 'left' | 'right', index: number) => {
    setExpanded(prev =>
      prev?.side === side && prev.index === index ? null : { side, index }
    );
  };

  const leftMin = Math.min(...left.events.map(e => e.sortYear ?? Infinity).filter(isFinite));
  const leftMax = Math.max(...left.events.map(e => e.sortYear ?? -Infinity).filter(n => isFinite(n)));
  const rightMin = Math.min(...right.events.map(e => e.sortYear ?? Infinity).filter(isFinite));
  const rightMax = Math.max(...right.events.map(e => e.sortYear ?? -Infinity).filter(n => isFinite(n)));
  const overlapStart = Math.max(leftMin, rightMin);
  const overlapEnd = Math.min(leftMax, rightMax);
  const hasOverlap = overlapStart <= overlapEnd;

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="glass border-b border-white/8 px-4 py-3 flex items-center gap-3 print:hidden shrink-0">
        {/* Topics */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest shrink-0">Compare</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300 font-medium truncate max-w-[28%]">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
            {left.topic}
          </span>
          <span className="text-slate-700 text-xs shrink-0">vs</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-medium truncate max-w-[28%]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            {right.topic}
          </span>
          {hasOverlap && (
            <span className="hidden sm:inline text-[10px] text-emerald-400 bg-emerald-400/8 border border-emerald-400/15 px-2 py-0.5 rounded-full font-medium shrink-0">
              overlap {yearLabel(overlapStart)} – {yearLabel(overlapEnd)}
            </span>
          )}
        </div>

        <button
          onClick={onExit}
          className="text-xs text-slate-500 hover:text-white border border-white/10 hover:border-white/25 rounded-lg px-3 py-1.5 transition-all shrink-0 hover:bg-white/5"
        >
          Exit
        </button>
      </div>

      {/* ── Shared time axis (desktop) ────────────────────────────── */}
      <div className="hidden md:block px-5 py-3 border-b border-white/5 bg-black/15 shrink-0">
        <div className="relative h-7 bg-white/3 rounded-full overflow-hidden">
          {/* Left span */}
          {isFinite(leftMin) && isFinite(leftMax) && (
            <div
              className="absolute top-1.5 bottom-1.5 rounded-full bg-violet-500/35 border border-violet-400/40"
              style={{
                left: `${pct(leftMin, axis.min, axis.range) ?? 0}%`,
                width: `${Math.max(((leftMax - leftMin) / axis.range) * 100, 1)}%`,
              }}
            />
          )}
          {/* Right span */}
          {isFinite(rightMin) && isFinite(rightMax) && (
            <div
              className="absolute top-1.5 bottom-1.5 rounded-full bg-amber-500/35 border border-amber-400/40"
              style={{
                left: `${pct(rightMin, axis.min, axis.range) ?? 0}%`,
                width: `${Math.max(((rightMax - rightMin) / axis.range) * 100, 1)}%`,
              }}
            />
          )}
          {/* Overlap */}
          {hasOverlap && (
            <div
              className="absolute inset-y-0 rounded-full bg-emerald-400/15 border border-emerald-400/25"
              style={{
                left: `${pct(overlapStart, axis.min, axis.range) ?? 0}%`,
                width: `${Math.max(((overlapEnd - overlapStart) / axis.range) * 100, 0.5)}%`,
              }}
            />
          )}
        </div>
        <div className="flex items-center mt-1.5 gap-4">
          <span className="text-[9px] text-slate-700 font-mono">{yearLabel(axis.min)}</span>
          <div className="flex items-center gap-3 flex-1 justify-center">
            <span className="flex items-center gap-1 text-[9px] text-violet-500">
              <span className="w-2 h-1 rounded-full bg-violet-500/50 inline-block" />
              {left.topic.length > 20 ? left.topic.slice(0, 20) + '…' : left.topic}
            </span>
            {hasOverlap && (
              <span className="flex items-center gap-1 text-[9px] text-emerald-600">
                <span className="w-2 h-1 rounded-full bg-emerald-500/40 inline-block" />
                overlap
              </span>
            )}
            <span className="flex items-center gap-1 text-[9px] text-amber-500">
              <span className="w-2 h-1 rounded-full bg-amber-500/50 inline-block" />
              {right.topic.length > 20 ? right.topic.slice(0, 20) + '…' : right.topic}
            </span>
          </div>
          <span className="text-[9px] text-slate-700 font-mono">{yearLabel(axis.max)}</span>
        </div>
      </div>

      {/* ── Mobile tab switcher ───────────────────────────────────── */}
      <div className="flex md:hidden border-b border-white/8 shrink-0">
        <button
          onClick={() => setActiveTab('left')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-all ${
            activeTab === 'left'
              ? 'text-violet-300 border-b-2 border-violet-500 bg-violet-500/5'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
            {left.topic.length > 18 ? left.topic.slice(0, 18) + '…' : left.topic}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('right')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-all ${
            activeTab === 'right'
              ? 'text-amber-300 border-b-2 border-amber-500 bg-amber-500/5'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            {right.topic.length > 18 ? right.topic.slice(0, 18) + '…' : right.topic}
          </span>
        </button>
      </div>

      {/* ── Desktop split columns ─────────────────────────────────── */}
      <div className="hidden md:grid md:grid-cols-2 flex-1 min-h-0 divide-x divide-white/5 overflow-hidden">
        <Column data={left} years={leftYears} side="left" expanded={expanded} onToggle={i => toggle('left', i)} />
        <Column data={right} years={rightYears} side="right" expanded={expanded} onToggle={i => toggle('right', i)} />
      </div>

      {/* ── Mobile single column ──────────────────────────────────── */}
      <div className="flex md:hidden flex-col flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'left'
          ? <Column data={left} years={leftYears} side="left" expanded={expanded} onToggle={i => toggle('left', i)} />
          : <Column data={right} years={rightYears} side="right" expanded={expanded} onToggle={i => toggle('right', i)} />
        }
      </div>
    </div>
  );
}
