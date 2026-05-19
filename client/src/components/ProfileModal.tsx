import { useState, useEffect } from 'react';
import type { AuthUser } from '../hooks/useAuth';
import { LEVEL_THRESHOLDS, xpForNextLevel } from '../types';

interface Props {
  user: AuthUser;
  onClose: () => void;
  onSignOut: () => void;
  onOpenMarketplace: () => void;
}

const LEVEL_TITLES = [
  '', 'Novice', 'Apprentice', 'Scholar', 'Historian', 'Archivist',
  'Chronicler', 'Sage', 'Lorekeeper', 'Antiquarian', 'Curator',
  'Fellow', 'Luminary', 'Savant', 'Polymath', 'Oracle',
  'Virtuoso', 'Mastermind', 'Visionary', 'Grand Historian', 'Epocha Master',
];

const THEME_ICONS: Record<string, string> = {
  midnight: '🌑', sepia: '📜', neon: '⚡', ocean: '🌊', forest: '🌿',
};

interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  earned: boolean;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  progress?: { current: number; target: number };
}

const RARITY_STYLES = {
  common:    { border: 'border-slate-600/50',  bg: 'bg-slate-800/60',  label: 'text-slate-400',  glow: '' },
  rare:      { border: 'border-blue-500/50',   bg: 'bg-blue-900/40',   label: 'text-blue-400',   glow: 'shadow-blue-500/20' },
  epic:      { border: 'border-violet-500/50', bg: 'bg-violet-900/40', label: 'text-violet-400', glow: 'shadow-violet-500/20' },
  legendary: { border: 'border-amber-400/60',  bg: 'bg-amber-900/30',  label: 'text-amber-300',  glow: 'shadow-amber-400/30' },
};

function levelTierColor(level: number) {
  if (level >= 20) return { bg: 'from-amber-300 to-yellow-200', text: 'text-amber-900', ring: 'ring-amber-300', label: 'text-amber-400' };
  if (level >= 15) return { bg: 'from-violet-400 to-purple-300', text: 'text-violet-900', ring: 'ring-violet-400', label: 'text-violet-400' };
  if (level >= 10) return { bg: 'from-cyan-400 to-blue-300', text: 'text-cyan-900', ring: 'ring-cyan-400', label: 'text-cyan-400' };
  if (level >= 5)  return { bg: 'from-emerald-400 to-green-300', text: 'text-emerald-900', ring: 'ring-emerald-400', label: 'text-emerald-400' };
  return               { bg: 'from-slate-400 to-slate-300', text: 'text-slate-900', ring: 'ring-slate-500', label: 'text-slate-400' };
}

function buildAchievements(level: number, xp: number, savedCount: number): Achievement[] {
  return [
    { id: 'first-steps', icon: '🌱', name: 'First Steps', description: 'Explored your first timeline', earned: xp >= 10, rarity: 'common' },
    { id: 'scholar', icon: '📚', name: 'Scholar', description: 'Reached Level 5', earned: level >= 5, rarity: 'common',
      progress: level < 5 ? { current: level, target: 5 } : undefined },
    { id: 'historian', icon: '🏛️', name: 'Historian', description: 'Reached Level 10', earned: level >= 10, rarity: 'rare',
      progress: level < 10 ? { current: level, target: 10 } : undefined },
    { id: 'grand-historian', icon: '🏆', name: 'Grand Historian', description: 'Reached Level 15', earned: level >= 15, rarity: 'epic',
      progress: level < 15 ? { current: level, target: 15 } : undefined },
    { id: 'master', icon: '👑', name: 'Epocha Master', description: 'Reached the max level', earned: level >= 20, rarity: 'legendary',
      progress: level < 20 ? { current: level, target: 20 } : undefined },
    { id: 'collector', icon: '🔖', name: 'Collector', description: 'Saved your first timeline', earned: savedCount >= 1, rarity: 'common' },
    { id: 'librarian', icon: '📖', name: 'Librarian', description: 'Saved 5 timelines', earned: savedCount >= 5, rarity: 'rare',
      progress: savedCount < 5 ? { current: savedCount, target: 5 } : undefined },
    { id: 'curator', icon: '🗄️', name: 'Curator', description: 'Saved 10 timelines', earned: savedCount >= 10, rarity: 'epic',
      progress: savedCount < 10 ? { current: savedCount, target: 10 } : undefined },
  ];
}

const SHOWCASE_KEY = 'epocha-showcase';
function loadShowcase(): string[] {
  try { return JSON.parse(localStorage.getItem(SHOWCASE_KEY) ?? '[]') as string[]; } catch { return []; }
}
function saveShowcase(ids: string[]) {
  try { localStorage.setItem(SHOWCASE_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
}

export default function ProfileModal({ user, onClose, onSignOut, onOpenMarketplace }: Props) {
  const level = user.level ?? 1;
  const xp = user.xp ?? 0;
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = xpForNextLevel(level);
  const progress = level >= 20 ? 1 : Math.max(0, (xp - currentThreshold) / (nextThreshold - currentThreshold));
  const xpToNext = level >= 20 ? 0 : nextThreshold - xp;
  const title = LEVEL_TITLES[level] ?? 'Epocha Master';
  const { bg, text, ring, label } = levelTierColor(level);
  const unlockedThemes = user.unlockedThemes ?? ['midnight'];
  const lockedCount = 5 - unlockedThemes.length;

  const [savedCount, setSavedCount] = useState(0);
  const [showcase, setShowcase] = useState<string[]>(loadShowcase);
  const [editingShowcase, setEditingShowcase] = useState(false);

  useEffect(() => {
    fetch('/api/saved', { credentials: 'include' })
      .then(r => r.json())
      .then((d: unknown[]) => setSavedCount(Array.isArray(d) ? d.length : 0))
      .catch(() => {});
  }, []);

  const achievements = buildAchievements(level, xp, savedCount);
  const earnedAchievements = achievements.filter(a => a.earned);
  const showcasedAchievements = showcase
    .map(id => achievements.find(a => a.id === id))
    .filter(Boolean) as Achievement[];

  const toggleShowcase = (id: string) => {
    setShowcase(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev;
      saveShowcase(next);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass rounded-2xl w-full max-w-sm border border-white/10 fade-up overflow-y-auto max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Hero banner ────────────────────────────────────────────────── */}
        <div className={`relative bg-gradient-to-br from-slate-900 to-[#0a0e1a] px-6 pt-6 pb-4 rounded-t-2xl overflow-hidden`}>
          {/* Subtle gradient wash */}
          <div className={`absolute inset-0 bg-gradient-to-br ${bg} opacity-5 pointer-events-none`} />

          <div className="relative flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              {user.picture ? (
                <img src={user.picture} alt={user.name} className={`w-14 h-14 rounded-full ring-2 ${ring} shadow-lg`} />
              ) : (
                <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${bg} ring-2 ${ring} flex items-center justify-center text-2xl font-black ${text}`}>
                  {user.name[0]}
                </div>
              )}
              <div>
                <p className="text-white font-bold text-sm leading-tight">{user.name}</p>
                <p className={`text-xs font-semibold ${label}`}>{title}</p>
                <p className="text-slate-600 text-[10px] mt-0.5">{user.email}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-600 hover:text-slate-300 text-xl leading-none">×</button>
          </div>

          {/* ── Big level badge ─────────────────────────────────────────── */}
          <div className="flex items-center gap-4">
            <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${bg} ring-2 ${ring} flex items-center justify-center shadow-xl flex-shrink-0`}>
              <span className={`font-cinzel font-black text-2xl leading-none ${text}`}>{level}</span>
              <span className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-bold ${label} uppercase tracking-wider whitespace-nowrap`}>
                Level
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-white font-bold text-sm">{xp.toLocaleString()} XP</span>
                {level < 20 && <span className="text-slate-600 text-[10px]">{xpToNext.toLocaleString()} to next</span>}
              </div>
              <div className="h-2.5 rounded-full bg-white/8 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${bg} transition-all`}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              {level >= 20 && <p className={`text-xs font-bold ${label} mt-1`}>Max level reached 🏆</p>}
            </div>
          </div>

          {/* ── Achievement showcase (up to 3 pinned) ──────────────────── */}
          {earnedAchievements.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Showcase</p>
                <button
                  onClick={() => setEditingShowcase(e => !e)}
                  className="text-[10px] text-amber-500/60 hover:text-amber-400 transition-colors"
                >
                  {editingShowcase ? 'done' : 'edit'}
                </button>
              </div>
              <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, i) => {
                  const a = showcasedAchievements[i];
                  const { border, bg: abg, glow } = a ? RARITY_STYLES[a.rarity] : RARITY_STYLES.common;
                  return (
                    <div
                      key={i}
                      className={`flex-1 aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 transition-all
                        ${a ? `${border} ${abg} shadow-lg ${glow}` : 'border-white/8 bg-white/3 border-dashed'}
                        ${editingShowcase && a ? 'cursor-pointer hover:opacity-70' : ''}
                      `}
                      onClick={() => editingShowcase && a && toggleShowcase(a.id)}
                      title={a ? a.name : 'Empty slot'}
                    >
                      {a ? (
                        <>
                          <span className="text-2xl">{a.icon}</span>
                          <span className="text-[9px] text-center text-slate-400 leading-tight px-1">{a.name}</span>
                        </>
                      ) : (
                        <span className="text-slate-700 text-xl">+</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* ── All achievements ────────────────────────────────────────── */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Achievements</p>
              <span className={`text-[10px] font-bold ${label}`}>{earnedAchievements.length}/{achievements.length}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {achievements.map(a => {
                const { border, bg: abg, glow } = RARITY_STYLES[a.rarity];
                const isShowcased = showcase.includes(a.id);
                return (
                  <div
                    key={a.id}
                    title={`${a.name}: ${a.description}${a.progress ? ` (${a.progress.current}/${a.progress.target})` : ''}`}
                    onClick={() => a.earned && editingShowcase && toggleShowcase(a.id)}
                    className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-all
                      ${a.earned
                        ? `${border} ${abg} shadow-sm ${glow} ${editingShowcase ? 'cursor-pointer hover:scale-105' : ''}`
                        : 'border-white/5 bg-white/2 opacity-30 grayscale'
                      }
                    `}
                  >
                    <span className="text-xl">{a.icon}</span>
                    <span className="text-[9px] text-slate-500 text-center leading-tight">{a.name}</span>
                    {isShowcased && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                    {a.progress && !a.earned && (
                      <div className="w-full h-0.5 rounded-full bg-white/10">
                        <div className="h-full bg-amber-500/50 rounded-full" style={{ width: `${(a.progress.current / a.progress.target) * 100}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {earnedAchievements.length > 0 && !editingShowcase && (
              <p className="text-[10px] text-slate-700 mt-2 text-center">Tap "edit" to pin achievements to your showcase</p>
            )}
          </div>

          {/* ── Daily usage ─────────────────────────────────────────────── */}
          <div className="bg-white/3 rounded-xl p-3 border border-white/5">
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Today</p>
              <span className={`text-xs font-bold ${user.remaining === 0 ? 'text-red-400' : user.remaining <= 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {user.dailyLimit - user.remaining}/{user.dailyLimit} generations
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
              <div
                className={`h-full rounded-full ${user.remaining === 0 ? 'bg-red-500' : user.remaining <= 2 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${((user.dailyLimit - user.remaining) / user.dailyLimit) * 100}%` }}
              />
            </div>
          </div>

          {/* ── Themes ──────────────────────────────────────────────────── */}
          <div className="bg-white/3 rounded-xl p-3 border border-white/5">
            <div className="flex justify-between items-center mb-2">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Themes</p>
              {lockedCount > 0 && (
                <button onClick={onOpenMarketplace} className="text-[10px] text-amber-400/70 hover:text-amber-400 transition-colors">
                  {lockedCount} locked → Shop
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {['midnight', 'sepia', 'neon', 'ocean', 'forest'].map(id => {
                const owned = unlockedThemes.includes(id);
                const active = user.activeTheme === id;
                return (
                  <div key={id} title={id}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all
                      ${active ? `ring-2 ${ring} scale-110` : owned ? 'opacity-70' : 'opacity-20 grayscale'}`}>
                    {THEME_ICONS[id]}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── XP guide ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5"><span className={`font-bold ${label}`}>+10</span> View timeline</div>
            <div className="flex items-center gap-1.5"><span className={`font-bold ${label}`}>+5</span> Save timeline</div>
            <div className="flex items-center gap-1.5"><span className={`font-bold ${label}`}>+50</span> Complete quiz</div>
            <div className="flex items-center gap-1.5"><span className={`font-bold ${label}`}>+5</span> Daily login</div>
          </div>

          <button
            onClick={onSignOut}
            className="w-full py-2 rounded-xl text-xs text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors border border-white/5"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
