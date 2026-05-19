import { useState, useEffect } from 'react';
import TimelineForm from './components/TimelineForm';
import Timeline from './components/Timeline';
import Sidebar from './components/Sidebar';
import AuthButton from './components/AuthButton';
import ProfileBadge from './components/ProfileBadge';
import ProfileModal from './components/ProfileModal';
import Marketplace from './components/Marketplace';
import SavedTimelines from './components/SavedTimelines';
import Discover from './components/Discover';
import Spotlight from './components/Spotlight';
import TimelineSkeleton from './components/TimelineSkeleton';
import Toaster from './components/Toaster';
import SurpriseButton from './components/SurpriseButton';
import Paths from './components/Paths';
import { toast } from './utils/toast';
import { useAuth } from './hooks/useAuth';
import { useHistory } from './hooks/useHistory';
import { useSession, loadSession } from './hooks/useSession';
import { useScrollProgress } from './hooks/useScrollProgress';
import type { TimelineData, AppStatus, AppPage } from './types';

const DEFAULT_PERIOD = { start: '1', end: '2000' };

export default function App() {
  const { user, loading: authLoading, signIn, signOut, refresh } = useAuth();
  const { history, push: pushHistory } = useHistory();
  const { save: saveSession, clear: clearSession } = useSession();
  const [prevLevel, setPrevLevel] = useState(user?.level ?? 1);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [status, setStatus] = useState<AppStatus>({ loading: false });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | undefined>();
  const [page, setPage] = useState<AppPage>('home');
  const [pendingTopic, setPendingTopic] = useState<{ topic: string; start: string; end: string } | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [streamingMeta, setStreamingMeta] = useState<{ topic: string; period: string; description: string } | null>(null);
  const scrollProgress = useScrollProgress(!!(timeline && !status.loading && page === 'home'));

  // Apply theme from user profile
  useEffect(() => {
    const theme = user?.activeTheme ?? localStorage.getItem('epocha-theme') ?? 'midnight';
    applyTheme(theme);
  }, [user?.activeTheme]);

  // Detect level-ups and fire toast
  useEffect(() => {
    if (!user) return;
    if (user.level > prevLevel) {
      const titles = ['', 'Novice', 'Apprentice', 'Scholar', 'Historian', 'Archivist',
        'Chronicler', 'Sage', 'Lorekeeper', 'Antiquarian', 'Curator',
        'Fellow', 'Luminary', 'Savant', 'Polymath', 'Oracle',
        'Virtuoso', 'Mastermind', 'Visionary', 'Grand Historian', 'Epocha Master'];
      toast.levelup(user.level, titles[user.level] ?? 'Epocha Master');
    }
    setPrevLevel(user.level);
  }, [user?.level]); // eslint-disable-line react-hooks/exhaustive-deps

  // On mount: load from URL params, or restore last session if no params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topic = params.get('topic');
    const startYear = params.get('start');
    const endYear = params.get('end');
    if (topic && startYear && endYear) {
      void handleBrowse(topic, startYear, endYear);
      return;
    }
    // No URL params — try to restore last session
    const session = loadSession();
    if (session) {
      setTimeline(session.timeline);
      setActiveTopic(session.topic);
      pushTimelineUrl(session.topic, session.startYear, session.endYear);
      setSessionRestored(true);
      setTimeout(() => setSessionRestored(false), 4000);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyTheme = (themeId: string) => {
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('epocha-theme', themeId);
  };

  // Try to browse (public cached), fall back to generate (requires auth)
  const handleBrowse = async (topic: string, startYear: string, endYear: string) => {
    setStatus({ loading: true, message: `Looking up "${topic}"…` });
    setTimeline(null);
    setActiveTopic(topic);
    setPage('home');

    try {
      const params = new URLSearchParams({ topic, startYear, endYear });
      const res = await fetch(`/api/timeline/browse?${params}`);
      if (res.ok) {
        const data = await res.json() as { cached: boolean; timeline: TimelineData };
        setTimeline(data.timeline);
        setStatus({ loading: false });
        pushTimelineUrl(topic, startYear, endYear);
        pushHistory({ topic, start: startYear, end: endYear, title: data.timeline.topic });
        saveSession(topic, startYear, endYear, data.timeline);
        return;
      }
      // Not cached — need auth to generate
      if (!user) {
        setPendingTopic({ topic, start: startYear, end: endYear });
        setStatus({ loading: false });
        signIn();
        return;
      }
      // Authenticated — generate
      await handleGenerate(topic, startYear, endYear);
    } catch (err) {
      setStatus({ loading: false, error: err instanceof Error ? err.message : 'An error occurred' });
    }
  };

  const handleGenerate = async (topic: string, startYear: string, endYear: string) => {
    if (!user) { setPendingTopic({ topic, start: startYear, end: endYear }); signIn(); return; }
    setStatus({ loading: true, message: `Researching "${topic}"…` });
    setTimeline(null);
    setStreamingMeta(null);
    setActiveTopic(topic);
    setPage('home');

    try {
      const response = await fetch('/api/timeline', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, startYear, endYear }),
      });

      if (!response.ok || !response.body) throw new Error(`Server error: ${response.status}`);

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
            const data = JSON.parse(line.slice(6)) as { type: string; message?: string; timeline?: TimelineData; topic?: string; period?: string; description?: string };
            if (data.type === 'status' && data.message) {
              setStatus({ loading: true, message: data.message });
            } else if (data.type === 'meta' && data.topic) {
              setStreamingMeta({ topic: data.topic, period: data.period ?? '', description: data.description ?? '' });
              setStatus({ loading: true, message: 'Building timeline events…' });
            } else if (data.type === 'complete' && data.timeline) {
              setTimeline(data.timeline);
              setStreamingMeta(null);
              setStatus({ loading: false });
              pushTimelineUrl(topic, startYear, endYear);
              pushHistory({ topic, start: startYear, end: endYear, title: data.timeline.topic });
              saveSession(topic, startYear, endYear, data.timeline);
              toast.xp('+10 XP', 'Timeline generated');
              void refresh();
            } else if (data.type === 'error' && data.message) {
              throw new Error(data.message);
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected token') throw parseErr;
          }
        }
      }
    } catch (err) {
      setStatus({ loading: false, error: err instanceof Error ? err.message : 'An unexpected error occurred' });
    }
  };

  // After sign-in, resume any pending topic
  useEffect(() => {
    if (user && pendingTopic) {
      const { topic, start, end } = pendingTopic;
      setPendingTopic(null);
      void handleGenerate(topic, start, end);
    }
  }, [user]);

  const pushTimelineUrl = (topic: string, startYear: string, endYear: string) => {
    const params = new URLSearchParams({ topic, start: startYear, end: endYear });
    window.history.replaceState(null, '', `?${params}`);
  };

  const handleReset = () => {
    setTimeline(null);
    setStreamingMeta(null);
    setActiveTopic(undefined);
    setStatus({ loading: false });
    clearSession();
    window.history.replaceState(null, '', '/');
  };

  const handleRelatedSelect = (topic: string) => {
    void handleBrowse(topic, DEFAULT_PERIOD.start, DEFAULT_PERIOD.end);
  };

  const isLoading = status.loading;
  const error = !status.loading ? status.error : undefined;

  return (
    <div className="min-h-screen hero-bg">
      <Toaster />

      {/* Scroll progress bar */}
      {scrollProgress > 0 && (
        <div className="fixed top-0 inset-x-0 z-30 h-0.5 bg-transparent print:hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-400 transition-all duration-100"
            style={{ width: `${scrollProgress * 100}%` }}
          />
        </div>
      )}

      {/* Top nav */}
      <header className="fixed top-0 inset-x-0 z-20 border-b border-white/5 backdrop-blur-lg bg-black/20 h-[52px]">
        <div className="h-full px-4 flex items-center justify-between">
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
            <button onClick={() => { handleReset(); setPage('home'); }} className="group">
              <span className="font-cinzel font-bold text-base tracking-[0.15em] text-white group-hover:text-amber-300 transition-colors">
                EPOCHA
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {(timeline || isLoading) && page === 'home' && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-amber-300 transition-colors"
              >
                <span>←</span>
                <span className="hidden sm:inline">New timeline</span>
              </button>
            )}

            {/* Nav links — Discover and Paths are public; others require login */}
            <button
              onClick={() => { setPage('discover'); setTimeline(null); setStatus({ loading: false }); }}
              className={`hidden sm:block text-xs px-2.5 py-1 rounded-lg transition-colors ${page === 'discover' ? 'text-amber-300 bg-amber-500/10' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
            >
              Discover
            </button>
            <button
              onClick={() => { setPage('paths'); setTimeline(null); setStatus({ loading: false }); }}
              className={`hidden sm:block text-xs px-2.5 py-1 rounded-lg transition-colors ${page === 'paths' ? 'text-amber-300 bg-amber-500/10' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
            >
              Paths
            </button>
            {user && (
              <>
                <button
                  onClick={() => { setPage('saved'); setTimeline(null); setStatus({ loading: false }); }}
                  className={`hidden sm:block text-xs px-2.5 py-1 rounded-lg transition-colors ${page === 'saved' ? 'text-amber-300 bg-amber-500/10' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  Library
                </button>
                <button
                  onClick={() => { setPage('marketplace'); setTimeline(null); setStatus({ loading: false }); }}
                  className={`hidden sm:block text-xs px-2.5 py-1 rounded-lg transition-colors ${page === 'marketplace' ? 'text-amber-300 bg-amber-500/10' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  Shop
                </button>
              </>
            )}

            {user ? (
              <ProfileBadge user={user} onClick={() => setShowProfile(true)} />
            ) : null}

            <AuthButton user={user} loading={authLoading} onSignIn={signIn} onSignOut={signOut} />
          </div>
        </div>
      </header>

      {/* Profile modal */}
      {showProfile && user && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onSignOut={() => { setShowProfile(false); void signOut(); }}
          onOpenMarketplace={() => { setShowProfile(false); setPage('marketplace'); setTimeline(null); setStatus({ loading: false }); }}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        onSelect={handleBrowse}
        activeTopic={activeTopic}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onSignIn={signIn}
        history={history}
      />

      {/* Main content */}
      <main className="pt-[52px] lg:pl-64 min-h-screen">

        {/* Discover page — public */}
        {page === 'discover' && (
          <Discover onSelect={(topic, s, e) => { setPage('home'); void handleBrowse(topic, s, e); }} />
        )}

        {/* Learning Paths page — public */}
        {page === 'paths' && (
          <Paths onSelect={(topic, s, e) => { setPage('home'); void handleBrowse(topic, s, e); }} />
        )}

        {/* Marketplace page */}
        {page === 'marketplace' && (
          <Marketplace user={user} onThemeChange={applyTheme} onSignIn={signIn} />
        )}

        {/* Saved timelines page */}
        {page === 'saved' && user && (
          <SavedTimelines onSelect={(topic, s, e) => { setPage('home'); void handleBrowse(topic, s, e); }} />
        )}

        {/* Home page */}
        {page === 'home' && (
          <>
            {/* Form / hero */}
            {!timeline && !isLoading && (
              <div className="min-h-[calc(100vh-52px)] flex flex-col items-center justify-center px-5 py-16">
                <div className="fade-up text-center mb-12">
                  <div className="flex items-center justify-center gap-4 mb-8">
                    <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-400/60" />
                    <span className="text-amber-400/60 text-xs tracking-[0.3em] uppercase font-medium">Est. 2025</span>
                    <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-400/60" />
                  </div>
                  <h1
                    className="font-cinzel font-black text-transparent bg-clip-text leading-none mb-4 select-none"
                    style={{
                      fontSize: 'clamp(4rem, 14vw, 9rem)',
                      letterSpacing: '0.18em',
                      backgroundImage: 'linear-gradient(135deg, #d4a843 0%, #f5d78e 35%, #fffaed 55%, #f5d78e 70%, #c49a38 100%)',
                      filter: 'drop-shadow(0 0 40px rgba(212, 168, 67, 0.25))',
                    }}
                  >
                    EPOCHA
                  </h1>
                  <p className="font-serif italic text-slate-400 text-lg sm:text-xl tracking-wide mb-2">
                    Explore the arc of history
                  </p>
                  <div className="flex items-center justify-center gap-4 mt-6">
                    <div className="h-px w-24 bg-gradient-to-r from-transparent to-white/10" />
                    <div className="w-1 h-1 rounded-full bg-amber-400/40" />
                    <div className="h-px w-24 bg-gradient-to-l from-transparent to-white/10" />
                  </div>
                </div>

                <Spotlight onSelect={(topic, s, e) => void handleBrowse(topic, s, e)} />

                <div className="flex justify-center mb-4 fade-up" style={{ animationDelay: '0.2s' }}>
                  <SurpriseButton onSelect={(topic, s, e) => void handleBrowse(topic, s, e)} />
                </div>

                <div className="fade-up w-full max-w-lg" style={{ animationDelay: '0.15s' }}>
                  <TimelineForm
                onSubmit={handleGenerate}
                remaining={user?.remaining}
                dailyLimit={user?.dailyLimit}
              />
                  {!user && (
                    <p className="text-center text-xs text-slate-600 mt-3">
                      Browse sidebar topics freely ·{' '}
                      <button onClick={signIn} className="text-amber-500/70 hover:text-amber-400 transition-colors">
                        Sign in
                      </button>{' '}
                      to generate custom timelines
                    </p>
                  )}
                </div>

                {error && (
                  <div className="fade-up mt-6 w-full max-w-lg p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
                    <strong className="font-semibold">Error:</strong> {error}
                  </div>
                )}

                <p className="fade-up mt-8 text-xs text-slate-700 text-center" style={{ animationDelay: '0.25s' }}>
                  ← Browse topics in the sidebar — no sign-in required
                </p>
              </div>
            )}

            {/* Streaming skeleton — shows header + skeleton cards while events generate */}
            {isLoading && streamingMeta && (
              <div className="max-w-4xl mx-auto px-5 pb-24">
                <TimelineSkeleton
                  topic={streamingMeta.topic}
                  period={streamingMeta.period}
                  description={streamingMeta.description}
                />
              </div>
            )}

            {/* Full-page spinner — only shown before meta arrives */}
            {isLoading && !streamingMeta && (
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
                {sessionRestored && (
                  <div className="mb-0 pt-4 fade-up flex justify-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-500 text-xs">
                      <span>🕐</span> Restored from your last session
                    </div>
                  </div>
                )}
                <Timeline
                  data={timeline}
                  onReset={handleReset}
                  onRelatedSelect={handleRelatedSelect}
                  user={user}
                  onSignIn={signIn}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
