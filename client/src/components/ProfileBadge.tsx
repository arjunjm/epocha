import type { AuthUser } from '../hooks/useAuth';
import { LEVEL_THRESHOLDS, xpForNextLevel } from '../types';

interface Props {
  user: AuthUser;
  onClick: () => void;
}

// Level tier colour — matches Steam's bronze→gold→legendary progression
function levelColor(level: number): { ring: string; bg: string; text: string; glow: string } {
  if (level >= 20) return { ring: 'ring-amber-300', bg: 'from-amber-300 to-yellow-200', text: 'text-amber-900', glow: 'shadow-amber-400/60' };
  if (level >= 15) return { ring: 'ring-violet-400', bg: 'from-violet-400 to-purple-300', text: 'text-violet-900', glow: 'shadow-violet-400/50' };
  if (level >= 10) return { ring: 'ring-cyan-400', bg: 'from-cyan-400 to-blue-300', text: 'text-cyan-900', glow: 'shadow-cyan-400/40' };
  if (level >= 5)  return { ring: 'ring-emerald-400', bg: 'from-emerald-400 to-green-300', text: 'text-emerald-900', glow: 'shadow-emerald-400/40' };
  return              { ring: 'ring-slate-500', bg: 'from-slate-400 to-slate-300', text: 'text-slate-900', glow: 'shadow-slate-400/30' };
}

export default function ProfileBadge({ user, onClick }: Props) {
  const level = user.level ?? 1;
  const xp = user.xp ?? 0;
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = xpForNextLevel(level);
  const progress = level >= 20 ? 1 : Math.max(0, Math.min(1, (xp - currentThreshold) / (nextThreshold - currentThreshold)));
  const { ring, bg, text, glow } = levelColor(level);

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 px-2 py-1 rounded-xl hover:bg-white/5 transition-colors group"
      title={`Level ${level} · ${xp.toLocaleString()} XP`}
    >
      {/* Avatar with level ring */}
      <div className="relative flex-shrink-0">
        {user.picture ? (
          <img src={user.picture} alt={user.name} className={`w-7 h-7 rounded-full ring-2 ${ring} shadow-sm ${glow}`} />
        ) : (
          <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${bg} ring-2 ${ring} flex items-center justify-center text-xs font-black ${text} shadow-sm ${glow}`}>
            {user.name[0]}
          </div>
        )}
        {/* Level pip */}
        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-br ${bg} ring-1 ring-black flex items-center justify-center shadow-md`}>
          <span className={`text-[8px] font-black leading-none ${text}`}>{level}</span>
        </div>
      </div>

      {/* XP bar */}
      <div className="hidden sm:flex flex-col items-start gap-0.5 min-w-[56px]">
        <span className={`text-xs font-bold leading-none bg-gradient-to-r ${bg} bg-clip-text text-transparent`}>
          Lv.{level}
        </span>
        <div className="w-14 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${bg} transition-all`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </button>
  );
}
