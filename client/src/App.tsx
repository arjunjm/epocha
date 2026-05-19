import { useState } from 'react';
import TimelineForm from './components/TimelineForm';
import Timeline from './components/Timeline';
import Sidebar from './components/Sidebar';
import AuthButton from './components/AuthButton';
import { useAuth } from './hooks/useAuth';
import type { TimelineData, AppStatus } from './types';

export default function App() {
  const { user, loading: authLoading, signIn, signOut, refresh } = useAuth();
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [status, setStatus] = useState<AppStatus>({ loading: false });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | undefined>();

  const handleGenerate = async (topic: string, startYear: string, endYear: string) => {
    if (!user) { signIn(); return; }
    setStatus({ loading: true, message: `Preparing to research "${topic}"…` });
    setTimeline(null);
    setActiveTopic(topic);

    try {
      const response = await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, startYear, endYear }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6)) as {
              type: string;
              message?: string;
              timeline?: TimelineData;
            };
            if (data.type === 'status' && data.message) {
              setStatus({ loading: true, message: data.message });
            } else if (data.type === 'complete' && data.timeline) {
              setTimeline(data.timeline);
              setStatus({ loading: false });
              void refresh(); // update remaining count
            } else if (data.type === 'error' && data.message) {
              throw new Error(data.message);
            }
          } catch {
            // ignore parse errors on individual lines
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setStatus({ loading: false, error: message });
    }
  };

  const handleReset = () => {
    setTimeline(null);
    setActiveTopic(undefined);
    setStatus({ loading: false });
  };

  const isLoading = status.loading;
  const error = !status.loading ? status.error : undefined;

  return (
    <div className="min-h-screen hero-bg">

      {/* Top nav */}
      <header className="fixed top-0 inset-x-0 z-20 border-b border-white/5 backdrop-blur-lg bg-black/20 h-[52px]">
        <div className="h-full px-4 flex items-center justify-between">
          {/* Left: hamburger (mobile) + logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <button onClick={handleReset} className="group">
              <span className="font-cinzel font-bold text-base tracking-[0.15em] text-white group-hover:text-amber-300 transition-colors">
                EPOCHA
              </span>
            </button>
          </div>

          {/* Right: back button + auth */}
          <div className="flex items-center gap-3">
            {(timeline || isLoading) && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-amber-300 transition-colors"
              >
                <span>←</span>
                <span className="hidden sm:inline">New timeline</span>
              </button>
            )}
            <AuthButton
              user={user}
              loading={authLoading}
              onSignIn={signIn}
              onSignOut={signOut}
            />
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar
        onSelect={handleGenerate}
        activeTopic={activeTopic}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content — offset by sidebar on desktop */}
      <main className="pt-[52px] lg:pl-64 min-h-screen">

        {/* Home / Form */}
        {!timeline && !isLoading && (
          <div className="min-h-[calc(100vh-52px)] flex flex-col items-center justify-center px-5 py-16">

            {/* Brand hero */}
            <div className="fade-up text-center mb-12">
              {/* Decorative top rule */}
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-400/60" />
                <span className="text-amber-400/60 text-xs tracking-[0.3em] uppercase font-medium">Est. 2025</span>
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-400/60" />
              </div>

              {/* Main brand name */}
              <h1
                className="font-cinzel font-black text-transparent bg-clip-text leading-none mb-4 select-none"
                style={{
                  fontSize: 'clamp(4rem, 14vw, 9rem)',
                  letterSpacing: '0.18em',
                  backgroundImage: 'linear-gradient(135deg, #d4a843 0%, #f5d78e 35%, #fffaed 55%, #f5d78e 70%, #c49a38 100%)',
                  textShadow: 'none',
                  filter: 'drop-shadow(0 0 40px rgba(212, 168, 67, 0.25))',
                }}
              >
                EPOCHA
              </h1>

              {/* Subtitle */}
              <p className="font-serif italic text-slate-400 text-lg sm:text-xl tracking-wide mb-2">
                Explore the arc of history
              </p>

              {/* Decorative bottom rule */}
              <div className="flex items-center justify-center gap-4 mt-6">
                <div className="h-px w-24 bg-gradient-to-r from-transparent to-white/10" />
                <div className="w-1 h-1 rounded-full bg-amber-400/40" />
                <div className="h-px w-24 bg-gradient-to-l from-transparent to-white/10" />
              </div>
            </div>

            {/* Form / Sign in */}
            <div className="fade-up w-full max-w-lg" style={{ animationDelay: '0.15s' }}>
              {user ? (
                <TimelineForm onSubmit={handleGenerate} />
              ) : (
                <div className="glass rounded-2xl p-8 text-center">
                  <p className="text-slate-400 text-sm mb-5">Sign in to start exploring timelines</p>
                  <button
                    onClick={signIn}
                    className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white text-slate-800 font-semibold text-sm hover:bg-slate-100 transition-colors shadow-lg"
                  >
                    <GoogleIcon />
                    Continue with Google
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="fade-up mt-6 w-full max-w-lg p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
                <strong className="font-semibold">Error:</strong> {error}
              </div>
            )}

            <p className="fade-up mt-8 text-xs text-slate-700 text-center" style={{ animationDelay: '0.25s' }}>
              ← Browse topics in the sidebar
            </p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="min-h-[calc(100vh-52px)] flex flex-col items-center justify-center px-5 fade-up">
            <div className="relative w-20 h-20 mb-8">
              <div className="absolute inset-0 rounded-full border-2 border-amber-500/20" />
              <div className="absolute inset-0 rounded-full border-2 border-t-amber-400 border-r-amber-400/50 border-b-transparent border-l-transparent animate-spin" />
              <div
                className="absolute inset-3 rounded-full border-2 border-t-transparent border-r-transparent border-b-violet-400 border-l-violet-400/50 animate-spin"
                style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">📜</div>
            </div>
            <p className="font-serif text-xl text-white mb-2">Researching…</p>
            <p className="text-slate-400 text-sm max-w-xs text-center mb-6">{status.message}</p>
            <div className="w-48 h-0.5 rounded-full overflow-hidden bg-white/5">
              <div className="h-full shimmer w-full" />
            </div>
            <button onClick={handleReset} className="mt-8 text-xs text-slate-600 hover:text-slate-400 transition-colors underline">
              Cancel
            </button>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="min-h-[calc(100vh-52px)] flex flex-col items-center justify-center px-5">
            <div className="fade-up max-w-md w-full p-6 rounded-2xl border border-red-500/20 bg-red-500/5 text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="font-serif text-xl text-white mb-2">Something went wrong</p>
              <p className="text-red-300/80 text-sm mb-6">{error}</p>
              <button
                onClick={handleReset}
                className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Timeline */}
        {timeline && !isLoading && (
          <div className="max-w-4xl mx-auto px-5 pb-24">
            <Timeline data={timeline} onReset={handleReset} />
          </div>
        )}
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
