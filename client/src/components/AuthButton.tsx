import type { AuthUser } from '../hooks/useAuth';

interface Props {
  user: AuthUser | null;
  loading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export default function AuthButton({ user, loading, onSignIn, onSignOut }: Props) {
  if (loading) {
    return <div className="w-20 h-7 rounded-full bg-white/5 animate-pulse" />;
  }

  if (!user) {
    return (
      <button
        onClick={onSignIn}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-white text-slate-800 hover:bg-slate-100 transition-colors shadow-sm"
      >
        <GoogleIcon />
        Sign in
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Usage pill */}
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400">
        <span className={user.remaining === 0 ? 'text-red-400' : 'text-amber-400'}>
          {user.remaining}/{user.dailyLimit}
        </span>
        <span>left today</span>
      </div>

      {/* Avatar + dropdown */}
      <div className="relative group">
        <button className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
          {user.picture ? (
            <img src={user.picture} alt={user.name} className="w-6 h-6 rounded-full" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-xs font-bold text-black">
              {user.name[0]}
            </div>
          )}
          <span className="text-xs text-slate-300 hidden sm:inline max-w-[100px] truncate">
            {user.name}
          </span>
        </button>

        {/* Dropdown */}
        <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-[#0d1120] border border-white/10 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
          <div className="px-3 py-2.5 border-b border-white/5">
            <p className="text-xs font-semibold text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
          <div className="px-3 py-2 border-b border-white/5">
            <p className="text-xs text-slate-500">
              {user.dailyCount} of {user.dailyLimit} timelines used today
            </p>
            <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: `${(user.dailyCount / user.dailyLimit) * 100}%` }}
              />
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors rounded-b-xl"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
