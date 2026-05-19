import type { AuthUser } from '../hooks/useAuth';
import { LEVEL_THRESHOLDS, xpForNextLevel } from '../types';

interface Props {
  user: AuthUser;
  onClick: () => void;
}

export default function ProfileBadge({ user, onClick }: Props) {
  const level = user.level ?? 1;
  const xp = user.xp ?? 0;
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = xpForNextLevel(level);
  const progress = level >= 20 ? 1 : Math.max(0, Math.min(1, (xp - currentThreshold) / (nextThreshold - currentThreshold)));

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/5 transition-colors group"
      title={`Level ${level} · ${xp} XP`}
    >
      {/* Avatar */}
      {user.picture ? (
        <img src={user.picture} alt={user.name} className="w-6 h-6 rounded-full ring-1 ring-white/20" />
      ) : (
        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-300">
          {user.name[0]}
        </div>
      )}

      {/* Level badge */}
      <div className="hidden sm:flex flex-col items-start">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-amber-400">Lv.{level}</span>
          <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
        <span className="text-[9px] text-slate-600">{xp} XP</span>
      </div>
    </button>
  );
}
