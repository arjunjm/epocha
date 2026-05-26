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

// Merge and sort all events from both timelines by sortYear for the shared axis
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

function EventRow({ event, expanded, onToggle, side }: {
  event: TimelineEvent;
  expanded: boolean;
  onToggle: () => void;
  side: 'left' | 'right';
}) {
  const accentColor = side === 'left'
    ? 'border-l-violet-500 bg-violet-500/5'
    : 'border-l-amber-500 bg-amber-500/5';

  return (
    <div
      className={`border-l-2 ${accentColor} pl-3 py-2 rounded-r-lg cursor-pointer hover:bg-white/4 transition-colors`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-mono text-slate-500">{event.date}</span>
          <p className="text-sm font-semibold text-white leading-snug mt-0.5">{event.title}</p>
          {expanded && (
            <div className="mt-2 space-y-2 fade-up">
              <p className="text-xs text-slate-400 leading-relaxed">{event.summary}</p>
              {event.significance && (
                <div className="rounded-lg p-2.5 bg-amber-400/8 border border-amber-400/15">
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Significance</p>
                  <p className="text-xs text-amber-100/75 leading-relaxed">{event.significance}</p>
                </div>
              )}
              {event.figures && event.figures.length > 0 && (
                <p className="text-[11px] text-slate-500">
                  <span className="text-slate-600">Figures: </span>
                  {event.figures.join(', ')}
                </p>
              )}
              {event.source && (
                <a
                  href={event.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-amber-400 transition-colors"
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
        <svg
          className={`w-3.5 h-3.5 text-slate-600 shrink-0 mt-1 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
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
  const accentClass = side === 'left' ? 'text-violet-400' : 'text-amber-400';
  const badgeClass = side === 'left'
    ? 'bg-violet-500/15 text-violet-300 border-violet-500/25'
    : 'bg-amber-500/15 text-amber-300 border-amber-500/25';

  return (
    <div className="flex flex-col h-full">
      {/* Column header */}
      <div className="px-4 py-4 border-b border-white/5 bg-white/2">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${accentClass}`}>
          {side === 'left' ? 'Timeline A' : 'Timeline B'}
        </span>
        <h3 className="text-base font-bold text-white mt-1 leading-tight">{data.topic}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{data.period}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${badgeClass}`}>
            {data.events.length} events
          </span>
          <span className="text-[10px] text-slate-600">{years.start} – {years.end}</span>
        </div>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
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

  // Find overlapping time range for the summary bar
  const leftMin = Math.min(...left.events.map(e => e.sortYear ?? Infinity).filter(isFinite));
  const leftMax = Math.max(...left.events.map(e => e.sortYear ?? -Infinity).filter(n => isFinite(n)));
  const rightMin = Math.min(...right.events.map(e => e.sortYear ?? Infinity).filter(isFinite));
  const rightMax = Math.max(...right.events.map(e => e.sortYear ?? -Infinity).filter(n => isFinite(n)));
  const overlapStart = Math.max(leftMin, rightMin);
  const overlapEnd = Math.min(leftMax, rightMax);
  const hasOverlap = overlapStart <= overlapEnd;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Compare header bar */}
      <div className="glass border-b border-white/8 px-4 py-3 flex items-center gap-3 print:hidden shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest shrink-0">Comparing</span>
          <span className="text-xs text-violet-300 font-semibold truncate">{left.topic}</span>
          <span className="text-slate-600 shrink-0">vs</span>
          <span className="text-xs text-amber-300 font-semibold truncate">{right.topic}</span>
        </div>

        {/* Overlap indicator */}
        {hasOverlap && (
          <span className="text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full shrink-0 hidden sm:inline">
            ⟺ overlap: {overlapStart < 0 ? `${Math.abs(overlapStart)} BCE` : `${overlapStart} CE`}
            {' '}–{' '}
            {overlapEnd < 0 ? `${Math.abs(overlapEnd)} BCE` : `${overlapEnd} CE`}
          </span>
        )}

        <button
          onClick={onExit}
          className="text-xs text-slate-500 hover:text-slate-200 border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 transition-colors shrink-0"
        >
          Exit compare
        </button>
      </div>

      {/* Shared time axis bar (desktop only) */}
      <div className="hidden md:block px-4 py-2 border-b border-white/5 bg-black/10 shrink-0">
        <div className="relative h-5 bg-white/3 rounded-full overflow-hidden">
          {/* Left timeline span */}
          {isFinite(leftMin) && isFinite(leftMax) && (
            <div
              className="absolute top-1 bottom-1 rounded-full bg-violet-500/30 border border-violet-500/40"
              style={{
                left: `${pct(leftMin, axis.min, axis.range) ?? 0}%`,
                width: `${((leftMax - leftMin) / axis.range) * 100}%`,
              }}
            />
          )}
          {/* Right timeline span */}
          {isFinite(rightMin) && isFinite(rightMax) && (
            <div
              className="absolute top-1 bottom-1 rounded-full bg-amber-500/30 border border-amber-500/40"
              style={{
                left: `${pct(rightMin, axis.min, axis.range) ?? 0}%`,
                width: `${((rightMax - rightMin) / axis.range) * 100}%`,
              }}
            />
          )}
          {/* Overlap highlight */}
          {hasOverlap && (
            <div
              className="absolute top-0.5 bottom-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30"
              style={{
                left: `${pct(overlapStart, axis.min, axis.range) ?? 0}%`,
                width: `${((overlapEnd - overlapStart) / axis.range) * 100}%`,
              }}
            />
          )}
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] text-slate-700 font-mono">
            {axis.min < 0 ? `${Math.abs(axis.min)} BCE` : `${axis.min} CE`}
          </span>
          <span className="text-[9px] text-slate-700 font-mono">
            {axis.max < 0 ? `${Math.abs(axis.max)} BCE` : `${axis.max} CE`}
          </span>
        </div>
      </div>

      {/* Mobile tab switcher */}
      <div className="flex md:hidden border-b border-white/8 shrink-0">
        <button
          onClick={() => setActiveTab('left')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'left'
              ? 'text-violet-300 border-b-2 border-violet-500'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {left.topic}
        </button>
        <button
          onClick={() => setActiveTab('right')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'right'
              ? 'text-amber-300 border-b-2 border-amber-500'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {right.topic}
        </button>
      </div>

      {/* Split columns — desktop */}
      <div className="hidden md:grid md:grid-cols-2 flex-1 min-h-0 divide-x divide-white/5" style={{ height: 'calc(100vh - 180px)' }}>
        <Column
          data={left}
          years={leftYears}
          side="left"
          expanded={expanded}
          onToggle={i => toggle('left', i)}
        />
        <Column
          data={right}
          years={rightYears}
          side="right"
          expanded={expanded}
          onToggle={i => toggle('right', i)}
        />
      </div>

      {/* Mobile single column */}
      <div className="flex md:hidden flex-col flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'left' ? (
          <Column
            data={left}
            years={leftYears}
            side="left"
            expanded={expanded}
            onToggle={i => toggle('left', i)}
          />
        ) : (
          <Column
            data={right}
            years={rightYears}
            side="right"
            expanded={expanded}
            onToggle={i => toggle('right', i)}
          />
        )}
      </div>
    </div>
  );
}
