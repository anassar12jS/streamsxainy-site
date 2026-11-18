import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { SettingsModal } from './components/SettingsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getTheme, getMode, setMode as setStorageMode, themeToRgb } from './services/storage';
import { Film, Loader2 } from 'lucide-react';
import { TMDBResult } from './types';
import { warmIdleRoutes } from './services/routePreloader';

// Retry lazy chunk loads once if a transient network/stale-chunk error occurs
const lazyWithRetry = <T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) =>
  lazy(() =>
    factory().catch(
      () =>
        new Promise<{ default: T }>((resolve, reject) => {
          setTimeout(() => {
            factory().then(resolve).catch(reject);
          }, 250);
        })
    )
  );

// Performance: Code-split routes so initial bundle is ultralight
const Details = lazyWithRetry(() => import('./pages/Details').then(m => ({ default: m.Details })));
const VidyPlayer = lazyWithRetry(() => import('./pages/VidyPlayer').then(m => ({ default: m.VidyPlayer })));
const Library = lazyWithRetry(() => import('./pages/Library').then(m => ({ default: m.Library })));
const Sports = lazyWithRetry(() => import('./pages/Sports').then(m => ({ default: m.Sports })));
const SportsPlayer = lazyWithRetry(() => import('./pages/SportsPlayer').then(m => ({ default: m.SportsPlayer })));
const Discover = lazyWithRetry(() => import('./pages/Discover').then(m => ({ default: m.Discover })));
const Person = lazyWithRetry(() => import('./pages/Person').then(m => ({ default: m.Person })));
const Anime = lazyWithRetry(() => import('./pages/Anime').then(m => ({ default: m.Anime })));
const LiveTV = lazyWithRetry(() => import('./pages/LiveTV').then(m => ({ default: m.LiveTV })));
const MusicModule = lazyWithRetry(() => import('./src/modules/music/MusicModule'));
const Search = lazyWithRetry(() => import('./pages/Search').then(m => ({ default: m.Search })));
const DMCA = lazyWithRetry(() => import('./pages/Legal').then(m => ({ default: m.DMCA })));
const Privacy = lazyWithRetry(() => import('./pages/Legal').then(m => ({ default: m.Privacy })));
const Terms = lazyWithRetry(() => import('./pages/Legal').then(m => ({ default: m.Terms })));
const NotFound = lazyWithRetry(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));
const AppHome = lazyWithRetry(() => import('./pages/AppHome').then(m => ({ default: m.AppHome })));

const PageLoadingFallback = () => (
  <div className="min-h-[70vh] w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
    {/* Hero skeleton */}
    <div className="h-72 sm:h-96 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] animate-pulse mb-10" />
    {/* Row skeletons */}
    {[0, 1, 2].map(row => (
      <div key={row} className="mb-10">
        <div className="h-6 w-48 rounded-lg bg-[var(--bg-card)] animate-pulse mb-5" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    ))}
    <div className="flex items-center justify-center gap-3 pt-4">
      <Loader2 className="w-5 h-5 text-[rgb(var(--primary-color))] animate-spin" />
      <span className="text-xs font-mono font-bold tracking-widest text-[var(--text-muted)] uppercase">
        Loading Stage...
      </span>
    </div>
  </div>
);

const SplashScreen = () => (
    <div className="fixed inset-0 bg-[#09090b] z-[9999] flex flex-col items-center justify-center animate-out fade-out duration-700 delay-500 fill-mode-forwards pointer-events-none">
        <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse"></div>
            <div className="w-24 h-24 bg-gradient-to-br from-[rgb(147,51,234)] to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl z-10 animate-bounce">
                <Film className="h-12 w-12 text-white" />
            </div>
        </div>
        <h1 className="mt-8 text-3xl font-black text-white tracking-tight">StreamHub</h1>
    </div>
);

const ScrollToTop: React.FC = () => {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, search]);
  return null;
};

const App: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [themeColor, setThemeColor] = useState('147, 51, 234'); 
  const [mode, setMode] = useState<'dark' | 'light'>(getMode());
  const [isAppReady, setIsAppReady] = useState(true);
  
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  useEffect(() => {
    const applyStored = () => {
      setThemeColor(themeToRgb(getTheme()));
      setMode(getMode());
    };
    applyStored();
    // Settings modal applies changes live via this event — no reload needed
    window.addEventListener('streamhub:settings-changed', applyStored);
    return () => window.removeEventListener('streamhub:settings-changed', applyStored);
  }, [isSettingsOpen]);

  useEffect(() => {
    // Warm key route chunks when browser is idle for 0ms navigation latency
    warmIdleRoutes();
  }, []);

  const toggleMode = () => {
    const newMode = mode === 'dark' ? 'light' : 'dark';
    setMode(newMode);
    setStorageMode(newMode);
  };

  const handleMediaSelect = (item: TMDBResult) => {
    if (!item || !item.id) return;
    // Pass the item object in state for Optimistic UI
    const state = { item };
    
    if (item.media_type === 'movie') {
        navigate(`/movie/${item.id}`, { state });
    } else if (item.media_type === 'tv') {
      const animeQuery = item.anilist_id ? `?anilistId=${item.anilist_id}` : '';
      navigate(`/tv/${item.id}${animeQuery}`, { state });
    } else if (item.media_type === 'person') {
        navigate(`/person/${item.id}`, { state });
    } else {
        // Fallback if media_type is missing based on properties
        if (item.title && !item.name) navigate(`/movie/${item.id}`, { state });
        else if (item.name && !item.title) navigate(`/tv/${item.id}`, { state });
        else navigate(`/movie/${item.id}`, { state }); // Default safe fallback
    }
  };

  // Check if we are in player or music mode to isolate layout
  const isPlayer = location.hash === '#player' || location.pathname.includes('/watch') || location.pathname.includes('/sports/watch');
  const isMusic = location.pathname.startsWith('/music');
  const isApp = location.pathname.startsWith('/app');
  const hideSiteChrome = isPlayer || isMusic || isApp;

  if (!isAppReady) return <SplashScreen />;

  return (
    <div 
      className={`${isMusic ? 'h-screen h-[100dvh] overflow-hidden' : 'min-h-screen'} bg-[var(--bg-main)] text-[var(--text-main)] font-sans flex flex-col transition-colors duration-300`} 
      style={({ '--primary-color': themeColor } as React.CSSProperties)}
    >
      <ScrollToTop />
      {!hideSiteChrome && (
        <Navbar 
            onOpenSettings={() => setIsSettingsOpen(true)} 
            currentMode={mode}
            onToggleMode={toggleMode}
        />
      )}
      
      <main className={isMusic ? "flex-1 h-full min-h-0 overflow-hidden" : "flex-grow"}>
        <ErrorBoundary resetKey={`${location.pathname}${location.search}`}>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/movie/:id" element={<Details />} />
                <Route path="/tv/:id" element={<Details />} />
                <Route path="/watch/:mediaType/:id/:season?/:episode?" element={<VidyPlayer />} />
                <Route path="/search" element={<Search onSelect={handleMediaSelect} />} />
                <Route path="/discover" element={<Discover onSelect={handleMediaSelect} />} />
                <Route path="/library" element={<Library onSelect={handleMediaSelect} />} />
                <Route path="/sports" element={<Sports />} />
                <Route path="/sports/watch" element={<SportsPlayer />} />
                <Route path="/anime" element={<Anime onSelect={handleMediaSelect} />} />
                <Route path="/livetv" element={<LiveTV />} />
                <Route path="/music/*" element={<MusicModule />} />
                <Route path="/app" element={<AppHome />} />
                <Route path="/app/movie/:id" element={<Details />} />
                <Route path="/app/tv/:id" element={<Details />} />
                <Route path="/app/watch/:mediaType/:id/:season?/:episode?" element={<VidyPlayer />} />
                <Route path="/app/person/:id" element={<Person onSelect={handleMediaSelect} />} />
                <Route path="/person/:id" element={<Person onSelect={handleMediaSelect} />} />
                <Route path="/dmca" element={<DMCA />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      {!hideSiteChrome && <Footer />}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default App;