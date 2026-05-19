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

export default function ProfileModal({ user, onClose, onSignOut, onOpenMarketplace }: Props) {
  const level = user.level ?? 1;
  const xp = user.xp ?? 0;
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = xpForNextLevel(level);
  const progress = level >= 20 ? 1 : Math.max(0, (xp - currentThreshold) / (nextThreshold - currentThreshold));
  const xpToNext = level >= 20 ? 0 : nextThreshold - xp;
  const title = LEVEL_TITLES[level] ?? 'Epocha Master';

  const unlockedThemes = user.unlockedThemes ?? ['midnight'];
  const lockedCount = 5 - unlockedThemes.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass rounded-2xl w-full max-w-sm p-6 border border-white/10 fade-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="w-12 h-12 rounded-full ring-2 ring-amber-500/30" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-xl font-bold text-amber-300">
                {user.name[0]}
              </div>
            )}
            <div>
              <p className="text-white font-semibold text-sm">{user.name}</p>
              <p className="text-slate-500 text-xs">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors text-xl leading-none">×</button>
        </div>

        {/* Level + XP */}
        <div className="bg-white/3 rounded-xl p-4 mb-4 border border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-amber-400 font-bold text-lg leading-none">Level {level}</p>
              <p className="text-slate-500 text-xs mt-0.5">{title}</p>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-sm">{xp.toLocaleString()} XP</p>
              {level < 20 && (
                <p className="text-slate-600 text-xs">{xpToNext.toLocaleString()} to next level</p>
              )}
            </div>
          </div>
          <div className="h-2 rounded-full bg-white/8 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          {level >= 20 && <p className="text-amber-400 text-xs text-center mt-2 font-semibold">Max level reached 🏆</p>}
        </div>

        {/* Daily usage */}
        <div className="bg-white/3 rounded-xl p-4 mb-4 border border-white/5">
          <div className="flex justify-between items-center mb-2">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Today's Generations</p>
            <span className={`text-xs font-bold ${user.remaining === 0 ? 'text-red-400' : user.remaining <= 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {user.dailyLimit - user.remaining}/{user.dailyLimit}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div
              className={`h-full rounded-full ${user.remaining === 0 ? 'bg-red-500' : user.remaining <= 2 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${((user.dailyLimit - user.remaining) / user.dailyLimit) * 100}%` }}
            />
          </div>
          {user.remaining === 0 && (
            <p className="text-slate-600 text-xs mt-1.5">Resets at midnight UTC</p>
          )}
        </div>

        {/* Themes */}
        <div className="bg-white/3 rounded-xl p-4 mb-5 border border-white/5">
          <div className="flex justify-between items-center mb-3">
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
                <div
                  key={id}
                  title={id}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all ${
                    active ? 'ring-2 ring-amber-400 scale-110' : owned ? 'opacity-80' : 'opacity-25 grayscale'
                  }`}
                >
                  {THEME_ICONS[id]}
                </div>
              );
            })}
          </div>
        </div>

        {/* XP guide */}
        <div className="mb-5 grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-1.5"><span className="text-amber-500">+10</span> View timeline</div>
          <div className="flex items-center gap-1.5"><span className="text-amber-500">+5</span> Save timeline</div>
          <div className="flex items-center gap-1.5"><span className="text-amber-500">+50</span> Complete quiz</div>
          <div className="flex items-center gap-1.5"><span className="text-amber-500">+5</span> Daily login</div>
        </div>

        <button
          onClick={onSignOut}
          className="w-full py-2 rounded-xl text-xs text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors border border-white/5"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
