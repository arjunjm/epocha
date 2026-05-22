import { useState, useEffect, useRef } from 'react';
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
import AdminPage from './components/AdminPage';
import WelcomeModal from './components/WelcomeModal';
import { toast } from './utils/toast';
import { useAuth } from './hooks/useAuth';
import { useHistory } from './hooks/useHistory';
import { useSession, loadSession } from './hooks/useSession';
import { useScrollProgress } from './hooks/useScrollProgress';
import MobileNav from './components/MobileNav';
import FeaturedTimelines from './components/FeaturedTimelines';
import type { TimelineData, AppStatus, AppPage } from './types';
import { TOPIC_TAXONOMY } from './data/topics';

const DEFAULT_PERIOD = { start: '1', end: '2000' };

// One representative topic per category — all valid sidebar entries with correct periods
const QUICK_CHIPS = [
  TOPIC_TAXONOMY[0]!.items[1]!, // The Roman Empire
  TOPIC_TAXONOMY[3]!.items[3]!, // The Cold War
  TOPIC_TAXONOMY[2]!.items[1]!, // The Space Race
  TOPIC_TAXONOMY[4]!.items[0]!, // The Renaissance
  TOPIC_TAXONOMY[7]!.items[3]!, // Napoleonic Wars
  TOPIC_TAXONOMY[1]!.items[2]!, // The Enlightenment
];

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
  const [colorScheme, setColorScheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('epocha-color-scheme') as 'dark' | 'light') ?? 'dark'
  );
  const [streamingEvents, setStreamingEvents] = useState<import('./types').TimelineEvent[]>([]);
  const [timelineWarning, setTimelineWarning] = useState<string | undefined>();
  const [collectionsRefreshKey, setCollectionsRefreshKey] = useState(0);
  const [showWelcome, setShowWelcome] = useState(() => {
    try { return !localStorage.getItem('epocha-welcomed'); } catch { return false; }
  });
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const lastAttemptRef = useRef<(() => void) | null>(null);
  const scrollProgress = useScrollProgress(!!(timeline && !status.loading && page === 'home'));

  // Tick elapsed timer while a generation is in progress (Feature 9)
  useEffect(() => {
    if (!generationStartTime) { setElapsedSeconds(0); return; }
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - generationStartTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [generationStartTime]);

  // Apply color scheme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-color-scheme', colorScheme);
    localStorage.setItem('epocha-color-scheme', colorScheme);
  }, [colorScheme]);

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

  // Browse path — public, no sign-in required, does not count against daily limit
  const handleBrowse = async (topic: string, startYear: string, endYear: string) => {
    setStatus({ loading: true, message: `Looking up "${topic}"…` });
    setTimeline(null);
    setStreamingMeta(null);
    setStreamingEvents([]);
    setTimelineWarning(undefined);
    setActiveTopic(topic);
    setPage('home');

    try {
      // Try cache first (instant, no SSE needed)
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
      // Not in cache — generate publicly (no auth required, no rate limit)
      await handleGeneratePublic(topic, startYear, endYear);
    } catch (err) {
      setStatus({ loading: false, error: err instanceof Error ? err.message : 'An error occurred' });
    }
  };

  // Public generation — sidebar/trending/chips, no auth, no daily limit
  const handleGeneratePublic = async (topic: string, startYear: string, endYear: string) => {
    setStatus({ loading: true, message: `Researching "${topic}"…` });
    setTimeline(null);
    setStreamingMeta(null);
    setStreamingEvents([]);
    setTimelineWarning(undefined);
    setActiveTopic(topic);
    await streamTimeline(topic, startYear, endYear, { publicBrowse: true });
  };

  // Shared SSE streaming logic used by both public browse and authenticated generate
  const streamTimeline = async (topic: string, startYear: string, endYear: string, extra?: Record<string, unknown>) => {
    let streamCompleted = false;
    try {
      const response = await fetch('/api/timeline', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, startYear, endYear, ...extra }),
      });

      if (!response.ok) {
        let message = `Something went wrong (${response.status})`;
        try {
          const body = await response.json() as { error?: string };
          if (body.error) message = body.error;
        } catch { /* use default */ }
        throw new Error(message);
      }
      if (!response.body) throw new Error('No response from server');

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
            const data = JSON.parse(line.slice(6)) as { type: string; message?: string; timeline?: TimelineData; topic?: string; period?: string; description?: string; event?: import('./types').TimelineEvent; warning?: string };
            if (data.type === 'status' && data.message) {
              setStatus({ loading: true, message: data.message });
            } else if (data.type === 'meta' && data.topic) {
              setStreamingMeta({ topic: data.topic, period: data.period ?? '', description: data.description ?? '' });
              setStatus({ loading: true, message: 'Building timeline events…' });
            } else if (data.type === 'event' && data.event) {
              setStreamingEvents(prev => [...prev, data.event!]);
            } else if (data.type === 'complete' && data.timeline) {
              streamCompleted = true;
              setTimeline(data.timeline);
              setStreamingMeta(null);
              setStreamingEvents([]);
              setTimelineWarning(data.warning);
              setStatus({ loading: false });
              pushTimelineUrl(topic, startYear, endYear);
              pushHistory({ topic, start: startYear, end: endYear, title: data.timeline.topic });
              saveSession(topic, startYear, endYear, data.timeline);
              if (!extra?.publicBrowse) { toast.xp('+10 XP', 'Timeline generated'); void refresh(); }
            } else if (data.type === 'error' && data.message) {
              throw new Error(data.message);
            }
          } catch (parseErr) {
            // Re-throw intentional errors; swallow JSON SyntaxErrors from partial lines
            if (!(parseErr instanceof SyntaxError)) throw parseErr;
          }
        }
      }

      // Stream closed without a complete event (connection drop, server restart, etc.)
      if (!streamCompleted) {
        throw new Error('Connection closed before the timeline finished loading. Please try again.');
      }
    } catch (err) {
      setStatus({ loading: false, error: err instanceof Error ? err.message : 'An unexpected error occurred' });
    }
  };

  // Custom generate — requires auth, counts against daily limit
  const handleGenerate = async (topic: string, startYear: string, endYear: string, skipCache = false, liteMode = false) => {
    if (!user) { setPendingTopic({ topic, start: startYear, end: endYear }); signIn(); return; }
    // Feature 8: store retry callback before any async work
    lastAttemptRef.current = () => void handleGenerate(topic, startYear, endYear, skipCache, liteMode);
    setStatus({ loading: true, message: `Looking up "${topic}"…` });
    setTimeline(null);
    // Feature 4: show skeleton immediately with form values; server meta event will override
    setStreamingMeta({ topic, period: `${startYear} – ${endYear}`, description: '' });
    setStreamingEvents([]);
    setTimelineWarning(undefined);
    setActiveTopic(topic);
    setPage('home');
    // Record search immediately so it appears in Recent even if the user navigates away
    pushHistory({ topic, start: startYear, end: endYear, title: topic });
    // Feature 9: start elapsed timer
    setGenerationStartTime(Date.now());

    // Feature 1: pre-flight cache check — instant load if already cached
    if (!skipCache) {
      try {
        const params = new URLSearchParams({ topic, startYear, endYear });
        const res = await fetch(`/api/timeline/browse?${params}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json() as { cached: boolean; timeline: TimelineData };
          setTimeline(data.timeline);
          setStreamingMeta(null);
          setGenerationStartTime(null);
          setStatus({ loading: false });
          pushTimelineUrl(topic, startYear, endYear);
          pushHistory({ topic, start: startYear, end: endYear, title: data.timeline.topic });
          saveSession(topic, startYear, endYear, data.timeline);
          toast.xp('+10 XP', 'Timeline generated'); void refresh();
          return;
        }
      } catch { /* fall through to SSE */ }
    }

    await streamTimeline(topic, startYear, endYear, {
      ...(skipCache && { skipCache: true }),
      ...(liteMode && { liteMode: true }),
    });
    setGenerationStartTime(null);
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
    setStreamingEvents([]);
    setTimelineWarning(undefined);
    setActiveTopic(undefined);
    setStatus({ loading: false });
    setGenerationStartTime(null);
    clearSession();
    window.history.replaceState(null, '', '/');
  };

  // Related topics: authenticated path so cache misses count against daily limit
  const handleRelatedSelect = (topic: string) => {
    void handleGenerate(topic, DEFAULT_PERIOD.start, DEFAULT_PERIOD.end);
  };

  const isLoading = status.loading;
  const error = !status.loading ? status.error : undefined;

  return (
    <div className="min-h-screen hero-bg">
      <Toaster />

      {/* Welcome modal — first-time visitors only */}
      {showWelcome && !authLoading && (
        <WelcomeModal onClose={() => setShowWelcome(false)} />
      )}

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

            {/* Light / dark toggle */}
            <button
              onClick={() => setColorScheme(s => s === 'dark' ? 'light' : 'dark')}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
              title={colorScheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {colorScheme === 'dark' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14A7 7 0 0012 5z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {user ? (
              <ProfileBadge user={user} onClick={() => setShowProfile(true)} />
            ) : null}

            <AuthButton user={user} loading={authLoading} onSignIn={signIn} onSignOut={signOut} onAdmin={() => setPage('admin')} />
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
        onOpenLibrary={() => { setPage('saved'); setTimeline(null); setStatus({ loading: false }); }}
        collectionsRefreshKey={collectionsRefreshKey}
      />

      {/* Main content */}
      <main className="pt-[52px] pb-16 lg:pb-0 lg:pl-72 min-h-screen">

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

        {/* Admin page — admin users only */}
        {page === 'admin' && user?.isAdmin && (
          <AdminPage />
        )}

        {/* Home page */}
        {page === 'home' && (
          <>
            {/* Form / hero */}
            {!timeline && !isLoading && (
              <>
              <div className="min-h-[calc(100vh-52px)] flex flex-col items-center justify-center px-5 py-16">
                <div className="fade-up text-center mb-12">
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
                    Any topic. Any era. Instant history.
                  </p>
                  <p className="text-slate-600 text-sm max-w-md mx-auto leading-relaxed mt-3">
                    From Ancient Rome to the Gaza conflict — type any subject and get a rich, structured timeline in seconds.
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
                onSubmit={(topic, start, end, liteMode) => void handleGenerate(topic, start, end, false, liteMode)}
                remaining={user?.remaining ?? undefined}
                dailyLimit={user?.dailyLimit ?? undefined}
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

                {/* Quick-start chips — drawn from sidebar taxonomy so they always have correct periods */}
                <div className="fade-up mt-6 flex flex-wrap justify-center gap-2 max-w-lg" style={{ animationDelay: '0.25s' }}>
                  {QUICK_CHIPS.map(item => (
                    <button
                      key={item.topic}
                      onClick={() => void handleBrowse(item.topic, item.start, item.end)}
                      className="px-3 py-1 rounded-full text-xs text-slate-500 border border-white/8 hover:border-amber-400/30 hover:text-amber-300 transition-all bg-white/3 hover:bg-amber-400/5"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <p className="fade-up mt-5 text-xs text-slate-700 text-center" style={{ animationDelay: '0.3s' }}>
                  Browse topics in the sidebar · no sign-in required
                </p>
              </div>

              {/* Featured timelines showcase */}
              <FeaturedTimelines onSelect={(topic, s, e) => void handleBrowse(topic, s, e)} />
              </>
            )}

            {/* Progressive timeline — shows real events as they stream in */}
            {isLoading && streamingMeta && streamingEvents.length > 0 && (
              <div className="max-w-4xl mx-auto px-5 pb-24">
                <Timeline
                  data={{ topic: streamingMeta.topic, period: streamingMeta.period, description: streamingMeta.description, events: streamingEvents }}
                  onReset={handleReset}
                  user={user}
                  onSignIn={signIn}
                />
              </div>
            )}

            {/* Skeleton header — shown from submit until first event streams in */}
            {isLoading && streamingMeta && streamingEvents.length === 0 && (
              <div className="max-w-4xl mx-auto px-5 pb-24">
                <TimelineSkeleton
                  topic={streamingMeta.topic}
                  period={streamingMeta.period}
                  description={streamingMeta.description}
                  statusMessage={status.message}
                  elapsedSeconds={elapsedSeconds}
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
                <p className="text-slate-400 text-sm max-w-xs text-center mb-2">{status.message}</p>
                {/* Feature 9: elapsed / estimated remaining */}
                {elapsedSeconds >= 3 && (
                  <p className="text-slate-600 text-xs mb-4">
                    {elapsedSeconds}s elapsed
                    {elapsedSeconds < 45 ? ` · ~${Math.max(5, 45 - elapsedSeconds)}s remaining` : ''}
                  </p>
                )}
                <div className="w-48 h-0.5 rounded-full overflow-hidden bg-white/5 mb-2">
                  <div className="h-full shimmer w-full" />
                </div>
                <button onClick={handleReset} className="mt-6 text-xs text-slate-600 hover:text-slate-400 transition-colors underline">
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
                  <div className="flex items-center justify-center gap-3">
                    {/* Feature 8: retry the exact request that failed */}
                    {lastAttemptRef.current && (
                      <button
                        onClick={() => lastAttemptRef.current?.()}
                        className="px-6 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-sm font-medium transition-colors"
                      >
                        Try again →
                      </button>
                    )}
                    <button
                      onClick={handleReset}
                      className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
                    >
                      New search
                    </button>
                  </div>
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
                  onRelatedSelect={user ? handleRelatedSelect : undefined}
                  onContinue={(topic, start, end) => void handleBrowse(topic, start, end)}
                  onRegenerateSkipCache={user?.isAdmin ? () => void handleGenerate(timeline.topic, timeline.period.split(' to ')[0] ?? '', timeline.period.split(' to ')[1] ?? '', true) : undefined}
                  onUpgradeLite={user && timeline.events.some(e => !e.details) ? () => void handleGenerate(timeline.topic, timeline.period.split(' to ')[0] ?? '', timeline.period.split(' to ')[1] ?? '', true) : undefined}
                  onSaved={() => setCollectionsRefreshKey(k => k + 1)}
                  warning={timelineWarning}
                  user={user}
                  onSignIn={signIn}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Mobile bottom nav */}
      <MobileNav
        page={page}
        user={user}
        onNavigate={(p) => {
          setPage(p);
          setTimeline(null);
          setStatus({ loading: false });
        }}
      />
    </div>
  );
}
