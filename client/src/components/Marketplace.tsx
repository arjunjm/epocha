import { useState, useEffect } from 'react';
import type { Theme } from '../types';
import type { AuthUser } from '../hooks/useAuth';

interface Props {
  user: AuthUser | null;
  onThemeChange: (themeId: string) => void;
  onSignIn: () => void;
}

const THEME_PREVIEWS: Record<string, { bg: string; dots: string[]; accent: string }> = {
  midnight: {
    bg: 'from-slate-950 to-slate-900',
    dots: ['bg-amber-400', 'bg-violet-400', 'bg-cyan-400', 'bg-emerald-400', 'bg-rose-400'],
    accent: 'text-amber-400',
  },
  sepia: {
    bg: 'from-amber-950 to-stone-900',
    dots: ['bg-amber-600', 'bg-amber-500', 'bg-stone-400', 'bg-amber-700', 'bg-stone-500'],
    accent: 'text-amber-600',
  },
  neon: {
    bg: 'from-slate-950 to-indigo-950',
    dots: ['bg-cyan-400', 'bg-pink-400', 'bg-yellow-300', 'bg-green-400', 'bg-purple-400'],
    accent: 'text-cyan-400',
  },
  ocean: {
    bg: 'from-blue-950 to-cyan-950',
    dots: ['bg-sky-400', 'bg-cyan-400', 'bg-blue-400', 'bg-teal-400', 'bg-indigo-400'],
    accent: 'text-sky-400',
  },
  forest: {
    bg: 'from-green-950 to-emerald-950',
    dots: ['bg-emerald-400', 'bg-green-400', 'bg-teal-400', 'bg-lime-400', 'bg-emerald-300'],
    accent: 'text-emerald-400',
  },
};

export default function Marketplace({ user, onThemeChange, onSignIn }: Props) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [activeTheme, setActiveTheme] = useState(user?.activeTheme ?? 'midnight');

  useEffect(() => { void fetchThemes(); }, [user]);

  const fetchThemes = async () => {
    try {
      const res = await fetch('/api/marketplace/themes', { credentials: 'include' });
      if (res.ok) setThemes(await res.json() as Theme[]);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleUnlock = async (themeId: string) => {
    if (!user) { onSignIn(); return; }
    setUnlocking(themeId);
    try {
      const res = await fetch(`/api/marketplace/unlock/${themeId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setThemes(prev => prev.map(t => t.id === themeId ? { ...t, unlocked: true } : t));
      }
    } catch { /* ignore */ }
    setUnlocking(null);
  };

  const handleActivate = async (themeId: string) => {
    if (!user) { onSignIn(); return; }
    try {
      const res = await fetch('/api/user/theme', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId }),
      });
      if (res.ok) {
        setActiveTheme(themeId);
        onThemeChange(themeId);
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <div className="mb-8">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Marketplace</p>
        <h1 className="font-cinzel font-bold text-white text-2xl tracking-wider">Timeline Themes</h1>
        <p className="text-slate-400 text-sm mt-2">Personalize your timeline experience. All themes are free.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass rounded-2xl h-52 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {themes.map(theme => {
            const preview = THEME_PREVIEWS[theme.id];
            const isActive = activeTheme === theme.id;
            const isOwned = theme.unlocked;

            return (
              <div
                key={theme.id}
                className={`relative rounded-2xl overflow-hidden border transition-all ${
                  isActive ? 'border-amber-400/50 shadow-[0_0_20px_rgba(212,168,67,0.15)]' : 'border-white/8 hover:border-white/15'
                }`}
              >
                {/* Preview */}
                <div className={`h-32 bg-gradient-to-br ${preview?.bg ?? 'from-slate-900 to-slate-800'} p-4 relative`}>
                  {/* Mini timeline preview */}
                  <div className="flex flex-col gap-2 mt-2">
                    {preview?.dots.slice(0, 3).map((dot, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
                        <div className="flex-1 h-1.5 rounded-full bg-white/10" />
                      </div>
                    ))}
                  </div>
                  {isActive && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40">
                      <span className="text-amber-300 text-[10px] font-bold">ACTIVE</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 bg-[#0d1120]">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className={`font-bold text-sm ${preview?.accent ?? 'text-white'}`}>{theme.name}</h3>
                    <span className="text-[10px] text-emerald-400 font-semibold">FREE</span>
                  </div>
                  <p className="text-slate-500 text-xs mb-3">{theme.description}</p>

                  {isOwned ? (
                    <button
                      onClick={() => void handleActivate(theme.id)}
                      disabled={isActive}
                      className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-white/5 text-slate-600 cursor-default'
                          : 'bg-white/8 hover:bg-white/12 text-slate-300'
                      }`}
                    >
                      {isActive ? 'Currently Active' : 'Activate'}
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleUnlock(theme.id)}
                      disabled={unlocking === theme.id}
                      className="w-full py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors disabled:opacity-50"
                    >
                      {unlocking === theme.id ? 'Unlocking…' : 'Unlock Free'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
